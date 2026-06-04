import { getConnection, query } from "./db.js";
import { getSupplierById } from "./supplierRepo.js";
import { parseMinOrderRubles, resolveProductPrice } from "./priceUtils.js";

export async function createOrder(userId, { supplierId, items, note }) {
  const supplier = await getSupplierById(supplierId);
  if (!supplier) throw new Error("Поставщик не найден");
  if (!items?.length) throw new Error("Добавьте хотя бы одну позицию в заказ");

  const productRows = await query(
    `SELECT id, supplier_id, name, unit, price_per_unit, price_hint
     FROM products WHERE supplier_id = ?`,
    [supplierId]
  );
  const byId = Object.fromEntries(productRows.map((p) => [String(p.id), p]));

  const lines = [];
  let total = 0;

  for (const item of items) {
    const qty = Number(item.quantity);
    if (!qty || qty <= 0) continue;
    const row = byId[String(item.productId)];
    if (!row) throw new Error(`Товар #${item.productId} не найден у поставщика`);
    const unitPrice = resolveProductPrice(row);
    if (unitPrice <= 0) throw new Error(`Нет цены для «${row.name}»`);
    const lineTotal = Math.round(unitPrice * qty * 100) / 100;
    total += lineTotal;
    lines.push({
      productId: row.id,
      productName: row.name,
      unit: row.unit || "шт.",
      quantity: qty,
      unitPrice,
      lineTotal,
    });
  }

  if (!lines.length) throw new Error("Укажите количество хотя бы для одного товара");

  const minOrderRub = parseMinOrderRubles(supplier.minOrder);
  if (minOrderRub != null && total < minOrderRub) {
    throw new Error(
      `Минимальная сумма заказа у поставщика — ${minOrderRub.toLocaleString("ru-RU")} ₽. Сейчас в заказе ${total.toLocaleString("ru-RU")} ₽`
    );
  }

  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const [orderRes] = await conn.execute(
      `INSERT INTO orders (user_id, supplier_id, status, total_amount, note)
       VALUES (?, ?, 'pending', ?, ?)`,
      [userId, supplierId, total, note || null]
    );
    const orderId = orderRes.insertId;
    for (const line of lines) {
      await conn.execute(
        `INSERT INTO order_items (order_id, product_id, product_name, unit, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          line.productId,
          line.productName,
          line.unit,
          line.quantity,
          line.unitPrice,
          line.lineTotal,
        ]
      );
    }
    await conn.commit();
    return getOrderById(orderId, userId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

function mapOrderRow(order, items) {
  return {
    id: order.id,
    supplierId: order.supplier_id,
    supplierName: order.supplier_name,
    status: order.status,
    totalAmount: Number(order.total_amount),
    note: order.note,
    createdAt: order.created_at,
    supplierContacts: {
      phone: order.supplier_phone || "",
      email: order.supplier_email || "",
      website: order.supplier_website || null,
    },
    items: items.map((i) => ({
      productId: i.product_id,
      productName: i.product_name,
      unit: i.unit,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unit_price),
      lineTotal: Number(i.line_total),
    })),
  };
}

export async function getOrderById(orderId, userId) {
  const rows = await query(
    `SELECT o.*, s.name AS supplier_name, s.phone AS supplier_phone,
            s.email AS supplier_email, s.website AS supplier_website
     FROM orders o
     JOIN suppliers s ON s.id = o.supplier_id
     WHERE o.id = ? AND o.user_id = ?`,
    [orderId, userId]
  );
  if (!rows.length) return null;
  const order = rows[0];
  const items = await query(
    `SELECT product_id, product_name, unit, quantity, unit_price, line_total
     FROM order_items WHERE order_id = ?`,
    [orderId]
  );
  return mapOrderRow(order, items);
}

export async function cancelOrder(orderId, userId) {
  const rows = await query(
    `SELECT status FROM orders WHERE id = ? AND user_id = ?`,
    [orderId, userId]
  );
  if (!rows.length) throw new Error("Заказ не найден");
  const { status } = rows[0];
  if (status === "cancelled") throw new Error("Заказ уже отменён");
  if (status === "confirmed") throw new Error("Подтверждённый заказ нельзя отменить");
  await query(`UPDATE orders SET status = 'cancelled' WHERE id = ? AND user_id = ?`, [
    orderId,
    userId,
  ]);
  return getOrderById(orderId, userId);
}

export async function listOrdersForUser(userId) {
  const rows = await query(
    `SELECT o.id, o.supplier_id, o.status, o.total_amount, o.created_at, s.name AS supplier_name
     FROM orders o
     JOIN suppliers s ON s.id = o.supplier_id
     WHERE o.user_id = ?
     ORDER BY o.created_at DESC`,
    [userId]
  );
  return rows.map((r) => ({
    id: r.id,
    supplierId: r.supplier_id,
    supplierName: r.supplier_name,
    status: r.status,
    totalAmount: Number(r.total_amount),
    createdAt: r.created_at,
  }));
}
