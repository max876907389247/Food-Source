import { Router } from "express";
import bcrypt from "bcryptjs";
import { requireAuth, requireBuyer, requireSeller, sessionUser } from "./auth.js";
import {
  activateDemandForUser,
  closeDemandAfterAcceptance,
  createDemandForUser,
  deactivateDemandForUser,
  listDemandsForUser,
  updateDemandForUser,
} from "./buyerDemandRepo.js";
import {
  cancelOrder,
  createOrder,
  getOrderById,
  getOrderByIdForSupplier,
  listOrdersForSupplier,
  listOrdersForUser,
  updateOrderStatusForSupplier,
} from "./orderRepo.js";
import { query, execute } from "./db.js";
import {
  createProduct,
  deleteProduct,
  listProductsBySupplier,
  updateProduct,
} from "./productRepo.js";
import { addFavorite, listFavoriteIds, removeFavorite } from "./favoriteRepo.js";
import { resolveProductPrice } from "./priceUtils.js";
import {
  createUser,
  getUserById,
  getUserByUsername,
  mapUserRow,
  normalizeAudience,
} from "./userRepo.js";

const router = Router();

function parseLineItems(row) {
  if (!row.line_items) return [];
  try {
    const raw = typeof row.line_items === "string" ? JSON.parse(row.line_items) : row.line_items;
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

async function buildProposalLines(supplierId, itemsInput) {
  if (!Array.isArray(itemsInput) || !itemsInput.length) {
    return { lines: [], total: 0 };
  }
  const products = await listProductsBySupplier(supplierId);
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines = [];
  let total = 0;
  for (const raw of itemsInput) {
    const productId = Number(raw.productId);
    const quantity = Number(raw.quantity);
    if (!productId || !Number.isFinite(quantity) || quantity <= 0) continue;
    const p = byId.get(productId);
    if (!p) continue;
    const unitPrice = resolveProductPrice(p);
    const lineTotal = Math.round(unitPrice * quantity * 100) / 100;
    lines.push({
      productId,
      name: p.name,
      unit: p.unit,
      quantity,
      unitPrice,
      lineTotal,
    });
    total += lineTotal;
  }
  return { lines, total: Math.round(total * 100) / 100 };
}

function mapProposalRow(row) {
  const proposal = {
    id: row.id,
    buyerDemandId: row.buyer_demand_id,
    message: row.message,
    priceOffer: row.price_offer,
    volumeOffer: row.volume_offer,
    lineItems: parseLineItems(row),
    offerTotal: row.offer_total != null ? Number(row.offer_total) : null,
    status: row.status || "pending",
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
      description: row.demand_description ?? null,
    },
  };
  if (row.supplier_name != null || row.seller_supplier_id != null) {
    proposal.seller = {
      supplierId: row.seller_supplier_id,
      supplierName: row.supplier_name,
      city: row.supplier_city,
      region: row.supplier_region,
      contacts: {
        phone: row.seller_phone ?? null,
        email: row.seller_email ?? null,
      },
    };
  }
  return proposal;
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
      region: req.body?.city,
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

router.get("/api/my/incoming-orders", requireAuth, requireSeller, async (req, res) => {
  try {
    const supplierId = await sellerSupplierId(req);
    if (!supplierId) {
      res.status(400).json({ error: "Аккаунт не привязан к карточке поставщика" });
      return;
    }
    const orders = await listOrdersForSupplier(supplierId);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message || "Не удалось загрузить предложения" });
  }
});

router.get("/api/my/incoming-orders/:id", requireAuth, requireSeller, async (req, res) => {
  try {
    const supplierId = await sellerSupplierId(req);
    if (!supplierId) {
      res.status(400).json({ error: "Аккаунт не привязан к карточке поставщика" });
      return;
    }
    const order = await getOrderByIdForSupplier(Number(req.params.id), supplierId);
    if (!order) {
      res.status(404).json({ error: "Предложение не найдено" });
      return;
    }
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message || "Не удалось загрузить предложение" });
  }
});

router.patch("/api/my/incoming-orders/:id/status", requireAuth, requireSeller, async (req, res) => {
  try {
    const supplierId = await sellerSupplierId(req);
    if (!supplierId) {
      res.status(400).json({ error: "Аккаунт не привязан к карточке поставщика" });
      return;
    }
    const status = String(req.body?.status || "").trim();
    const order = await updateOrderStatusForSupplier(
      Number(req.params.id),
      supplierId,
      status
    );
    res.json({ order });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/api/favorites", requireAuth, async (req, res) => {
  try {
    const user = sessionUser(req);
    const type = String(req.query?.type || "").trim();
    const favorites = await listFavoriteIds(user.id, type);
    res.json({ favorites });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/api/favorites", requireAuth, async (req, res) => {
  try {
    const user = sessionUser(req);
    const targetType = String(req.body?.targetType || "").trim();
    const targetId = req.body?.targetId;

    if (targetType === "supplier" && user.audience !== "buyer" && user.role !== "admin") {
      res.status(403).json({ error: "Избранные поставщики доступны покупателям" });
      return;
    }
    if (targetType === "buyer_demand" && user.audience !== "seller") {
      res.status(403).json({ error: "Избранные покупатели доступны поставщикам" });
      return;
    }

    const item = await addFavorite(user.id, targetType, targetId);
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/api/favorites/:targetType/:targetId", requireAuth, async (req, res) => {
  try {
    const user = sessionUser(req);
    const item = await removeFavorite(user.id, req.params.targetType, req.params.targetId);
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/api/buyer-demands", requireAuth, requireSeller, async (req, res) => {
  const { category, city, region, org, q, sort = "relevance", ids } = req.query;
  const filterCity = city || region || "";

  const idList = ids
    ? String(ids)
        .split(",")
        .map((x) => Number(x.trim()))
        .filter((n) => Number.isFinite(n) && n > 0)
    : [];
  const fetchByIdsOnly = idList.length > 0 && !category && !filterCity && !org && !q;

  let sql = `
    SELECT b.*, c.label AS category_label
    FROM buyer_demands b
    LEFT JOIN categories c ON c.id = b.category_id`;
  const params = [];

  if (fetchByIdsOnly) {
    sql += ` WHERE b.id IN (${idList.map(() => "?").join(",")})`;
    params.push(...idList);
  } else {
    sql += " WHERE b.is_active = 1";
    if (idList.length) {
      sql += ` AND b.id IN (${idList.map(() => "?").join(",")})`;
      params.push(...idList);
    }
  }

  if (category) {
    sql += " AND b.category_id = ?";
    params.push(category);
  }

  if (filterCity) {
    sql += " AND b.city = ?";
    params.push(filterCity);
  }

  if (org) {
    const orgLike = `%${String(org).trim().toLowerCase()}%`;
    sql += " AND LOWER(b.company_name) LIKE ?";
    params.push(orgLike);
  }

  if (q) {
    const like = `%${String(q).trim().toLowerCase()}%`;
    sql += ` AND (
      LOWER(b.description) LIKE ?
      OR LOWER(b.business_type) LIKE ? OR LOWER(b.city) LIKE ?
    )`;
    params.push(like, like, like);
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
      isActive: Boolean(r.is_active),
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
  let priceOffer = String(req.body?.priceOffer || "").trim() || null;
  let volumeOffer = String(req.body?.volumeOffer || "").trim() || null;
  const itemsInput = req.body?.items;

  if (!buyerDemandId) {
    res.status(400).json({ error: "Укажите заявку покупателя" });
    return;
  }
  if (!message) {
    res.status(400).json({ error: "Опишите ваше предложение" });
    return;
  }

  const supplierId = await sellerSupplierId(req);
  if (!supplierId) {
    res.status(400).json({ error: "Аккаунт не привязан к карточке поставщика" });
    return;
  }

  const { lines, total } = await buildProposalLines(supplierId, itemsInput);
  const lineItemsJson = lines.length ? JSON.stringify(lines) : null;
  const offerTotal = lines.length ? total : null;

  if (lines.length) {
    priceOffer = priceOffer || `Итого ${total.toLocaleString("ru-RU")} ₽`;
    if (!volumeOffer) {
      volumeOffer = lines.map((l) => `${l.quantity} ${l.unit}`).join(", ");
    }
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
    "SELECT id, status FROM supply_proposals WHERE seller_user_id = ? AND buyer_demand_id = ?",
    [user.id, buyerDemandId]
  );

  if (existing.length) {
    const currentStatus = existing[0].status || "pending";
    if (currentStatus === "accepted") {
      res.status(400).json({ error: "Покупатель принял предложение — изменить ответ нельзя" });
      return;
    }
    if (currentStatus === "rejected") {
      res.status(400).json({ error: "Покупатель отклонил предложение — изменить ответ нельзя" });
      return;
    }

    await query(
      `UPDATE supply_proposals SET message = ?, price_offer = ?, volume_offer = ?, line_items = ?, offer_total = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [message, priceOffer, volumeOffer, lineItemsJson, offerTotal, existing[0].id]
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
    `INSERT INTO supply_proposals (seller_user_id, buyer_demand_id, message, price_offer, volume_offer, line_items, offer_total)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [user.id, buyerDemandId, message, priceOffer, volumeOffer, lineItemsJson, offerTotal]
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

router.get("/api/my/incoming-proposals", requireAuth, requireBuyer, async (req, res) => {
  try {
    const user = sessionUser(req);
    const rows = await query(
      `SELECT p.*,
        b.company_name, b.city, b.region, b.business_type, b.volume_text, b.budget_text,
        b.description AS demand_description, c.label AS category_label,
        s.id AS seller_supplier_id, s.name AS supplier_name, s.city AS supplier_city,
        (SELECT GROUP_CONCAT(DISTINCT r.name ORDER BY r.name SEPARATOR ', ')
         FROM supplier_regions sr
         JOIN regions r ON r.id = sr.region_id
         WHERE sr.supplier_id = s.id) AS supplier_region,
        s.phone AS seller_phone, s.email AS seller_email
       FROM supply_proposals p
       JOIN buyer_demands b ON b.id = p.buyer_demand_id
       JOIN users u ON u.id = p.seller_user_id
       LEFT JOIN suppliers s ON s.id = u.supplier_id
       LEFT JOIN categories c ON c.id = b.category_id
       WHERE b.user_id = ?
       ORDER BY p.updated_at DESC`,
      [user.id]
    );
    res.json(rows.map(mapProposalRow));
  } catch (err) {
    res.status(500).json({ error: err.message || "Не удалось загрузить ответы поставщиков" });
  }
});

const INCOMING_PROPOSAL_SELECT = `SELECT p.*,
  b.company_name, b.city, b.region, b.business_type, b.volume_text, b.budget_text,
  b.description AS demand_description, c.label AS category_label,
  s.id AS seller_supplier_id, s.name AS supplier_name, s.city AS supplier_city,
  (SELECT GROUP_CONCAT(DISTINCT r.name ORDER BY r.name SEPARATOR ', ')
   FROM supplier_regions sr
   JOIN regions r ON r.id = sr.region_id
   WHERE sr.supplier_id = s.id) AS supplier_region,
  s.phone AS seller_phone, s.email AS seller_email`;

router.patch("/api/my/incoming-proposals/:id/status", requireAuth, requireBuyer, async (req, res) => {
  try {
    const user = sessionUser(req);
    const proposalId = Number(req.params.id);
    const status = String(req.body?.status || "").trim();

    if (!["accepted", "rejected"].includes(status)) {
      res.status(400).json({ error: "Укажите статус: accepted или rejected" });
      return;
    }

    const owned = await query(
      `SELECT p.id, p.status, p.buyer_demand_id FROM supply_proposals p
       JOIN buyer_demands b ON b.id = p.buyer_demand_id
       WHERE p.id = ? AND b.user_id = ?`,
      [proposalId, user.id]
    );
    if (!owned.length) {
      res.status(404).json({ error: "Предложение не найдено" });
      return;
    }
    if (owned[0].status !== "pending") {
      res.status(400).json({ error: "Статус этого предложения уже изменён" });
      return;
    }

    await query(
      `UPDATE supply_proposals SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, proposalId]
    );

    if (status === "accepted") {
      await closeDemandAfterAcceptance(owned[0].buyer_demand_id);
    }

    const rows = await query(
      `${INCOMING_PROPOSAL_SELECT}
       FROM supply_proposals p
       JOIN buyer_demands b ON b.id = p.buyer_demand_id
       JOIN users u ON u.id = p.seller_user_id
       LEFT JOIN suppliers s ON s.id = u.supplier_id
       LEFT JOIN categories c ON c.id = b.category_id
       WHERE p.id = ?`,
      [proposalId]
    );
    res.json({ proposal: mapProposalRow(rows[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message || "Не удалось обновить статус" });
  }
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
