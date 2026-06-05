import bcrypt from "bcryptjs";
import { execute, query } from "./db.js";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,32}$/;

export function normalizeAudience(audience) {
  if (audience === "seller") return "seller";
  return "buyer";
}

export function mapUserRow(row) {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    audience: normalizeAudience(row.audience),
    supplierId: row.supplier_id || null,
    organizationName: row.organization_name || null,
    city: row.city || null,
    region: row.region || null,
    contactPhone: row.contact_phone || null,
    contactEmail: row.contact_email || null,
    createdAt: row.created_at,
  };
}

const USER_SELECT = `id, username, role, audience, supplier_id, organization_name, city, region, contact_phone, contact_email, created_at`;

export function validateUsername(username) {
  const u = String(username || "").trim();
  if (!USERNAME_RE.test(u)) {
    return "Логин: 3–32 символа, латиница, цифры и _";
  }
  return null;
}

export function validatePassword(password, minLen = 4) {
  const p = String(password || "");
  if (p.length < minLen) {
    return `Пароль: минимум ${minLen} символа`;
  }
  return null;
}

export function validateOrganization(audience, org = {}) {
  const name = String(org.organizationName || "").trim();
  const city = String(org.city || "").trim();

  if (!name) return "Укажите название организации";
  if (name.length < 2) return "Название организации слишком короткое";
  if (!city) return "Укажите город";
  return null;
}

export function validateOrgAccountFields(role, audience, org = {}) {
  if (role === "admin") return null;
  const orgErr = validateOrganization(audience, org);
  if (orgErr) return orgErr;
  if (!String(org.contactPhone || "").trim()) return "Укажите телефон";
  return null;
}

export async function getUserById(id) {
  const rows = await query(`SELECT ${USER_SELECT} FROM users WHERE id = ?`, [id]);
  return rows.length ? mapUserRow(rows[0]) : null;
}

export async function getUserByUsername(username) {
  const rows = await query(
    `SELECT id, username, password_hash, role, audience, supplier_id, organization_name, city, region, contact_phone, contact_email, created_at FROM users WHERE username = ?`,
    [username]
  );
  return rows[0] || null;
}

export async function listUsers() {
  const rows = await query(`SELECT ${USER_SELECT} FROM users ORDER BY username`);
  return rows.map(mapUserRow);
}

export async function createUser({
  username,
  password,
  role = "user",
  audience = "buyer",
  organizationName = null,
  city = null,
  region = null,
  contactPhone = null,
  contactEmail = null,
}) {
  const nameErr = validateUsername(username);
  if (nameErr) throw new Error(nameErr);
  const passErr = validatePassword(password);
  if (passErr) throw new Error(passErr);
  if (!["user", "admin"].includes(role)) {
    throw new Error("Роль: user или admin");
  }

  const accountAudience = normalizeAudience(audience);
  const orgErr = validateOrgAccountFields(role, accountAudience, {
    organizationName,
    city,
    region,
    contactPhone,
  });
  if (orgErr) throw new Error(orgErr);

  const existing = await getUserByUsername(username.trim());
  if (existing) throw new Error("Пользователь с таким логином уже существует");

  const orgName =
    role === "admin" ? String(organizationName || "").trim() || null : String(organizationName || "").trim();
  const orgCity = role === "admin" ? String(city || "").trim() || null : String(city || "").trim();
  const orgRegion = orgCity;
  const phone = String(contactPhone || "").trim() || null;
  const email = String(contactEmail || "").trim() || null;

  const hash = await bcrypt.hash(password, 10);
  const result = await execute(
    `INSERT INTO users (username, password_hash, role, audience, organization_name, city, region, contact_phone, contact_email)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [username.trim(), hash, role, accountAudience, orgName, orgCity, orgRegion, phone, email]
  );
  const insertId = result?.insertId;
  if (!insertId) {
    throw new Error("Не удалось создать пользователя в БД");
  }
  return getUserById(insertId);
}

export async function updateUser(
  id,
  {
    username,
    password,
    role,
    audience,
    organizationName,
    city,
    region,
    contactPhone,
    contactEmail,
  } = {}
) {
  const user = await getUserById(id);
  if (!user) throw new Error("Пользователь не найден");

  const nextRole = role !== undefined ? role : user.role;
  const nextAudience = audience !== undefined ? normalizeAudience(audience) : user.audience;
  const nextOrg = {
    organizationName:
      organizationName !== undefined ? organizationName : user.organizationName,
    city: city !== undefined ? city : user.city,
    region: region !== undefined ? region : user.region,
    contactPhone: contactPhone !== undefined ? contactPhone : user.contactPhone,
  };

  if (
    organizationName !== undefined ||
    city !== undefined ||
    region !== undefined ||
    contactPhone !== undefined ||
    role !== undefined ||
    audience !== undefined
  ) {
    const orgErr = validateOrgAccountFields(nextRole, nextAudience, nextOrg);
    if (orgErr) throw new Error(orgErr);
  }

  const fields = [];
  const params = [];

  if (username !== undefined && username !== user.username) {
    const nameErr = validateUsername(username);
    if (nameErr) throw new Error(nameErr);
    const taken = await getUserByUsername(username.trim());
    if (taken && taken.id !== Number(id)) {
      throw new Error("Логин уже занят");
    }
    fields.push("username = ?");
    params.push(username.trim());
  }

  if (role !== undefined) {
    if (!["user", "admin"].includes(role)) {
      throw new Error("Роль: user или admin");
    }
    fields.push("role = ?");
    params.push(role);
  }

  if (audience !== undefined) {
    fields.push("audience = ?");
    params.push(nextAudience);
  }

  if (organizationName !== undefined) {
    fields.push("organization_name = ?");
    params.push(String(organizationName || "").trim() || null);
  }
  if (city !== undefined) {
    fields.push("city = ?");
    params.push(String(city || "").trim() || null);
  }
  if (region !== undefined || city !== undefined) {
    const nextCity = city !== undefined ? String(city || "").trim() || null : user.city;
    fields.push("region = ?");
    params.push(nextCity);
  }
  if (contactPhone !== undefined) {
    fields.push("contact_phone = ?");
    params.push(String(contactPhone || "").trim() || null);
  }
  if (contactEmail !== undefined) {
    fields.push("contact_email = ?");
    params.push(String(contactEmail || "").trim() || null);
  }

  if (password && String(password).length > 0) {
    const passErr = validatePassword(password);
    if (passErr) throw new Error(passErr);
    fields.push("password_hash = ?");
    params.push(await bcrypt.hash(password, 10));
  }

  if (!fields.length) return user;

  params.push(id);
  await query(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, params);
  return getUserById(id);
}

export async function deleteUser(id, currentUserId) {
  const user = await getUserById(id);
  if (!user) throw new Error("Пользователь не найден");
  if (Number(id) === Number(currentUserId)) {
    throw new Error("Нельзя удалить свою учётную запись");
  }
  await query("DELETE FROM users WHERE id = ?", [id]);
  return true;
}
