import { Router } from "express";
import { requireAuth, sessionUser } from "./auth.js";
import { cancelOrder, createOrder, getOrderById, listOrdersForUser } from "./orderRepo.js";

const router = Router();

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

export default router;
