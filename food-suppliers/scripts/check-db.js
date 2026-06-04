import "dotenv/config";
import mysql from "mysql2/promise";

const config = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "foodsource",
  password: process.env.DB_PASSWORD || "foodsource",
  database: process.env.DB_NAME || "foodsource",
};

try {
  const conn = await mysql.createConnection(config);
  const [rows] = await conn.query("SELECT COUNT(*) AS n FROM suppliers");
  await conn.end();
  console.log("OK:", config.host, config.port, config.database);
  console.log("Поставщиков в БД:", rows[0].n);
} catch (err) {
  console.error("Ошибка:", err.message);
  if (err.code === "ECONNREFUSED") {
    console.error("\n→ MySQL не запущена. Выполните: npm run db:up");
  } else if (err.code === "ER_ACCESS_DENIED_ERROR") {
    console.error("\n→ Неверный логин/пароль в .env");
  } else if (err.code === "ER_BAD_DB_ERROR") {
    console.error("\n→ База не создана. Запустите: npm run db:up");
  }
  process.exit(1);
}
