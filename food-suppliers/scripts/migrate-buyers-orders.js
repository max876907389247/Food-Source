import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "foodsource",
  password: process.env.DB_PASSWORD || "foodsource",
  database: process.env.DB_NAME || "foodsource",
  multipleStatements: true,
};

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [config.database, table, column]
  );
  return rows.length > 0;
}

async function tableExists(conn, table) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [config.database, table]
  );
  return rows.length > 0;
}

async function run() {
  const conn = await mysql.createConnection(config);
  console.log("Миграция: заказы, заявки, тип аккаунта…");

  if (!(await columnExists(conn, "users", "audience"))) {
    await conn.query(
      "ALTER TABLE users ADD COLUMN audience ENUM('buyer', 'seller', 'viewer') NOT NULL DEFAULT 'buyer' AFTER role"
    );
    console.log("  + users.audience");
  } else {
    await conn.query(
      "ALTER TABLE users MODIFY COLUMN audience ENUM('buyer', 'seller', 'viewer') NOT NULL DEFAULT 'buyer'"
    );
    console.log("  ~ users.audience (viewer)");
  }

  const orgCols = [
    ["organization_name", "VARCHAR(200) NULL"],
    ["city", "VARCHAR(120) NULL"],
    ["region", "VARCHAR(120) NULL"],
    ["contact_phone", "VARCHAR(40) NULL"],
    ["contact_email", "VARCHAR(120) NULL"],
  ];
  for (const [col, def] of orgCols) {
    if (!(await columnExists(conn, "users", col))) {
      await conn.query(`ALTER TABLE users ADD COLUMN ${col} ${def}`);
      console.log(`  + users.${col}`);
    }
  }

  if (!(await columnExists(conn, "products", "price_per_unit"))) {
    await conn.query(
      "ALTER TABLE products ADD COLUMN price_per_unit DECIMAL(10, 2) NULL AFTER price_hint"
    );
    console.log("  + products.price_per_unit");
  }

  if (!(await columnExists(conn, "suppliers", "working_hours"))) {
    await conn.query(
      "ALTER TABLE suppliers ADD COLUMN working_hours VARCHAR(40) NOT NULL DEFAULT '08:00–21:00 (МСК)' AFTER response_time"
    );
    console.log("  + suppliers.working_hours");
  }

  if (!(await tableExists(conn, "buyer_demands"))) {
    await conn.query(`
      CREATE TABLE buyer_demands (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_name VARCHAR(200) NOT NULL,
        city VARCHAR(120) NOT NULL,
        region VARCHAR(120) NOT NULL,
        business_type VARCHAR(120) NOT NULL,
        category_id VARCHAR(32) NULL,
        volume_text VARCHAR(120) NOT NULL,
        volume_kg INT UNSIGNED NULL,
        budget_text VARCHAR(120) NULL,
        description TEXT NOT NULL,
        contact_phone VARCHAR(40) NOT NULL,
        contact_email VARCHAR(120) NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("  + таблица buyer_demands");
  }

  if (!(await tableExists(conn, "orders"))) {
    await conn.query(`
      CREATE TABLE orders (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id INT UNSIGNED NOT NULL,
        supplier_id VARCHAR(64) NOT NULL,
        status ENUM('pending', 'confirmed', 'cancelled') NOT NULL DEFAULT 'pending',
        total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
        note TEXT NULL,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
        INDEX idx_orders_user (user_id),
        INDEX idx_orders_supplier (supplier_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("  + таблица orders");
  }

  if (!(await tableExists(conn, "order_items"))) {
    await conn.query(`
      CREATE TABLE order_items (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        order_id INT UNSIGNED NOT NULL,
        product_id INT UNSIGNED NULL,
        product_name VARCHAR(200) NOT NULL,
        unit VARCHAR(40) NOT NULL DEFAULT 'шт.',
        quantity DECIMAL(10, 2) NOT NULL,
        unit_price DECIMAL(10, 2) NOT NULL,
        line_total DECIMAL(12, 2) NOT NULL,
        PRIMARY KEY (id),
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("  + таблица order_items");
  }

  const sqlPath = path.join(__dirname, "../sql/data-updates.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("USE ") && !s.startsWith("SET NAMES"));

  for (const stmt of statements) {
    if (stmt) await conn.query(stmt);
  }
  console.log("  цены и демо-заявки покупателей обновлены");

  const [[{ c }]] = await conn.query("SELECT COUNT(*) AS c FROM buyer_demands");
  console.log(`Готово. Заявок покупателей в БД: ${c}`);
  await conn.end();
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
