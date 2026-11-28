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

function hasDatabaseEnvVars(): boolean {
  return Boolean(
    String(process.env.DB_NAME || '').trim() &&
    String(process.env.DB_USER || '').trim() &&
    String(process.env.DB_PASSWORD || '').trim()
  );
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

export function resetCircuitBreaker(): void {
  circuitOpenUntil = 0;
  consecutiveFailures = 0;
  localLoopbackRefusedInPreview = false;
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
  const missing: string[] = [];
  if (!String(process.env.DB_NAME || '').trim()) missing.push('DB_NAME');
  if (!String(process.env.DB_USER || '').trim()) missing.push('DB_USER');
  if (!String(process.env.DB_PASSWORD || '').trim()) missing.push('DB_PASSWORD');
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

export async function query<T = any>(sql: string, params: any[] = []): Promise<T> {
  if (isCircuitOpen()) {
    throw new Error('Circuit breaker database aktif sementara. Klik "Coba Hubungkan Ulang" atau periksa konfigurasi MySQL.');
  }

  try {
    const p = getDbPool();
    const [rows] = await p.execute(sql, params);
    consecutiveFailures = 0;
    circuitOpenUntil = 0;
    localLoopbackRefusedInPreview = false;
    return rows as T;
  } catch (err: any) {
    handleConnectionFailure(err);
    throw err;
  }
}

export async function testConnection(): Promise<{ success: boolean; configured: boolean; message: string }> {
  if (!hasDatabaseEnvVars()) {
    return {
      success: false,
      configured: false,
      message: 'Database belum dikonfigurasi: DB_NAME, DB_USER, DB_PASSWORD belum diatur di environment variables.'
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
      message: `Connected successfully at ${host}:${port}`
    };
  } catch (err: any) {
    handleConnectionFailure(err);
    return {
      success: false,
      configured: !localLoopbackRefusedInPreview,
      message: `Database connection unavailable: ${err?.message || err}`
    };
  }
}
