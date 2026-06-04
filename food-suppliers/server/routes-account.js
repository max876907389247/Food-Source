import { Router } from "express";
import bcrypt from "bcryptjs";
import { requireAuth, requireBuyer, requireSeller, sessionUser } from "./auth.js";
import {
  activateDemandForUser,
  createDemandForUser,
  deactivateDemandForUser,
  listDemandsForUser,
  updateDemandForUser,
} from "./buyerDemandRepo.js";
import { cancelOrder, createOrder, getOrderById, listOrdersForUser } from "./orderRepo.js";
import { query, execute } from "./db.js";
import {
  createProduct,
  deleteProduct,
  listProductsBySupplier,
  updateProduct,
} from "./productRepo.js";
import {
  createUser,
  getUserById,
  getUserByUsername,
  mapUserRow,
  normalizeAudience,
} from "./userRepo.js";

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

async function sellerSupplierId(req) {
  const user = await getUserById(sessionUser(req).id);
  if (!user?.supplierId) return null;
  return user.supplierId;
}

router.get("/api/auth/me", async (req, res) => {
  const session = sessionUser(req);
  if (!session) {
    res.json({ user: null });
    return;
  }
  const user = await getUserById(session.id);
  res.json({ user: user || null });
});

router.post("/api/auth/login", async (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");

  if (!username || !password) {
    res.status(400).json({ error: "Введите логин и пароль" });
    return;
  }

  const row = await getUserByUsername(username);
  if (!row) {
    res.status(401).json({ error: "Неверный логин или пароль" });
    return;
  }

  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) {
    res.status(401).json({ error: "Неверный логин или пароль" });
    return;
  }

  const user = mapUserRow(row);
  req.session.user = {
    id: user.id,
    username: user.username,
    role: user.role,
    audience: user.audience,
  };

  res.json({ user });
});

router.post("/api/auth/register", async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");
    const passwordConfirm = String(req.body?.passwordConfirm || "");

    if (password !== passwordConfirm) {
      res.status(400).json({ error: "Пароли не совпадают" });
      return;
    }

    const audience = normalizeAudience(req.body?.audience);
    const user = await createUser({
      username,
      password,
      role: "user",
      audience,
      organizationName: req.body?.organizationName,
      city: req.body?.city,
      region: req.body?.region,
      contactPhone: req.body?.contactPhone,
      contactEmail: req.body?.contactEmail,
    });

    req.session.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      audience: user.audience,
    };

    res.status(201).json({ user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/api/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: "Не удалось выйти" });
      return;
    }
    res.clearCookie("foodsource.sid");
    res.json({ ok: true });
  });
});

router.post("/api/orders", requireAuth, async (req, res) => {
  try {
    const user = sessionUser(req);
    const order = await createOrder(user.id, {
      supplierId: req.body.supplierId,
      items: req.body.items,
      note: req.body.note,
    });
    res.status(201).json({ order });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/api/orders", requireAuth, async (req, res) => {
  const user = sessionUser(req);
  const orders = await listOrdersForUser(user.id);
  res.json(orders);
});

async function cancelOrderHandler(req, res) {
  try {
    const user = sessionUser(req);
    const order = await cancelOrder(Number(req.params.id), user.id);
    res.json({ order });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

router.post("/api/orders/:id/cancel", requireAuth, cancelOrderHandler);
router.patch("/api/orders/:id/cancel", requireAuth, cancelOrderHandler);

router.get("/api/orders/:id", requireAuth, async (req, res) => {
  const user = sessionUser(req);
  const order = await getOrderById(Number(req.params.id), user.id);
  if (!order) {
    res.status(404).json({ error: "Заказ не найден" });
    return;
  }
  res.json(order);
});

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

router.get("/api/my/products", requireAuth, requireSeller, async (req, res) => {
  const supplierId = await sellerSupplierId(req);
  if (!supplierId) {
    res.status(400).json({ error: "Аккаунт не привязан к карточке поставщика" });
    return;
  }
  const products = await listProductsBySupplier(supplierId);
  res.json({ supplierId, products });
});

router.post("/api/my/products", requireAuth, requireSeller, async (req, res) => {
  try {
    const supplierId = await sellerSupplierId(req);
    if (!supplierId) {
      res.status(400).json({ error: "Аккаунт не привязан к карточке поставщика" });
      return;
    }
    const product = await createProduct(supplierId, req.body);
    res.status(201).json({ product });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/api/my/products/:id", requireAuth, requireSeller, async (req, res) => {
  try {
    const supplierId = await sellerSupplierId(req);
    if (!supplierId) {
      res.status(400).json({ error: "Аккаунт не привязан к карточке поставщика" });
      return;
    }
    const product = await updateProduct(supplierId, Number(req.params.id), req.body);
    res.json({ product });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/api/my/products/:id", requireAuth, requireSeller, async (req, res) => {
  try {
    const supplierId = await sellerSupplierId(req);
    if (!supplierId) {
      res.status(400).json({ error: "Аккаунт не привязан к карточке поставщика" });
      return;
    }
    await deleteProduct(supplierId, Number(req.params.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/api/my/demands", requireAuth, requireBuyer, async (req, res) => {
  const user = sessionUser(req);
  const demands = await listDemandsForUser(user.id);
  res.json(demands);
});

router.post("/api/my/demands", requireAuth, requireBuyer, async (req, res) => {
  try {
    const user = sessionUser(req);
    const demand = await createDemandForUser(user.id, req.body);
    res.status(201).json({ demand });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/api/my/demands/:id", requireAuth, requireBuyer, async (req, res) => {
  try {
    const user = sessionUser(req);
    const demand = await updateDemandForUser(user.id, Number(req.params.id), req.body);
    res.json({ demand });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/api/my/demands/:id/restore", requireAuth, requireBuyer, async (req, res) => {
  try {
    const user = sessionUser(req);
    const demand = await activateDemandForUser(user.id, Number(req.params.id));
    res.json({ demand });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/api/my/demands/:id", requireAuth, requireBuyer, async (req, res) => {
  try {
    const user = sessionUser(req);
    await deactivateDemandForUser(user.id, Number(req.params.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
