import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "foodsource",
  waitForConnections: true,
  connectionLimit: 10,
  charset: "utf8mb4_unicode_ci",
  typeCast(field, next) {
    if (field.type === "VAR_STRING" || field.type === "STRING" || field.type === "BLOB") {
      const val = field.string();
      return val === null ? null : val;
    }
    return next();
  },
});

pool.on("connection", (conn) => {
  conn.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
});

export async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/** Для INSERT/UPDATE/DELETE — возвращает OkPacket с insertId */
export async function execute(sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return result;
}

export async function getConnection() {
  const conn = await pool.getConnection();
  await conn.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
  return conn;
}

export async function ping() {
  await query("SELECT 1");
}

export default pool;
