import { Router } from "express";
import { requireAuth } from "./auth.js";
import { query } from "./db.js";
import { mapSupplierRow, SUPPLIER_SELECT } from "./mapSupplier.js";
import { scoreSupplier } from "./scoring.js";
import { resolveProductPrice } from "./priceUtils.js";

const router = Router();

async function attachProducts(suppliers) {
  if (!suppliers.length) return suppliers;

  const ids = suppliers.map((s) => s.id);
  const placeholders = ids.map(() => "?").join(",");
  const products = await query(
    `SELECT p.id, p.supplier_id, p.name, p.description, p.price_hint, p.price_per_unit,
            p.min_order, p.unit, p.category_id, c.label AS category_label
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.supplier_id IN (${placeholders})
     ORDER BY p.name`,
    ids
  );

  const bySupplier = Object.fromEntries(ids.map((id) => [id, []]));
  for (const p of products) {
    bySupplier[p.supplier_id].push({
      id: p.id,
      name: p.name,
      description: p.description,
      priceHint: p.price_hint,
      pricePerUnit: resolveProductPrice(p),
      minOrder: p.min_order,
      unit: p.unit || "шт.",
      categoryId: p.category_id,
      categoryLabel: p.category_label,
    });
  }

  return suppliers.map((s) => ({
    ...s,
    products: bySupplier[s.id] || [],
  }));
}

function rowToSupplier(row) {
  const base = mapSupplierRow(row);
  delete base.products;
  return base;
}

router.get("/api/health", async (_req, res) => {
  try {
    await query("SELECT 1");
    res.json({ ok: true, database: "connected" });
  } catch (err) {
    res.status(503).json({ ok: false, error: err.message });
  }
});

router.get("/api/categories", async (_req, res) => {
  const rows = await query("SELECT id, label FROM categories ORDER BY label");
  res.json(rows);
});

router.get("/api/regions", async (_req, res) => {
  const rows = await query("SELECT name FROM regions ORDER BY name");
  res.json(rows.map((r) => r.name));
});

router.get("/api/suppliers", async (req, res) => {
  const { category, region, q, budgetKg, sort = "score", ids } = req.query;

  let sql = `${SUPPLIER_SELECT} WHERE 1=1`;
  const params = [];

  if (ids) {
    const idList = String(ids)
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    if (idList.length) {
      sql += ` AND s.id IN (${idList.map(() => "?").join(",")})`;
      params.push(...idList);
    }
  }

  if (category) {
    sql += ` AND EXISTS (
      SELECT 1 FROM supplier_categories sc2
      WHERE sc2.supplier_id = s.id AND sc2.category_id = ?
    )`;
    params.push(category);
  }

  if (region) {
    sql += ` AND EXISTS (
      SELECT 1 FROM supplier_regions sr2
      JOIN regions r2 ON r2.id = sr2.region_id
      WHERE sr2.supplier_id = s.id
        AND (r2.name = ? OR r2.name = 'Вся Россия')
    )`;
    params.push(region);
  }

  if (q) {
    const like = `%${q.trim().toLowerCase()}%`;
    sql += ` AND (
      LOWER(s.name) LIKE ? OR LOWER(s.description) LIKE ? OR LOWER(s.price_hint) LIKE ?
      OR LOWER(s.city) LIKE ?
      OR EXISTS (
        SELECT 1 FROM products p
        WHERE p.supplier_id = s.id
          AND (LOWER(p.name) LIKE ? OR LOWER(p.description) LIKE ?)
      )
    )`;
    params.push(like, like, like, like, like, like);
  }

  sql += " GROUP BY s.id";

  const rows = await query(sql, params);
  let list = rows.map(rowToSupplier);
  list = await attachProducts(list);

  const filters = { region: region || "", budgetKg: budgetKg || "" };
  list = list.map((s) => ({
    ...s,
    _score: scoreSupplier(s, filters),
  }));

  if (sort === "rating") {
    list.sort((a, b) => b.rating - a.rating);
  } else if (sort === "minOrder") {
    list.sort((a, b) => (a.minOrderKg ?? 99999) - (b.minOrderKg ?? 99999));
  } else if (sort === "name") {
    list.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  } else {
    list.sort((a, b) => b._score.score - a._score.score);
  }

  res.json(list);
});

router.get("/api/suppliers/:id", requireAuth, async (req, res) => {
  const rows = await query(`${SUPPLIER_SELECT} WHERE s.id = ? GROUP BY s.id`, [
    req.params.id,
  ]);
  if (!rows.length) {
    res.status(404).json({ error: "Поставщик не найден" });
    return;
  }

  const [supplier] = await attachProducts([rowToSupplier(rows[0])]);
  const filters = {
    region: req.query.region || "",
    budgetKg: req.query.budgetKg || "",
  };
  supplier._score = scoreSupplier(supplier, filters);
  res.json(supplier);
});

export default router;
