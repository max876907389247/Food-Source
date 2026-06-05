import { api, initAuth, isAdmin, loadSession } from "./auth.js";
import { hideAdminSupplierProducts, initAdminSupplierProducts } from "./admin-products.js";
import { parseDemandBudgetInput, parseDemandVolumeInput } from "./proposals-shared.js";
import { bindPhoneField, formatUserPhone, isCompleteUserPhone } from "./phone.js";
import { escapeHtml } from "./ui.js";

const suppliersTbody = document.getElementById("suppliers-tbody");
const buyersTbody = document.getElementById("buyers-tbody");
const usersTbody = document.getElementById("users-tbody");
const supplierModal = document.getElementById("supplier-modal");
const buyerModal = document.getElementById("buyer-modal");
const userModal = document.getElementById("user-modal");
const supplierForm = document.getElementById("supplier-form");
const buyerForm = document.getElementById("buyer-form");
const userForm = document.getElementById("user-form");
const hint = document.getElementById("admin-hint");

let meta = { categories: [], regions: [], cities: [] };
let allSuppliers = [];
let allBuyers = [];
let allUsers = [];
let supplierProductsCtl = null;

const suppliersFilterForm = document.getElementById("suppliers-filter-form");
const buyersFilterForm = document.getElementById("buyers-filter-form");
const usersFilterForm = document.getElementById("users-filter-form");
const suppliersFilterMeta = document.getElementById("suppliers-filter-meta");
const buyersFilterMeta = document.getElementById("buyers-filter-meta");
const usersFilterMeta = document.getElementById("users-filter-meta");

const RESPONSE_TIME_OPTIONS = [
  "30 минут",
  "45 минут",
  "1 час",
  "1 час 30 минут",
  "2 часа",
  "2 часа 30 минут",
  "3 часа",
  "3 часа 30 минут",
  "4 часа",
];

const WORK_HOUR_OPTIONS = Array.from({ length: 14 }, (_, i) => {
  const h = 8 + i;
  return `${String(h).padStart(2, "0")}:00`;
});

function parseWorkingHours(value) {
  const m = String(value || "").match(/(\d{2}:\d{2})–(\d{2}:\d{2})/);
  if (!m) return { from: "08:00", to: "21:00" };
  return { from: m[1], to: m[2] };
}

function initSupplierFieldSelects() {
  const rt = document.getElementById("field-response-time");
  if (rt) {
    rt.innerHTML =
      '<option value="">Выберите…</option>' +
      RESPONSE_TIME_OPTIONS.map(
        (t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`
      ).join("");
  }

  const hourHtml = WORK_HOUR_OPTIONS.map(
    (h) => `<option value="${h}">${h}</option>`
  ).join("");
  const from = document.getElementById("field-work-from");
  const to = document.getElementById("field-work-to");
  if (from) from.innerHTML = hourHtml;
  if (to) to.innerHTML = hourHtml;
}

function syncCertificatesField() {
  const checked = document.getElementById("field-certs")?.checked;
  const ta = document.getElementById("field-certificates-text");
  if (!ta) return;
  ta.required = Boolean(checked);
}

function validateSupplierFormClient() {
  const fd = new FormData(supplierForm);
  if (fd.get("hasCertificates") === "on" && !String(fd.get("certificatesText") || "").trim()) {
    throw new Error("При подтверждённых сертификатах укажите их названия");
  }
  if (!fd.get("responseTime")) {
    throw new Error("Выберите срок ответа на запрос");
  }
  const from = fd.get("workHoursFrom");
  const to = fd.get("workHoursTo");
  if (!from || !to) {
    throw new Error("Укажите время работы (МСК)");
  }
  if (from >= to) {
    throw new Error("Время окончания работы должно быть позже начала");
  }
}

function ensureResponseTimeOption(value) {
  const rt = supplierForm.elements.responseTime;
  if (!value || !rt) return;
  const exists = [...rt.options].some((o) => o.value === value);
  if (!exists) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = `${value} (обновите значение)`;
    rt.appendChild(opt);
  }
  rt.value = value;
}

function formatDate(val) {
  if (!val) return "—";
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? String(val) : d.toLocaleString("ru-RU");
}

function openOverlay(modal) {
  modal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeOverlay(modal) {
  modal.hidden = true;
  if (!document.querySelector(".overlay:not([hidden])")) {
    document.body.classList.remove("modal-open");
  }
}

function setSection(name) {
  document.querySelectorAll(".admin-tabs [data-section]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.section === name);
  });
  document.getElementById("section-suppliers").hidden = name !== "suppliers";
  document.getElementById("section-buyers").hidden = name !== "buyers";
  document.getElementById("section-users").hidden = name !== "users";
}

function audienceLabel(a) {
  if (a === "seller") return "Поставщик";
  return "Покупатель";
}

function getCheckedValues(container, inputName) {
  if (!container) return [];
  return [...container.querySelectorAll(`input[name="${inputName}"]:checked`)].map(
    (el) => el.value
  );
}

function regionOptionsHtml() {
  return meta.regions
    .map((r) => {
      const name = typeof r === "string" ? r : r.name;
      return `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`;
    })
    .join("");
}

function cityOptionsHtml() {
  return (meta.cities || [])
    .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
    .join("");
}

function categoryOptionsHtml() {
  return meta.categories
    .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.label)}</option>`)
    .join("");
}

function populateAdminFilterSelects() {
  const catFilter = document.getElementById("filter-supplier-category");
  const supplierCityFilter = document.getElementById("filter-supplier-city");
  const buyerCatFilter = document.getElementById("filter-buyer-category");
  const buyerCityFilter = document.getElementById("filter-buyer-city");

  if (catFilter) {
    const val = catFilter.value;
    catFilter.innerHTML = `<option value="">Все категории</option>${categoryOptionsHtml()}`;
    catFilter.value = val;
  }
  if (supplierCityFilter) {
    const val = supplierCityFilter.value;
    supplierCityFilter.innerHTML = `<option value="">Любой город</option>${cityOptionsHtml()}`;
    supplierCityFilter.value = val;
  }
  if (buyerCatFilter) {
    const val = buyerCatFilter.value;
    buyerCatFilter.innerHTML = `<option value="">Все категории</option>${categoryOptionsHtml()}`;
    buyerCatFilter.value = val;
  }
  if (buyerCityFilter) {
    const val = buyerCityFilter.value;
    buyerCityFilter.innerHTML = `<option value="">Любой город</option>${cityOptionsHtml()}`;
    buyerCityFilter.value = val;
  }

  populateBuyerFormSelects();
}

function bindUserPhoneField() {
  bindPhoneField(document.getElementById("user-phone"));
}

function userAccountTypeFromUser(user) {
  if (!user) return "buyer";
  if (user.role === "admin") return "admin";
  return user.audience === "seller" ? "seller" : "buyer";
}

function accountTypeToRoleAudience(accountType) {
  if (accountType === "admin") return { role: "admin", audience: "buyer" };
  return { role: "user", audience: accountType };
}

function syncUserFormFields(isEdit = false) {
  const accountType = document.getElementById("user-account-type")?.value || "buyer";
  const isOrg = accountType === "buyer" || accountType === "seller";

  document.getElementById("user-org-fields")?.toggleAttribute("hidden", !isOrg);
  ["user-field-organization-wrap", "user-field-city-wrap", "user-field-phone-wrap", "user-field-email-wrap"].forEach(
    (id) => document.getElementById(id)?.toggleAttribute("hidden", !isOrg)
  );

}

function readUserFormValues() {
  const accountType = document.getElementById("user-account-type")?.value || "buyer";
  return {
    accountType: String(accountType),
    username: String(document.getElementById("user-username")?.value || "").trim(),
    password: String(document.getElementById("user-password")?.value || ""),
    organizationName: String(document.getElementById("user-organization")?.value || "").trim(),
    city: String(document.getElementById("user-city")?.value || "").trim(),
    contactPhone: String(document.getElementById("user-phone")?.value || "").trim(),
    contactEmail: String(document.getElementById("user-email")?.value || "").trim(),
  };
}

function buildUserBody(isEdit) {
  syncUserFormFields(isEdit);
  const values = readUserFormValues();
  const { role, audience } = accountTypeToRoleAudience(values.accountType);

  if (!values.username) {
    throw new Error("Укажите логин");
  }
  if (!isEdit && !values.password) {
    throw new Error("Укажите пароль");
  }

  const body = {
    username: values.username,
    role,
    audience,
  };
  if (values.password) body.password = values.password;

  if (values.accountType !== "admin") {
    if (!values.organizationName) throw new Error("Укажите название организации");
    if (!values.city) throw new Error("Укажите город");
    if (!isCompleteUserPhone(values.contactPhone)) {
      throw new Error("Укажите телефон в формате +7 999-999-99-99");
    }

    body.organizationName = values.organizationName;
    body.city = values.city;
    body.region = values.city;
    body.contactPhone = formatUserPhone(values.contactPhone);
    if (values.contactEmail) body.contactEmail = values.contactEmail;
  }

  return body;
}

function getSupplierFilterState() {
  return {
    category: document.getElementById("filter-supplier-category")?.value || "",
    city: document.getElementById("filter-supplier-city")?.value || "",
    query: (document.getElementById("filter-supplier-query")?.value || "").trim().toLowerCase(),
    certs: document.getElementById("filter-supplier-certs")?.value || "",
    sort: document.getElementById("filter-supplier-sort")?.value || "name",
  };
}

function getUserFilterState() {
  return {
    query: (document.getElementById("filter-user-query")?.value || "").trim().toLowerCase(),
    role: document.getElementById("filter-user-role")?.value || "",
    audience: document.getElementById("filter-user-audience")?.value || "",
    sort: document.getElementById("filter-user-sort")?.value || "username",
  };
}

function getBuyerFilterState() {
  return {
    category: document.getElementById("filter-buyer-category")?.value || "",
    city: document.getElementById("filter-buyer-city")?.value || "",
    organization: (document.getElementById("filter-buyer-organization")?.value || "").trim().toLowerCase(),
    query: (document.getElementById("filter-buyer-query")?.value || "").trim().toLowerCase(),
    status: document.getElementById("filter-buyer-status")?.value || "",
    sort: document.getElementById("filter-buyer-sort")?.value || "name",
  };
}

function filterSuppliers(list) {
  const f = getSupplierFilterState();
  let out = list.filter((s) => {
    if (f.category && !(s.categories || []).includes(f.category)) return false;
    if (f.city && s.city !== f.city) return false;
    if (f.certs === "yes" && !s.hasCertificates) return false;
    if (f.certs === "no" && s.hasCertificates) return false;
    if (f.query) {
      const hay = [s.id, s.name, s.city, s.description, ...(s.regions || [])]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(f.query)) return false;
    }
    return true;
  });

  out = [...out].sort((a, b) => {
    switch (f.sort) {
      case "rating":
        return b.rating - a.rating || a.name.localeCompare(b.name, "ru");
      case "city":
        return a.city.localeCompare(b.city, "ru") || a.name.localeCompare(b.name, "ru");
      case "minOrder":
        return String(a.minOrder).localeCompare(String(b.minOrder), "ru", {
          numeric: true,
        });
      default:
        return a.name.localeCompare(b.name, "ru");
    }
  });

  return out;
}

function filterUsers(list) {
  const f = getUserFilterState();
  let out = list.filter((u) => {
    if (f.role && u.role !== f.role) return false;
    if (f.audience && u.audience !== f.audience) return false;
    if (f.query) {
      const hay = [
        u.username,
        u.organizationName,
        u.city,
        u.region,
        u.contactPhone,
        u.contactEmail,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(f.query)) return false;
    }
    return true;
  });

  out = [...out].sort((a, b) => {
    switch (f.sort) {
      case "role":
        return a.role.localeCompare(b.role, "ru") || a.username.localeCompare(b.username, "ru");
      case "createdAt":
        return new Date(b.createdAt) - new Date(a.createdAt);
      default:
        return a.username.localeCompare(b.username, "ru");
    }
  });

  return out;
}

function filterBuyers(list) {
  const f = getBuyerFilterState();
  let out = list.filter((b) => {
    if (f.category && String(b.categoryId) !== String(f.category)) return false;
    if (f.city && b.city !== f.city) return false;
    if (f.organization && !b.companyName.toLowerCase().includes(f.organization)) return false;
    if (f.query) {
      const hay = `${b.description} ${b.businessType} ${b.companyName} ${b.city}`.toLowerCase();
      if (!hay.includes(f.query)) return false;
    }
    if (f.status === "active" && !b.isActive) return false;
    if (f.status === "inactive" && b.isActive) return false;
    return true;
  });

  out = [...out].sort((a, b) => {
    switch (f.sort) {
      case "budget":
        return (
          (parseDemandBudgetInput(b.budgetText) || 0) - (parseDemandBudgetInput(a.budgetText) || 0)
        );
      case "volume":
        return (b.volumeKg || 0) - (a.volumeKg || 0);
      case "newest":
        return new Date(b.createdAt) - new Date(a.createdAt);
      default:
        return a.companyName.localeCompare(b.companyName, "ru");
    }
  });

  return out;
}

function renderAccountCells(account) {
  const acc = account || {};
  const login = acc.login || "—";
  const password = acc.password ?? "—";
  const missingNote = acc.missing
    ? ' <span class="admin-cred-missing" title="Запустите npm run db:seed-accounts">не в БД</span>'
    : "";
  return `
      <td class="admin-cred"><code>${escapeHtml(login)}</code>${missingNote}</td>
      <td class="admin-cred"><code>${escapeHtml(password)}</code></td>`;
}

function renderSupplierRow(s) {
  return `
    <tr>
      <td><code>${escapeHtml(s.id)}</code></td>
      <td>${escapeHtml(s.name)}</td>
      <td>${escapeHtml(s.city)}</td>
      <td>${s.rating}</td>
      <td>${escapeHtml(s.minOrder)}</td>
      <td>${s.hasCertificates ? "Да" : "Нет"}</td>
      <td>${s.productCount ?? 0}</td>
      ${renderAccountCells(s.account)}
      <td class="admin-actions">
        <button type="button" class="btn btn--sm btn--ghost" data-edit-supplier="${escapeHtml(s.id)}">Изменить</button>
        <button type="button" class="btn btn--sm btn--ghost btn--danger" data-del-supplier="${escapeHtml(s.id)}">Удалить</button>
      </td>
    </tr>`;
}

function renderUserRow(u) {
  const org = escapeHtml(u.organizationName || "—");
  const place = u.city || "—";
  const contacts = [u.contactPhone, u.contactEmail].filter(Boolean).join(" · ") || "—";
  const pwd = u.displayPassword != null ? u.displayPassword : "—";
  return `
    <tr>
      <td>${u.id}</td>
      <td><strong>${escapeHtml(u.username)}</strong></td>
      <td class="admin-cred"><code>${escapeHtml(pwd)}</code></td>
      <td><span class="badge badge--muted">${audienceLabel(u.audience)}</span></td>
      <td>${org}</td>
      <td>${escapeHtml(place)}</td>
      <td class="admin-contacts">${escapeHtml(contacts)}</td>
      <td><span class="badge ${u.role === "admin" ? "badge--ok" : "badge--muted"}">${u.role === "admin" ? "Админ" : "Пользователь"}</span></td>
      <td>${formatDate(u.createdAt)}</td>
      <td class="admin-actions">
        <button type="button" class="btn btn--sm btn--ghost" data-edit-user="${u.id}">Изменить</button>
        <button type="button" class="btn btn--sm btn--ghost btn--danger" data-del-user="${u.id}">Удалить</button>
      </td>
    </tr>`;
}

function renderBuyerRow(b) {
  return `
    <tr>
      <td>${b.id}</td>
      <td><strong>${escapeHtml(b.companyName)}</strong></td>
      <td>${escapeHtml(b.city)}</td>
      <td>${escapeHtml(b.businessType)}</td>
      <td>${b.categoryLabel ? escapeHtml(b.categoryLabel) : "—"}</td>
      <td>${escapeHtml(b.volumeText)}</td>
      <td class="admin-contacts">${escapeHtml(b.contacts.phone)}<br>${escapeHtml(b.contacts.email)}</td>
      ${renderAccountCells(b.account)}
      <td class="admin-actions">
        <button type="button" class="btn btn--sm btn--ghost" data-edit-buyer="${b.id}">Изменить</button>
        <button type="button" class="btn btn--sm btn--ghost btn--danger" data-del-buyer="${b.id}">Удалить</button>
      </td>
    </tr>`;
}

function renderSuppliersTable() {
  const filtered = filterSuppliers(allSuppliers);
  if (suppliersFilterMeta) {
    suppliersFilterMeta.textContent = `Показано: ${filtered.length} из ${allSuppliers.length}`;
  }
  if (!filtered.length) {
    suppliersTbody.innerHTML =
      '<tr><td colspan="10" class="muted">Ничего не найдено. Измените фильтры.</td></tr>';
    return;
  }
  suppliersTbody.innerHTML = filtered.map(renderSupplierRow).join("");
}

function renderUsersTable() {
  const filtered = filterUsers(allUsers);
  if (usersFilterMeta) {
    usersFilterMeta.textContent = `Показано: ${filtered.length} из ${allUsers.length}`;
  }
  if (!filtered.length) {
    usersTbody.innerHTML =
      '<tr><td colspan="10" class="muted">Ничего не найдено. Измените фильтры.</td></tr>';
    return;
  }
  usersTbody.innerHTML = filtered.map(renderUserRow).join("");
}

function renderBuyersTable() {
  if (!buyersTbody) return;
  const filtered = filterBuyers(allBuyers);
  if (buyersFilterMeta) {
    buyersFilterMeta.textContent = `Показано: ${filtered.length} из ${allBuyers.length}`;
  }
  if (!allBuyers.length) {
    buyersTbody.innerHTML = '<tr><td colspan="10" class="muted">Нет заявок покупателей.</td></tr>';
    return;
  }
  if (!filtered.length) {
    buyersTbody.innerHTML =
      '<tr><td colspan="10" class="muted">Ничего не найдено. Измените фильтры.</td></tr>';
    return;
  }
  buyersTbody.innerHTML = filtered.map(renderBuyerRow).join("");
}

function populateBuyerFormSelects() {
  const catEl = document.getElementById("buyer-field-category");
  const cityEl = document.getElementById("buyer-field-city");
  if (catEl) {
    const catValue = catEl.value;
    catEl.innerHTML =
      '<option value="">—</option>' +
      meta.categories
        .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.label)}</option>`)
        .join("");
    catEl.value = catValue;
  }
  if (cityEl) {
    const cityValue = cityEl.value;
    cityEl.innerHTML = `<option value="">Выберите…</option>${cityOptionsHtml()}`;
    cityEl.value = cityValue;
  }
}

function buyerVolumeInputValue(demand) {
  if (demand?.volumeKg != null && demand.volumeKg !== "") return demand.volumeKg;
  return parseDemandVolumeInput(demand?.volumeText) ?? "";
}

function buyerBudgetInputValue(demand) {
  return parseDemandBudgetInput(demand?.budgetText) ?? "";
}

function fillBuyerForm(b) {
  document.getElementById("buyer-edit-id").value = b.id;
  buyerForm.elements.companyName.value = b.companyName;
  buyerForm.elements.businessType.value = b.businessType;
  buyerForm.elements.city.value = b.city;
  buyerForm.elements.categoryId.value = b.categoryId || "";
  buyerForm.elements.volumeKg.value = buyerVolumeInputValue(b);
  buyerForm.elements.budgetRub.value = buyerBudgetInputValue(b);
  buyerForm.elements.description.value = b.description;
  buyerForm.elements.contactPhone.value = b.contacts.phone;
  buyerForm.elements.contactEmail.value = b.contacts.email;
  document.getElementById("buyer-form-error").hidden = true;
}

function buyerPayload() {
  const fd = new FormData(buyerForm);
  const volumeKg = parseDemandVolumeInput(fd.get("volumeKg"));
  const budgetRub = parseDemandBudgetInput(fd.get("budgetRub"));
  if (volumeKg == null) throw new Error("Укажите объём в кг");
  if (budgetRub == null) throw new Error("Укажите бюджет");
  return {
    companyName: fd.get("companyName"),
    businessType: fd.get("businessType"),
    city: fd.get("city"),
    categoryId: fd.get("categoryId") || null,
    volumeKg,
    budgetRub,
    description: fd.get("description"),
    contactPhone: fd.get("contactPhone"),
    contactEmail: fd.get("contactEmail"),
  };
}

async function loadMeta() {
  meta = await api("/api/admin/meta");
  populateAdminFilterSelects();
  populateBuyerFormSelects();
  document.getElementById("field-categories").innerHTML = meta.categories
    .map(
      (c) => `
      <label class="multi-check-list__item">
        <input type="checkbox" name="categoryIds" value="${escapeHtml(c.id)}">
        <span>${escapeHtml(c.label)}</span>
      </label>`
    )
    .join("");
  document.getElementById("field-regions").innerHTML = meta.regions
    .map((r) => {
      const name = typeof r === "string" ? r : r.name;
      return `
      <label class="multi-check-list__item">
        <input type="checkbox" name="regionNames" value="${escapeHtml(name)}">
        <span>${escapeHtml(name)}</span>
      </label>`;
    })
    .join("");
}

async function loadSuppliers() {
  allSuppliers = await api("/api/admin/suppliers");
  renderSuppliersTable();
}

async function loadUsers() {
  allUsers = await api("/api/admin/users");
  renderUsersTable();
}

async function loadBuyers() {
  allBuyers = await api("/api/admin/buyer-demands");
  renderBuyersTable();
}

function bindAdminFilters() {
  suppliersFilterForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    renderSuppliersTable();
  });
  usersFilterForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    renderUsersTable();
  });
  buyersFilterForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    renderBuyersTable();
  });

  suppliersFilterForm?.addEventListener("change", () => renderSuppliersTable());
  suppliersFilterForm?.addEventListener("input", (e) => {
    if (e.target.matches("input")) renderSuppliersTable();
  });

  usersFilterForm?.addEventListener("change", () => renderUsersTable());
  usersFilterForm?.addEventListener("input", (e) => {
    if (e.target.matches("input")) renderUsersTable();
  });

  buyersFilterForm?.addEventListener("change", () => renderBuyersTable());
  buyersFilterForm?.addEventListener("input", (e) => {
    if (e.target.matches("input")) renderBuyersTable();
  });

  document.getElementById("reset-suppliers-filter")?.addEventListener("click", () => {
    suppliersFilterForm?.reset();
    renderSuppliersTable();
  });

  document.getElementById("reset-users-filter")?.addEventListener("click", () => {
    usersFilterForm?.reset();
    renderUsersTable();
  });

  document.getElementById("reset-buyers-filter")?.addEventListener("click", () => {
    buyersFilterForm?.reset();
    renderBuyersTable();
  });
}

function fillSupplierForm(s) {
  document.getElementById("supplier-edit-mode").value = "1";
  const idField = document.getElementById("field-id");
  idField.value = s.id;
  idField.readOnly = true;

  const map = {
    name: s.name,
    city: s.city,
    description: s.description,
    delivery: s.delivery,
    source: s.source,
    phone: s.contacts?.phone || s.phone,
    email: s.contacts?.email || s.email,
    website: s.contacts?.website || s.website || "",
    priceHint: s.priceHint,
    minOrder: s.minOrder,
    responseTime: s.responseTime,
  };

  for (const [key, val] of Object.entries(map)) {
    const el = supplierForm.elements[key];
    if (el && key !== "responseTime") el.value = val ?? "";
  }

  ensureResponseTimeOption(s.responseTime || "");
  const wh = parseWorkingHours(s.workingHours);
  supplierForm.elements.workHoursFrom.value = wh.from;
  supplierForm.elements.workHoursTo.value = wh.to;

  supplierForm.elements.rating.value = s.rating;
  supplierForm.elements.reviewsCount.value = s.reviewsCount;
  supplierForm.elements.minOrderKg.value = s.minOrderKg ?? "";
  supplierForm.elements.hasCertificates.checked = s.hasCertificates;
  supplierForm.elements.certificatesText.value = (s.certificates || []).join("\n");

  const catIds = new Set(s.categories || []);
  document
    .getElementById("field-categories")
    ?.querySelectorAll('input[name="categoryIds"]')
    .forEach((inp) => {
      inp.checked = catIds.has(inp.value);
    });
  const regionNames = new Set(s.regions || []);
  document
    .getElementById("field-regions")
    ?.querySelectorAll('input[name="regionNames"]')
    .forEach((inp) => {
      inp.checked = regionNames.has(inp.value);
    });

  syncCertificatesField();
}

function resetSupplierForm() {
  supplierProductsCtl?.hide();
  supplierProductsCtl = null;
  hideAdminSupplierProducts();
  supplierForm.reset();
  document.getElementById("supplier-edit-mode").value = "0";
  document.getElementById("field-id").readOnly = false;
  document.getElementById("field-certs").checked = false;
  supplierForm.elements.workHoursFrom.value = "08:00";
  supplierForm.elements.workHoursTo.value = "21:00";
  supplierForm.elements.responseTime.value = "";
  syncCertificatesField();
}

function supplierPayload() {
  const fd = new FormData(supplierForm);
  return {
    id: fd.get("id"),
    name: fd.get("name"),
    city: fd.get("city"),
    description: fd.get("description"),
    rating: Number(fd.get("rating")),
    reviewsCount: Number(fd.get("reviewsCount")),
    minOrder: fd.get("minOrder"),
    minOrderKg: fd.get("minOrderKg") ? Number(fd.get("minOrderKg")) : null,
    priceHint: fd.get("priceHint") || null,
    hasCertificates: fd.get("hasCertificates") === "on",
    delivery: fd.get("delivery"),
    source: fd.get("source"),
    responseTime: fd.get("responseTime"),
    workHoursFrom: fd.get("workHoursFrom"),
    workHoursTo: fd.get("workHoursTo"),
    phone: fd.get("phone"),
    email: fd.get("email"),
    website: fd.get("website") || null,
    categoryIds: getCheckedValues(
      document.getElementById("field-categories"),
      "categoryIds"
    ),
    regionNames: getCheckedValues(
      document.getElementById("field-regions"),
      "regionNames"
    ),
    certificatesText: fd.get("certificatesText"),
  };
}

function openUserForm(title, user = null) {
  const isEdit = Boolean(user);
  document.getElementById("user-form-title").textContent = title;
  document.getElementById("user-form-error").hidden = true;

  userForm.reset();
  document.getElementById("user-edit-id").value = user ? String(user.id) : "";
  document.getElementById("user-account-type").value = userAccountTypeFromUser(user);
  document.getElementById("user-username").value = user?.username || "";
  document.getElementById("user-organization").value = user?.organizationName || "";
  document.getElementById("user-city").value = user?.city || "";
  document.getElementById("user-phone").value = user?.contactPhone ? formatUserPhone(user.contactPhone) : "";
  document.getElementById("user-email").value = user?.contactEmail || "";
  document.getElementById("user-password").value = "";

  document.getElementById("user-password-hint")?.toggleAttribute("hidden", !isEdit);
  document.getElementById("user-password-required-hint")?.toggleAttribute("hidden", isEdit);
  syncUserFormFields(isEdit);
  openOverlay(userModal);
}

document.querySelectorAll("[data-section]").forEach((btn) => {
  btn.addEventListener("click", () => setSection(btn.dataset.section));
});

document.getElementById("btn-add-user")?.addEventListener("click", () => {
  openUserForm("Новый пользователь");
});

document.getElementById("user-account-type")?.addEventListener("change", () => {
  const isEdit = Boolean(document.getElementById("user-edit-id").value);
  syncUserFormFields(isEdit);
});

suppliersTbody.addEventListener("click", async (e) => {
  const editId = e.target.closest("[data-edit-supplier]")?.dataset.editSupplier;
  const delId = e.target.closest("[data-del-supplier]")?.dataset.delSupplier;

  if (editId) {
    const s = await api(`/api/admin/suppliers/${editId}`);
    resetSupplierForm();
    fillSupplierForm(s);
    document.getElementById("supplier-form-title").textContent = "Редактирование поставщика";
    supplierProductsCtl = initAdminSupplierProducts({
      supplierId: s.id,
      categories: meta.categories,
      products: s.products || [],
    });
    openOverlay(supplierModal);
  }
  if (delId && confirm(`Удалить поставщика ${delId}?`)) {
    await api(`/api/admin/suppliers/${delId}`, { method: "DELETE" });
    await loadSuppliers();
  }
});

buyersTbody?.addEventListener("click", async (e) => {
  const editId = e.target.closest("[data-edit-buyer]")?.dataset.editBuyer;
  const delId = e.target.closest("[data-del-buyer]")?.dataset.delBuyer;

  if (editId) {
    const b = allBuyers.find((row) => String(row.id) === String(editId));
    if (!b) return;
    populateBuyerFormSelects();
    fillBuyerForm(b);
    document.getElementById("buyer-form-title").textContent = "Редактирование заявки";
    openOverlay(buyerModal);
  }
  if (delId && confirm(`Удалить заявку покупателя #${delId}?`)) {
    await api(`/api/admin/buyer-demands/${delId}`, { method: "DELETE" });
    await loadBuyers();
  }
});

usersTbody.addEventListener("click", async (e) => {
  const editId = e.target.closest("[data-edit-user]")?.dataset.editUser;
  const delId = e.target.closest("[data-del-user]")?.dataset.delUser;

  if (editId) {
    const u = await api(`/api/admin/users/${editId}`);
    openUserForm("Редактирование пользователя", u);
  }
  if (delId && confirm(`Удалить пользователя #${delId}?`)) {
    await api(`/api/admin/users/${delId}`, { method: "DELETE" });
    await loadUsers();
  }
});

document.getElementById("field-certs")?.addEventListener("change", syncCertificatesField);

supplierForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("supplier-form-error");
  errEl.hidden = true;
  try {
    validateSupplierFormClient();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.hidden = false;
    return;
  }
  const payload = supplierPayload();
  const isEdit = document.getElementById("supplier-edit-mode").value === "1";
  if (!isEdit) {
    errEl.textContent = "Создание поставщиков отключено — только редактирование.";
    errEl.hidden = false;
    return;
  }

  try {
    await api(`/api/admin/suppliers/${payload.id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    await supplierProductsCtl?.reload?.();
    closeOverlay(supplierModal);
    await loadSuppliers();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.hidden = false;
  }
});

buyerForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("buyer-form-error");
  errEl.hidden = true;
  const id = document.getElementById("buyer-edit-id").value;
  if (!id) {
    errEl.textContent = "Создание покупателей отключено — только редактирование.";
    errEl.hidden = false;
    return;
  }
  let payload;
  try {
    payload = buyerPayload();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.hidden = false;
    return;
  }
  try {
    await api(`/api/admin/buyer-demands/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    closeOverlay(buyerModal);
    await loadBuyers();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.hidden = false;
  }
});

userForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("user-form-error");
  errEl.hidden = true;
  const id = document.getElementById("user-edit-id").value;
  const isEdit = Boolean(id);
  let body;
  try {
    body = buildUserBody(isEdit);
  } catch (err) {
    errEl.textContent = err.message;
    errEl.hidden = false;
    return;
  }

  try {
    if (isEdit) {
      await api(`/api/admin/users/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
    } else {
      await api("/api/admin/users", {
        method: "POST",
        body: JSON.stringify(body),
      });
    }
    closeOverlay(userModal);
    await loadUsers();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.hidden = false;
  }
});

supplierModal.addEventListener("click", (e) => {
  if (e.target === supplierModal || e.target.closest("[data-close]")) {
    closeOverlay(supplierModal);
  }
});

userModal.addEventListener("click", (e) => {
  if (e.target === userModal || e.target.closest("[data-close-user]")) {
    closeOverlay(userModal);
  }
});

buyerModal?.addEventListener("click", (e) => {
  if (e.target === buyerModal || e.target.closest("[data-close-buyer]")) {
    closeOverlay(buyerModal);
  }
});

async function boot() {
  await loadSession();
  await initAuth("#auth-bar");

  if (!isAdmin()) {
    hint.hidden = false;
    document.getElementById("btn-add-user").disabled = true;
    suppliersTbody.innerHTML = `<tr><td colspan="10">Нет доступа</td></tr>`;
    if (buyersTbody) buyersTbody.innerHTML = `<tr><td colspan="10">Нет доступа</td></tr>`;
    usersTbody.innerHTML = `<tr><td colspan="10">Нет доступа</td></tr>`;
    return;
  }

  hint.hidden = true;
  bindUserPhoneField();
  initSupplierFieldSelects();
  document.getElementById("field-certs")?.addEventListener("change", syncCertificatesField);
  syncCertificatesField();
  bindAdminFilters();
  try {
    await loadMeta();
    await Promise.all([loadSuppliers(), loadBuyers(), loadUsers()]);
  } catch (err) {
    suppliersTbody.innerHTML = `<tr><td colspan="10">${escapeHtml(err.message)}</td></tr>`;
  }
}

boot();
