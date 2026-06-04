import { execute, query } from "./db.js";

export function mapDemandRow(row) {
  return {
    id: row.id,
    companyName: row.company_name,
    city: row.city,
    region: row.region,
    businessType: row.business_type,
    categoryId: row.category_id,
    categoryLabel: row.category_label || null,
    volumeText: row.volume_text,
    volumeKg: row.volume_kg,
    budgetText: row.budget_text,
    description: row.description,
    contacts: {
      phone: row.contact_phone,
      email: row.contact_email,
    },
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
  };
}

const DEMAND_SELECT = `
  SELECT b.*, c.label AS category_label
  FROM buyer_demands b
  LEFT JOIN categories c ON c.id = b.category_id`;

function validateDemandBody(body) {
  const companyName = String(body?.companyName || "").trim();
  const city = String(body?.city || "").trim();
  const region = String(body?.region || "").trim();
  const businessType = String(body?.businessType || "").trim();
  const volumeText = String(body?.volumeText || "").trim();
  const description = String(body?.description || "").trim();
  const phone = String(body?.contactPhone || body?.phone || "").trim();
  const email = String(body?.contactEmail || body?.email || "").trim();

  if (!companyName) throw new Error("Укажите название компании");
  if (!city) throw new Error("Укажите город");
  if (!region) throw new Error("Укажите регион");
  if (!businessType) throw new Error("Укажите тип бизнеса");
  if (!volumeText) throw new Error("Укажите объём закупки");
  if (!description) throw new Error("Опишите запрос");
  if (!phone) throw new Error("Укажите телефон");
  if (!email) throw new Error("Укажите email");

  let volumeKg = null;
  if (body?.volumeKg != null && body.volumeKg !== "") {
    volumeKg = Number(body.volumeKg);
    if (Number.isNaN(volumeKg) || volumeKg < 0) throw new Error("Некорректный объём в кг");
  }

  return {
    companyName,
    city,
    region,
    businessType,
    categoryId: body?.categoryId ? String(body.categoryId).trim() : null,
    volumeText,
    volumeKg,
    budgetText: String(body?.budgetText || "").trim() || null,
    description,
    contactPhone: phone,
    contactEmail: email,
  };
}

export async function listDemandsForUser(userId) {
  const rows = await query(
    `${DEMAND_SELECT} WHERE b.user_id = ? ORDER BY b.created_at DESC`,
    [userId]
  );
  return rows.map(mapDemandRow);
}

export async function getDemandForUser(userId, demandId) {
  const rows = await query(
    `${DEMAND_SELECT} WHERE b.user_id = ? AND b.id = ?`,
    [userId, demandId]
  );
  return rows.length ? mapDemandRow(rows[0]) : null;
}

export async function createDemandForUser(userId, body) {
  const data = validateDemandBody(body);
  const result = await execute(
    `INSERT INTO buyer_demands (
      user_id, company_name, city, region, business_type, category_id,
      volume_text, volume_kg, budget_text, description, contact_phone, contact_email, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      userId,
      data.companyName,
      data.city,
      data.region,
      data.businessType,
      data.categoryId,
      data.volumeText,
      data.volumeKg,
      data.budgetText,
      data.description,
      data.contactPhone,
      data.contactEmail,
    ]
  );
  const rows = await query(`${DEMAND_SELECT} WHERE b.id = ?`, [result.insertId]);
  return mapDemandRow(rows[0]);
}

export async function updateDemandForUser(userId, demandId, body) {
  const existing = await getDemandForUser(userId, demandId);
  if (!existing) throw new Error("Запрос не найден");
  const data = validateDemandBody(body);
  await query(
    `UPDATE buyer_demands SET
      company_name = ?, city = ?, region = ?, business_type = ?, category_id = ?,
      volume_text = ?, volume_kg = ?, budget_text = ?, description = ?,
      contact_phone = ?, contact_email = ?
     WHERE id = ? AND user_id = ?`,
    [
      data.companyName,
      data.city,
      data.region,
      data.businessType,
      data.categoryId,
      data.volumeText,
      data.volumeKg,
      data.budgetText,
      data.description,
      data.contactPhone,
      data.contactEmail,
      demandId,
      userId,
    ]
  );
  return getDemandForUser(userId, demandId);
}

export async function deactivateDemandForUser(userId, demandId) {
  const existing = await getDemandForUser(userId, demandId);
  if (!existing) throw new Error("Запрос не найден");
  if (!existing.isActive) return existing;
  await execute("UPDATE buyer_demands SET is_active = 0 WHERE id = ? AND user_id = ?", [
    demandId,
    userId,
  ]);
  return getDemandForUser(userId, demandId);
}

export async function activateDemandForUser(userId, demandId) {
  const existing = await getDemandForUser(userId, demandId);
  if (!existing) throw new Error("Запрос не найден");
  if (existing.isActive) return existing;
  await execute("UPDATE buyer_demands SET is_active = 1 WHERE id = ? AND user_id = ?", [
    demandId,
    userId,
  ]);
  return getDemandForUser(userId, demandId);
}
