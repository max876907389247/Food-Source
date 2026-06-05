import { execute, query } from "./db.js";
import {
  formatProductMinOrder,
  formatProductPriceHint,
  parseProductMinOrderInput,
} from "./priceUtils.js";

function mapProduct(row) {
  return {
    id: row.id,
    supplierId: row.supplier_id,
    name: row.name,
    categoryId: row.category_id,
    description: row.description,
    priceHint: row.price_hint,
    pricePerUnit: row.price_per_unit != null ? Number(row.price_per_unit) : null,
    minOrder: row.min_order,
    unit: row.unit || "шт.",
  };
}

export async function listProductsBySupplier(supplierId) {
  const rows = await query(
    `SELECT id, supplier_id, name, category_id, description, price_hint, price_per_unit, min_order, unit
     FROM products WHERE supplier_id = ? ORDER BY name`,
    [supplierId]
  );
  return rows.map(mapProduct);
}

export async function getProductForSupplier(supplierId, productId) {
  const rows = await query(
    `SELECT id, supplier_id, name, category_id, description, price_hint, price_per_unit, min_order, unit
     FROM products WHERE id = ? AND supplier_id = ?`,
    [productId, supplierId]
  );
  return rows.length ? mapProduct(rows[0]) : null;
}

function validateProductBody(body) {
  const name = String(body?.name || "").trim();
  if (!name || name.length < 2) throw new Error("Укажите название товара");
  const unit = String(body?.unit || "шт.").trim() || "шт.";
  let pricePerUnit = null;
  if (body?.pricePerUnit != null && body.pricePerUnit !== "") {
    pricePerUnit = Number(body.pricePerUnit);
    if (Number.isNaN(pricePerUnit) || pricePerUnit < 0) {
      throw new Error("Некорректная цена");
    }
  }
  const minOrderRub = parseProductMinOrderInput(body?.minOrderRub ?? body?.minOrder);
  if (Number.isNaN(minOrderRub)) {
    throw new Error("Некорректная минимальная цена заказа");
  }

  return {
    name,
    categoryId: body?.categoryId ? String(body.categoryId).trim() : null,
    description: String(body?.description || "").trim() || null,
    priceHint: formatProductPriceHint(pricePerUnit, unit),
    pricePerUnit,
    minOrder: formatProductMinOrder(minOrderRub),
    unit,
  };
}

export async function createProduct(supplierId, body) {
  const data = validateProductBody(body);
  const result = await execute(
    `INSERT INTO products (supplier_id, name, category_id, description, price_hint, price_per_unit, min_order, unit)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      supplierId,
      data.name,
      data.categoryId,
      data.description,
      data.priceHint,
      data.pricePerUnit,
      data.minOrder,
      data.unit,
    ]
  );
  return getProductForSupplier(supplierId, result.insertId);
}

export async function updateProduct(supplierId, productId, body) {
  const existing = await getProductForSupplier(supplierId, productId);
  if (!existing) throw new Error("Товар не найден");
  const data = validateProductBody(body);
  await query(
    `UPDATE products SET name = ?, category_id = ?, description = ?, price_hint = ?,
      price_per_unit = ?, min_order = ?, unit = ? WHERE id = ? AND supplier_id = ?`,
    [
      data.name,
      data.categoryId,
      data.description,
      data.priceHint,
      data.pricePerUnit,
      data.minOrder,
      data.unit,
      productId,
      supplierId,
    ]
  );
  return getProductForSupplier(supplierId, productId);
}

export async function deleteProduct(supplierId, productId) {
  const result = await execute("DELETE FROM products WHERE id = ? AND supplier_id = ?", [
    productId,
    supplierId,
  ]);
  if (!result.affectedRows) throw new Error("Товар не найден");
  return true;
}
