import { api } from "./auth.js";
import { escapeHtml } from "./dom.js";

function productFormHtml(categories, product = null) {
  const catOptions = categories
    .map(
      (c) =>
        `<option value="${escapeHtml(c.id)}"${product?.categoryId === c.id ? " selected" : ""}>${escapeHtml(c.label)}</option>`
    )
    .join("");
  return `
    <form id="admin-product-form" class="manage-form manage-form--compact">
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
        <span class="field__label">Цена (₽)</span>
        <input name="pricePerUnit" type="number" min="0" step="0.01" value="${product?.pricePerUnit ?? ""}">
      </label>
      <label class="field">
        <span class="field__label">Подсказка</span>
        <input name="priceHint" value="${product?.priceHint ? escapeHtml(product.priceHint) : ""}">
      </label>
      <label class="field">
        <span class="field__label">Ед.</span>
        <input name="unit" value="${product?.unit ? escapeHtml(product.unit) : "кг"}">
      </label>
      <label class="field">
        <span class="field__label">Мин. заказ</span>
        <input name="minOrder" value="${product?.minOrder ? escapeHtml(product.minOrder) : ""}">
      </label>
      <label class="field field--wide">
        <span class="field__label">Описание</span>
        <textarea name="description" rows="2">${product?.description ? escapeHtml(product.description) : ""}</textarea>
      </label>
      <p class="auth-error" id="admin-product-form-error" hidden></p>
      <div class="manage-form__actions">
        <button type="submit" class="btn btn--primary btn--sm">${product ? "Сохранить" : "Добавить"}</button>
        ${product ? '<button type="button" class="btn btn--ghost btn--sm" data-cancel-admin-product>Отмена</button>' : ""}
      </div>
    </form>`;
}

function renderRow(p, categories) {
  const cat = categories.find((c) => c.id === p.categoryId);
  return `
    <tr data-product-row="${p.id}">
      <td>${p.id}</td>
      <td><strong>${escapeHtml(p.name)}</strong></td>
      <td>${cat ? escapeHtml(cat.label) : "—"}</td>
      <td>${p.pricePerUnit != null ? `${p.pricePerUnit} ₽` : escapeHtml(p.priceHint || "—")}</td>
      <td>${escapeHtml(p.unit || "—")}</td>
      <td class="admin-actions">
        <button type="button" class="btn btn--sm btn--ghost" data-edit-admin-product="${p.id}">Изменить</button>
        <button type="button" class="btn btn--sm btn--ghost btn--danger" data-del-admin-product="${p.id}">Удалить</button>
      </td>
    </tr>`;
}

export function initAdminSupplierProducts({ supplierId, categories, products: initial = [] }) {
  const block = document.getElementById("supplier-products-block");
  const listEl = document.getElementById("admin-products-tbody");
  const formWrap = document.getElementById("admin-product-form-wrap");
  const metaEl = document.getElementById("admin-products-meta");
  if (!block || !listEl || !supplierId) return () => {};

  block.hidden = false;
  let products = [...initial];

  function renderList() {
    metaEl.textContent = `Товаров: ${products.length}`;
    if (!products.length) {
      listEl.innerHTML =
        '<tr><td colspan="6" class="muted">Нет товаров — добавьте ниже.</td></tr>';
      return;
    }
    listEl.innerHTML = products.map((p) => renderRow(p, categories)).join("");
  }

  function resetForm() {
    formWrap.innerHTML = productFormHtml(categories);
    bindForm();
  }

  function bindForm(product = null) {
    formWrap.innerHTML = productFormHtml(categories, product);
    const form = formWrap.querySelector("#admin-product-form");
    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errEl = formWrap.querySelector("#admin-product-form-error");
      errEl.hidden = true;
      const fd = new FormData(form);
      const payload = {
        name: fd.get("name"),
        categoryId: fd.get("categoryId") || null,
        pricePerUnit: fd.get("pricePerUnit") || null,
        priceHint: fd.get("priceHint"),
        unit: fd.get("unit"),
        minOrder: fd.get("minOrder"),
        description: fd.get("description"),
      };
      try {
        const id = fd.get("id");
        if (id) {
          const { product: updated } = await api(`/api/admin/products/${id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          });
          products = products.map((p) => (p.id === updated.id ? updated : p));
        } else {
          const { product: created } = await api(`/api/admin/suppliers/${supplierId}/products`, {
            method: "POST",
            body: JSON.stringify(payload),
          });
          products.push(created);
        }
        resetForm();
        renderList();
      } catch (ex) {
        errEl.textContent = ex.message;
        errEl.hidden = false;
      }
    });
    formWrap.querySelector("[data-cancel-admin-product]")?.addEventListener("click", resetForm);
  }

  async function reload() {
    products = await api(`/api/admin/suppliers/${supplierId}/products`);
    renderList();
  }

  listEl.onclick = async (e) => {
    const editId = e.target.closest("[data-edit-admin-product]")?.dataset.editAdminProduct;
    const delId = e.target.closest("[data-del-admin-product]")?.dataset.delAdminProduct;
    if (editId) {
      const p = products.find((x) => String(x.id) === editId);
      if (p) bindForm(p);
      return;
    }
    if (delId && confirm("Удалить этот товар?")) {
      try {
        await api(`/api/admin/products/${delId}`, { method: "DELETE" });
        products = products.filter((p) => String(p.id) !== delId);
        renderList();
        resetForm();
      } catch (err) {
        alert(err.message);
      }
    }
  };

  renderList();
  resetForm();

  return { reload, hide: () => {
    block.hidden = true;
    listEl.innerHTML = "";
    formWrap.innerHTML = "";
  } };
}

export function hideAdminSupplierProducts() {
  const block = document.getElementById("supplier-products-block");
  if (block) block.hidden = true;
}
