import { execute, query } from "./db.js";

const VALID_TYPES = new Set(["supplier", "buyer_demand"]);

export function normalizeFavoriteType(type) {
  const t = String(type || "").trim();
  if (!VALID_TYPES.has(t)) throw new Error("Недопустимый тип избранного");
  return t;
}

export async function listFavoriteIds(userId, targetType) {
  const type = normalizeFavoriteType(targetType);
  const rows = await query(
    "SELECT target_id FROM favorites WHERE user_id = ? AND target_type = ? ORDER BY created_at DESC",
    [userId, type]
  );
  return rows.map((r) => r.target_id);
}

export async function addFavorite(userId, targetType, targetId) {
  const type = normalizeFavoriteType(targetType);
  const id = String(targetId || "").trim();
  if (!id) throw new Error("Укажите объект для избранного");

  if (type === "supplier") {
    const rows = await query("SELECT id FROM suppliers WHERE id = ?", [id]);
    if (!rows.length) throw new Error("Поставщик не найден");
  } else {
    const demandId = Number(id);
    if (!demandId) throw new Error("Укажите заявку покупателя");
    const rows = await query("SELECT id FROM buyer_demands WHERE id = ? AND is_active = 1", [demandId]);
    if (!rows.length) throw new Error("Заявка покупателя не найдена");
  }

  await execute(
    "INSERT IGNORE INTO favorites (user_id, target_type, target_id) VALUES (?, ?, ?)",
    [userId, type, id]
  );
  return { targetType: type, targetId: id };
}

export async function removeFavorite(userId, targetType, targetId) {
  const type = normalizeFavoriteType(targetType);
  const id = String(targetId || "").trim();
  await execute("DELETE FROM favorites WHERE user_id = ? AND target_type = ? AND target_id = ?", [
    userId,
    type,
    id,
  ]);
  return { targetType: type, targetId: id };
}
