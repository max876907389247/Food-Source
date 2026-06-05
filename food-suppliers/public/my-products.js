import { api } from "./auth.js";
import {
  formatProductMinOrder,
  formatProductPrice,
  parseProductMinOrderInput,
} from "./proposals-shared.js";
import { escapeHtml } from "./ui.js";

const PRODUCT_UNITS = ["кг", "г", "л", "мл", "шт.", "упак.", "кор.", "т"];

function unitOptionsHtml(product) {
  const current = product?.unit || "кг";
  const units = [...new Set([...PRODUCT_UNITS, current])];
  return units
    .map(
      (u) =>
        `<option value="${escapeHtml(u)}"${u === current ? " selected" : ""}>${escapeHtml(u)}</option>`
    )
    .join("");
}

function minOrderInputValue(product) {
  if (!product?.minOrder) return "";
  const rub = parseProductMinOrderInput(product.minOrder);
  return rub != null ? rub : "";
}

function renderProductRow(p, categories) {
  const cat = categories.find((c) => c.id === p.categoryId);
  const price = formatProductPrice(p.pricePerUnit, p.unit, p.priceHint);
  const minOrder = formatProductMinOrder(p.minOrder);
  return `
    <article class="product-manage-card" data-product-id="${p.id}">
      <div class="product-manage-card__head">
        <h3>${escapeHtml(p.name)}</h3>
        <span class="badge badge--muted">${cat ? escapeHtml(cat.label) : "Без категории"}</span>
      </div>
      <dl class="product-manage-card__facts">
        <div><dt>Цена</dt><dd>${escapeHtml(price)}</dd></div>
        <div><dt>Мин. заказ</dt><dd>${escapeHtml(minOrder)}</dd></div>
      </dl>
      ${p.description ? `<p class="product-manage-card__desc">${escapeHtml(p.description)}</p>` : ""}
      <div class="product-manage-card__actions">
        <button type="button" class="btn btn--ghost btn--sm" data-edit-product="${p.id}">Изменить</button>
        <button type="button" class="btn btn--ghost btn--sm btn--danger" data-delete-product="${p.id}">Удалить</button>
      </div>
    </article>`;
}

function productFormHtml(categories, product = null) {
  const catOptions = categories
    .map(
      (c) =>
        `<option value="${escapeHtml(c.id)}"${product?.categoryId === c.id ? " selected" : ""}>${escapeHtml(c.label)}</option>`
    )
    .join("");
  const unit = product?.unit || "кг";
  const pricePreview =
    product?.pricePerUnit != null ? formatProductPrice(product.pricePerUnit, unit) : "";
  const minPreview = product?.minOrder ? formatProductMinOrder(product.minOrder) : "";
  return `
    <h3 class="manage-form__title">${product ? "Редактирование товара" : "Новый товар"}</h3>
    <p class="manage-form__hint muted">Позиция появится в блоке «Продукция» на карточке поставщика в каталоге.</p>
    <form id="product-form" class="manage-form">
      <input type="hidden" name="id" value="${product?.id || ""}">
      <label class="field">
        <span class="field__label">Название</span>
        <input name="name" required value="${product ? escapeHtml(product.name) : ""}">
      </label>
      <label class="field">
        <span class="field__label">Категория</span>
        <select name="categoryId">
          <option value="">—</option>
          ${catOptions}
        </select>
      </label>
      <label class="field">
        <span class="field__label">Цена за единицу (₽)</span>
        <input name="pricePerUnit" type="number" min="0" step="0.01" value="${product?.pricePerUnit ?? ""}">
        <span class="field__hint" id="product-price-preview">${pricePreview ? `Будет отображаться: ${escapeHtml(pricePreview)}` : "Формат: 42₽/кг"}</span>
      </label>
      <label class="field">
        <span class="field__label">Единица измерения</span>
        <select name="unit">${unitOptionsHtml(product)}</select>
      </label>
      <label class="field">
        <span class="field__label">Мин. сумма заказа (₽)</span>
        <input name="minOrderRub" type="number" min="0" step="1" value="${product ? minOrderInputValue(product) : ""}" placeholder="5000">
        <span class="field__hint" id="product-min-preview">${minPreview ? `Будет отображаться: ${escapeHtml(minPreview)}` : "Формат: мин. от 5 000 ₽"}</span>
      </label>
      <label class="field field--wide">
        <span class="field__label">Описание</span>
        <textarea name="description" rows="2">${product?.description ? escapeHtml(product.description) : ""}</textarea>
      </label>
      <p class="auth-error" id="product-form-error" hidden></p>
      <div class="manage-form__actions">
        <button type="submit" class="btn btn--primary">${product ? "Сохранить изменения" : "Добавить товар"}</button>
        ${product ? '<button type="button" class="btn btn--ghost" data-cancel-form>Отмена</button>' : ""}
      </div>
    </form>`;
}

function bindProductFormPreviews(formWrap) {
  const form = formWrap.querySelector("#product-form");
  if (!form) return;
  const priceInput = form.querySelector('[name="pricePerUnit"]');
  const unitSelect = form.querySelector('[name="unit"]');
  const minInput = form.querySelector('[name="minOrderRub"]');
  const pricePreview = formWrap.querySelector("#product-price-preview");
  const minPreview = formWrap.querySelector("#product-min-preview");

  const updatePreviews = () => {
    const price = priceInput?.value;
    const unit = unitSelect?.value || "кг";
    if (pricePreview) {
      const formatted = price !== "" && price != null ? formatProductPrice(Number(price), unit) : null;
      pricePreview.textContent = formatted
        ? `Будет отображаться: ${formatted}`
        : "Формат: 42₽/кг";
    }
    if (minPreview) {
      const minRub = minInput?.value;
      const formatted =
        minRub !== "" && minRub != null ? formatProductMinOrder(minRub) : null;
      minPreview.textContent = formatted
        ? `Будет отображаться: ${formatted}`
        : "Формат: мин. от 5 000 ₽";
    }
  };

  priceInput?.addEventListener("input", updatePreviews);
  unitSelect?.addEventListener("change", updatePreviews);
  minInput?.addEventListener("input", updatePreviews);
}

let controller = null;

export function initMyProducts({ categories }) {
  if (controller) {
    controller.reload();
    return controller;
  }

  const listEl = document.getElementById("seller-products-list");
  const formWrap = document.getElementById("seller-product-form-wrap");
  const metaEl = document.getElementById("seller-products-meta");
  const errEl = document.getElementById("seller-products-error");
  if (!listEl || !formWrap) return null;

  let products = [];
  let editingId = null;

  async function load() {
    errEl.hidden = true;
    try {
      const data = await api("/api/my/products");
      products = data.products || [];
      metaEl.textContent = `Товаров в каталоге: ${products.length}`;
      listEl.innerHTML =
        products.map((p) => renderProductRow(p, categories)).join("") ||
        '<p class="muted">Нет товаров — добавьте первый в форме ниже.</p>';
      if (!editingId) {
        renderNewForm();
      }
    } catch (err) {
      errEl.hidden = false;
      errEl.querySelector("p").textContent = err.message;
      listEl.innerHTML = "";
    }
  }

  function renderNewForm() {
    editingId = null;
    formWrap.innerHTML = productFormHtml(categories);
    bindForm();
  }

  function bindForm() {
    const form = formWrap.querySelector("#product-form");
    if (!form) return;
    bindProductFormPreviews(formWrap);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = formWrap.querySelector("#product-form-error");
      err.hidden = true;
      const fd = new FormData(form);
      const priceRaw = fd.get("pricePerUnit");
      const minOrderRaw = fd.get("minOrderRub");
      const pricePerUnit =
        priceRaw !== "" && priceRaw != null ? Number(priceRaw) : null;
      const minOrderRub =
        minOrderRaw !== "" && minOrderRaw != null ? Number(minOrderRaw) : null;
      if (pricePerUnit != null && Number.isNaN(pricePerUnit)) {
        err.textContent = "Некорректная цена";
        err.hidden = false;
        return;
      }
      if (minOrderRub != null && Number.isNaN(minOrderRub)) {
        err.textContent = "Некорректная минимальная цена заказа";
        err.hidden = false;
        return;
      }
      const payload = {
        name: fd.get("name"),
        categoryId: fd.get("categoryId") || null,
        pricePerUnit,
        unit: fd.get("unit"),
        minOrderRub,
        description: fd.get("description"),
      };
      try {
        const id = fd.get("id");
        if (id) {
          await api(`/api/my/products/${id}`, { method: "PUT", body: JSON.stringify(payload) });
        } else {
          await api("/api/my/products", { method: "POST", body: JSON.stringify(payload) });
        }
        renderNewForm();
        await load();
      } catch (ex) {
        err.textContent = ex.message;
        err.hidden = false;
      }
    });
    formWrap.querySelector("[data-cancel-form]")?.addEventListener("click", renderNewForm);
  }

  listEl.addEventListener("click", async (e) => {
    const editBtn = e.target.closest("[data-edit-product]");
    const delBtn = e.target.closest("[data-delete-product]");
    if (editBtn) {
      const editId = editBtn.dataset.editProduct;
      const p = products.find((x) => String(x.id) === String(editId));
      if (!p) return;
      editingId = p.id;
      formWrap.innerHTML = productFormHtml(categories, p);
      bindForm();
      formWrap.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (delBtn) {
      const delId = delBtn.dataset.deleteProduct;
      if (!delId || !confirm("Удалить этот товар из каталога?")) return;
      try {
        await api(`/api/my/products/${delId}`, { method: "DELETE" });
        if (String(editingId) === String(delId)) renderNewForm();
        await load();
      } catch (err) {
        alert(err.message);
      }
    }
  });

  controller = { reload: load };
  load();
  return controller;
}
