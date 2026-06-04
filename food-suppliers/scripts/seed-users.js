import "dotenv/config";
import bcrypt from "bcryptjs";
import { query } from "../server/db.js";

const users = [
  { username: "admin1", password: "admin2", role: "admin" },
  { username: "user1", password: "user2", role: "user" },
];

for (const u of users) {
  const hash = await bcrypt.hash(u.password, 10);
  await query(
    `INSERT INTO users (username, password_hash, role)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = VALUES(role)`,
    [u.username, hash, u.role]
  );
  console.log(`Пользователь ${u.username} (${u.role})`);
}

console.log("Готово.");
