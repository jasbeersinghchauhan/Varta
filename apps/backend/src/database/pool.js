import mysql from "mysql2/promise";

const requiredEnv = ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME"];

for (const key of requiredEnv) {
  const value = process.env[key];
  if (!value || value.trim().length === 0)
    throw new Error(`Missing Environment element: ${key}`);
}

const port = Number(process.env.DB_PORT);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("Database Port must be a valid number");
}

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    minVersion: "TLSv1.2",
    rejectUnauthorized: false,
  },
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 100,
  connectTimeout: 10000,
});

export async function initializeDatabase() {
  await pool.query("SELECT 1");
}

export async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}