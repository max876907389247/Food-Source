import { Router } from "express";
import { requireAuth, requireSeller, sessionUser } from "./auth.js";
import { query, execute } from "./db.js";

const router = Router();

function mapProposalRow(row) {
  return {
    id: row.id,
    buyerDemandId: row.buyer_demand_id,
    message: row.message,
    priceOffer: row.price_offer,
    volumeOffer: row.volume_offer,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    buyer: {
      companyName: row.company_name,
      city: row.city,
      region: row.region,
      businessType: row.business_type,
      categoryLabel: row.category_label,
      volumeText: row.volume_text,
      budgetText: row.budget_text,
    },
  };
}

router.get("/api/proposals", requireAuth, requireSeller, async (req, res) => {
  const user = sessionUser(req);
  const rows = await query(
    `SELECT p.*, b.company_name, b.city, b.region, b.business_type, b.volume_text, b.budget_text, c.label AS category_label
     FROM supply_proposals p
     JOIN buyer_demands b ON b.id = p.buyer_demand_id
     LEFT JOIN categories c ON c.id = b.category_id
     WHERE p.seller_user_id = ?
     ORDER BY p.updated_at DESC`,
    [user.id]
  );
  res.json(rows.map(mapProposalRow));
});

router.post("/api/proposals", requireAuth, requireSeller, async (req, res) => {
  const user = sessionUser(req);
  const buyerDemandId = Number(req.body?.buyerDemandId);
  const message = String(req.body?.message || "").trim();
  const priceOffer = String(req.body?.priceOffer || "").trim() || null;
  const volumeOffer = String(req.body?.volumeOffer || "").trim() || null;

  if (!buyerDemandId) {
    res.status(400).json({ error: "Укажите заявку покупателя" });
    return;
  }
  if (!message) {
    res.status(400).json({ error: "Опишите ваше предложение" });
    return;
  }

  const demands = await query(
    "SELECT id FROM buyer_demands WHERE id = ? AND is_active = 1",
    [buyerDemandId]
  );
  if (!demands.length) {
    res.status(404).json({ error: "Заявка покупателя не найдена" });
    return;
  }

  const existing = await query(
    "SELECT id FROM supply_proposals WHERE seller_user_id = ? AND buyer_demand_id = ?",
    [user.id, buyerDemandId]
  );

  if (existing.length) {
    await query(
      `UPDATE supply_proposals SET message = ?, price_offer = ?, volume_offer = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [message, priceOffer, volumeOffer, existing[0].id]
    );
    const rows = await query(
      `SELECT p.*, b.company_name, b.city, b.region, b.business_type, b.volume_text, b.budget_text, c.label AS category_label
       FROM supply_proposals p
       JOIN buyer_demands b ON b.id = p.buyer_demand_id
       LEFT JOIN categories c ON c.id = b.category_id
       WHERE p.id = ?`,
      [existing[0].id]
    );
    res.json({ proposal: mapProposalRow(rows[0]), updated: true });
    return;
  }

  const result = await execute(
    `INSERT INTO supply_proposals (seller_user_id, buyer_demand_id, message, price_offer, volume_offer)
     VALUES (?, ?, ?, ?, ?)`,
    [user.id, buyerDemandId, message, priceOffer, volumeOffer]
  );

  const rows = await query(
    `SELECT p.*, b.company_name, b.city, b.region, b.business_type, b.volume_text, b.budget_text, c.label AS category_label
     FROM supply_proposals p
     JOIN buyer_demands b ON b.id = p.buyer_demand_id
     LEFT JOIN categories c ON c.id = b.category_id
     WHERE p.id = ?`,
    [result.insertId]
  );
  res.status(201).json({ proposal: mapProposalRow(rows[0]), updated: false });
});

router.get("/api/proposals/by-demand/:demandId", requireAuth, requireSeller, async (req, res) => {
  const user = sessionUser(req);
  const demandId = Number(req.params.demandId);
  const rows = await query(
    `SELECT p.*, b.company_name, b.city, b.region, b.business_type, b.volume_text, b.budget_text, c.label AS category_label
     FROM supply_proposals p
     JOIN buyer_demands b ON b.id = p.buyer_demand_id
     LEFT JOIN categories c ON c.id = b.category_id
     WHERE p.seller_user_id = ? AND p.buyer_demand_id = ?`,
    [user.id, demandId]
  );
  res.json(rows.length ? mapProposalRow(rows[0]) : null);
});

export default router;
