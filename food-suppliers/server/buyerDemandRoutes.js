import { Router } from "express";
import { requireAuth, requireSeller } from "./auth.js";
import { query } from "./db.js";

const router = Router();

router.get("/api/buyer-demands", requireAuth, requireSeller, async (req, res) => {
  const { category, region, q, sort = "relevance" } = req.query;

  let sql = `
    SELECT b.*, c.label AS category_label
    FROM buyer_demands b
    LEFT JOIN categories c ON c.id = b.category_id
    WHERE b.is_active = 1`;
  const params = [];

  if (category) {
    sql += " AND b.category_id = ?";
    params.push(category);
  }

  if (region) {
    sql += " AND (b.region = ? OR b.city = ?)";
    params.push(region, region);
  }

  if (q) {
    const like = `%${String(q).trim().toLowerCase()}%`;
    sql += ` AND (
      LOWER(b.company_name) LIKE ? OR LOWER(b.description) LIKE ?
      OR LOWER(b.business_type) LIKE ? OR LOWER(b.city) LIKE ?
    )`;
    params.push(like, like, like, like);
  }

  if (sort === "volume") {
    sql += " ORDER BY b.volume_kg DESC, b.company_name";
  } else if (sort === "name") {
    sql += " ORDER BY b.company_name";
  } else {
    sql += " ORDER BY b.created_at DESC";
  }

  const rows = await query(sql, params);
  res.json(
    rows.map((r) => ({
      id: r.id,
      companyName: r.company_name,
      city: r.city,
      region: r.region,
      businessType: r.business_type,
      categoryId: r.category_id,
      categoryLabel: r.category_label,
      volumeText: r.volume_text,
      volumeKg: r.volume_kg,
      budgetText: r.budget_text,
      description: r.description,
      contacts: {
        phone: r.contact_phone,
        email: r.contact_email,
      },
    }))
  );
});

export default router;
