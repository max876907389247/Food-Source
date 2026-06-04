import { Router } from "express";
import { requireAdmin } from "./auth.js";
import { query } from "./db.js";
import { SUPPLIER_SELECT, mapSupplierRow } from "./mapSupplier.js";
import {
  createProduct,
  deleteProduct,
  listProductsBySupplier,
  updateProduct,
} from "./productRepo.js";
import {
  deleteSupplier,
  getSupplierById,
  insertSupplier,
  supplierPayloadFromBody,
  updateSupplier,
} from "./supplierRepo.js";
import {
  accountFieldsForBuyer,
  accountFieldsForSupplier,
  displayPasswordForUsername,
} from "./demoCredentials.js";
import {
  createUser,
  deleteUser,
  getUserById,
  listUsers,
  updateUser,
} from "./userRepo.js";

const router = Router();

router.use("/api/admin", requireAdmin);

router.get("/api/admin/suppliers", async (_req, res) => {
  const rows = await query(`${SUPPLIER_SELECT} GROUP BY s.id ORDER BY s.name`);
  const accounts = await query(
    "SELECT supplier_id, username FROM users WHERE supplier_id IS NOT NULL"
  );
  const loginBySupplier = Object.fromEntries(
    accounts.map((a) => [a.supplier_id, a.username])
  );
  const counts = await query(
    "SELECT supplier_id, COUNT(*) AS product_count FROM products GROUP BY supplier_id"
  );
  const countBySupplier = Object.fromEntries(
    counts.map((c) => [c.supplier_id, Number(c.product_count)])
  );
  res.json(
    rows.map((row) => {
      const supplier = mapSupplierRow(row);
      const linked = loginBySupplier[supplier.id] || null;
      return {
        ...supplier,
        productCount: countBySupplier[supplier.id] || 0,
        account: accountFieldsForSupplier(supplier.id, linked),
      };
    })
  );
});

router.get("/api/admin/suppliers/:id", async (req, res) => {
  const supplier = await getSupplierById(req.params.id);
  if (!supplier) {
    res.status(404).json({ error: "Поставщик не найден" });
    return;
  }
  const products = await listProductsBySupplier(supplier.id);
  res.json({ ...supplier, products });
});

router.get("/api/admin/suppliers/:id/products", async (req, res) => {
  const supplier = await getSupplierById(req.params.id);
  if (!supplier) {
    res.status(404).json({ error: "Поставщик не найден" });
    return;
  }
  res.json(await listProductsBySupplier(supplier.id));
});

router.post("/api/admin/suppliers/:id/products", async (req, res) => {
  try {
    const supplier = await getSupplierById(req.params.id);
    if (!supplier) {
      res.status(404).json({ error: "Поставщик не найден" });
      return;
    }
    const product = await createProduct(supplier.id, req.body);
    res.status(201).json({ product });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/api/admin/products/:id", async (req, res) => {
  try {
    const rows = await query("SELECT supplier_id FROM products WHERE id = ?", [
      req.params.id,
    ]);
    if (!rows.length) {
      res.status(404).json({ error: "Товар не найден" });
      return;
    }
    const product = await updateProduct(rows[0].supplier_id, Number(req.params.id), req.body);
    res.json({ product });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/api/admin/products/:id", async (req, res) => {
  try {
    const rows = await query("SELECT supplier_id FROM products WHERE id = ?", [
      req.params.id,
    ]);
    if (!rows.length) {
      res.status(404).json({ error: "Товар не найден" });
      return;
    }
    await deleteProduct(rows[0].supplier_id, Number(req.params.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/api/admin/suppliers", async (req, res) => {
  try {
    const data = supplierPayloadFromBody(req.body);
    if (!data.id || !data.name) {
      res.status(400).json({ error: "Укажите id и название поставщика" });
      return;
    }
    const existing = await getSupplierById(data.id);
    if (existing) {
      res.status(409).json({ error: "Поставщик с таким id уже существует" });
      return;
    }
    const created = await insertSupplier(data);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/api/admin/suppliers/:id", async (req, res) => {
  try {
    const existing = await getSupplierById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: "Поставщик не найден" });
      return;
    }
    const data = supplierPayloadFromBody({ ...req.body, id: req.params.id });
    const updated = await updateSupplier(req.params.id, data);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/api/admin/suppliers/:id", async (req, res) => {
  const existing = await getSupplierById(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "Поставщик не найден" });
    return;
  }
  await deleteSupplier(req.params.id);
  res.json({ ok: true });
});

router.get("/api/admin/users", async (_req, res) => {
  const users = await listUsers();
  res.json(
    users.map((u) => ({
      ...u,
      displayPassword: displayPasswordForUsername(u.username),
    }))
  );
});

router.get("/api/admin/users/:id", async (req, res) => {
  const user = await getUserById(req.params.id);
  if (!user) {
    res.status(404).json({ error: "Пользователь не найден" });
    return;
  }
  res.json(user);
});

router.post("/api/admin/users", async (req, res) => {
  try {
    const { username, password, role = "user" } = req.body || {};
    if (!username || !password) {
      res.status(400).json({ error: "Укажите логин и пароль" });
      return;
    }
    const user = await createUser({ username, password, role });
    res.status(201).json({
      ...user,
      displayPassword:
        displayPasswordForUsername(user.username) ?? password,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/api/admin/users/:id", async (req, res) => {
  try {
    const { username, password, role } = req.body || {};
    const user = await updateUser(req.params.id, { username, password, role });
    res.json({
      ...user,
      displayPassword: password
        ? displayPasswordForUsername(user.username) ?? password
        : displayPasswordForUsername(user.username),
    });
  } catch (err) {
    const code = err.message === "Пользователь не найден" ? 404 : 400;
    res.status(code).json({ error: err.message });
  }
});

router.delete("/api/admin/users/:id", async (req, res) => {
  try {
    await deleteUser(req.params.id, req.session.user?.id);
    res.json({ ok: true });
  } catch (err) {
    const code = err.message === "Пользователь не найден" ? 404 : 400;
    res.status(code).json({ error: err.message });
  }
});

router.get("/api/admin/buyer-demands", async (_req, res) => {
  const rows = await query(
    `SELECT b.*, c.label AS category_label, u.username AS account_username
     FROM buyer_demands b
     LEFT JOIN categories c ON c.id = b.category_id
     LEFT JOIN users u ON u.id = b.user_id
     ORDER BY b.company_name`
  );
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
      createdAt: r.created_at,
      account: accountFieldsForBuyer(r.id, r.account_username || null),
    }))
  );
});

router.get("/api/admin/meta", async (_req, res) => {
  const [categories, regions] = await Promise.all([
    query("SELECT id, label FROM categories ORDER BY label"),
    query("SELECT name FROM regions ORDER BY name"),
  ]);
  res.json({
    categories,
    regions: regions.map((r) => r.name),
  });
});

export default router;
