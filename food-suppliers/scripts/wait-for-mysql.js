import "dotenv/config";
import mysql from "mysql2/promise";

const maxAttempts = 30;
const delayMs = 2000;

const config = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "foodsource",
  password: process.env.DB_PASSWORD || "foodsource",
  database: process.env.DB_NAME || "foodsource",
};

async function tryConnect() {
  const conn = await mysql.createConnection(config);
  await conn.query("SELECT 1");
  await conn.end();
}

console.log(
  `Ожидание MySQL на ${config.host}:${config.port} (пользователь: ${config.user})…`
);

for (let i = 1; i <= maxAttempts; i++) {
  try {
    await tryConnect();
    console.log("MySQL готова.");
    process.exit(0);
  } catch (err) {
    if (i === maxAttempts) {
      console.error("\nНе удалось подключиться к MySQL.");
      console.error(err.message);
      console.error("\nЧто сделать:");
      console.error("  1) Docker:  npm run db:up");
      console.error("  2) Подождите 20–40 сек и снова: npm run db:wait");
      console.error("  3) Проверьте .env (см. .env.example)");
      process.exit(1);
    }
    process.stdout.write(`  попытка ${i}/${maxAttempts}…\r`);
    await new Promise((r) => setTimeout(r, delayMs));
  }
}
