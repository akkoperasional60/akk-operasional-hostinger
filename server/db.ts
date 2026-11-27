import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

let pool: mysql.Pool | null = null;
let circuitOpenUntil = 0;
let consecutiveFailures = 0;
let localLoopbackRefusedInPreview = false;
const CIRCUIT_BREAKER_COOLDOWN_MS = 20000;

function isPreviewOrCloudRun(): boolean {
  return Boolean(process.env.K_SERVICE) || process.env.NODE_ENV !== 'production';
}

function isLoopbackDbHost(): boolean {
  const host = String(process.env.DB_HOST || 'localhost').trim().toLowerCase();
  return !host || host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function getMissingDatabaseEnvVars(): string[] {
  const missing: string[] = [];
  if (!String(process.env.DB_NAME || '').trim()) missing.push('DB_NAME');
  if (!String(process.env.DB_USER || '').trim()) missing.push('DB_USER');
  if (!String(process.env.DB_PASSWORD || '').trim()) missing.push('DB_PASSWORD');
  return missing;
}

function hasDatabaseEnvVars(): boolean {
  return getMissingDatabaseEnvVars().length === 0;
}

export function isDatabaseConfigured(): boolean {
  if (localLoopbackRefusedInPreview && isPreviewOrCloudRun()) {
    return false;
  }
  return hasDatabaseEnvVars();
}

export function isCircuitOpen(): boolean {
  return Date.now() < circuitOpenUntil;
}

export interface CircuitBreakerStatus {
  isOpen: boolean;
  remainingSeconds: number;
  consecutiveFailures: number;
  localLoopbackRefusedInPreview: boolean;
  configured: boolean;
  missingEnvVars: string[];
  host: string;
  port: number;
  database: string;
}

export function getCircuitBreakerStatus(): CircuitBreakerStatus {
  const remainingMs = Math.max(0, circuitOpenUntil - Date.now());
  const missingEnvVars = getMissingDatabaseEnvVars();
  return {
    isOpen: remainingMs > 0,
    remainingSeconds: Math.ceil(remainingMs / 1000),
    consecutiveFailures,
    localLoopbackRefusedInPreview,
    configured: isDatabaseConfigured(),
    missingEnvVars,
    host: String(process.env.DB_HOST || 'localhost').trim() || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    database: String(process.env.DB_NAME || '').trim()
  };
}

export async function resetCircuitBreaker(resetPool: boolean = false): Promise<void> {
  circuitOpenUntil = 0;
  consecutiveFailures = 0;
  localLoopbackRefusedInPreview = false;
  if (resetPool && pool) {
    const oldPool = pool;
    pool = null;
    try {
      await oldPool.end();
    } catch {
      // ignore pool shutdown errors
    }
  }
}

function handleConnectionFailure(err: any): void {
  consecutiveFailures++;
  const errCode = String(err?.code || '');
  const errMsg = String(err?.message || '');
  const isConnErr =
    errCode === 'ECONNREFUSED' ||
    errCode === 'ETIMEDOUT' ||
    errCode === 'ENOTFOUND' ||
    errCode === 'EHOSTUNREACH' ||
    errMsg.includes('ECONNREFUSED') ||
    errMsg.includes('connect');

  if (isConnErr && isPreviewOrCloudRun() && isLoopbackDbHost()) {
    localLoopbackRefusedInPreview = true;
    circuitOpenUntil = Date.now() + 24 * 60 * 60 * 1000;
    return;
  }

  if (isConnErr || consecutiveFailures >= 2) {
    circuitOpenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
    if (!isPreviewOrCloudRun()) {
      console.warn(
        `[Database] Koneksi terganggu (${errMsg || errCode}). Cooldown aktif ${CIRCUIT_BREAKER_COOLDOWN_MS / 1000}s.`
      );
    }
  }
}

function assertDatabaseConfig(): void {
  const missing = getMissingDatabaseEnvVars();
  if (missing.length > 0) {
    throw new Error(`Database belum dikonfigurasi: ${missing.join(', ')}`);
  }
}

export function getDbPool(): mysql.Pool {
  if (pool) return pool;
  assertDatabaseConfig();

  const host = process.env.DB_HOST || 'localhost';
  const port = Number(process.env.DB_PORT) || 3306;
  const database = String(process.env.DB_NAME || '').trim();
  const user = String(process.env.DB_USER || '').trim();
  const password = String(process.env.DB_PASSWORD || '').trim();

  pool = mysql.createPool({
    host,
    port,
    database,
    user,
    password,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 2500,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    charset: 'utf8mb4'
  });

  return pool;
}

const DEFAULT_QUERY_TIMEOUT_MS = 8500;

export async function query<T = any>(sql: string, params: any[] = [], timeoutMs: number = DEFAULT_QUERY_TIMEOUT_MS): Promise<T> {
  if (isCircuitOpen()) {
    throw new Error('Database circuit breaker active (using instant local cache)');
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const p = getDbPool();
    const execPromise = p.execute(sql, params);
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`MySQL query timeout after ${timeoutMs}ms`));
      }, Math.max(1500, timeoutMs));
    });
    const [rows] = (await Promise.race([execPromise, timeoutPromise])) as [any, any];
    consecutiveFailures = 0;
    circuitOpenUntil = 0;
    localLoopbackRefusedInPreview = false;
    return rows as T;
  } catch (err: any) {
    handleConnectionFailure(err);
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function testConnection(): Promise<{
  success: boolean;
  configured: boolean;
  circuitOpen: boolean;
  remainingSeconds: number;
  missingEnvVars: string[];
  message: string;
}> {
  const missingEnvVars = getMissingDatabaseEnvVars();
  if (missingEnvVars.length > 0) {
    return {
      success: false,
      configured: false,
      circuitOpen: isCircuitOpen(),
      remainingSeconds: getCircuitBreakerStatus().remainingSeconds,
      missingEnvVars,
      message: `Database belum dikonfigurasi: ${missingEnvVars.join(', ')} belum diatur di environment variables.`
    };
  }
  try {
    const p = getDbPool();
    const connection = await p.getConnection();
    await connection.ping();
    connection.release();
    consecutiveFailures = 0;
    circuitOpenUntil = 0;
    localLoopbackRefusedInPreview = false;
    const host = process.env.DB_HOST || 'localhost';
    const port = Number(process.env.DB_PORT) || 3306;
    return {
      success: true,
      configured: true,
      circuitOpen: false,
      remainingSeconds: 0,
      missingEnvVars: [],
      message: `Terhubung ke MySQL pada ${host}:${port}`
    };
  } catch (err: any) {
    handleConnectionFailure(err);
    const status = getCircuitBreakerStatus();
    return {
      success: false,
      configured: !localLoopbackRefusedInPreview,
      circuitOpen: status.isOpen,
      remainingSeconds: status.remainingSeconds,
      missingEnvVars,
      message: `Koneksi database belum tersedia: ${err?.message || err}`
    };
  }
}
