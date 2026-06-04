import { getConnection, query } from "./db.js";
import { mapSupplierRow, SUPPLIER_SELECT } from "./mapSupplier.js";
import { formatWorkingHours, validateSupplierData } from "./supplierValidation.js";

export async function getSupplierById(id) {
  const rows = await query(`${SUPPLIER_SELECT} WHERE s.id = ? GROUP BY s.id`, [id]);
  if (!rows.length) return null;
  return mapSupplierRow(rows[0]);
}

export async function getRegionIdsByNames(names) {
  if (!names?.length) return [];
  const placeholders = names.map(() => "?").join(",");
  const rows = await query(
    `SELECT id, name FROM regions WHERE name IN (${placeholders})`,
    names
  );
  return rows;
}

export async function upsertSupplierRelations(conn, supplierId, { categoryIds, regionNames, certificates }) {
  await conn.execute("DELETE FROM supplier_categories WHERE supplier_id = ?", [supplierId]);
  await conn.execute("DELETE FROM supplier_regions WHERE supplier_id = ?", [supplierId]);
  await conn.execute("DELETE FROM certificates WHERE supplier_id = ?", [supplierId]);

  for (const categoryId of categoryIds || []) {
    await conn.execute(
      "INSERT INTO supplier_categories (supplier_id, category_id) VALUES (?, ?)",
      [supplierId, categoryId]
    );
  }

  for (const regionName of regionNames || []) {
    const [existing] = await conn.execute("SELECT id FROM regions WHERE name = ?", [regionName]);
    let regionId;
    if (existing.length) {
      regionId = existing[0].id;
    } else {
      const [ins] = await conn.execute("INSERT INTO regions (name) VALUES (?)", [regionName]);
      regionId = ins.insertId;
    }
    await conn.execute(
      "INSERT INTO supplier_regions (supplier_id, region_id) VALUES (?, ?)",
      [supplierId, regionId]
    );
  }

  for (const name of certificates || []) {
    const trimmed = String(name).trim();
    if (!trimmed) continue;
    await conn.execute("INSERT INTO certificates (supplier_id, name) VALUES (?, ?)", [
      supplierId,
      trimmed,
    ]);
  }
}

export function supplierPayloadFromBody(body) {
  const workFrom = String(body.workHoursFrom || "").trim();
  const workTo = String(body.workHoursTo || "").trim();
  const workingHours =
    String(body.workingHours || "").trim() ||
    (workFrom && workTo ? formatWorkingHours(workFrom, workTo) : "");

  const data = {
    id: String(body.id || "").trim(),
    name: String(body.name || "").trim(),
    city: String(body.city || "").trim(),
    description: String(body.description || "").trim(),
    rating: Number(body.rating) || 0,
    reviewsCount: Number(body.reviewsCount ?? body.reviews_count) || 0,
    minOrder: String((body.minOrder ?? body.min_order) || "").trim(),
    minOrderKg: body.minOrderKg ?? body.min_order_kg,
    priceHint: body.priceHint ?? body.price_hint ?? null,
    hasCertificates: Boolean(body.hasCertificates ?? body.has_certificates),
    delivery: String(body.delivery || "").trim(),
    source: String(body.source || "").trim(),
    responseTime: String((body.responseTime ?? body.response_time) || "").trim(),
    workingHours: workingHours || formatWorkingHours("08:00", "21:00"),
    phone: String(body.phone || "").trim(),
    email: String(body.email || "").trim(),
    website: body.website || null,
    categoryIds: body.categoryIds || body.categories || [],
    regionNames: body.regionNames || body.regions || [],
    certificates: Array.isArray(body.certificates)
      ? body.certificates
      : String(body.certificatesText || "")
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
  };

  validateSupplierData(data);
  return data;
}

export async function insertSupplier(data) {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `INSERT INTO suppliers (
        id, name, city, description, rating, reviews_count, min_order, min_order_kg,
        price_hint, has_certificates, delivery, source, response_time, working_hours, phone, email, website
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.id,
        data.name,
        data.city,
        data.description,
        data.rating,
        data.reviewsCount,
        data.minOrder,
        data.minOrderKg || null,
        data.priceHint,
        data.hasCertificates ? 1 : 0,
        data.delivery,
        data.source,
        data.responseTime,
        data.workingHours,
        data.phone,
        data.email,
        data.website,
      ]
    );
    await upsertSupplierRelations(conn, data.id, data);
    await conn.commit();
    return getSupplierById(data.id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function updateSupplier(id, data) {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `UPDATE suppliers SET
        name = ?, city = ?, description = ?, rating = ?, reviews_count = ?,
        min_order = ?, min_order_kg = ?, price_hint = ?, has_certificates = ?,
        delivery = ?, source = ?, response_time = ?, working_hours = ?, phone = ?, email = ?, website = ?
      WHERE id = ?`,
      [
        data.name,
        data.city,
        data.description,
        data.rating,
        data.reviewsCount,
        data.minOrder,
        data.minOrderKg || null,
        data.priceHint,
        data.hasCertificates ? 1 : 0,
        data.delivery,
        data.source,
        data.responseTime,
        data.workingHours,
        data.phone,
        data.email,
        data.website,
        id,
      ]
    );
    await upsertSupplierRelations(conn, id, data);
    await conn.commit();
    return getSupplierById(id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function deleteSupplier(id) {
  await query("DELETE FROM suppliers WHERE id = ?", [id]);
}
