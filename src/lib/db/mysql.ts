if (typeof window !== 'undefined') {
  throw new Error('Security Error: Database clients cannot be loaded in the browser');
}

import mysql, { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';

// Global declaration to maintain pool singleton across HMR in development
declare global {
  // eslint-disable-next-line no-var
  var __mysqlPool: Pool | undefined;
}

function getPoolConfig(): mysql.PoolOptions {
  const host = process.env.MYSQL_HOST || 'localhost';
  const port = parseInt(process.env.MYSQL_PORT || '3306', 10);
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  const database = process.env.MYSQL_DATABASE || 'smart_hostel_db';
  const connectionLimit = parseInt(process.env.MYSQL_CONNECTION_LIMIT || '10', 10);

  if (!password && process.env.NODE_ENV === 'production') {
    throw new Error('Database Error: MYSQL_PASSWORD environment variable is missing.');
  }

  return {
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    decimalNumbers: true,
  };
}

/**
 * Returns the shared MySQL connection pool singleton.
 */
export function getMySQLPool(): Pool {
  if (process.env.NODE_ENV === 'production') {
    return mysql.createPool(getPoolConfig());
  }

  if (!global.__mysqlPool) {
    global.__mysqlPool = mysql.createPool(getPoolConfig());
  }
  return global.__mysqlPool;
}

export const pool = getMySQLPool();

/**
 * Executes a parameterized SQL query using the connection pool.
 * @param sql SQL statement with placeholder (?) markers
 * @param params Parameter array
 */
export async function query<T extends RowDataPacket[] | ResultSetHeader>(
  sql: string,
  params: any[] = []
): Promise<T> {
  const [result] = await pool.execute<T>(sql, params);
  return result;
}

/**
 * Executes an atomic database transaction callback.
 * Automatically handles COMMIT on success and ROLLBACK on error.
 */
export async function withTransaction<T>(
  callback: (connection: PoolConnection) => Promise<T>
): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Verifies the database connection and returns server version.
 */
export async function verifyMySQLConnection(): Promise<{ ok: boolean; version?: string; error?: string }> {
  try {
    const rows = await query<RowDataPacket[]>('SELECT VERSION() AS version');
    const version = rows[0]?.version as string;
    return { ok: true, version };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('MySQL Connection Error:', message);
    return { ok: false, error: message };
  }
}
