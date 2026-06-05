import { execute, query } from "./db.js";
import { formatRuNumber } from "./priceUtils.js";

function parsePositiveNumber(value) {
  if (value == null || value === "") return null;
  const num = Number(String(value).replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(num) || num < 0) return NaN;
  return num;
}

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
    isFulfilled: Boolean(row.is_fulfilled),
    createdAt: row.created_at,
  };
}

const DEMAND_SELECT = `
  SELECT b.*, c.label AS category_label,
    EXISTS (
      SELECT 1 FROM supply_proposals p
      WHERE p.buyer_demand_id = b.id AND p.status = 'accepted'
    ) AS is_fulfilled
  FROM buyer_demands b
  LEFT JOIN categories c ON c.id = b.category_id`;

export async function demandHasAcceptedProposal(demandId) {
  const rows = await query(
    "SELECT 1 FROM supply_proposals WHERE buyer_demand_id = ? AND status = 'accepted' LIMIT 1",
    [demandId]
  );
  return rows.length > 0;
}

export async function closeDemandAfterAcceptance(demandId) {
  await execute("UPDATE buyer_demands SET is_active = 0 WHERE id = ?", [demandId]);
}

function validateDemandBody(body) {
  const companyName = String(body?.companyName || "").trim();
  const city = String(body?.city || "").trim();
  const businessType = String(body?.businessType || "").trim();
  const description = String(body?.description || "").trim();
  const phone = String(body?.contactPhone || body?.phone || "").trim();
  const email = String(body?.contactEmail || body?.email || "").trim();

  if (!companyName) throw new Error("Укажите название компании");
  if (!city) throw new Error("Укажите город");
  const region = city;
  if (!businessType) throw new Error("Укажите тип бизнеса");
  if (!description) throw new Error("Опишите запрос");
  if (!phone) throw new Error("Укажите телефон");
  if (!email) throw new Error("Укажите email");

  let volumeKg = parsePositiveNumber(body?.volumeKg);
  if (volumeKg == null) {
    volumeKg = parsePositiveNumber(body?.volumeText);
  }
  if (volumeKg == null || Number.isNaN(volumeKg)) {
    throw new Error("Укажите объём в кг");
  }

  const budgetRub = parsePositiveNumber(body?.budgetRub ?? body?.budgetText);
  if (budgetRub == null || Number.isNaN(budgetRub)) {
    throw new Error("Укажите бюджет");
  }

  return {
    companyName,
    city,
    region,
    businessType,
    categoryId: body?.categoryId ? String(body.categoryId).trim() : null,
    volumeText: `до ${formatRuNumber(volumeKg)} кг`,
    volumeKg,
    budgetText: budgetRub != null ? `до ${formatRuNumber(budgetRub)} ₽` : null,
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

async function insertDemandRow(userId, data) {
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

export async function getDemandById(demandId) {
  const rows = await query(`${DEMAND_SELECT} WHERE b.id = ?`, [demandId]);
  return rows.length ? mapDemandRow(rows[0]) : null;
}

export async function linkDemandToUser(demandId, userId) {
  await execute("UPDATE buyer_demands SET user_id = ? WHERE id = ?", [userId, demandId]);
}

export async function createDemandForUser(userId, body) {
  const data = validateDemandBody(body);
  return insertDemandRow(userId, data);
}

export async function createDemandAdmin(body, userId = null) {
  const data = validateDemandBody(body);
  return insertDemandRow(userId, data);
}

export async function updateDemandAdmin(demandId, body) {
  const existing = await getDemandById(demandId);
  if (!existing) throw new Error("Запрос не найден");
  if (existing.isFulfilled) {
    throw new Error("Запрос закрыт — предложение поставщика принято");
  }
  const data = validateDemandBody(body);
  await query(
    `UPDATE buyer_demands SET
      company_name = ?, city = ?, region = ?, business_type = ?, category_id = ?,
      volume_text = ?, volume_kg = ?, budget_text = ?, description = ?,
      contact_phone = ?, contact_email = ?
     WHERE id = ?`,
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
    ]
  );
  return getDemandById(demandId);
}

export async function deleteDemandAdmin(demandId) {
  const existing = await getDemandById(demandId);
  if (!existing) throw new Error("Запрос не найден");
  await execute("DELETE FROM buyer_demands WHERE id = ?", [demandId]);
}

export async function updateDemandForUser(userId, demandId, body) {
  const existing = await getDemandForUser(userId, demandId);
  if (!existing) throw new Error("Запрос не найден");
  if (existing.isFulfilled) throw new Error("Запрос закрыт — предложение поставщика принято");
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
  if (existing.isFulfilled) {
    throw new Error("Запрос закрыт — вы приняли предложение поставщика");
  }
  if (existing.isActive) return existing;
  await execute("UPDATE buyer_demands SET is_active = 1 WHERE id = ? AND user_id = ?", [
    demandId,
    userId,
  ]);
  return getDemandForUser(userId, demandId);
}
