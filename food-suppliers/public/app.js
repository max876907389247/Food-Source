import { api, auth, isLoggedIn, openAuthModal } from "./auth.js";
import {
  canUseBuyerFeatures,
  canViewSupplierDetail,
  promptBuyerAuth,
} from "./audience.js";
import { initMyDemands } from "./my-demands.js";
import { closeAllPanels, openPanel } from "./modal.js";
import { maybeShowQuickSetup } from "./onboarding.js";
import { escapeHtml } from "./dom.js";

const MAX_COMPARE = 3;

const state = {
  category: "",
  region: "",
  query: "",
  sort: "score",
  budgetKg: "",
  compare: [],
  view: "list",
  categories: [],
  regions: [],
  loading: true,
  error: null,
  readOnly: false,
  demandsInited: false,
};

const els = {
  searchForm: document.getElementById("search-form"),
  category: document.getElementById("filter-category"),
  region: document.getElementById("filter-region"),
  query: document.getElementById("filter-query"),
  budget: document.getElementById("filter-budget"),
  sort: document.getElementById("filter-sort"),
  results: document.getElementById("results"),
  resultsMeta: document.getElementById("results-meta"),
  empty: document.getElementById("empty-state"),
  loading: document.getElementById("loading-state"),
  error: document.getElementById("error-state"),
  compareBar: document.getElementById("compare-bar"),
  compareList: document.getElementById("compare-list"),
  compareGo: document.getElementById("compare-go"),
  compareClear: document.getElementById("compare-clear"),
  panelCompare: document.getElementById("panel-compare"),
  panelDetail: document.getElementById("panel-detail"),
  panelDeal: document.getElementById("panel-deal"),
  panelOrders: document.getElementById("panel-orders"),
  overlay: document.getElementById("overlay"),
  navTabs: document.querySelectorAll("#header-nav [data-view]"),
  recommendation: document.getElementById("recommendation-card"),
};

function stars(rating) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  let out = "";
  for (let i = 0; i < 5; i++) {
    if (i < full) out += "★";
    else if (i === full && half) out += "⯨";
    else out += "☆";
  }
  return out;
}

function formatMoney(n) {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

function parseMinOrderRubles(minOrderText) {
  if (!minOrderText) return null;
  const m = String(minOrderText).match(/(\d[\d\s]*)\s*₽/);
  if (!m) return null;
  const value = Number(m[1].replace(/\s/g, ""));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function plural(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "а";
  return "ов";
}

function categoryLabel(id) {
  return state.categories.find((c) => c.id === id)?.label ?? id;
}

function buildQueryParams() {
  const params = new URLSearchParams();
  if (state.category) params.set("category", state.category);
  if (state.region) params.set("region", state.region);
  if (state.query) params.set("q", state.query);
  if (state.budgetKg) params.set("budgetKg", state.budgetKg);
  if (state.sort) params.set("sort", state.sort);
  return params;
}

async function fetchSuppliers(extra = {}) {
  const params = buildQueryParams();
  Object.entries(extra).forEach(([k, v]) => params.set(k, v));
  return api(`/api/suppliers?${params}`);
}

function setLoading(isLoading) {
  state.loading = isLoading;
  if (els.loading) els.loading.hidden = !isLoading;
  if (els.results) els.results.style.opacity = isLoading ? "0.5" : "1";
}

function showError(message) {
  state.error = message;
  if (els.error) {
    els.error.hidden = false;
    els.error.querySelector("p").textContent = message;
  }
}

function hideError() {
  state.error = null;
  if (els.error) els.error.hidden = true;
}

function renderProductsList(products) {
  if (!products?.length) return "";
  const items = products
    .slice(0, 4)
    .map((p) => {
      const price =
        p.priceHint ||
        (p.pricePerUnit != null ? `${p.pricePerUnit} ₽/${escapeHtml(p.unit || "шт.")}` : "");
      return `<li><strong>${escapeHtml(p.name)}</strong>${price ? ` — ${escapeHtml(price)}` : ""}${p.minOrder ? ` <span class="muted">(мин. ${escapeHtml(p.minOrder)})</span>` : ""}</li>`;
    })
    .join("");
  const more =
    products.length > 4
      ? `<li class="muted">ещё ${products.length - 4} позиций…</li>`
      : "";
  return `<ul class="product-list">${items}${more}</ul>`;
}

function renderCard(supplier) {
  const inCompare = state.compare.includes(supplier.id);
  const cats =
    supplier.categoryLabels?.join(", ") ||
    supplier.categories.map(categoryLabel).join(", ");
  return `
    <article class="supplier-card" data-id="${supplier.id}">
      <div class="supplier-card__top">
        <div>
          <h3 class="supplier-card__title">${escapeHtml(supplier.name)}</h3>
          <p class="supplier-card__meta">
            <span class="stars" aria-label="Рейтинг ${supplier.rating}">${stars(supplier.rating)}</span>
            ${supplier.rating} · ${supplier.reviewsCount} отзывов · ${escapeHtml(supplier.city)}
          </p>
        </div>
        <div class="supplier-card__badges">
          ${supplier.hasCertificates ? '<span class="badge badge--ok">Сертификаты</span>' : '<span class="badge badge--muted">Без серт.</span>'}
          <span class="badge badge--score" title="Оценка релевантности">★ ${supplier._score.score}</span>
        </div>
      </div>
      <p class="supplier-card__desc">${escapeHtml(supplier.description)}</p>
      <dl class="supplier-card__facts">
        <div><dt>Категории</dt><dd>${escapeHtml(cats)}</dd></div>
        <div><dt>Мин. заказ</dt><dd>${escapeHtml(supplier.minOrder)}</dd></div>
        <div><dt>Цена</dt><dd>${supplier.priceHint ? escapeHtml(supplier.priceHint) : "—"}</dd></div>
        <div><dt>Доставка</dt><dd>${escapeHtml(supplier.delivery)}</dd></div>
      </dl>
      ${supplier.products?.length ? `<div class="supplier-card__products"><dt class="field__label">Продукция</dt>${renderProductsList(supplier.products)}</div>` : ""}
      ${
        supplier._score.reasons.length
          ? `<ul class="supplier-card__reasons">${supplier._score.reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>`
          : ""
      }
      <div class="supplier-card__actions">
        ${
          state.readOnly || !canUseBuyerFeatures() || !supplier.products?.length
            ? ""
            : `<button type="button" class="btn btn--sm btn--primary" data-action="deal">Предложить сделку</button>`
        }
        <button type="button" class="btn btn--sm btn--ghost" data-action="detail">Подробнее</button>
        ${
          state.readOnly
            ? ""
            : `<button type="button" class="btn btn--sm ${inCompare ? "btn--active" : "btn--ghost"}" data-action="compare" ${!inCompare && state.compare.length >= MAX_COMPARE ? "disabled" : ""}>
          ${inCompare ? "В сравнении" : "Сравнить"}
        </button>`
        }
        <a class="btn btn--sm btn--primary" href="tel:${supplier.contacts.phone.replace(/\s/g, "")}">Позвонить</a>
      </div>
    </article>
  `;
}

function updateRecommendation(top) {
  if (!els.recommendation) return;
  if (!top) {
    els.recommendation.innerHTML =
      '<p class="sidebar-card__hint">Укажите категорию и регион — здесь появится рекомендация из базы данных.</p>';
    return;
  }
  els.recommendation.innerHTML = `
    <p class="rec__label">Кого связать в первую очередь</p>
    <h3 class="rec__name">${escapeHtml(top.name)}</h3>
    <p class="rec__text">
      Наивысшая оценка (${top._score.score}) при текущих фильтрах.
      <a href="mailto:${top.contacts.email}">${escapeHtml(top.contacts.email)}</a>
    </p>
    <ul class="rec__reasons">
      ${top._score.reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}
    </ul>
    <button type="button" class="btn btn--primary" data-id="${top.id}">Открыть карточку</button>
  `;
}

function showBuyerContentView(view) {
  const isDemands = view === "demands";
  const isCatalog = view === "list";
  document.querySelector("#buyer-app .hero")?.toggleAttribute("hidden", !isCatalog);
  document.getElementById("buyer-catalog-section")?.toggleAttribute("hidden", !isCatalog && view !== "orders");
  document.getElementById("buyer-demands-panel")?.toggleAttribute("hidden", !isDemands);
  if (els.compareBar) els.compareBar.hidden = !isCatalog || state.readOnly;
}

async function renderResults() {
  if (state.view === "orders") {
    showBuyerContentView("orders");
    await renderOrders();
    return;
  }
  if (state.view === "demands") {
    showBuyerContentView("demands");
    if (!state.demandsInited && state.categories.length) {
      initMyDemands({
        categories: state.categories,
        user: auth.user,
        onChanged: () => {},
      });
      state.demandsInited = true;
    }
    return;
  }
  showBuyerContentView("list");
  hideError();
  setLoading(true);

  try {
    const list = await fetchSuppliers();

    els.resultsMeta.textContent = `Найдено: ${list.length} поставщик${plural(list.length)} · данные из MySQL`;

    if (list.length === 0) {
      els.results.innerHTML = "";
      els.empty.hidden = false;
      updateRecommendation(null);
      return;
    }

    els.empty.hidden = true;
    els.results.innerHTML = list.map(renderCard).join("");
    updateRecommendation(list[0]);
  } catch (err) {
    showError(err.message);
    els.results.innerHTML = "";
    updateRecommendation(null);
  } finally {
    setLoading(false);
  }
}

function renderCompareBar() {
  const names = state.compare;
  els.compareBar.hidden = names.length === 0;
  els.compareList.innerHTML = state.compare
    .map(
      (id) => `
      <span class="compare-chip" data-id="${id}">
        <span class="compare-chip__name">…</span>
        <button type="button" data-remove-compare="${id}" aria-label="Убрать">×</button>
      </span>`
    )
    .join("");
  els.compareGo.disabled = names.length < 2;

  fetchSuppliers({ ids: names.join(",") })
    .then((list) => {
      state.compare.forEach((id) => {
        const chip = els.compareList.querySelector(`[data-id="${id}"] .compare-chip__name`);
        const s = list.find((x) => x.id === id);
        if (chip && s) chip.textContent = s.name;
      });
    })
    .catch(() => {});
}

async function openDetail(id) {
  if (!canViewSupplierDetail()) {
    openAuthModal("login", {
      message:
        "Каталог доступен без входа. Чтобы открыть карточку поставщика, войдите в аккаунт покупателя или наблюдателя.",
    });
    return;
  }
  try {
    const params = buildQueryParams();
    const s = await api(`/api/suppliers/${id}?${params}`);
    const productsHtml = s.products?.length
      ? `<div class="panel__scroll-x"><table class="products-table">
          <thead><tr><th>Продукция</th><th>Цена</th><th>Мин. заказ</th></tr></thead>
          <tbody>
            ${s.products
              .map(
                (p) => `<tr>
                  <td><strong>${escapeHtml(p.name)}</strong>${p.categoryLabel ? `<br><span class="muted">${escapeHtml(p.categoryLabel)}</span>` : ""}${p.description ? `<br>${escapeHtml(p.description)}` : ""}</td>
                  <td>${p.priceHint ? escapeHtml(p.priceHint) : "—"}</td>
                  <td>${p.minOrder ? escapeHtml(p.minOrder) : "—"}</td>
                </tr>`
              )
              .join("")}
          </tbody>
        </table></div>`
      : '<p class="muted">Позиции не указаны.</p>';

    els.panelDetail.innerHTML = `
      <header class="panel__head">
        <h2>${escapeHtml(s.name)}</h2>
        <button type="button" class="panel__close" data-close aria-label="Закрыть">×</button>
      </header>
      <div class="panel__body">
        <p class="panel__rating"><span class="stars">${stars(s.rating)}</span> ${s.rating} (${s.reviewsCount} отзывов)</p>
        <p>${escapeHtml(s.description)}</p>

        <section class="detail-section">
          <h3>Продукция (из БД)</h3>
          ${productsHtml}
        </section>

        <section class="detail-section">
          <h3>Условия</h3>
          <dl class="detail-dl">
            <div><dt>Минимальный заказ</dt><dd>${escapeHtml(s.minOrder)}</dd></div>
            <div><dt>Ориентировочная цена</dt><dd>${s.priceHint ? escapeHtml(s.priceHint) : "—"}</dd></div>
            <div><dt>Доставка</dt><dd>${escapeHtml(s.delivery)}</dd></div>
            <div><dt>Регионы</dt><dd>${s.regions.map(escapeHtml).join(", ")}</dd></div>
            <div><dt>Срок ответа</dt><dd>${escapeHtml(s.responseTime)}</dd></div>
            <div><dt>Часы работы</dt><dd>${escapeHtml(s.workingHours || "08:00–21:00 (МСК)")}</dd></div>
          </dl>
        </section>

        <section class="detail-section">
          <h3>Документы</h3>
          ${
            s.hasCertificates
              ? `<ul class="detail-list">${s.certificates.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>`
              : '<p class="muted">Сертификаты не подтверждены — уточните у поставщика.</p>'
          }
        </section>

        <section class="detail-section">
          <h3>Контакты</h3>
          <ul class="contact-list">
            <li><strong>Телефон:</strong> <a href="tel:${s.contacts.phone}">${escapeHtml(s.contacts.phone)}</a></li>
            <li><strong>Email:</strong> <a href="mailto:${s.contacts.email}">${escapeHtml(s.contacts.email)}</a></li>
            ${
              s.contacts.website
                ? `<li><strong>Сайт:</strong> <a href="${s.contacts.website}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.contacts.website)}</a></li>`
                : ""
            }
            <li><strong>Источник:</strong> ${escapeHtml(s.source)}</li>
          </ul>
        </section>

        <section class="detail-section detail-section--score">
          <h3>Оценка под запрос</h3>
          <p class="score-big">${s._score.score} / 100</p>
          <ul class="detail-list">${s._score.reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>
        </section>
      </div>
      <footer class="panel__foot">
        <a class="btn btn--primary" href="tel:${s.contacts.phone.replace(/\s/g, "")}">Связаться</a>
        ${
          state.readOnly
            ? ""
            : `<button type="button" class="btn btn--ghost" data-action="compare-detail" data-id="${s.id}">
          ${state.compare.includes(s.id) ? "Убрать из сравнения" : "Добавить в сравнение"}
        </button>`
        }
      </footer>
    `;

    openPanel(els.panelDetail);
  } catch (err) {
    showError(err.message);
  }
}

function recalcDealTotal(panel, minOrderRub) {
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
  const el = panel.querySelector("#deal-total-sum");
  if (el) el.textContent = formatMoney(rounded);

  const warn = panel.querySelector("#deal-min-warning");
  const submitBtn = panel.querySelector("#btn-submit-deal");
  const belowMin = minOrderRub != null && rounded > 0 && rounded < minOrderRub;
  if (warn) {
    warn.hidden = !belowMin;
    if (belowMin) {
      warn.textContent = `Сумма ниже минимального заказа (${formatMoney(minOrderRub)} ₽). Добавьте позиции.`;
    }
  }
  if (submitBtn) {
    submitBtn.disabled = rounded <= 0 || (minOrderRub != null && rounded < minOrderRub);
  }
  return rounded;
}

function bindDealForm(supplier, panel, minOrderRub) {
  const lines = panel.querySelector("#deal-lines");
  if (!lines) return;

  lines.addEventListener("change", (e) => {
    const row = e.target.closest(".order-line");
    if (!row) return;
    if (e.target.matches(".order-line__check")) {
      const qty = row.querySelector(".order-line__qty");
      qty.disabled = !e.target.checked;
      if (e.target.checked && Number(qty.value) < 1) qty.value = "1";
    }
    recalcDealTotal(panel, minOrderRub);
  });
  lines.addEventListener("input", (e) => {
    if (e.target.matches(".order-line__qty")) recalcDealTotal(panel, minOrderRub);
  });

  panel.querySelector("#btn-submit-deal")?.addEventListener("click", async () => {
    const errEl = panel.querySelector("#deal-error");
    errEl.hidden = true;
    const items = [];
    panel.querySelectorAll(".order-line").forEach((row) => {
      const check = row.querySelector(".order-line__check");
      const qty = row.querySelector(".order-line__qty");
      if (check?.checked && Number(qty.value) > 0) {
        items.push({ productId: Number(check.dataset.productId), quantity: Number(qty.value) });
      }
    });
    if (!items.length) {
      errEl.textContent = "Выберите товар и укажите количество";
      errEl.hidden = false;
      return;
    }
    try {
      const { order } = await api("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          supplierId: supplier.id,
          items,
          note: panel.querySelector("#deal-note")?.value?.trim() || "",
        }),
      });
      alert(
        `Предложение о сделке отправлено (заказ №${order.id}) на сумму ${formatMoney(order.totalAmount)} ₽.\nПоставщик: ${order.supplierName}`
      );
      closeAllPanels();
      state.view = "orders";
      els.navTabs.forEach((t) => t.classList.toggle("is-active", t.dataset.view === "orders"));
      renderOrders();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
    }
  });
}

async function openDealPanel(id) {
  if (!canUseBuyerFeatures()) {
    if (!isLoggedIn()) promptBuyerAuth(true);
    else {
      openAuthModal("login", {
        audience: "buyer",
        message: "Чтобы предложить сделку поставщику, войдите в аккаунт покупателя.",
      });
    }
    return;
  }
  try {
    const params = buildQueryParams();
    const s = await api(`/api/suppliers/${id}?${params}`);
    if (!s.products?.length) {
      alert("У поставщика нет товаров в каталоге — предложение сделки недоступно.");
      return;
    }

    const minOrderRub = parseMinOrderRubles(s.minOrder);
    const panel = els.panelDeal;
    panel.innerHTML = `
      <header class="panel__head">
        <h2>Предложить сделку</h2>
        <button type="button" class="panel__close" data-close aria-label="Закрыть">×</button>
      </header>
      <div class="panel__body">
        <p class="deal-panel__lead">Поставщик: <strong>${escapeHtml(s.name)}</strong></p>
        <p class="deal-panel__min">Минимальная сумма заказа: <strong>${escapeHtml(s.minOrder)}</strong>${minOrderRub != null ? ` (${formatMoney(minOrderRub)} ₽)` : ""}</p>
        <p class="field__hint">Отметьте продукцию и укажите количество — сумма пересчитается автоматически.</p>
        <div class="order-lines" id="deal-lines">
          ${s.products
            .map(
              (p) => `
            <label class="order-line">
              <input type="checkbox" class="order-line__check" data-product-id="${p.id}" data-price="${p.pricePerUnit}" data-unit="${escapeHtml(p.unit)}">
              <span class="order-line__info">
                <strong>${escapeHtml(p.name)}</strong>
                <span class="muted">${formatMoney(p.pricePerUnit)} ₽ / ${escapeHtml(p.unit)}</span>
              </span>
              <input type="number" class="order-line__qty" min="0" step="1" value="0" disabled placeholder="0">
            </label>`
            )
            .join("")}
        </div>
        <p class="order-total">Итого: <strong id="deal-total-sum">0</strong> ₽</p>
        <p class="deal-min-warning" id="deal-min-warning" hidden></p>
        <label class="field">
          <span class="field__label">Комментарий (необязательно)</span>
          <textarea id="deal-note" rows="2" placeholder="Сроки, условия оплаты…"></textarea>
        </label>
        <p class="auth-error" id="deal-error" hidden></p>
      </div>
      <footer class="panel__foot">
        <button type="button" class="btn btn--primary" id="btn-submit-deal">Отправить предложение</button>
        <button type="button" class="btn btn--ghost" data-close>Отмена</button>
      </footer>
    `;

    bindDealForm(s, panel, minOrderRub);
    recalcDealTotal(panel, minOrderRub);
    openPanel(panel);
  } catch (err) {
    showError(err.message);
  }
}

function renderOrderItemsTable(items) {
  if (!items?.length) return '<p class="muted">Позиции не указаны.</p>';
  return `<div class="panel__scroll-x"><table class="products-table">
    <thead><tr><th>Продукция</th><th>Количество</th><th>Цена</th><th>Сумма</th></tr></thead>
    <tbody>
      ${items
        .map(
          (i) => `<tr>
            <td><strong>${escapeHtml(i.productName)}</strong></td>
            <td>${i.quantity} ${escapeHtml(i.unit)}</td>
            <td>${formatMoney(i.unitPrice)} ₽ / ${escapeHtml(i.unit)}</td>
            <td><strong>${formatMoney(i.lineTotal)} ₽</strong></td>
          </tr>`
        )
        .join("")}
    </tbody>
  </table></div>`;
}

function renderOrderContacts(contacts) {
  const phone = contacts?.phone?.trim();
  const email = contacts?.email?.trim();
  const website = contacts?.website?.trim();
  return `<ul class="contact-list">
    <li><strong>Телефон:</strong> ${
      phone
        ? `<a href="tel:${phone.replace(/\s/g, "")}">${escapeHtml(phone)}</a>`
        : '<span class="muted">—</span>'
    }</li>
    <li><strong>Email:</strong> ${
      email
        ? `<a href="mailto:${email}">${escapeHtml(email)}</a>`
        : '<span class="muted">—</span>'
    }</li>
    ${
      website
        ? `<li><strong>Сайт:</strong> <a href="${escapeHtml(website)}" target="_blank" rel="noopener noreferrer">${escapeHtml(website)}</a></li>`
        : ""
    }
  </ul>`;
}

async function cancelOrderById(orderId) {
  if (!window.confirm("Отменить этот заказ? Поставщик увидит статус «Отменён».")) return;
  try {
    await api(`/api/orders/${orderId}/cancel`, { method: "POST" });
    closeAllPanels();
    await renderOrders();
  } catch (err) {
    showError(err.message);
  }
}

async function openOrderPanel(orderId) {
  try {
    const order = await api(`/api/orders/${orderId}`);
    const panel = els.panelOrders;
    const canCancel = order.status === "pending";
    const noteBlock = order.note
      ? `<section class="detail-section"><h3>Комментарий</h3><p>${escapeHtml(order.note)}</p></section>`
      : "";

    panel.innerHTML = `
      <header class="panel__head">
        <h2>Заказ №${order.id}</h2>
        <button type="button" class="panel__close" data-close aria-label="Закрыть">×</button>
      </header>
      <div class="panel__body">
        <p class="deal-panel__lead">Поставщик: <strong>${escapeHtml(order.supplierName)}</strong></p>
        <p class="supplier-card__meta">${formatDate(order.createdAt)} · ${statusLabel(order.status)} · <strong>${formatMoney(order.totalAmount)} ₽</strong></p>

        <section class="detail-section">
          <h3>Состав заказа</h3>
          ${renderOrderItemsTable(order.items)}
        </section>

        <section class="detail-section">
          <h3>Контакты поставщика</h3>
          ${renderOrderContacts(order.supplierContacts)}
        </section>
        ${noteBlock}
      </div>
      <footer class="panel__foot">
        ${
          order.supplierContacts?.phone
            ? `<a class="btn btn--primary" href="tel:${order.supplierContacts.phone.replace(/\s/g, "")}">Позвонить</a>`
            : ""
        }
        ${
          canCancel
            ? `<button type="button" class="btn btn--ghost" id="btn-cancel-order" data-order-id="${order.id}">Отменить заказ</button>`
            : ""
        }
        <button type="button" class="btn btn--ghost" data-close>Закрыть</button>
      </footer>
    `;

    panel.querySelector("#btn-cancel-order")?.addEventListener("click", () =>
      cancelOrderById(order.id)
    );
    openPanel(panel);
  } catch (err) {
    showError(err.message);
  }
}

async function renderOrders() {
  hideError();
  setLoading(true);
  els.compareBar.hidden = true;
  els.resultsMeta.textContent = "Мои заказы";
  try {
    if (!isLoggedIn()) {
      els.loading.hidden = true;
      els.empty.hidden = true;
      els.results.innerHTML =
        '<div class="empty"><h2>Войдите в аккаунт</h2><p>Заказы доступны после регистрации.</p><button type="button" class="btn btn--primary" id="orders-login">Войти</button></div>';
      document.getElementById("orders-login")?.addEventListener("click", () =>
        openAuthModal("login")
      );
      setLoading(false);
      return;
    }
    const orders = await api("/api/orders");
    setLoading(false);
    els.loading.hidden = true;
    if (!orders.length) {
      els.empty.hidden = false;
      els.results.innerHTML = "";
      return;
    }
    els.empty.hidden = true;
    els.results.innerHTML = orders
      .map(
        (o) => `
      <article class="supplier-card order-card" data-order-id="${o.id}">
        <h3 class="supplier-card__title">Заказ №${o.id} · ${escapeHtml(o.supplierName)}</h3>
        <p class="supplier-card__meta">${formatDate(o.createdAt)} · ${statusLabel(o.status)} · <strong>${formatMoney(o.totalAmount)} ₽</strong></p>
        <div class="supplier-card__actions">
          <button type="button" class="btn btn--sm btn--ghost" data-order-view="${o.id}">Подробнее</button>
          ${
            o.status === "pending"
              ? `<button type="button" class="btn btn--sm btn--ghost order-card__cancel" data-order-cancel="${o.id}">Отменить</button>`
              : ""
          }
        </div>
      </article>`
      )
      .join("");
  } catch (err) {
    showError(err.message);
  }
}

function formatDate(val) {
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? String(val) : d.toLocaleString("ru-RU");
}

function statusLabel(status) {
  if (status === "confirmed") return "Подтверждён";
  if (status === "cancelled") return "Отменён";
  return "Ожидает";
}

async function renderComparePanel() {
  if (state.compare.length < 2) return;

  try {
    const items = await fetchSuppliers({ ids: state.compare.join(",") });
    const best = [...items].sort((a, b) => b._score.score - a._score.score)[0];

    const rows = [
      { label: "Поставщик", key: "name" },
      { label: "Рейтинг", key: "rating" },
      { label: "Оценка", get: (s) => s._score.score },
      { label: "Мин. заказ", key: "minOrder" },
      { label: "Продукция", get: (s) => (s.products?.length ? `${s.products.length} поз.` : "—") },
      { label: "Сертификаты", get: (s) => (s.hasCertificates ? "Да" : "Нет") },
      { label: "Доставка", key: "delivery" },
      { label: "Регионы", get: (s) => s.regions.join(", ") },
      { label: "Контакт", get: (s) => s.contacts.phone },
    ];

    const reasonsHtml = best._score?.reasons?.length
      ? `<ul class="compare-winner__reasons">
          ${best._score.reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}
         </ul>`
      : `<p class="compare-winner__empty">Уточните фильтры (регион, объём), чтобы увидеть аргументы.</p>`;

    const others = items
      .filter((s) => s.id !== best.id)
      .map((s) => `${escapeHtml(s.name)} (${s._score.score})`)
      .join(", ");

    els.panelCompare.innerHTML = `
      <header class="panel__head">
        <h2>Сравнение поставщиков</h2>
        <button type="button" class="panel__close" data-close aria-label="Закрыть">×</button>
      </header>
      <div class="panel__body">
        <section class="compare-winner" aria-label="Рекомендация">
          <p class="compare-winner__label">Рекомендуем связаться с</p>
          <h3 class="compare-winner__name">${escapeHtml(best.name)}</h3>
          <p class="compare-winner__score">Оценка под ваш запрос: <strong>${best._score.score}</strong> из 100</p>
          <p class="compare-winner__why-title">Почему эта компания лучше в сравнении:</p>
          ${reasonsHtml}
          ${others ? `<p class="compare-winner__others">Остальные в выборке: ${others}</p>` : ""}
        </section>
        <div class="compare-table-wrap">
          <table class="compare-table">
            <thead><tr><th>Параметр</th>${items.map((s) => `<th>${escapeHtml(s.name)}</th>`).join("")}</tr></thead>
            <tbody>
              ${rows
                .map((row) => {
                  const cells = items.map((s) => {
                    const val = row.get ? row.get(s) : s[row.key];
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

    openPanel(els.panelCompare);
  } catch (err) {
    showError(err.message);
  }
}

function toggleCompare(id) {
  const idx = state.compare.indexOf(id);
  if (idx >= 0) state.compare.splice(idx, 1);
  else if (state.compare.length < MAX_COMPARE) state.compare.push(id);
  renderCompareBar();
  renderResults();
}

function readFiltersFromForm() {
  state.category = els.category.value;
  state.region = els.region.value;
  state.query = els.query.value;
  state.budgetKg = els.budget.value;
  state.sort = els.sort.value;
}

async function initMeta() {
  const [categories, regions] = await Promise.all([
    api("/api/categories"),
    api("/api/regions"),
  ]);

  state.categories = categories;
  state.regions = regions;

  categories.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.label;
    els.category.appendChild(opt);
  });

  regions.forEach((r) => {
    const opt = document.createElement("option");
    opt.value = r;
    opt.textContent = r;
    els.region.appendChild(opt);
  });

  const params = new URLSearchParams(location.search);
  if (params.get("region")) els.region.value = params.get("region");
  if (params.get("category")) els.category.value = params.get("category");
  readFiltersFromForm();
}

function bindEvents() {
  if (!els.searchForm) {
    console.error("FoodSource: не найдена форма поиска");
    return;
  }

  els.searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    readFiltersFromForm();
    renderResults();
  });

  els.searchForm.addEventListener("change", () => {
    readFiltersFromForm();
    renderResults();
  });

  els.searchForm.addEventListener("input", (e) => {
    if (e.target.matches("input, textarea")) {
      readFiltersFromForm();
      renderResults();
    }
  });

  els.results.addEventListener("click", (e) => {
    const orderViewBtn = e.target.closest("[data-order-view]");
    if (orderViewBtn) {
      openOrderPanel(orderViewBtn.dataset.orderView);
      return;
    }
    const orderCancelBtn = e.target.closest("[data-order-cancel]");
    if (orderCancelBtn) {
      cancelOrderById(orderCancelBtn.dataset.orderCancel);
      return;
    }

    const card = e.target.closest(".supplier-card");
    if (!card) return;
    const id = card.dataset.id;
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (action === "deal") {
      openDealPanel(id);
      return;
    }
    if (action === "detail") openDetail(id);
    if (action === "compare") {
      if (!canUseBuyerFeatures()) {
        if (!isLoggedIn()) promptBuyerAuth(true);
        else {
          openAuthModal("login", {
            audience: "buyer",
            message: "Чтобы сравнивать поставщиков, войдите в аккаунт покупателя.",
          });
        }
        return;
      }
      toggleCompare(id);
    }
  });

  els.recommendation?.addEventListener("click", (e) => {
    const id = e.target.closest("[data-id]")?.dataset.id;
    if (id) openDetail(id);
  });

  els.compareGo?.addEventListener("click", () => renderComparePanel());
  els.compareClear?.addEventListener("click", () => {
    state.compare = [];
    renderCompareBar();
    renderResults();
  });

  els.compareList?.addEventListener("click", (e) => {
    const id = e.target.closest("[data-remove-compare]")?.dataset.removeCompare;
    if (id) toggleCompare(id);
  });

  els.overlay?.addEventListener("click", (e) => {
    if (e.target === els.overlay || e.target.closest("[data-close]")) closeAllPanels();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllPanels();
  });

  els.panelDetail?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action='compare-detail']");
    if (btn) {
      toggleCompare(btn.dataset.id);
      openDetail(btn.dataset.id);
    }
  });

  els.navTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const view = tab.dataset.view;
      if (BUYER_ONLY_VIEWS.includes(view) && !canUseBuyerFeatures()) {
        if (!isLoggedIn()) promptBuyerAuth(view === "demands");
        else {
          openAuthModal("login", {
            audience: "buyer",
            message:
              view === "demands"
                ? "Чтобы публиковать запросы, войдите в аккаунт покупателя."
                : "Чтобы пользоваться разделом, войдите в аккаунт покупателя.",
          });
        }
        return;
      }
      if (view === "list") {
        goToBuyerCatalog();
        return;
      }
      state.view = view;
      els.navTabs.forEach((t) => t.classList.toggle("is-active", t === tab));
      renderResults();
    });
  });

  document.getElementById("reset-filters")?.addEventListener("click", () => {
    els.searchForm.reset();
    readFiltersFromForm();
    renderResults();
  });

  document.querySelector(".brand")?.addEventListener("click", (e) => {
    const buyerApp = document.getElementById("buyer-app");
    if (!buyerApp || buyerApp.hidden || state.view === "list") return;
    e.preventDefault();
    goToBuyerCatalog();
  });
}

const BUYER_ONLY_VIEWS = ["orders", "demands"];

function applyReadOnlyUi() {
  const isBuyerAccount = canUseBuyerFeatures();
  const ordersTab = document.getElementById("buyer-tab-orders");
  const demandsTab = document.getElementById("buyer-tab-demands");
  if (ordersTab) ordersTab.hidden = !isBuyerAccount;
  if (demandsTab) demandsTab.hidden = !isBuyerAccount;

  els.navTabs.forEach((tab) => {
    if (tab.dataset.view === "list") {
      tab.hidden = false;
    } else {
      tab.hidden = state.readOnly || !isBuyerAccount;
    }
  });

  const needCatalog = state.readOnly && BUYER_ONLY_VIEWS.includes(state.view);
  const needBuyerLogin = !isBuyerAccount && BUYER_ONLY_VIEWS.includes(state.view);
  if (needCatalog || needBuyerLogin) {
    goToBuyerCatalog();
  }
}

function goToBuyerCatalog() {
  state.view = "list";
  els.navTabs.forEach((t) => t.classList.toggle("is-active", t.dataset.view === "list"));
  showBuyerContentView("list");
  renderResults();
}

export async function initBuyerApp(options = {}) {
  state.readOnly = Boolean(options.readOnly);
  closeAllPanels();
  bindEvents();
  applyReadOnlyUi();
  renderCompareBar();
  try {
    await initMeta();
    await maybeShowQuickSetup(state.readOnly ? "viewer" : "buyer", {
      categories: state.categories,
      regions: state.regions,
      fetchSuggestions: () => api("/api/suppliers?sort=rating"),
      applyFilters: (f) => {
        if (f.category != null) els.category.value = f.category;
        if (f.region != null) els.region.value = f.region;
        if (f.query != null) els.query.value = f.query;
        readFiltersFromForm();
      },
    });
    await renderResults();
  } catch (err) {
    showError(
      `${err.message}. Запустите сервер (npm start) и инициализируйте БД (см. README).`
    );
    setLoading(false);
  }
}
