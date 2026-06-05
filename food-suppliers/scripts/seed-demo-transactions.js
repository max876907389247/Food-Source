import "dotenv/config";
import mysql from "mysql2/promise";

const SEED_MARKER = "demo-seed";
const PRODUCTS_PER_SUPPLIER = 5;
const PROPOSALS_PER_SELLER = 2;
const DEMANDS_PER_BUYER = 3;
const ORDERS_PER_BUYER = 2;

const PROPOSAL_STATUSES = ["pending", "accepted", "rejected"];
const ORDER_STATUSES = ["pending", "confirmed", "cancelled"];

const config = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "foodsource",
  password: process.env.DB_PASSWORD || "foodsource",
  database: process.env.DB_NAME || "foodsource",
};

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function parseMinOrderRubles(minOrderText) {
  if (!minOrderText) return null;
  const m = String(minOrderText).match(/(\d[\d\s]*)\s*₽/);
  if (!m) return null;
  const value = Number(m[1].replace(/\s/g, ""));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function resolveProductPrice(product) {
  if (product.price_per_unit != null && product.price_per_unit !== "") {
    return Number(product.price_per_unit);
  }
  const hint = product.price_hint || "";
  const m = String(hint).match(/(\d+(?:[.,]\d+)?)\s*₽/);
  return m ? Number(m[1].replace(",", ".")) : 0;
}

const PRODUCT_TEMPLATES = {
  ingredients: ["Мука пшеничная", "Крупа гречневая", "Сахар", "Соль морская", "Крахмал"],
  ready: ["Соус томатный", "Пюре картофельное", "Котлета куриная", "Суп-пюре", "Рагу овощное"],
  packaging: ["Контейнер 500 мл", "Стакан 400 мл", "Крышка PP", "Пакет крафт", "Ложка одноразовая"],
  dairy: ["Молоко 3,2%", "Сметана 20%", "Творог 9%", "Сыр твёрдый", "Йогурт натуральный"],
  meat: ["Куриное филе", "Говядина тушёная", "Фарш свиной", "Индейка бедро", "Колбаса варёная"],
  bakery: ["Булочка бургер", "Круассан", "Батон нарезной", "Пирог яблочный", "Хлеб ржаной"],
  beverages: ["Сок яблочный", "Сироп ваниль", "Чай чёрный", "Вода минеральная", "Лимонад"],
  frozen: ["Овощи микс", "Лосось филе", "Креветки", "Пельмени", "Ягоды смесь"],
};

async function cleanupSeedData(conn) {
  await conn.query(
    `DELETE oi FROM order_items oi
     INNER JOIN orders o ON o.id = oi.order_id
     WHERE o.note = ?`,
    [SEED_MARKER]
  );
  await conn.query("DELETE FROM orders WHERE note = ?", [SEED_MARKER]);
  await conn.query("DELETE FROM supply_proposals WHERE message LIKE ?", ["Демо-предложение%"]);
  await conn.query("DELETE FROM buyer_demands WHERE description LIKE ?", [`%[${SEED_MARKER}]%`]);
  await conn.query("DELETE FROM products WHERE name LIKE ?", ["Демо:%"]);
}

async function seedProducts(conn) {
  const [suppliers] = await conn.query(
    `SELECT s.id, s.min_order, MIN(sc.category_id) AS category_id
     FROM suppliers s
     INNER JOIN supplier_categories sc ON sc.supplier_id = s.id
     GROUP BY s.id, s.min_order
     ORDER BY s.id`
  );

  let added = 0;
  for (const supplier of suppliers) {
    const categoryId = supplier.category_id;
    const templates = PRODUCT_TEMPLATES[categoryId] || [
      "Товар А",
      "Товар Б",
      "Товар В",
      "Товар Г",
      "Товар Д",
    ];

    await conn.query("UPDATE products SET category_id = ? WHERE supplier_id = ?", [
      categoryId,
      supplier.id,
    ]);

    const [[{ cnt }]] = await conn.query(
      "SELECT COUNT(*) AS cnt FROM products WHERE supplier_id = ?",
      [supplier.id]
    );
    const need = PRODUCTS_PER_SUPPLIER - Number(cnt);
    if (need <= 0) continue;

    const [[priceRow]] = await conn.query(
      `SELECT price_per_unit, price_hint FROM products WHERE supplier_id = ? LIMIT 1`,
      [supplier.id]
    );
    const basePrice = priceRow ? resolveProductPrice(priceRow) || 100 : 100;
    const minOrderRub = parseMinOrderRubles(supplier.min_order);
    const minOrderText = minOrderRub
      ? `от ${Math.round(minOrderRub / PRODUCTS_PER_SUPPLIER).toLocaleString("ru-RU")} ₽`
      : "от 1 000 ₽";

    for (let i = 0; i < need; i++) {
      const name = `Демо: ${templates[i % templates.length]}`;
      const price = Math.round((basePrice * (0.85 + (i % 5) * 0.05)) * 100) / 100;
      await conn.query(
        `INSERT INTO products (supplier_id, name, category_id, description, price_hint, price_per_unit, min_order, unit)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          supplier.id,
          name,
          categoryId,
          `Демо-версия каталога [${SEED_MARKER}]`,
          `от ${price.toLocaleString("ru-RU")} ₽`,
          price,
          minOrderText,
          categoryId === "packaging" || categoryId === "bakery" ? "шт." : "кг",
        ]
      );
      added += 1;
    }
  }
  return added;
}

async function seedBuyerDemands(conn) {
  const [buyers] = await conn.query(
    `SELECT id, organization_name, city, region, contact_phone, contact_email
     FROM users WHERE audience = 'buyer' AND role = 'user'
     ORDER BY id`
  );
  const [categories] = await conn.query("SELECT id FROM categories ORDER BY id");

  let added = 0;
  for (const buyer of buyers) {
    const [[{ cnt }]] = await conn.query(
      "SELECT COUNT(*) AS cnt FROM buyer_demands WHERE user_id = ?",
      [buyer.id]
    );
    const need = DEMANDS_PER_BUYER - Number(cnt);
    if (need <= 0) continue;

    const org = buyer.organization_name || `Покупатель #${buyer.id}`;
    const city = buyer.city || "Москва";
    const region = buyer.region || city;

    for (let i = 0; i < need; i++) {
      const category = categories[(buyer.id + i) % categories.length];
      const volumeKg = 50 + ((buyer.id + i) % 8) * 25;
      const budget = 15000 + ((buyer.id + i) % 6) * 10000;
      await conn.query(
        `INSERT INTO buyer_demands (
          user_id, company_name, city, region, business_type, category_id,
          volume_text, volume_kg, budget_text, description, contact_phone, contact_email, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          buyer.id,
          org,
          city,
          region,
          "Ритейл",
          category.id,
          `от ${volumeKg} кг`,
          volumeKg,
          `до ${budget.toLocaleString("ru-RU")} ₽`,
          `Дополнительный запрос на закупку (${i + 1}) [${SEED_MARKER}]`,
          buyer.contact_phone || "+7 900 000-00-00",
          buyer.contact_email || `buyer${buyer.id}@demo.local`,
        ]
      );
      added += 1;
    }
  }
  return added;
}

async function seedProposals(conn) {
  const [sellers] = await conn.query(
    `SELECT id, supplier_id FROM users WHERE audience = 'seller' AND supplier_id IS NOT NULL ORDER BY id`
  );
  const [demands] = await conn.query(
    "SELECT id, category_id FROM buyer_demands ORDER BY id"
  );
  const acceptedDemands = new Set();

  let added = 0;
  for (const seller of sellers) {
    const [products] = await conn.query(
      `SELECT id, name, unit, price_per_unit, price_hint FROM products WHERE supplier_id = ? ORDER BY id LIMIT 3`,
      [seller.supplier_id]
    );
    if (!products.length) continue;

    const shuffled = [...demands].sort(() => Math.random() - 0.5);
    let picked = 0;
    for (const demand of shuffled) {
      if (picked >= PROPOSALS_PER_SELLER) break;

      const status = pickRandom(PROPOSAL_STATUSES);
      if (status === "accepted" && acceptedDemands.has(demand.id)) continue;

      const lines = products.slice(0, 2).map((p, idx) => {
        const unitPrice = resolveProductPrice(p);
        const quantity = idx === 0 ? 10 : 5;
        const lineTotal = Math.round(unitPrice * quantity * 100) / 100;
        return {
          productId: p.id,
          name: p.name,
          unit: p.unit || "кг",
          quantity,
          unitPrice,
          lineTotal,
        };
      });
      const offerTotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);

      try {
        await conn.query(
          `INSERT INTO supply_proposals (
            seller_user_id, buyer_demand_id, message, price_offer, volume_offer, line_items, offer_total, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            seller.id,
            demand.id,
            `Демо-предложение от поставщика ${seller.supplier_id}`,
            `Итого ${offerTotal.toLocaleString("ru-RU")} ₽`,
            lines.map((l) => `${l.quantity} ${l.unit}`).join(", "),
            JSON.stringify(lines),
            offerTotal,
            status,
          ]
        );
        if (status === "accepted") {
          acceptedDemands.add(demand.id);
          await conn.query("UPDATE buyer_demands SET is_active = 0 WHERE id = ?", [demand.id]);
        }
        added += 1;
        picked += 1;
      } catch (err) {
        if (err.code !== "ER_DUP_ENTRY") throw err;
      }
    }
  }
  return added;
}

async function seedOrders(conn) {
  const [buyers] = await conn.query(
    `SELECT id FROM users WHERE audience = 'buyer' AND role = 'user' ORDER BY id`
  );
  const [suppliers] = await conn.query(
    "SELECT id, min_order FROM suppliers ORDER BY id"
  );

  let added = 0;
  for (const buyer of buyers) {
    const shuffledSuppliers = [...suppliers].sort(() => Math.random() - 0.5);
    let created = 0;

    for (const supplier of shuffledSuppliers) {
      if (created >= ORDERS_PER_BUYER) break;

      const [products] = await conn.query(
        `SELECT id, name, unit, price_per_unit, price_hint FROM products WHERE supplier_id = ? ORDER BY id LIMIT 2`,
        [supplier.id]
      );
      if (!products.length) continue;

      const minOrderRub = parseMinOrderRubles(supplier.min_order) || 1000;
      const lines = [];
      let total = 0;

      for (const product of products) {
        const unitPrice = resolveProductPrice(product);
        if (unitPrice <= 0) continue;
        let quantity = Math.max(1, Math.ceil(minOrderRub / (unitPrice * products.length) / 10) * 10);
        if (product.unit === "шт." || product.unit === "порция") {
          quantity = Math.max(quantity, Math.ceil(minOrderRub / unitPrice));
        }
        const lineTotal = Math.round(unitPrice * quantity * 100) / 100;
        total += lineTotal;
        lines.push({ product, quantity, unitPrice, lineTotal });
      }

      if (!lines.length || total < minOrderRub) continue;

      const status = pickRandom(ORDER_STATUSES);
      const [orderRes] = await conn.query(
        `INSERT INTO orders (user_id, supplier_id, status, total_amount, note) VALUES (?, ?, ?, ?, ?)`,
        [buyer.id, supplier.id, status, total, SEED_MARKER]
      );

      for (const line of lines) {
        await conn.query(
          `INSERT INTO order_items (order_id, product_id, product_name, unit, quantity, unit_price, line_total)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            orderRes.insertId,
            line.product.id,
            line.product.name,
            line.product.unit || "кг",
            line.quantity,
            line.unitPrice,
            line.lineTotal,
          ]
        );
      }

      added += 1;
      created += 1;
    }
  }
  return added;
}

async function run() {
  const conn = await mysql.createConnection(config);
  console.log("Демо-данные: товары, заявки, предложения, заказы…");

  await cleanupSeedData(conn);
  const productsAdded = await seedProducts(conn);
  const demandsAdded = await seedBuyerDemands(conn);
  const proposalsAdded = await seedProposals(conn);
  const ordersAdded = await seedOrders(conn);

  const [[products]] = await conn.query("SELECT COUNT(*) AS c FROM products");
  const [[demands]] = await conn.query("SELECT COUNT(*) AS c FROM buyer_demands");
  const [[proposals]] = await conn.query("SELECT COUNT(*) AS c FROM supply_proposals");
  const [[orders]] = await conn.query("SELECT COUNT(*) AS c FROM orders");

  console.log(`  + товаров: ${productsAdded} (всего в БД: ${products.c})`);
  console.log(`  + заявок покупателей: ${demandsAdded} (всего: ${demands.c})`);
  console.log(`  + предложений: ${proposalsAdded} (всего: ${proposals.c})`);
  console.log(`  + заказов: ${ordersAdded} (всего: ${orders.c})`);
  console.log("\nГотово. Повторный запуск обновит демо-записи.");

  await conn.end();
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
