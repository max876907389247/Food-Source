import "dotenv/config";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";
const DEMO_PASSWORD = "demo";

const config = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "foodsource",
  password: process.env.DB_PASSWORD || "foodsource",
  database: process.env.DB_NAME || "foodsource",
  multipleStatements: true,
};

function sellerUsername(supplierId) {
  return `s_${supplierId.replace(/-/g, "_")}`.slice(0, 32);
}

function buyerUsername(demandId) {
  return `b_${demandId}`;
}

async function upsertUser(conn, hash, row) {
  await conn.query(
    `INSERT INTO users (username, password_hash, role, audience, supplier_id, organization_name, city, region, contact_phone, contact_email)
     VALUES (?, ?, 'user', ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       password_hash = VALUES(password_hash),
       audience = VALUES(audience),
       supplier_id = VALUES(supplier_id),
       organization_name = VALUES(organization_name),
       city = VALUES(city),
       region = VALUES(region),
       contact_phone = VALUES(contact_phone),
       contact_email = VALUES(contact_email)`,
    [
      row.username,
      hash,
      row.audience,
      row.supplierId,
      row.organizationName,
      row.city,
      row.region,
      row.contactPhone,
      row.contactEmail,
    ]
  );
  const [[u]] = await conn.query("SELECT id FROM users WHERE username = ?", [row.username]);
  return u.id;
}

async function run() {
  const conn = await mysql.createConnection(config);
  console.log("Демо-аккаунты поставщиков и покупателей…");

  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const [suppliers] = await conn.query(
    "SELECT id, name, city, phone, email FROM suppliers ORDER BY id"
  );

  for (const s of suppliers) {
    const username = sellerUsername(s.id);
    await upsertUser(conn, hash, {
      username,
      audience: "seller",
      supplierId: s.id,
      organizationName: s.name,
      city: s.city,
      region: s.city,
      contactPhone: s.phone,
      contactEmail: s.email,
    });
    console.log(`  поставщик ${s.name}: ${username} / ${DEMO_PASSWORD}`);
  }

  const [demands] = await conn.query(
    "SELECT id, company_name, city, region, contact_phone, contact_email FROM buyer_demands ORDER BY id"
  );

  for (const d of demands) {
    const username = buyerUsername(d.id);
    const userId = await upsertUser(conn, hash, {
      username,
      audience: "buyer",
      supplierId: null,
      organizationName: d.company_name,
      city: d.city,
      region: d.region,
      contactPhone: d.contact_phone,
      contactEmail: d.contact_email,
    });
    await conn.query("UPDATE buyer_demands SET user_id = ? WHERE id = ?", [userId, d.id]);
    console.log(`  покупатель ${d.company_name}: ${username} / ${DEMO_PASSWORD}`);
  }

  console.log(`\nГотово. Пароль для всех: ${DEMO_PASSWORD}`);
  await conn.end();
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
