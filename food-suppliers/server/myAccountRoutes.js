import { Router } from "express";
import { requireAuth, requireBuyer, requireSeller, sessionUser } from "./auth.js";
import {
  activateDemandForUser,
  createDemandForUser,
  deactivateDemandForUser,
  listDemandsForUser,
  updateDemandForUser,
} from "./buyerDemandRepo.js";
import {
  createProduct,
  deleteProduct,
  listProductsBySupplier,
  updateProduct,
} from "./productRepo.js";
import { getUserById } from "./userRepo.js";

const router = Router();

async function sellerSupplierId(req) {
  const user = await getUserById(sessionUser(req).id);
  if (!user?.supplierId) {
    return null;
  }
  return user.supplierId;
}

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
