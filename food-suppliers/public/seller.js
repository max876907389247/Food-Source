import { api } from "./auth.js";
import { closeAllPanels, openPanel } from "./ui.js";
import { maybeShowQuickSetup } from "./onboarding.js";
import { isSellerAccount, promptSellerAuth } from "./audience.js";
import { initMyProducts } from "./my-products.js";
import { escapeHtml } from "./ui.js";

const sellerState = {
  category: "",
  region: "",
  query: "",
  sort: "relevance",
  categories: [],
  regions: [],
  view: "proposals",
  productsController: null,
};

function showSellerView(view) {
  sellerState.view = view;
  const proposals = document.getElementById("seller-proposals-wrap");
  const products = document.getElementById("seller-products-section");
  if (proposals) proposals.hidden = view !== "proposals";
  if (products) products.hidden = view !== "products";
  if (view === "products") {
    ensureProductsPanel();
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
  if (sellerState.region) p.set("region", sellerState.region);
  if (sellerState.query) p.set("q", sellerState.query);
  if (sellerState.sort) p.set("sort", sellerState.sort);
  return p.toString();
}

function renderBuyerProposalCard(b) {
  return `
    <article class="buyer-card">
      <div class="buyer-card__top">
        <h3 class="buyer-card__title">${escapeHtml(b.companyName)}</h3>
        <span class="badge badge--ok">${escapeHtml(b.businessType)}</span>
      </div>
      <p class="buyer-card__meta">${escapeHtml(b.city)} · ${escapeHtml(b.region)}${b.categoryLabel ? ` · ${escapeHtml(b.categoryLabel)}` : ""}</p>
      <p class="buyer-card__desc">${escapeHtml(b.description)}</p>
      <dl class="buyer-card__facts">
        <div><dt>Объём</dt><dd>${escapeHtml(b.volumeText)}</dd></div>
        <div><dt>Бюджет</dt><dd>${b.budgetText ? escapeHtml(b.budgetText) : "—"}</dd></div>
      </dl>
      <div class="buyer-card__actions">
        <button type="button" class="btn btn--primary btn--sm" data-buyer-respond="${b.id}">Ответить на предложение</button>
        <button type="button" class="btn btn--ghost btn--sm" data-buyer-detail="${b.id}">Подробнее</button>
        <a class="btn btn--ghost btn--sm" href="tel:${b.contacts.phone.replace(/\s/g, "")}">Позвонить</a>
        <a class="btn btn--ghost btn--sm" href="mailto:${b.contacts.email}">Написать</a>
      </div>
    </article>`;
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

function bindResponseForm(panel, buyerId) {
  const form = panel.querySelector("#proposal-form");
  const errEl = panel.querySelector("#proposal-error");
  const okEl = panel.querySelector("#proposal-success");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errEl.hidden = true;
    okEl.hidden = true;
    const fd = new FormData(form);
    try {
      const res = await api("/api/proposals", {
        method: "POST",
        body: JSON.stringify({
          buyerDemandId: buyerId,
          message: fd.get("message"),
          priceOffer: fd.get("priceOffer"),
          volumeOffer: fd.get("volumeOffer"),
        }),
      });
      okEl.textContent = res.updated
        ? "Ваш ответ обновлён."
        : "Ответ отправлен покупателю.";
      okEl.hidden = false;
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
    }
  });
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

  const myResponse = await loadMyResponse(b.id);
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
        <div><dt>Регион</dt><dd>${escapeHtml(b.region)}</dd></div>
        <div><dt>Категория закупки</dt><dd>${b.categoryLabel ? escapeHtml(b.categoryLabel) : "—"}</dd></div>
        <div><dt>Объём</dt><dd>${escapeHtml(b.volumeText)}</dd></div>
        <div><dt>Бюджет</dt><dd>${b.budgetText ? escapeHtml(b.budgetText) : "—"}</dd></div>
      </dl>
      <h3>Контакты покупателя</h3>
      <ul class="contact-list">
        <li><a href="tel:${b.contacts.phone}">${escapeHtml(b.contacts.phone)}</a></li>
        <li><a href="mailto:${b.contacts.email}">${escapeHtml(b.contacts.email)}</a></li>
      </ul>
      <section class="proposal-form-section">
        <h3>${myResponse ? "Ваш ответ на предложение" : "Ответить на предложение"}</h3>
        <p class="proposal-form-section__lead">Опишите условия поставки — покупатель получит ваш ответ.</p>
        <form id="proposal-form" class="proposal-form">
          <label class="field">
            <span class="field__label">Текст ответа</span>
            <textarea name="message" rows="4" required placeholder="Ассортимент, сроки, условия оплаты…">${myResponse ? escapeHtml(myResponse.message) : ""}</textarea>
          </label>
          <label class="field">
            <span class="field__label">Цена / условия (необязательно)</span>
            <input type="text" name="priceOffer" value="${myResponse?.priceOffer ? escapeHtml(myResponse.priceOffer) : ""}" placeholder="от 120 ₽/кг, FCA…">
          </label>
          <label class="field">
            <span class="field__label">Объём поставки (необязательно)</span>
            <input type="text" name="volumeOffer" value="${myResponse?.volumeOffer ? escapeHtml(myResponse.volumeOffer) : ""}" placeholder="до 500 кг/нед…">
          </label>
          <div class="proposal-form__actions">
            <p class="auth-error" id="proposal-error" hidden></p>
            <p class="proposal-success" id="proposal-success" hidden></p>
            <button type="submit" class="btn btn--primary">${myResponse ? "Сохранить ответ" : "Отправить ответ"}</button>
          </div>
        </form>
      </section>
    </div>
    <footer class="panel__foot">
      <a class="btn btn--ghost" href="tel:${b.contacts.phone.replace(/\s/g, "")}">Позвонить</a>
      <a class="btn btn--ghost" href="mailto:${b.contacts.email}">Email</a>
    </footer>
  `;
  bindResponseForm(panel, b.id);
  openPanel(panel);
  if (options.focusReply) {
    requestAnimationFrame(() => {
      panel.querySelector(".proposal-form-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      panel.querySelector("#proposal-form textarea")?.focus();
    });
  }
}

async function initSellerMeta() {
  const [categories, regions] = await Promise.all([
    api("/api/categories"),
    api("/api/regions"),
  ]);
  sellerState.categories = categories;
  sellerState.regions = regions;
  const cat = document.getElementById("seller-filter-category");
  const reg = document.getElementById("seller-filter-region");
  categories.forEach((c) => {
    const o = document.createElement("option");
    o.value = c.id;
    o.textContent = c.label;
    cat.appendChild(o);
  });
  regions.forEach((r) => {
    const o = document.createElement("option");
    o.value = r;
    o.textContent = r;
    reg.appendChild(o);
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
    sellerState.region = document.getElementById("seller-filter-region").value;
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
  document.getElementById("seller-results")?.addEventListener("click", (e) => {
    const respondId = e.target.closest("[data-buyer-respond]")?.dataset.buyerRespond;
    if (respondId) {
      openBuyerDetail(respondId, { focusReply: true });
      return;
    }
    const id = e.target.closest("[data-buyer-detail]")?.dataset.buyerDetail;
    if (id) openBuyerDetail(id);
  });
  document.getElementById("overlay")?.addEventListener("click", (e) => {
    if (e.target.id === "overlay" || e.target.closest("[data-close]")) {
      closeAllPanels();
    }
  });

  initSellerMeta()
    .then(async () => {
      await maybeShowQuickSetup("seller", {
        categories: sellerState.categories,
        regions: sellerState.regions,
        fetchSuggestions: () => api(`/api/buyer-demands?sort=relevance`),
        applyFilters: (f) => {
          const cat = document.getElementById("seller-filter-category");
          const reg = document.getElementById("seller-filter-region");
          const q = document.getElementById("seller-filter-query");
          if (f.category != null && cat) cat.value = f.category;
          if (f.region != null && reg) reg.value = f.region;
          if (f.query != null && q) q.value = f.query;
          sellerState.category = cat?.value || "";
          sellerState.region = reg?.value || "";
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
