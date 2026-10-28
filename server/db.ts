import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

let pool: mysql.Pool | null = null;

export function isDatabaseConfigured(): boolean {
  return Boolean(
    String(process.env.DB_NAME || '').trim() &&
    String(process.env.DB_USER || '').trim() &&
    String(process.env.DB_PASSWORD || '').trim()
  );
}

function assertDatabaseConfig(): void {
  const missing: string[] = [];
  if (!String(process.env.DB_NAME || '').trim()) missing.push('DB_NAME');
  if (!String(process.env.DB_USER || '').trim()) missing.push('DB_USER');
  if (!String(process.env.DB_PASSWORD || '').trim()) missing.push('DB_PASSWORD');
  if (missing.length > 0) {
    throw new Error(`Hostinger MySQL belum dikonfigurasi: ${missing.join(', ')}`);
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
    connectTimeout: 10000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    charset: 'utf8mb4'
  });

  console.log(`✅ [Hostinger MySQL] Pool aktif di ${host}:${port}/${database}`);
  return pool;
}

export async function query<T = any>(sql: string, params: any[] = []): Promise<T> {
  const p = getDbPool();
  const [rows] = await p.execute(sql, params);
  return rows as T;
}

export async function testConnection(): Promise<{ success: boolean; configured: boolean; message: string }> {
  if (!isDatabaseConfigured()) {
    return {
      success: false,
      configured: false,
      message: 'Hostinger MySQL belum dikonfigurasi: DB_NAME, DB_USER, DB_PASSWORD belum diatur di environment variables.'
    };
  }
  try {
    const p = getDbPool();
    const connection = await p.getConnection();
    await connection.ping();
    connection.release();
    const host = process.env.DB_HOST || 'localhost';
    const port = Number(process.env.DB_PORT) || 3306;
    return {
      success: true,
      configured: true,
      message: `Connected successfully to Hostinger MySQL at ${host}:${port}`
    };
  } catch (err: any) {
    return {
      success: false,
      configured: true,
      message: `MySQL Connection failed: ${err?.message || err}`
    };
  }
}
