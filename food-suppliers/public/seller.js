import { api } from "./auth.js";
import { closeAllPanels, escapeHtml, openPanel } from "./ui.js";
import {
  formatMoney,
  formatProposalDate,
  isProposalEditable,
  parseDemandBudgetInput,
  renderOrderItemsTable,
  renderOrderStatusBadge,
  renderSellerIncomingOrderStatus,
  renderProposalFacts,
  renderProposalItemsSummary,
  renderProposalProductsSection,
  renderSellerProposalStatus,
  truncateMessage,
} from "./proposals-shared.js";
import { createFavoritesStore, favoriteButtonHtml } from "./favorites.js";
import { maybeShowQuickSetup } from "./onboarding.js";
import { isSellerAccount, promptSellerAuth } from "./audience.js";
import { initMyProducts } from "./my-products.js";

const MAX_COMPARE_BUYERS = 3;

const sellerState = {
  category: "",
  city: "",
  query: "",
  organization: "",
  sort: "relevance",
  categories: [],
  cities: [],
  view: "proposals",
  productsController: null,
  myResponses: [],
  incomingOrders: [],
  compareBuyers: [],
  favoritesStore: null,
  _lastList: [],
};

function showSellerView(view) {
  sellerState.view = view;
  const proposals = document.getElementById("seller-proposals-wrap");
  const products = document.getElementById("seller-products-section");
  const incomingOrders = document.getElementById("seller-incoming-orders-section");
  const favorites = document.getElementById("seller-favorites-section");
  if (proposals) proposals.hidden = view !== "proposals";
  if (products) products.hidden = view !== "products";
  if (incomingOrders) incomingOrders.hidden = view !== "incoming-orders";
  if (favorites) favorites.hidden = view !== "favorites";
  if (view === "products") {
    ensureProductsPanel();
  }
  if (view === "incoming-orders") {
    renderIncomingOrders();
  }
  if (view === "favorites") {
    renderSellerFavorites();
  }
  if (view !== "proposals") {
    document.getElementById("seller-compare-bar")?.setAttribute("hidden", "");
  } else {
    renderSellerCompareBar();
  }
}

function buyerDisplayName(buyer) {
  return buyer?.organizationName || buyer?.username || "Покупатель";
}

function renderIncomingOrderCard(order) {
  const buyer = order.buyer || {};
  const name = buyerDisplayName(buyer);
  return `
    <article class="proposal-card" data-incoming-order-id="${order.id}">
      <div class="proposal-card__head">
        <h3 class="proposal-card__title">${escapeHtml(name)}</h3>
        <span class="proposal-card__date">${formatProposalDate(order.createdAt)}</span>
      </div>
      ${renderSellerIncomingOrderStatus(order.status, name)}
      <p class="proposal-card__meta">${escapeHtml(buyer.city || "")}${buyer.region ? ` · ${escapeHtml(buyer.region)}` : ""}</p>
      <p class="proposal-card__message">${order.note ? escapeHtml(truncateMessage(order.note)) : '<span class="muted">Без комментария</span>'}</p>
      <dl class="proposal-card__facts">
        <div><dt>Сумма</dt><dd><strong>${formatMoney(order.totalAmount)} ₽</strong></dd></div>
        <div><dt>Статус</dt><dd>${renderOrderStatusBadge(order.status, "seller")}</dd></div>
      </dl>
      <button type="button" class="btn btn--sm btn--primary" data-incoming-order-open="${order.id}">Открыть</button>
    </article>`;
}

async function updateIncomingOrderStatus(orderId, status) {
  const { order } = await api(`/api/my/incoming-orders/${orderId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  const idx = sellerState.incomingOrders.findIndex((o) => o.id === order.id);
  if (idx >= 0) sellerState.incomingOrders[idx] = order;
  else sellerState.incomingOrders.unshift(order);
  if (sellerState.view === "incoming-orders") {
    const listEl = document.getElementById("seller-incoming-orders-list");
    const meta = document.getElementById("seller-incoming-orders-meta");
    if (listEl) listEl.innerHTML = sellerState.incomingOrders.map(renderIncomingOrderCard).join("");
    if (meta) meta.textContent = `Предложений от покупателей: ${sellerState.incomingOrders.length}`;
  }
  openIncomingOrderPanel(order.id, order);
}

async function openIncomingOrderPanel(orderId, cachedOrder = null) {
  const order = cachedOrder || (await api(`/api/my/incoming-orders/${orderId}`));
  const buyer = order.buyer || {};
  const name = buyerDisplayName(buyer);
  const panel = document.getElementById("panel-seller-incoming-order");
  const isPending = order.status === "pending";
  const actionButtons = isPending
    ? `<button type="button" class="btn btn--primary" id="btn-accept-incoming-order" data-order-id="${order.id}">Принять предложение</button>
       <button type="button" class="btn btn--ghost" id="btn-reject-incoming-order" data-order-id="${order.id}">Отклонить предложение</button>`
    : "";
  const noteBlock = order.note
    ? `<section class="detail-section"><h3>Комментарий покупателя</h3><p>${escapeHtml(order.note)}</p></section>`
    : "";

  panel.innerHTML = `
    <header class="panel__head">
      <h2>Предложение от покупателя</h2>
      <button type="button" class="panel__close" data-close aria-label="Закрыть">×</button>
    </header>
    <div class="panel__body">
      <p class="deal-panel__lead">Покупатель: <strong>${escapeHtml(name)}</strong></p>
      ${renderSellerIncomingOrderStatus(order.status, name)}
      <p class="proposal-card__meta">${formatProposalDate(order.createdAt)}${buyer.city ? ` · ${escapeHtml(buyer.city)}` : ""}${buyer.region ? ` · ${escapeHtml(buyer.region)}` : ""}</p>
      <p class="order-total">Сумма предложения: <strong>${formatMoney(order.totalAmount)} ₽</strong></p>
      <section class="detail-section">
        <h3>Состав предложения</h3>
        ${renderOrderItemsTable(order.items)}
      </section>
      ${noteBlock}
      <section class="detail-section">
        <h3>Контакты покупателя</h3>
        <ul class="contact-list">
          ${buyer.contacts?.phone ? `<li><a href="tel:${buyer.contacts.phone.replace(/\s/g, "")}">${escapeHtml(buyer.contacts.phone)}</a></li>` : ""}
          ${buyer.contacts?.email ? `<li><a href="mailto:${buyer.contacts.email}">${escapeHtml(buyer.contacts.email)}</a></li>` : ""}
        </ul>
      </section>
      <p class="auth-error" id="incoming-order-error" hidden></p>
    </div>
    <footer class="panel__foot">
      ${actionButtons}
      ${buyer.contacts?.phone ? `<a class="btn btn--ghost" href="tel:${buyer.contacts.phone.replace(/\s/g, "")}">Позвонить</a>` : ""}
      ${buyer.contacts?.email ? `<a class="btn btn--ghost" href="mailto:${buyer.contacts.email}">Написать</a>` : ""}
      <button type="button" class="btn btn--ghost" data-close>Закрыть</button>
    </footer>
  `;

  panel.querySelector("#btn-accept-incoming-order")?.addEventListener("click", async () => {
    const errEl = panel.querySelector("#incoming-order-error");
    errEl.hidden = true;
    try {
      await updateIncomingOrderStatus(order.id, "confirmed");
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
    }
  });
  panel.querySelector("#btn-reject-incoming-order")?.addEventListener("click", async () => {
    if (!window.confirm(`Отклонить предложение от «${name}»?`)) return;
    const errEl = panel.querySelector("#incoming-order-error");
    errEl.hidden = true;
    try {
      await updateIncomingOrderStatus(order.id, "cancelled");
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
    }
  });
  openPanel(panel);
}

async function renderIncomingOrders() {
  const meta = document.getElementById("seller-incoming-orders-meta");
  const loading = document.getElementById("seller-incoming-orders-loading");
  const errEl = document.getElementById("seller-incoming-orders-error");
  const listEl = document.getElementById("seller-incoming-orders-list");
  const emptyEl = document.getElementById("seller-incoming-orders-empty");

  loading.hidden = false;
  errEl.hidden = true;
  emptyEl.hidden = true;

  try {
    const list = await api("/api/my/incoming-orders");
    sellerState.incomingOrders = list;
    loading.hidden = true;
    meta.textContent = `Предложений от покупателей: ${list.length}`;
    if (!list.length) {
      listEl.innerHTML = "";
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;
    listEl.innerHTML = list.map(renderIncomingOrderCard).join("");
    listEl.onclick = (e) => {
      const id = e.target.closest("[data-incoming-order-open]")?.dataset.incomingOrderOpen;
      if (id) openIncomingOrderPanel(id);
    };
  } catch (err) {
    loading.hidden = true;
    errEl.hidden = false;
    errEl.querySelector("p").textContent = err.message;
    listEl.innerHTML = "";
  }
}

function ensureProductsPanel() {
  const run = () => {
    if (!sellerState.productsController) {
      sellerState.productsController = initMyProducts({ categories: sellerState.categories });
    } else {
      sellerState.productsController.reload();
    }
  };
  if (sellerState.categories.length) {
    run();
  } else {
    initSellerMeta().then(run);
  }
}

function buildQuery() {
  const p = new URLSearchParams();
  if (sellerState.category) p.set("category", sellerState.category);
  if (sellerState.city) p.set("city", sellerState.city);
  if (sellerState.organization) p.set("org", sellerState.organization);
  if (sellerState.query) p.set("q", sellerState.query);
  if (sellerState.sort) p.set("sort", sellerState.sort);
  return p.toString();
}

function renderSellerCompareBar() {
  const bar = document.getElementById("seller-compare-bar");
  const list = document.getElementById("seller-compare-list");
  const goBtn = document.getElementById("seller-compare-go");
  if (!bar || !list) return;

  const onProposals = sellerState.view === "proposals";
  bar.hidden = !onProposals;
  const hint = document.getElementById("seller-compare-hint");
  const count = sellerState.compareBuyers.length;
  if (hint) {
    hint.hidden = count >= 2;
    hint.textContent =
      count === 1
        ? "Добавьте ещё одну организацию для сравнения"
        : "Добавьте 2 организации для сравнения";
  }
  list.innerHTML = sellerState.compareBuyers
    .map((id) => {
      const b = sellerState._lastList?.find((x) => x.id === Number(id));
      const name = b?.companyName || `№${id}`;
      return `<span class="compare-chip" data-id="${id}">
        <span class="compare-chip__name">${escapeHtml(name)}</span>
        <button type="button" data-remove-seller-compare="${id}" aria-label="Убрать">×</button>
      </span>`;
    })
    .join("");
  if (goBtn) goBtn.disabled = sellerState.compareBuyers.length < 2;
}

function toggleBuyerCompare(id) {
  const numId = Number(id);
  const idx = sellerState.compareBuyers.indexOf(numId);
  if (idx >= 0) sellerState.compareBuyers.splice(idx, 1);
  else if (sellerState.compareBuyers.length < MAX_COMPARE_BUYERS) sellerState.compareBuyers.push(numId);
  renderSellerCompareBar();
  renderBuyerProposals();
}

async function toggleBuyerFavorite(id) {
  if (!sellerState.favoritesStore) {
    sellerState.favoritesStore = createFavoritesStore("buyer_demand");
    await sellerState.favoritesStore.load();
  }
  try {
    await sellerState.favoritesStore.toggle(id);
    if (sellerState.view === "favorites") await renderSellerFavorites();
    else renderBuyerProposals();
  } catch (err) {
    const errEl = document.getElementById("seller-error");
    if (errEl) {
      errEl.hidden = false;
      errEl.querySelector("p").textContent = err.message;
    }
  }
}

function buyerBudgetRub(buyer) {
  return parseDemandBudgetInput(buyer?.budgetText) ?? parseBudgetRubles(buyer?.budgetText) ?? 0;
}

function pickBestBuyerForCompare(items) {
  return (
    [...items].sort((a, b) => {
      const budgetDiff = buyerBudgetRub(b) - buyerBudgetRub(a);
      if (budgetDiff !== 0) return budgetDiff;
      return (b.volumeKg || 0) - (a.volumeKg || 0);
    })[0] || items[0]
  );
}

async function renderBuyerComparePanel() {
  if (sellerState.compareBuyers.length < 2) return;
  try {
    const items = await api(`/api/buyer-demands?ids=${sellerState.compareBuyers.join(",")}`);
    const best = pickBestBuyerForCompare(items);
    const rows = [
      { label: "Компания", key: "companyName" },
      { label: "Тип бизнеса", key: "businessType" },
      { label: "Город", key: "city" },
      { label: "Регион", key: "region" },
      { label: "Категория", key: "categoryLabel" },
      { label: "Объём", key: "volumeText" },
      { label: "Бюджет", get: (b) => b.budgetText || "—" },
      { label: "Телефон", get: (b) => b.contacts?.phone || "—" },
      { label: "Email", get: (b) => b.contacts?.email || "—" },
    ];
    const others = items
      .filter((b) => b.id !== best.id)
      .map((b) => escapeHtml(b.companyName))
      .join(", ");
    const panel = document.getElementById("panel-seller-compare");
    panel.innerHTML = `
      <header class="panel__head">
        <h2>Сравнение покупателей</h2>
        <button type="button" class="panel__close" data-close aria-label="Закрыть">×</button>
      </header>
      <div class="panel__body">
        <section class="compare-winner" aria-label="Рекомендация">
          <p class="compare-winner__label">Рекомендуем связаться с</p>
          <h3 class="compare-winner__name">${escapeHtml(best.companyName)}</h3>
          <p class="compare-winner__score">Наибольший бюджет: <strong>${best.budgetText ? escapeHtml(best.budgetText) : buyerBudgetRub(best) ? `${formatMoney(buyerBudgetRub(best))} ₽` : "—"}</strong></p>
          ${others ? `<p class="compare-winner__others">Остальные в выборке: ${others}</p>` : ""}
        </section>
        <div class="compare-table-wrap">
          <table class="compare-table">
            <thead><tr><th>Параметр</th>${items.map((b) => `<th>${escapeHtml(b.companyName)}</th>`).join("")}</tr></thead>
            <tbody>
              ${rows
                .map((row) => {
                  const cells = items.map((b) => {
                    const val = row.get ? row.get(b) : b[row.key];
                    return `<td>${escapeHtml(String(val ?? "—"))}</td>`;
                  });
                  return `<tr><th scope="row">${row.label}</th>${cells.join("")}</tr>`;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
    openPanel(panel);
  } catch (err) {
    const errEl = document.getElementById("seller-error");
    if (errEl) {
      errEl.hidden = false;
      errEl.querySelector("p").textContent = err.message;
    }
  }
}

function renderBuyerProposalCard(b) {
  const inCompare = sellerState.compareBuyers.includes(b.id);
  const inFavorite = sellerState.favoritesStore?.has(b.id);
  const closedBadge =
    b.isActive === false ? '<span class="badge badge--muted">Заявка закрыта</span>' : "";
  return `
    <article class="buyer-card">
      <div class="buyer-card__top">
        <h3 class="buyer-card__title">${escapeHtml(b.companyName)}</h3>
        <span class="badge badge--ok">${escapeHtml(b.businessType)}</span>
        ${closedBadge}
      </div>
      <p class="buyer-card__meta">${escapeHtml(b.city)}${b.categoryLabel ? ` · ${escapeHtml(b.categoryLabel)}` : ""}</p>
      <p class="buyer-card__desc">${escapeHtml(b.description)}</p>
      <dl class="buyer-card__facts">
        <div><dt>Объём</dt><dd>${escapeHtml(b.volumeText)}</dd></div>
        <div><dt>Бюджет</dt><dd>${b.budgetText ? escapeHtml(b.budgetText) : "—"}</dd></div>
      </dl>
      <div class="buyer-card__actions">
        <button type="button" class="btn btn--primary btn--sm" data-buyer-respond="${b.id}">Ответить на предложение</button>
        ${favoriteButtonHtml(b.id, inFavorite, { sm: true })}
        <button type="button" class="btn btn--sm ${inCompare ? "btn--active" : "btn--ghost"}" data-buyer-compare="${b.id}" ${!inCompare && sellerState.compareBuyers.length >= MAX_COMPARE_BUYERS ? "disabled" : ""}>
          ${inCompare ? "В сравнении" : "Сравнить"}
        </button>
        <a class="btn btn--ghost btn--sm" href="tel:${b.contacts.phone.replace(/\s/g, "")}">Позвонить</a>
        <a class="btn btn--ghost btn--sm" href="mailto:${b.contacts.email}">Написать</a>
      </div>
    </article>`;
}

async function renderSellerFavorites() {
  const meta = document.getElementById("seller-favorites-meta");
  const loading = document.getElementById("seller-favorites-loading");
  const errEl = document.getElementById("seller-favorites-error");
  const listEl = document.getElementById("seller-favorites-list");
  const emptyEl = document.getElementById("seller-favorites-empty");

  loading.hidden = false;
  errEl.hidden = true;
  emptyEl.hidden = true;
  listEl.innerHTML = "";

  try {
    if (!sellerState.favoritesStore) {
      sellerState.favoritesStore = createFavoritesStore("buyer_demand");
    }
    await sellerState.favoritesStore.load();
    const ids = [...sellerState.favoritesStore.ids];
    loading.hidden = true;
    if (!ids.length) {
      meta.textContent = "В избранном: 0 покупателей";
      emptyEl.hidden = false;
      return;
    }
    const list = await api(`/api/buyer-demands?ids=${ids.join(",")}`);
    emptyEl.hidden = true;
    meta.textContent = `В избранном: ${list.length} покупател${list.length === 1 ? "ь" : list.length < 5 ? "я" : "ей"}`;
    listEl.innerHTML = list.map(renderBuyerProposalCard).join("");
    sellerState._lastList = list;
  } catch (err) {
    loading.hidden = true;
    errEl.hidden = false;
    errEl.querySelector("p").textContent = err.message;
    listEl.innerHTML = "";
  }
}

async function renderBuyerProposals() {
  const metaEl = document.getElementById("seller-results-meta");
  const results = document.getElementById("seller-results");
  const empty = document.getElementById("seller-empty");
  const loading = document.getElementById("seller-loading");
  const errEl = document.getElementById("seller-error");

  loading.hidden = false;
  errEl.hidden = true;
  empty.hidden = true;

  try {
    const list = await api(`/api/buyer-demands?${buildQuery()}`);
    loading.hidden = true;
    metaEl.textContent = `Предложений от покупателей: ${list.length}`;
    if (!list.length) {
      results.innerHTML = "";
      renderSellerCompareBar();
      empty.hidden = false;
      const emptyTitle = empty.querySelector("h2");
      const emptyText = empty.querySelector("p");
      if (emptyTitle) emptyTitle.textContent = "Предложений не найдено";
      if (emptyText) {
        emptyText.textContent =
          "Измените фильтры или обновите базу (npm run db:migrate).";
      }
      return;
    }
    empty.hidden = true;
    results.innerHTML = list.map(renderBuyerProposalCard).join("");
    sellerState._lastList = list;
    renderSellerCompareBar();
  } catch (err) {
    loading.hidden = true;
    errEl.hidden = false;
    errEl.querySelector("p").textContent = err.message;
    results.innerHTML = "";
  }
}

async function loadMyResponse(demandId) {
  try {
    return await api(`/api/proposals/by-demand/${demandId}`);
  } catch {
    return null;
  }
}

function parseBudgetRubles(text) {
  if (!text) return null;
  const m = String(text).match(/(\d[\d\s]*)\s*₽/);
  if (!m) return null;
  const value = Number(m[1].replace(/\s/g, ""));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function productUnitPrice(p) {
  if (p.pricePerUnit != null && p.pricePerUnit !== "") return Number(p.pricePerUnit);
  const m = String(p.priceHint || "").match(/(\d+(?:[.,]\d+)?)\s*₽/);
  return m ? Number(m[1].replace(",", ".")) : 0;
}

function collectProposalItems(panel) {
  const items = [];
  panel.querySelectorAll(".order-line").forEach((row) => {
    const check = row.querySelector(".order-line__check");
    const qty = row.querySelector(".order-line__qty");
    if (check?.checked && Number(qty?.value) > 0) {
      items.push({ productId: Number(check.dataset.productId), quantity: Number(qty.value) });
    }
  });
  return items;
}

function recalcProposalOffer(panel, buyer) {
  let total = 0;
  panel.querySelectorAll(".order-line").forEach((row) => {
    const check = row.querySelector(".order-line__check");
    const qty = row.querySelector(".order-line__qty");
    if (!check?.checked) return;
    const q = Number(qty?.value) || 0;
    const price = Number(check.dataset.price) || 0;
    total += price * q;
  });
  const rounded = Math.round(total * 100) / 100;
  const totalEl = panel.querySelector("#proposal-total-sum");
  const totalWrap = panel.querySelector("#proposal-offer-total-wrap");
  if (totalEl) totalEl.textContent = formatMoney(rounded);
  if (totalWrap) totalWrap.hidden = rounded <= 0;

  const priceInput = panel.querySelector('input[name="priceOffer"]');
  if (priceInput && rounded > 0) {
    priceInput.value = `Итого ${formatMoney(rounded)} ₽`;
  }

  const budgetRub = parseBudgetRubles(buyer.budgetText);
  const warn = panel.querySelector("#proposal-budget-warning");
  const overBudget = budgetRub != null && rounded > 0 && rounded > budgetRub;
  if (warn) {
    warn.hidden = !overBudget;
    if (overBudget) {
      warn.textContent = `Сумма (${formatMoney(rounded)} ₽) превышает бюджет покупателя${buyer.budgetText ? ` (${buyer.budgetText})` : ` (${formatMoney(budgetRub)} ₽)`}. Уменьшите количество или подтвердите отправку.`;
    }
  }
  panel.dataset.proposalOverBudget = overBudget ? "1" : "";
  panel.dataset.proposalTotal = String(rounded);
  return rounded;
}

function bindProposalProducts(panel, buyer, products, savedItems) {
  const picker = panel.querySelector("#proposal-product-picker");
  const toggleBtn = panel.querySelector("#btn-toggle-proposal-products");
  const savedById = new Map((savedItems || []).map((l) => [l.productId, l.quantity]));

  toggleBtn?.addEventListener("click", () => {
    if (!products.length) {
      alert("Добавьте товары в разделе «Мои товары», чтобы предложить их покупателю.");
      return;
    }
    if (!picker) return;
    picker.hidden = !picker.hidden;
    toggleBtn.setAttribute("aria-expanded", picker.hidden ? "false" : "true");
    toggleBtn.textContent = picker.hidden ? "Предложить товар" : "Скрыть товары";
  });

  const lines = panel.querySelector("#proposal-offer-lines");
  if (!lines) return;

  lines.addEventListener("change", (e) => {
    const row = e.target.closest(".order-line");
    if (!row) return;
    if (e.target.matches(".order-line__check")) {
      const qty = row.querySelector(".order-line__qty");
      qty.disabled = !e.target.checked;
      if (e.target.checked && Number(qty.value) < 1) qty.value = "1";
    }
    recalcProposalOffer(panel, buyer);
  });
  lines.addEventListener("input", (e) => {
    if (e.target.matches(".order-line__qty")) recalcProposalOffer(panel, buyer);
  });

  panel.querySelectorAll(".order-line").forEach((row) => {
    const check = row.querySelector(".order-line__check");
    const qty = row.querySelector(".order-line__qty");
    const pid = Number(check?.dataset.productId);
    const savedQty = savedById.get(pid);
    if (savedQty) {
      check.checked = true;
      qty.disabled = false;
      qty.value = String(savedQty);
    }
  });
  recalcProposalOffer(panel, buyer);
}

function bindResponseForm(panel, buyer) {
  const form = panel.querySelector("#proposal-form");
  const errEl = panel.querySelector("#proposal-error");
  const okEl = panel.querySelector("#proposal-success");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errEl.hidden = true;
    okEl.hidden = true;
    const fd = new FormData(form);
    const items = collectProposalItems(panel);
    const total = Number(panel.dataset.proposalTotal) || 0;

    if (panel.dataset.proposalOverBudget === "1") {
      const ok = window.confirm(
        `Сумма предложения (${formatMoney(total)} ₽) выше бюджета покупателя. Всё равно отправить ответ?`
      );
      if (!ok) return;
    }

    try {
      const res = await api("/api/proposals", {
        method: "POST",
        body: JSON.stringify({
          buyerDemandId: buyer.id,
          message: fd.get("message"),
          priceOffer: fd.get("priceOffer"),
          volumeOffer: fd.get("volumeOffer"),
          items: items.length ? items : undefined,
        }),
      });
      okEl.textContent = res.updated
        ? "Ваш ответ обновлён."
        : "Ответ отправлен покупателю.";
      okEl.hidden = false;
      const listBtn = panel.querySelector("#btn-open-my-responses");
      if (listBtn) listBtn.hidden = false;
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
    }
  });
}

function renderSellerResponseCard(p) {
  const buyer = p.buyer || {};
  return `
    <article class="proposal-card" data-seller-response-id="${p.id}">
      <div class="proposal-card__head">
        <h3 class="proposal-card__title">${escapeHtml(buyer.companyName || "Покупатель")}</h3>
        <span class="proposal-card__date">${formatProposalDate(p.updatedAt || p.createdAt)}</span>
      </div>
      ${renderSellerProposalStatus(p.status, buyer.companyName)}
      <p class="proposal-card__meta">${escapeHtml(buyer.city || "")}${buyer.region ? ` · ${escapeHtml(buyer.region)}` : ""}${buyer.volumeText ? ` · ${escapeHtml(buyer.volumeText)}` : ""}</p>
      <p class="proposal-card__message">${escapeHtml(truncateMessage(p.message))}</p>
      ${renderProposalItemsSummary(p.lineItems)}
      ${renderProposalFacts(p.priceOffer, p.volumeOffer, p.offerTotal)}
      <button type="button" class="btn btn--sm btn--ghost" data-seller-response-open="${p.id}">Открыть</button>
    </article>`;
}

function openSellerResponseDetail(proposal) {
  const buyer = proposal.buyer || {};
  const panel = document.getElementById("panel-seller-responses");

  panel.innerHTML = `
    <header class="panel__head">
      <h2>Ответ покупателю</h2>
      <button type="button" class="panel__close" data-close aria-label="Закрыть">×</button>
    </header>
    <div class="panel__body">
      <p class="deal-panel__lead">Покупатель: <strong>${escapeHtml(buyer.companyName || "")}</strong></p>
      ${renderSellerProposalStatus(proposal.status, buyer.companyName, { showLockNote: true })}
      <p class="proposal-card__meta">${formatProposalDate(proposal.updatedAt || proposal.createdAt)}${buyer.city ? ` · ${escapeHtml(buyer.city)}` : ""}${buyer.region ? ` · ${escapeHtml(buyer.region)}` : ""}</p>
      <dl class="detail-dl">
        <div><dt>Категория закупки</dt><dd>${buyer.categoryLabel ? escapeHtml(buyer.categoryLabel) : "—"}</dd></div>
        <div><dt>Объём заявки</dt><dd>${buyer.volumeText ? escapeHtml(buyer.volumeText) : "—"}</dd></div>
        <div><dt>Бюджет</dt><dd>${buyer.budgetText ? escapeHtml(buyer.budgetText) : "—"}</dd></div>
      </dl>
      <section class="detail-section">
        <h3>Ваш ответ</h3>
        <p>${escapeHtml(proposal.message)}</p>
        ${renderProposalFacts(proposal.priceOffer, proposal.volumeOffer, proposal.offerTotal)}
      </section>
      ${renderProposalProductsSection(proposal.lineItems, proposal.offerTotal)}
    </div>
    <footer class="panel__foot">
      ${
        isProposalEditable(proposal.status)
          ? `<button type="button" class="btn btn--primary" data-edit-response="${proposal.buyerDemandId}">Изменить ответ</button>`
          : ""
      }
      <button type="button" class="btn btn--ghost" data-back-to-responses>К списку ответов</button>
      <button type="button" class="btn btn--ghost" data-close>Закрыть</button>
    </footer>
  `;

  panel.querySelector("[data-edit-response]")?.addEventListener("click", () => {
    closeAllPanels();
    openBuyerDetail(proposal.buyerDemandId, { focusReply: true });
  });
  panel.querySelector("[data-back-to-responses]")?.addEventListener("click", () => {
    openMyResponsesPanel();
  });
  openPanel(panel);
}

async function openMyResponsesPanel() {
  syncSellerHeaderNavActive("my-responses");
  const panel = document.getElementById("panel-seller-responses");
  panel.innerHTML = `
    <header class="panel__head">
      <h2>Мои ответы покупателям</h2>
      <button type="button" class="panel__close" data-close aria-label="Закрыть">×</button>
    </header>
    <div class="panel__body">
      <p class="field__hint">Все отправленные ответы на заявки покупателей.</p>
      <div class="state state--loading" id="seller-responses-loading">Загрузка…</div>
      <p class="auth-error" id="seller-responses-error" hidden></p>
      <div class="results results--proposals-list" id="seller-responses-list" role="list"></div>
      <div class="empty" id="seller-responses-empty" hidden>
        <h2>Ответов пока нет</h2>
        <p>Найдите заявку покупателя и нажмите «Ответить на предложение».</p>
      </div>
    </div>
    <footer class="panel__foot">
      <button type="button" class="btn btn--ghost" data-close>Закрыть</button>
    </footer>
  `;
  openPanel(panel);

  const loading = panel.querySelector("#seller-responses-loading");
  const errEl = panel.querySelector("#seller-responses-error");
  const listEl = panel.querySelector("#seller-responses-list");
  const emptyEl = panel.querySelector("#seller-responses-empty");

  try {
    const list = await api("/api/proposals");
    sellerState.myResponses = list;
    loading.hidden = true;
    if (!list.length) {
      emptyEl.hidden = false;
      listEl.innerHTML = "";
      return;
    }
    emptyEl.hidden = true;
    listEl.innerHTML = list.map(renderSellerResponseCard).join("");
    listEl.onclick = (e) => {
      const id = e.target.closest("[data-seller-response-open]")?.dataset.sellerResponseOpen;
      if (!id) return;
      const proposal = sellerState.myResponses.find((p) => p.id === Number(id));
      if (proposal) openSellerResponseDetail(proposal);
    };
  } catch (err) {
    loading.hidden = true;
    errEl.textContent = err.message;
    errEl.hidden = false;
  }
}

function renderProposalProductLines(products) {
  if (!products.length) {
    return '<p class="muted">В каталоге нет товаров — добавьте их в разделе «Мои товары».</p>';
  }
  return `<div class="order-lines" id="proposal-offer-lines">
    ${products
      .map((p) => {
        const price = productUnitPrice(p);
        return `
            <label class="order-line">
              <input type="checkbox" class="order-line__check" data-product-id="${p.id}" data-price="${price}" data-unit="${escapeHtml(p.unit)}">
              <span class="order-line__info">
                <strong>${escapeHtml(p.name)}</strong>
                <span class="muted">${formatMoney(price)} ₽ / ${escapeHtml(p.unit)}</span>
              </span>
              <input type="number" class="order-line__qty" min="0" step="1" value="0" disabled placeholder="0">
            </label>`;
      })
      .join("")}
  </div>`;
}

async function openBuyerDetail(id, options = {}) {
  let b = sellerState._lastList?.find((x) => x.id === Number(id));
  if (!b) {
    try {
      const list = await api(`/api/buyer-demands?sort=relevance`);
      sellerState._lastList = list;
      b = list.find((x) => x.id === Number(id));
    } catch {
      return;
    }
  }
  if (!b) return;

  const [myResponse, catalog] = await Promise.all([
    loadMyResponse(b.id),
    api("/api/my/products").catch(() => ({ products: [] })),
  ]);
  const products = catalog.products || [];
  const savedItems = myResponse?.lineItems || [];
  const budgetRub = parseBudgetRubles(b.budgetText);
  const showPickerInitially = savedItems.length > 0;
  const locked = myResponse && !isProposalEditable(myResponse.status);

  const lockedSection = locked
    ? `<section class="proposal-form-section">
        <h3>Ваш ответ на предложение</h3>
        ${renderSellerProposalStatus(myResponse.status, b.companyName, { showLockNote: true })}
        <p>${escapeHtml(myResponse.message)}</p>
        ${renderProposalItemsSummary(myResponse.lineItems)}
        ${renderProposalFacts(myResponse.priceOffer, myResponse.volumeOffer, myResponse.offerTotal)}
        ${renderProposalProductsSection(myResponse.lineItems, myResponse.offerTotal)}
        <button type="button" class="btn btn--ghost" id="btn-open-my-responses">Мои ответы покупателям</button>
      </section>`
    : "";

  const editableSection = locked
    ? ""
    : `<section class="proposal-form-section">
        <h3>${myResponse ? "Ваш ответ на предложение" : "Ответить на предложение"}</h3>
        ${myResponse ? renderSellerProposalStatus(myResponse.status, b.companyName) : '<p class="proposal-form-section__lead">Опишите условия поставки — покупатель получит ваш ответ.</p>'}
        <div class="proposal-offer-block">
          <div class="proposal-offer-block__head">
            <p class="field__hint">Сформируйте предложение из вашего каталога — сумма пересчитается автоматически.</p>
            <button type="button" class="btn btn--ghost btn--sm" id="btn-toggle-proposal-products" aria-expanded="${showPickerInitially ? "true" : "false"}">${showPickerInitially ? "Скрыть товары" : "Предложить товар"}</button>
          </div>
          <div id="proposal-product-picker" ${showPickerInitially ? "" : "hidden"}>
            ${renderProposalProductLines(products)}
          </div>
          <p class="order-total" id="proposal-offer-total-wrap" hidden>Итого по товарам: <strong id="proposal-total-sum">0</strong> ₽</p>
          <p class="proposal-budget-warning" id="proposal-budget-warning" hidden></p>
          ${budgetRub != null ? `<p class="field__hint">Бюджет покупателя: <strong>${b.budgetText ? escapeHtml(b.budgetText) : formatMoney(budgetRub) + " ₽"}</strong></p>` : ""}
        </div>
        <form id="proposal-form" class="proposal-form">
          <label class="field">
            <span class="field__label">Текст ответа</span>
            <textarea name="message" rows="4" required placeholder="Ассортимент, сроки, условия оплаты…">${myResponse ? escapeHtml(myResponse.message) : ""}</textarea>
          </label>
          <label class="field">
            <span class="field__label">Цена / условия</span>
            <input type="text" name="priceOffer" value="${myResponse?.priceOffer ? escapeHtml(myResponse.priceOffer) : ""}" placeholder="Заполнится при выборе товаров…">
          </label>
          <label class="field">
            <span class="field__label">Объём поставки (необязательно)</span>
            <input type="text" name="volumeOffer" value="${myResponse?.volumeOffer ? escapeHtml(myResponse.volumeOffer) : ""}" placeholder="до 500 кг/нед…">
          </label>
          <div class="proposal-form__actions">
            <p class="auth-error" id="proposal-error" hidden></p>
            <p class="proposal-success" id="proposal-success" hidden></p>
            <button type="submit" class="btn btn--primary">${myResponse ? "Сохранить ответ" : "Отправить ответ"}</button>
            <button type="button" class="btn btn--ghost" id="btn-open-my-responses" ${myResponse ? "" : "hidden"}>Мои ответы покупателям</button>
          </div>
        </form>
      </section>`;

  const panel = document.getElementById("panel-seller-detail");
  panel.innerHTML = `
    <header class="panel__head">
      <h2>${escapeHtml(b.companyName)}</h2>
      <button type="button" class="panel__close" data-close aria-label="Закрыть">×</button>
    </header>
    <div class="panel__body">
      <p><span class="badge badge--ok">${escapeHtml(b.businessType)}</span></p>
      <p>${escapeHtml(b.description)}</p>
      <dl class="detail-dl">
        <div><dt>Город</dt><dd>${escapeHtml(b.city)}</dd></div>
        <div><dt>Категория закупки</dt><dd>${b.categoryLabel ? escapeHtml(b.categoryLabel) : "—"}</dd></div>
        <div><dt>Объём</dt><dd>${escapeHtml(b.volumeText)}</dd></div>
        <div><dt>Бюджет</dt><dd>${b.budgetText ? escapeHtml(b.budgetText) : "—"}</dd></div>
      </dl>
      <h3>Контакты покупателя</h3>
      <ul class="contact-list">
        <li><a href="tel:${b.contacts.phone}">${escapeHtml(b.contacts.phone)}</a></li>
        <li><a href="mailto:${b.contacts.email}">${escapeHtml(b.contacts.email)}</a></li>
      </ul>
      ${lockedSection}
      ${editableSection}
    </div>
    <footer class="panel__foot">
      <a class="btn btn--ghost" href="tel:${b.contacts.phone.replace(/\s/g, "")}">Позвонить</a>
      <a class="btn btn--ghost" href="mailto:${b.contacts.email}">Email</a>
    </footer>
  `;
  if (!locked) {
    bindProposalProducts(panel, b, products, savedItems);
    bindResponseForm(panel, b);
  }
  panel.querySelector("#btn-open-my-responses")?.addEventListener("click", () => openMyResponsesPanel());
  openPanel(panel);
  if (options.focusReply && !locked) {
    requestAnimationFrame(() => {
      panel.querySelector(".proposal-form-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      panel.querySelector("#proposal-form textarea")?.focus();
    });
  }
}

async function initSellerMeta() {
  const [categories, cities] = await Promise.all([
    api("/api/categories"),
    api("/api/cities"),
  ]);
  sellerState.categories = categories;
  sellerState.cities = cities;
  const cat = document.getElementById("seller-filter-category");
  const cityEl = document.getElementById("seller-filter-city");
  categories.forEach((c) => {
    const o = document.createElement("option");
    o.value = c.id;
    o.textContent = c.label;
    cat.appendChild(o);
  });
  cities.forEach((c) => {
    const o = document.createElement("option");
    o.value = c;
    o.textContent = c;
    cityEl.appendChild(o);
  });
}

function syncSellerHeaderNavActive(view) {
  document.querySelectorAll("#seller-header-nav [data-seller-view]").forEach((tab) => {
    tab.classList.toggle("is-active", view != null && tab.dataset.sellerView === view);
  });
}

function showMyProducts() {
  showSellerView("products");
  syncSellerHeaderNavActive("products");
  document.getElementById("seller-products-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showSellerProposals() {
  showSellerView("proposals");
  syncSellerHeaderNavActive("proposals");
  document.getElementById("seller-proposals-wrap")?.scrollIntoView({ behavior: "smooth", block: "start" });
  renderBuyerProposals();
}

function showIncomingOrders() {
  closeAllPanels();
  showSellerView("incoming-orders");
  syncSellerHeaderNavActive("incoming-orders");
  document.getElementById("seller-incoming-orders-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showSellerFavorites() {
  closeAllPanels();
  showSellerView("favorites");
  syncSellerHeaderNavActive("favorites");
  document.getElementById("seller-favorites-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function bindSellerHeaderNav() {
  document.getElementById("seller-header-nav")?.addEventListener("click", (e) => {
    const tab = e.target.closest("[data-seller-view]");
    if (!tab) return;
    if (!isSellerAccount()) {
      promptSellerAuth();
      return;
    }
    if (tab.dataset.sellerView === "proposals") {
      showSellerProposals();
    } else if (tab.dataset.sellerView === "products") {
      showMyProducts();
    } else if (tab.dataset.sellerView === "my-responses") {
      openMyResponsesPanel();
    } else if (tab.dataset.sellerView === "incoming-orders") {
      showIncomingOrders();
    } else if (tab.dataset.sellerView === "favorites") {
      showSellerFavorites();
    }
  });

  document.querySelector(".brand")?.addEventListener("click", (e) => {
    const sellerApp = document.getElementById("seller-app");
    if (!sellerApp || sellerApp.hidden || sellerState.view === "proposals") return;
    e.preventDefault();
    showSellerProposals();
  });
}

export function initSellerApp() {
  if (!isSellerAccount()) {
    promptSellerAuth();
    return;
  }

  showSellerProposals();
  bindSellerHeaderNav();

  const form = document.getElementById("seller-search-form");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    sellerState.category = document.getElementById("seller-filter-category").value;
    sellerState.city = document.getElementById("seller-filter-city").value;
    sellerState.organization = document.getElementById("seller-filter-organization").value;
    sellerState.query = document.getElementById("seller-filter-query").value;
    sellerState.sort = document.getElementById("seller-filter-sort").value;
    renderBuyerProposals();
  });
  form?.addEventListener("change", () => form.requestSubmit());
  form?.addEventListener("input", (e) => {
    if (e.target.matches("input")) form.requestSubmit();
  });
  document.getElementById("reset-seller-filters")?.addEventListener("click", () => {
    form.reset();
    form.requestSubmit();
  });
  const handleSellerBuyerCardClick = (e) => {
    const favBtn = e.target.closest("[data-favorite-id]");
    if (favBtn) {
      toggleBuyerFavorite(favBtn.dataset.favoriteId);
      return;
    }
    const compareId = e.target.closest("[data-buyer-compare]")?.dataset.buyerCompare;
    if (compareId) {
      toggleBuyerCompare(compareId);
      return;
    }
    const respondId = e.target.closest("[data-buyer-respond]")?.dataset.buyerRespond;
    if (respondId) {
      openBuyerDetail(respondId, { focusReply: true });
    }
  };
  document.getElementById("seller-results")?.addEventListener("click", handleSellerBuyerCardClick);
  document.getElementById("seller-favorites-list")?.addEventListener("click", handleSellerBuyerCardClick);
  document.getElementById("seller-compare-go")?.addEventListener("click", () => renderBuyerComparePanel());
  document.getElementById("seller-compare-clear")?.addEventListener("click", () => {
    sellerState.compareBuyers = [];
    renderSellerCompareBar();
    renderBuyerProposals();
  });
  document.getElementById("seller-compare-list")?.addEventListener("click", (e) => {
    const id = e.target.closest("[data-remove-seller-compare]")?.dataset.removeSellerCompare;
    if (id) toggleBuyerCompare(id);
  });
  document.getElementById("overlay")?.addEventListener("click", (e) => {
    if (e.target.id === "overlay" || e.target.closest("[data-close]")) {
      closeAllPanels();
    }
  });

  initSellerMeta()
    .then(async () => {
      sellerState.favoritesStore = createFavoritesStore("buyer_demand");
      await sellerState.favoritesStore.load();
      await maybeShowQuickSetup("seller", {
        categories: sellerState.categories,
        cities: sellerState.cities,
        fetchSuggestions: () => api(`/api/buyer-demands?sort=relevance`),
        applyFilters: (f) => {
          const cat = document.getElementById("seller-filter-category");
          const cityEl = document.getElementById("seller-filter-city");
          const q = document.getElementById("seller-filter-query");
          const org = document.getElementById("seller-filter-organization");
          if (f.category != null && cat) cat.value = f.category;
          if (f.city != null && cityEl) cityEl.value = f.city;
          else if (f.region != null && cityEl) cityEl.value = f.region;
          if (f.organization != null && org) org.value = f.organization;
          if (f.query != null && q) q.value = f.query;
          sellerState.category = cat?.value || "";
          sellerState.city = cityEl?.value || "";
          sellerState.organization = org?.value || "";
          sellerState.query = q?.value || "";
        },
      });
      form?.requestSubmit();
    })
    .catch((err) => {
      document.getElementById("seller-error").hidden = false;
      document.getElementById("seller-error").querySelector("p").textContent = err.message;
    });
}
