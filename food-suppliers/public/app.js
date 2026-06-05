import { api, auth, isLoggedIn, openAuthModal } from "./auth.js";
import {
  canUseBuyerFeatures,
  isAdminAccount,
  promptBuyerAuth,
} from "./audience.js";
import { initMyDemands } from "./my-demands.js";
import { maybeShowQuickSetup } from "./onboarding.js";
import { createFavoritesStore, favoriteButtonHtml } from "./favorites.js";
import { closeAllPanels, escapeHtml, openPanel } from "./ui.js";
import {
  formatDemandBudget,
  formatDemandVolume,
  formatMoney,
  parseDemandBudgetInput,
  formatProductMinOrder,
  formatProductPrice,
  formatProposalDate,
  orderStatusLabel,
  renderOrderItemsTable,
  renderProposalFacts,
  renderProposalProductsSection,
  renderProposalItemsSummary,
  renderProposalStatusBadge,
  truncateMessage,
} from "./proposals-shared.js";

const MAX_COMPARE = 3;

const state = {
  category: "",
  city: "",
  query: "",
  organization: "",
  sort: "score",
  budgetKg: "",
  compare: [],
  view: "list",
  categories: [],
  cities: [],
  loading: true,
  error: null,
  demandsInited: false,
  incomingProposals: [],
  favoritesStore: null,
  adminBuyers: [],
  adminBuyersAll: [],
  adminBuyerFilters: {
    category: "",
    city: "",
    organization: "",
    query: "",
    status: "",
    sort: "name",
  },
};

const els = {
  searchForm: document.getElementById("search-form"),
  category: document.getElementById("filter-category"),
  city: document.getElementById("filter-city"),
  query: document.getElementById("filter-query"),
  organization: document.getElementById("filter-organization"),
  budget: document.getElementById("filter-budget"),
  sort: document.getElementById("filter-sort"),
  results: document.getElementById("results"),
  resultsMeta: document.getElementById("results-meta"),
  empty: document.getElementById("empty-state"),
  loading: document.getElementById("loading-state"),
  error: document.getElementById("error-state"),
  compareBar: document.getElementById("compare-bar"),
  compareList: document.getElementById("compare-list"),
  compareHint: document.getElementById("compare-hint"),
  compareGo: document.getElementById("compare-go"),
  compareClear: document.getElementById("compare-clear"),
  panelCompare: document.getElementById("panel-compare"),
  panelDetail: document.getElementById("panel-detail"),
  panelDeal: document.getElementById("panel-deal"),
  panelOrders: document.getElementById("panel-orders"),
  panelIncomingProposal: document.getElementById("panel-incoming-proposal"),
  overlay: document.getElementById("overlay"),
  navTabs: document.querySelectorAll("#header-nav [data-view]"),
  recommendation: document.getElementById("recommendation-card"),
  adminBuyersSearchForm: document.getElementById("admin-buyers-search-form"),
  adminBuyersCategory: document.getElementById("admin-buyers-filter-category"),
  adminBuyersCity: document.getElementById("admin-buyers-filter-city"),
  adminBuyersOrganization: document.getElementById("admin-buyers-filter-organization"),
  adminBuyersQuery: document.getElementById("admin-buyers-filter-query"),
  adminBuyersStatus: document.getElementById("admin-buyers-filter-status"),
  adminBuyersSort: document.getElementById("admin-buyers-filter-sort"),
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
  if (state.city) params.set("city", state.city);
  if (state.organization) params.set("org", state.organization);
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
      const price = formatProductPrice(p.pricePerUnit, p.unit, p.priceHint);
      const minOrder = formatProductMinOrder(p.minOrder);
      const minPart = minOrder !== "—" ? ` <span class="muted">(${escapeHtml(minOrder)})</span>` : "";
      return `<li><strong>${escapeHtml(p.name)}</strong>${price !== "—" ? ` — ${escapeHtml(price)}` : ""}${minPart}</li>`;
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
  const inFavorite = state.favoritesStore?.has(supplier.id);
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
          !canUseBuyerFeatures() || !supplier.products?.length
            ? ""
            : `<button type="button" class="btn btn--sm btn--primary" data-action="deal">Предложить сделку</button>`
        }
        <button type="button" class="btn btn--sm btn--ghost" data-action="detail">Подробнее</button>
        ${
          !canUseBuyerFeatures()
            ? ""
            : `${favoriteButtonHtml(supplier.id, inFavorite, { sm: true, className: "btn--favorite-card" })}
        <button type="button" class="btn btn--sm ${inCompare ? "btn--active" : "btn--ghost"}" data-action="compare" ${!inCompare && state.compare.length >= MAX_COMPARE ? "disabled" : ""}>
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
      '<p class="sidebar-card__hint">Укажите категорию и город — здесь появится рекомендация из базы данных.</p>';
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

function updateSuppliersSidebar(list) {
  if (!els.recommendation) return;
  if (!isAdminAccount()) {
    updateRecommendation(list?.[0] || null);
    return;
  }
  if (!list?.length) {
    els.recommendation.innerHTML =
      '<p class="sidebar-card__hint">Поставщики появятся после добавления в базу данных.</p>';
    return;
  }
  const withCerts = list.filter((s) => s.hasCertificates).length;
  const top = list[0];
  els.recommendation.innerHTML = `
    <p class="rec__label">Сводка каталога</p>
    <p class="rec__text">Всего поставщиков: <strong>${list.length}</strong><br>С сертификатами: <strong>${withCerts}</strong></p>
    <h3 class="rec__name">${escapeHtml(top.name)}</h3>
    <p class="rec__text">Лучший рейтинг: <strong>${top.rating}</strong>${top._score ? ` · оценка ${top._score.score}` : ""}</p>
    <button type="button" class="btn btn--primary" data-id="${top.id}">Открыть карточку</button>
  `;
}

function showBuyerContentView(view) {
  const isDemands = view === "demands";
  const isSuppliersCatalog = view === "list";
  const isBuyersCatalog = view === "buyers-catalog";
  const isListResults = view === "orders" || view === "incoming-proposals" || view === "favorites";
  document.querySelector("#buyer-app .hero:not(#admin-buyers-hero)")?.toggleAttribute("hidden", !isSuppliersCatalog);
  document.getElementById("admin-buyers-hero")?.toggleAttribute("hidden", !isBuyersCatalog);
  document.getElementById("buyer-catalog-section")?.toggleAttribute(
    "hidden",
    !isSuppliersCatalog && !isListResults && !isBuyersCatalog
  );
  document.getElementById("buyer-demands-panel")?.toggleAttribute("hidden", !isDemands);
  if (els.compareBar) {
    const showCompare = isSuppliersCatalog && canUseBuyerFeatures();
    els.compareBar.hidden = !showCompare;
    if (showCompare) renderCompareBar();
  }
}

async function renderResults() {
  if (state.view === "orders") {
    showBuyerContentView("orders");
    await renderOrders();
    return;
  }
  if (state.view === "incoming-proposals") {
    showBuyerContentView("incoming-proposals");
    await renderIncomingProposals();
    return;
  }
  if (state.view === "favorites") {
    showBuyerContentView("favorites");
    await renderBuyerFavorites();
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
  if (state.view === "buyers-catalog") {
    showBuyerContentView("buyers-catalog");
    await renderAdminBuyersCatalog();
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
      updateSuppliersSidebar([]);
      return;
    }

    els.empty.hidden = true;
    els.results.className = "results";
    els.results.innerHTML = list.map(renderCard).join("");
    updateSuppliersSidebar(list);
  } catch (err) {
    showError(err.message);
    els.results.innerHTML = "";
    updateSuppliersSidebar([]);
  } finally {
    setLoading(false);
  }
}

function renderCompareBar() {
  const names = state.compare;
  const onCatalog = state.view === "list";
  if (!canUseBuyerFeatures() || !onCatalog) {
    els.compareBar.hidden = true;
    return;
  }
  els.compareBar.hidden = false;
  if (els.compareHint) {
    els.compareHint.hidden = names.length >= 2;
    els.compareHint.textContent =
      names.length === 1
        ? "Добавьте ещё одну организацию для сравнения"
        : "Добавьте 2 организации для сравнения";
  }
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

function renderAdminBuyerCard(b) {
  const status = b.isActive
    ? '<span class="badge badge--ok">Активен</span>'
    : '<span class="badge badge--muted">Снят</span>';
  const categoryBadge = b.categoryLabel
    ? `<span class="badge badge--score">${escapeHtml(b.categoryLabel)}</span>`
    : "";
  const phone = b.contacts?.phone?.trim() || "";
  const email = b.contacts?.email?.trim() || "";
  return `
    <article class="supplier-card" data-admin-buyer-id="${b.id}">
      <div class="supplier-card__top">
        <div>
          <h3 class="supplier-card__title">${escapeHtml(b.companyName)}</h3>
          <p class="supplier-card__meta">${escapeHtml(b.businessType)} · ${escapeHtml(b.city)}</p>
        </div>
        <div class="supplier-card__badges">
          ${status}
          ${categoryBadge}
        </div>
      </div>
      <p class="supplier-card__desc">${escapeHtml(b.description)}</p>
      <dl class="supplier-card__facts">
        <div><dt>Категория</dt><dd>${b.categoryLabel ? escapeHtml(b.categoryLabel) : "—"}</dd></div>
        <div><dt>Объём</dt><dd>${escapeHtml(adminBuyerVolumeLabel(b))}</dd></div>
        <div><dt>Бюджет</dt><dd>${escapeHtml(adminBuyerBudgetLabel(b))}</dd></div>
        <div><dt>Контакты</dt><dd>${phone ? escapeHtml(phone) : "—"}${email ? `<br><span class="muted">${escapeHtml(email)}</span>` : ""}</dd></div>
      </dl>
      <div class="supplier-card__actions">
        <button type="button" class="btn btn--sm btn--ghost" data-admin-buyer-open="${b.id}">Подробнее</button>
        ${
          phone
            ? `<a class="btn btn--sm btn--primary" href="tel:${phone.replace(/\s/g, "")}">Позвонить</a>`
            : ""
        }
        ${
          email
            ? `<a class="btn btn--sm btn--ghost" href="mailto:${email}">Написать</a>`
            : ""
        }
      </div>
    </article>`;
}

function updateAdminBuyersSidebar(list) {
  if (!els.recommendation) return;
  if (!list?.length) {
    els.recommendation.innerHTML =
      '<p class="sidebar-card__hint">Заявки покупателей появятся здесь после публикации в системе.</p>';
    return;
  }
  const activeCount = list.filter((b) => b.isActive).length;
  const top = [...list].sort(
    (a, b) =>
      (parseDemandBudgetInput(b.budgetText) || 0) - (parseDemandBudgetInput(a.budgetText) || 0)
  )[0];
  els.recommendation.innerHTML = `
    <p class="rec__label">Сводка каталога</p>
    <p class="rec__text">Всего заявок: <strong>${list.length}</strong><br>Активных: <strong>${activeCount}</strong></p>
    ${
      top
        ? `<h3 class="rec__name">${escapeHtml(top.companyName)}</h3>
    <p class="rec__text">Наибольший бюджет: <strong>${escapeHtml(adminBuyerBudgetLabel(top))}</strong></p>
    <button type="button" class="btn btn--primary" data-admin-buyer-open="${top.id}">Открыть карточку</button>`
        : ""
    }
  `;
}

function adminBuyerVolumeLabel(b) {
  if (b.volumeKg != null && b.volumeKg !== "") return formatDemandVolume(b.volumeKg);
  return b.volumeText || "—";
}

function adminBuyerBudgetLabel(b) {
  if (!b.budgetText) return "—";
  if (String(b.budgetText).includes("мин. от") || String(b.budgetText).includes("до ")) {
    return b.budgetText;
  }
  const rub = parseDemandBudgetInput(b.budgetText);
  return rub != null ? formatDemandBudget(rub) : b.budgetText;
}

function openAdminBuyerPanel(buyer) {
  const panel = els.panelDetail;
  const status = buyer.isActive
    ? '<span class="badge badge--ok">Активен</span>'
    : '<span class="badge badge--muted">Снят</span>';
  panel.innerHTML = `
    <header class="panel__head">
      <h2>${escapeHtml(buyer.companyName)}</h2>
      <button type="button" class="panel__close" data-close aria-label="Закрыть">×</button>
    </header>
    <div class="panel__body">
      <p class="supplier-card__meta">${status}${buyer.categoryLabel ? ` · ${escapeHtml(buyer.categoryLabel)}` : ""}</p>
      <dl class="detail-dl">
        <div><dt>Тип бизнеса</dt><dd>${escapeHtml(buyer.businessType)}</dd></div>
        <div><dt>Город</dt><dd>${escapeHtml(buyer.city)}</dd></div>
        <div><dt>Объём</dt><dd>${escapeHtml(buyer.volumeText || formatDemandVolume(buyer.volumeKg))}</dd></div>
        <div><dt>Бюджет</dt><dd>${escapeHtml(buyer.budgetText || "—")}</dd></div>
      </dl>
      <section class="detail-section">
        <h3>Описание запроса</h3>
        <p>${escapeHtml(buyer.description)}</p>
      </section>
      <section class="detail-section">
        <h3>Контакты</h3>
        <ul class="contact-list">
          <li><a href="tel:${buyer.contacts.phone.replace(/\s/g, "")}">${escapeHtml(buyer.contacts.phone)}</a></li>
          <li><a href="mailto:${buyer.contacts.email}">${escapeHtml(buyer.contacts.email)}</a></li>
        </ul>
      </section>
      ${buyer.account?.username ? `<p class="field__hint">Аккаунт: <strong>${escapeHtml(buyer.account.username)}</strong></p>` : ""}
    </div>
    <footer class="panel__foot">
      <button type="button" class="btn btn--ghost" data-close>Закрыть</button>
    </footer>
  `;
  openPanel(panel);
}

function readAdminBuyerFiltersFromForm() {
  const f = state.adminBuyerFilters;
  f.category = els.adminBuyersCategory?.value || "";
  f.city = els.adminBuyersCity?.value || "";
  f.organization = els.adminBuyersOrganization?.value || "";
  f.query = els.adminBuyersQuery?.value || "";
  f.status = els.adminBuyersStatus?.value || "";
  f.sort = els.adminBuyersSort?.value || "name";
}

function filterAdminBuyers(list) {
  const f = state.adminBuyerFilters;
  const org = f.organization.trim().toLowerCase();
  const q = f.query.trim().toLowerCase();
  return list.filter((b) => {
    if (f.category && String(b.categoryId) !== String(f.category)) return false;
    if (f.city && b.city !== f.city) return false;
    if (org && !b.companyName.toLowerCase().includes(org)) return false;
    if (q) {
      const hay = `${b.description} ${b.businessType} ${b.companyName}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.status === "active" && !b.isActive) return false;
    if (f.status === "inactive" && b.isActive) return false;
    return true;
  });
}

function sortAdminBuyers(list) {
  const sorted = [...list];
  const { sort } = state.adminBuyerFilters;
  if (sort === "budget") {
    sorted.sort(
      (a, b) =>
        (parseDemandBudgetInput(b.budgetText) || 0) - (parseDemandBudgetInput(a.budgetText) || 0)
    );
  } else if (sort === "volume") {
    sorted.sort((a, b) => (b.volumeKg || 0) - (a.volumeKg || 0));
  } else if (sort === "newest") {
    sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else {
    sorted.sort((a, b) => a.companyName.localeCompare(b.companyName, "ru"));
  }
  return sorted;
}

function renderAdminBuyersList(list) {
  state.adminBuyers = list;
  if (!list.length) {
    els.empty.hidden = false;
    els.empty.querySelector("h2").textContent = "Ничего не найдено";
    els.empty.querySelector("p").textContent = "Измените фильтры или проверьте данные в базе.";
    els.results.innerHTML = "";
    updateAdminBuyersSidebar([]);
    els.resultsMeta.textContent = "Найдено: 0 покупателей · данные из MySQL";
    return;
  }
  els.empty.hidden = true;
  els.results.className = "results";
  els.results.innerHTML = list.map(renderAdminBuyerCard).join("");
  els.resultsMeta.textContent = `Найдено: ${list.length} покупател${list.length === 1 ? "ь" : list.length < 5 ? "я" : "ей"} · данные из MySQL`;
  updateAdminBuyersSidebar(list);
}

async function renderAdminBuyersCatalog() {
  hideError();
  setLoading(true);
  els.compareBar.hidden = true;
  try {
    if (!state.adminBuyersAll.length) {
      state.adminBuyersAll = await api("/api/admin/buyer-demands");
    }
    readAdminBuyerFiltersFromForm();
    const list = sortAdminBuyers(filterAdminBuyers(state.adminBuyersAll));
    setLoading(false);
    els.loading.hidden = true;
    renderAdminBuyersList(list);
  } catch (err) {
    setLoading(false);
    els.loading.hidden = true;
    showError(err.message);
    els.results.innerHTML = "";
    updateAdminBuyersSidebar([]);
  }
}

function populateAdminBuyerFilterOptions() {
  if (!els.adminBuyersCategory || !els.adminBuyersCity) return;
  const catValue = els.adminBuyersCategory.value;
  const cityValue = els.adminBuyersCity.value;
  els.adminBuyersCategory.innerHTML = '<option value="">Все категории</option>';
  els.adminBuyersCity.innerHTML = '<option value="">Любой город</option>';
  state.categories.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.label;
    els.adminBuyersCategory.appendChild(opt);
  });
  state.cities.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    els.adminBuyersCity.appendChild(opt);
  });
  els.adminBuyersCategory.value = catValue;
  els.adminBuyersCity.value = cityValue;
}

async function openDetail(id) {
  if (!canUseBuyerFeatures() && !isAdminAccount()) {
    if (!isLoggedIn()) promptBuyerAuth();
    else {
      openAuthModal("login", {
        audience: "buyer",
        message: "Чтобы открыть карточку поставщика, войдите в аккаунт покупателя.",
      });
    }
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
                  <td>${escapeHtml(formatProductPrice(p.pricePerUnit, p.unit, p.priceHint))}</td>
                  <td>${escapeHtml(formatProductMinOrder(p.minOrder))}</td>
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
        ${canUseBuyerFeatures() ? favoriteButtonHtml(s.id, state.favoritesStore?.has(s.id), { sm: false, className: "btn--favorite-detail" }) : ""}
        ${
          canUseBuyerFeatures()
            ? `<button type="button" class="btn btn--ghost" data-action="compare-detail" data-id="${s.id}">
          ${state.compare.includes(s.id) ? "Убрать из сравнения" : "Добавить в сравнение"}
        </button>`
            : ""
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
        <p class="supplier-card__meta">${formatDate(order.createdAt)} · ${orderStatusLabel(order.status)} · <strong>${formatMoney(order.totalAmount)} ₽</strong></p>

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

async function updateIncomingProposalStatus(proposalId, status) {
  const { proposal } = await api(`/api/my/incoming-proposals/${proposalId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  const idx = state.incomingProposals.findIndex((p) => p.id === proposal.id);
  if (idx >= 0) state.incomingProposals[idx] = proposal;
  else state.incomingProposals.unshift(proposal);
  openIncomingProposalPanel(proposal);
  if (state.view === "incoming-proposals") {
    els.results.innerHTML = state.incomingProposals.map(renderIncomingProposalCard).join("");
  }
}

function renderIncomingProposalCard(p) {
  const seller = p.seller || {};
  return `
    <article class="proposal-card" data-incoming-proposal-id="${p.id}">
      <div class="proposal-card__head">
        <h3 class="proposal-card__title">${escapeHtml(seller.supplierName || "Поставщик")}</h3>
        <div class="proposal-card__head-right">
          ${renderProposalStatusBadge(p.status)}
          <span class="proposal-card__date">${formatProposalDate(p.updatedAt || p.createdAt)}</span>
        </div>
      </div>
      <p class="proposal-card__meta">${escapeHtml(seller.city || "")}${seller.region ? ` · ${escapeHtml(seller.region)}` : ""}${p.buyer?.volumeText ? ` · заявка: ${escapeHtml(p.buyer.volumeText)}` : ""}</p>
      <p class="proposal-card__message">${escapeHtml(truncateMessage(p.message))}</p>
      ${renderProposalItemsSummary(p.lineItems)}
      ${renderProposalFacts(p.priceOffer, p.volumeOffer, p.offerTotal)}
      <button type="button" class="btn btn--sm btn--primary" data-incoming-proposal-open="${p.id}">Открыть</button>
    </article>`;
}

function openIncomingProposalPanel(proposal) {
  const seller = proposal.seller || {};
  const buyer = proposal.buyer || {};
  const panel = els.panelIncomingProposal;
  const isPending = !proposal.status || proposal.status === "pending";
  const actionButtons = isPending
    ? `<button type="button" class="btn btn--primary" id="btn-accept-proposal" data-proposal-id="${proposal.id}">Принять предложение</button>
       <button type="button" class="btn btn--ghost" id="btn-reject-proposal" data-proposal-id="${proposal.id}">Отклонить предложение</button>`
    : "";
  const contactsBlock =
    seller.contacts?.phone || seller.contacts?.email
      ? `<section class="detail-section"><h3>Контакты поставщика</h3><ul class="contact-list">
          ${seller.contacts.phone ? `<li><a href="tel:${seller.contacts.phone.replace(/\s/g, "")}">${escapeHtml(seller.contacts.phone)}</a></li>` : ""}
          ${seller.contacts.email ? `<li><a href="mailto:${seller.contacts.email}">${escapeHtml(seller.contacts.email)}</a></li>` : ""}
        </ul></section>`
      : "";

  panel.innerHTML = `
    <header class="panel__head">
      <h2>Ответ поставщика</h2>
      <button type="button" class="panel__close" data-close aria-label="Закрыть">×</button>
    </header>
    <div class="panel__body">
      <p class="deal-panel__lead">Поставщик: <strong>${escapeHtml(seller.supplierName || "")}</strong> ${renderProposalStatusBadge(proposal.status)}</p>
      <p class="proposal-card__meta">${formatProposalDate(proposal.updatedAt || proposal.createdAt)}${seller.city ? ` · ${escapeHtml(seller.city)}` : ""}${seller.region ? ` · ${escapeHtml(seller.region)}` : ""}</p>
      <dl class="detail-dl">
        <div><dt>Ваша заявка</dt><dd>${buyer.volumeText ? escapeHtml(buyer.volumeText) : "—"}</dd></div>
        <div><dt>Бюджет</dt><dd>${buyer.budgetText ? escapeHtml(buyer.budgetText) : "—"}</dd></div>
      </dl>
      <section class="detail-section">
        <h3>Сообщение поставщика</h3>
        <p>${escapeHtml(proposal.message)}</p>
        ${renderProposalFacts(proposal.priceOffer, proposal.volumeOffer, proposal.offerTotal)}
      </section>
      ${renderProposalProductsSection(proposal.lineItems, proposal.offerTotal)}
      ${contactsBlock}
      <p class="auth-error" id="incoming-proposal-error" hidden></p>
    </div>
    <footer class="panel__foot">
      ${actionButtons}
      ${seller.contacts?.phone ? `<a class="btn btn--ghost" href="tel:${seller.contacts.phone.replace(/\s/g, "")}">Позвонить</a>` : ""}
      ${seller.contacts?.email ? `<a class="btn btn--ghost" href="mailto:${seller.contacts.email}">Написать</a>` : ""}
      <button type="button" class="btn btn--ghost" data-close>Закрыть</button>
    </footer>
  `;

  panel.querySelector("#btn-accept-proposal")?.addEventListener("click", async () => {
    const errEl = panel.querySelector("#incoming-proposal-error");
    errEl.hidden = true;
    try {
      await updateIncomingProposalStatus(proposal.id, "accepted");
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
    }
  });
  panel.querySelector("#btn-reject-proposal")?.addEventListener("click", async () => {
    if (!window.confirm("Отклонить предложение поставщика?")) return;
    const errEl = panel.querySelector("#incoming-proposal-error");
    errEl.hidden = true;
    try {
      await updateIncomingProposalStatus(proposal.id, "rejected");
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
    }
  });
  openPanel(panel);
}

async function renderBuyerFavorites() {
  hideError();
  setLoading(true);
  els.compareBar.hidden = true;
  els.resultsMeta.textContent = "Избранные поставщики";
  try {
    if (!canUseBuyerFeatures()) {
      els.loading.hidden = true;
      els.empty.hidden = true;
      els.results.innerHTML =
        '<div class="empty"><h2>Войдите в аккаунт</h2><p>Избранное доступно покупателям после входа.</p><button type="button" class="btn btn--primary" id="favorites-login">Войти</button></div>';
      document.getElementById("favorites-login")?.addEventListener("click", () =>
        openAuthModal("login", { audience: "buyer" })
      );
      setLoading(false);
      return;
    }
    if (!state.favoritesStore) {
      state.favoritesStore = createFavoritesStore("supplier");
    }
    await state.favoritesStore.load();
    const ids = [...state.favoritesStore.ids];
    setLoading(false);
    els.loading.hidden = true;
    if (!ids.length) {
      els.empty.hidden = false;
      els.empty.querySelector("h2").textContent = "Избранного пока нет";
      els.empty.querySelector("p").textContent =
        "Нажмите «☆ В избранное» на карточке поставщика в каталоге.";
      els.results.innerHTML = "";
      updateRecommendation(null);
      return;
    }
    const list = await fetchSuppliers({ ids: ids.join(",") });
    els.empty.hidden = true;
    els.results.className = "results";
    els.results.innerHTML = list.map(renderCard).join("");
    updateRecommendation(list[0] || null);
    els.resultsMeta.textContent = `В избранном: ${list.length} поставщик${list.length === 1 ? "" : list.length < 5 ? "а" : "ов"}`;
  } catch (err) {
    setLoading(false);
    els.loading.hidden = true;
    showError(err.message);
  }
}

async function renderIncomingProposals() {
  hideError();
  setLoading(true);
  els.compareBar.hidden = true;
  els.resultsMeta.textContent = "Ответы поставщиков на ваши заявки";
  try {
    if (!isLoggedIn()) {
      els.loading.hidden = true;
      els.empty.hidden = true;
      els.results.innerHTML =
        '<div class="empty"><h2>Войдите в аккаунт</h2><p>Ответы поставщиков доступны после входа.</p><button type="button" class="btn btn--primary" id="incoming-login">Войти</button></div>';
      document.getElementById("incoming-login")?.addEventListener("click", () =>
        openAuthModal("login", { audience: "buyer" })
      );
      setLoading(false);
      return;
    }
    const list = await api("/api/my/incoming-proposals");
    state.incomingProposals = list;
    setLoading(false);
    els.loading.hidden = true;
    if (!list.length) {
      els.empty.hidden = false;
      els.empty.querySelector("h2").textContent = "Ответов пока нет";
      els.empty.querySelector("p").textContent =
        "Когда поставщик ответит на вашу заявку, предложение появится здесь.";
      els.results.innerHTML = "";
      return;
    }
    els.empty.hidden = true;
    els.results.className = "results results--proposals-list";
    els.results.innerHTML = list.map(renderIncomingProposalCard).join("");
  } catch (err) {
    setLoading(false);
    els.loading.hidden = true;
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
    els.results.className = "results";
    els.results.innerHTML = orders
      .map(
        (o) => `
      <article class="supplier-card order-card" data-order-id="${o.id}">
        <h3 class="supplier-card__title">Заказ №${o.id} · ${escapeHtml(o.supplierName)}</h3>
        <p class="supplier-card__meta">${formatDate(o.createdAt)} · ${orderStatusLabel(o.status)} · <strong>${formatMoney(o.totalAmount)} ₽</strong></p>
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
      : `<p class="compare-winner__empty">Уточните фильтры (город, объём), чтобы увидеть аргументы.</p>`;

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

async function toggleSupplierFavorite(id) {
  if (!canUseBuyerFeatures()) {
    if (!isLoggedIn()) promptBuyerAuth(true);
    else {
      openAuthModal("login", { audience: "buyer", message: "Избранное доступно покупателям." });
    }
    return;
  }
  if (!state.favoritesStore) {
    state.favoritesStore = createFavoritesStore("supplier");
    await state.favoritesStore.load();
  }
  try {
    await state.favoritesStore.toggle(id);
    if (state.view === "favorites") await renderBuyerFavorites();
    else renderResults();
  } catch (err) {
    showError(err.message);
  }
}

function readFiltersFromForm() {
  state.category = els.category.value;
  state.city = els.city.value;
  state.query = els.query.value;
  state.organization = els.organization?.value || "";
  state.budgetKg = els.budget.value;
  state.sort = els.sort.value;
}

async function initMeta() {
  const [categories, cities] = await Promise.all([
    api("/api/categories"),
    api("/api/cities"),
  ]);

  state.categories = categories;
  state.cities = cities;

  categories.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.label;
    els.category.appendChild(opt);
  });

  cities.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    els.city.appendChild(opt);
  });

  populateAdminBuyerFilterOptions();

  const params = new URLSearchParams(location.search);
  if (params.get("city")) els.city.value = params.get("city");
  else if (params.get("region")) els.city.value = params.get("region");
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

  const applyAdminBuyersFilters = () => {
    readAdminBuyerFiltersFromForm();
    if (state.view === "buyers-catalog") {
      if (state.adminBuyersAll.length) {
        renderAdminBuyersList(sortAdminBuyers(filterAdminBuyers(state.adminBuyersAll)));
      } else {
        renderAdminBuyersCatalog();
      }
    }
  };

  els.adminBuyersSearchForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    applyAdminBuyersFilters();
  });
  els.adminBuyersSearchForm?.addEventListener("change", applyAdminBuyersFilters);
  els.adminBuyersSearchForm?.addEventListener("input", (e) => {
    if (e.target.matches("input")) applyAdminBuyersFilters();
  });
  document.getElementById("reset-admin-buyers-filters")?.addEventListener("click", () => {
    els.adminBuyersSearchForm?.reset();
    applyAdminBuyersFilters();
  });

  els.results.addEventListener("click", (e) => {
    const adminBuyerId = e.target.closest("[data-admin-buyer-open]")?.dataset.adminBuyerOpen;
    if (adminBuyerId && isAdminAccount()) {
      const buyer = state.adminBuyers?.find((b) => String(b.id) === String(adminBuyerId));
      if (buyer) openAdminBuyerPanel(buyer);
      return;
    }
    const incomingBtn = e.target.closest("[data-incoming-proposal-open]");
    if (incomingBtn) {
      const proposal = state.incomingProposals.find(
        (p) => p.id === Number(incomingBtn.dataset.incomingProposalOpen)
      );
      if (proposal) openIncomingProposalPanel(proposal);
      return;
    }
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
    if (isAdminAccount() && state.view === "buyers-catalog") return;
    const id = card.dataset.id;
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (action === "deal") {
      openDealPanel(id);
      return;
    }
    if (action === "detail") openDetail(id);
    const favBtn = e.target.closest("[data-favorite-id]");
    if (favBtn) {
      toggleSupplierFavorite(favBtn.dataset.favoriteId);
      return;
    }
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
    const adminBuyerId = e.target.closest("[data-admin-buyer-open]")?.dataset.adminBuyerOpen;
    if (adminBuyerId && isAdminAccount()) {
      const buyer = state.adminBuyers?.find((b) => String(b.id) === String(adminBuyerId));
      if (buyer) openAdminBuyerPanel(buyer);
      return;
    }
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

  els.panelDetail?.addEventListener("click", async (e) => {
    const favBtn = e.target.closest("[data-favorite-id]");
    if (favBtn) {
      await toggleSupplierFavorite(favBtn.dataset.favoriteId);
      openDetail(favBtn.dataset.favoriteId);
      return;
    }
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
                : view === "incoming-proposals"
                  ? "Чтобы смотреть ответы поставщиков, войдите в аккаунт покупателя."
                  : view === "favorites"
                    ? "Чтобы смотреть избранное, войдите в аккаунт покупателя."
                    : "Чтобы пользоваться разделом, войдите в аккаунт покупателя.",
          });
        }
        return;
      }
      if (view === "buyers-catalog") {
        if (!isAdminAccount()) return;
        state.view = "buyers-catalog";
        els.navTabs.forEach((t) => t.classList.toggle("is-active", t === tab));
        renderResults();
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

const BUYER_ONLY_VIEWS = ["orders", "demands", "incoming-proposals", "favorites"];

function applyBuyerNavVisibility() {
  const isBuyerAccount = canUseBuyerFeatures();
  const isAdmin = isAdminAccount();
  const catalogTab = document.getElementById("buyer-tab-catalog");
  const buyersCatalogTab = document.getElementById("buyer-tab-buyers-catalog");
  const ordersTab = document.getElementById("buyer-tab-orders");
  const demandsTab = document.getElementById("buyer-tab-demands");
  const incomingTab = document.getElementById("buyer-tab-incoming-proposals");
  const favoritesTab = document.getElementById("buyer-tab-favorites");
  if (catalogTab) catalogTab.textContent = isAdmin ? "Каталог поставщиков" : "Каталог";
  const hidePersonalTabs = !isBuyerAccount || isAdmin;
  if (ordersTab) ordersTab.hidden = hidePersonalTabs;
  if (demandsTab) demandsTab.hidden = hidePersonalTabs;
  if (incomingTab) incomingTab.hidden = hidePersonalTabs;
  if (favoritesTab) favoritesTab.hidden = hidePersonalTabs;
  if (buyersCatalogTab) buyersCatalogTab.hidden = !isAdmin;

  els.navTabs.forEach((tab) => {
    if (tab.dataset.view === "list") {
      tab.hidden = !isBuyerAccount && !isAdmin;
    } else if (tab.dataset.view === "buyers-catalog") {
      tab.hidden = !isAdmin;
    } else if (BUYER_ONLY_VIEWS.includes(tab.dataset.view)) {
      tab.hidden = hidePersonalTabs;
    } else {
      tab.hidden = !isBuyerAccount;
    }
  });

  if (!isBuyerAccount && BUYER_ONLY_VIEWS.includes(state.view)) {
    goToBuyerCatalog();
  }
  if (!isAdmin && state.view === "buyers-catalog") {
    goToBuyerCatalog();
  }
}

function goToBuyerCatalog() {
  state.view = "list";
  els.navTabs.forEach((t) => t.classList.toggle("is-active", t.dataset.view === "list"));
  showBuyerContentView("list");
  renderResults();
}

export async function initBuyerApp() {
  closeAllPanels();
  bindEvents();
  applyBuyerNavVisibility();
  renderCompareBar();
  try {
    if (canUseBuyerFeatures()) {
      state.favoritesStore = createFavoritesStore("supplier");
      await state.favoritesStore.load();
    }
    await initMeta();
    if (!isAdminAccount()) {
      await maybeShowQuickSetup("buyer", {
        categories: state.categories,
        cities: state.cities,
        fetchSuggestions: () => api("/api/suppliers?sort=rating"),
        applyFilters: (f) => {
          if (f.category != null) els.category.value = f.category;
          if (f.city != null) els.city.value = f.city;
          else if (f.region != null) els.city.value = f.region;
          if (f.query != null) els.query.value = f.query;
          readFiltersFromForm();
        },
      });
    }
    await renderResults();
  } catch (err) {
    showError(
      `${err.message}. Запустите сервер (npm start) и инициализируйте БД (см. README).`
    );
    setLoading(false);
  }
}
