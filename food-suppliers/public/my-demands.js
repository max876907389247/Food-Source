import { api } from "./auth.js";
import { escapeHtml } from "./ui.js";

function renderDemandRow(d) {
  const status = d.isActive ? '<span class="badge badge--ok">Активен</span>' : '<span class="badge badge--muted">Снят</span>';
  return `
    <article class="demand-manage-card" data-demand-id="${d.id}">
      <div class="demand-manage-card__head">
        <h3>${escapeHtml(d.companyName)}</h3>
        ${status}
      </div>
      <p class="demand-manage-card__meta">${escapeHtml(d.city)} · ${escapeHtml(d.region)}${d.categoryLabel ? ` · ${escapeHtml(d.categoryLabel)}` : ""}</p>
      <p class="demand-manage-card__desc">${escapeHtml(d.description)}</p>
      <dl class="demand-manage-card__facts">
        <div><dt>Объём</dt><dd>${escapeHtml(d.volumeText)}</dd></div>
        <div><dt>Бюджет</dt><dd>${d.budgetText ? escapeHtml(d.budgetText) : "—"}</dd></div>
      </dl>
      <div class="demand-manage-card__actions">
        <button type="button" class="btn btn--ghost btn--sm" data-edit-demand="${d.id}">Изменить</button>
        ${
          d.isActive
            ? `<button type="button" class="btn btn--ghost btn--sm" data-delete-demand="${d.id}">Снять с публикации</button>`
            : `<button type="button" class="btn btn--primary btn--sm" data-restore-demand="${d.id}">Вернуть публикацию</button>`
        }
      </div>
    </article>`;
}

function demandFormHtml(categories, demand = null, user = null) {
  const catOptions = categories
    .map(
      (c) =>
        `<option value="${escapeHtml(c.id)}"${demand?.categoryId === c.id ? " selected" : ""}>${escapeHtml(c.label)}</option>`
    )
    .join("");
  return `
    <form id="demand-form" class="manage-form">
      <input type="hidden" name="id" value="${demand?.id || ""}">
      <label class="field">
        <span class="field__label">Компания</span>
        <input name="companyName" required value="${demand ? escapeHtml(demand.companyName) : escapeHtml(user?.organizationName || "")}">
      </label>
      <label class="field">
        <span class="field__label">Тип бизнеса</span>
        <input name="businessType" required value="${demand ? escapeHtml(demand.businessType) : ""}" placeholder="Кафе, ресторан, ритейл…">
      </label>
      <label class="field">
        <span class="field__label">Город</span>
        <input name="city" required value="${demand ? escapeHtml(demand.city) : escapeHtml(user?.city || "")}">
      </label>
      <label class="field">
        <span class="field__label">Регион</span>
        <input name="region" required value="${demand ? escapeHtml(demand.region) : escapeHtml(user?.region || "")}">
      </label>
      <label class="field">
        <span class="field__label">Категория закупки</span>
        <select name="categoryId">
          <option value="">—</option>
          ${catOptions}
        </select>
      </label>
      <label class="field">
        <span class="field__label">Объём (текст)</span>
        <input name="volumeText" required value="${demand ? escapeHtml(demand.volumeText) : ""}" placeholder="до 80 кг/нед">
      </label>
      <label class="field">
        <span class="field__label">Объём (кг, необязательно)</span>
        <input name="volumeKg" type="number" min="0" value="${demand?.volumeKg ?? ""}">
      </label>
      <label class="field">
        <span class="field__label">Бюджет</span>
        <input name="budgetText" value="${demand?.budgetText ? escapeHtml(demand.budgetText) : ""}">
      </label>
      <label class="field field--wide">
        <span class="field__label">Описание запроса</span>
        <textarea name="description" rows="3" required>${demand ? escapeHtml(demand.description) : ""}</textarea>
      </label>
      <label class="field">
        <span class="field__label">Телефон</span>
        <input name="contactPhone" required value="${demand ? escapeHtml(demand.contacts.phone) : escapeHtml(user?.contactPhone || "")}">
      </label>
      <label class="field">
        <span class="field__label">Email</span>
        <input name="contactEmail" type="email" required value="${demand ? escapeHtml(demand.contacts.email) : escapeHtml(user?.contactEmail || "")}">
      </label>
      <p class="auth-error" id="demand-form-error" hidden></p>
      <div class="manage-form__actions">
        <button type="submit" class="btn btn--primary">${demand ? "Сохранить" : "Опубликовать запрос"}</button>
        ${demand ? '<button type="button" class="btn btn--ghost" data-cancel-demand-form>Отмена</button>' : ""}
      </div>
    </form>`;
}

export function initMyDemands({ categories, user, onChanged }) {
  const panel = document.getElementById("buyer-demands-panel");
  const listEl = document.getElementById("buyer-demands-list");
  const formWrap = document.getElementById("buyer-demand-form-wrap");
  const metaEl = document.getElementById("buyer-demands-meta");
  const errEl = document.getElementById("buyer-demands-error");
  if (!panel || !listEl) return;

  let demands = [];

  async function load() {
    errEl.hidden = true;
    try {
      demands = await api("/api/my/demands");
      metaEl.textContent = `Ваших запросов: ${demands.length}`;
      listEl.innerHTML = demands.map(renderDemandRow).join("") || '<p class="muted">Пока нет запросов — добавьте первый ниже.</p>';
      onChanged?.();
    } catch (err) {
      errEl.hidden = false;
      errEl.querySelector("p").textContent = err.message;
    }
  }

  function bindForm(demand = null) {
    formWrap.innerHTML = demandFormHtml(categories, demand, user);
    const form = formWrap.querySelector("#demand-form");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = formWrap.querySelector("#demand-form-error");
      err.hidden = true;
      const fd = new FormData(form);
      const payload = {
        companyName: fd.get("companyName"),
        businessType: fd.get("businessType"),
        city: fd.get("city"),
        region: fd.get("region"),
        categoryId: fd.get("categoryId") || null,
        volumeText: fd.get("volumeText"),
        volumeKg: fd.get("volumeKg") || null,
        budgetText: fd.get("budgetText"),
        description: fd.get("description"),
        contactPhone: fd.get("contactPhone"),
        contactEmail: fd.get("contactEmail"),
      };
      try {
        const id = fd.get("id");
        if (id) {
          await api(`/api/my/demands/${id}`, { method: "PUT", body: JSON.stringify(payload) });
        } else {
          await api("/api/my/demands", { method: "POST", body: JSON.stringify(payload) });
        }
        formWrap.innerHTML = demandFormHtml(categories, null, user);
        bindForm();
        await load();
      } catch (ex) {
        err.textContent = ex.message;
        err.hidden = false;
      }
    });
    formWrap.querySelector("[data-cancel-demand-form]")?.addEventListener("click", () => {
      formWrap.innerHTML = demandFormHtml(categories, null, user);
      bindForm();
    });
  }

  listEl.addEventListener("click", async (e) => {
    const editId = e.target.closest("[data-edit-demand]")?.dataset.editDemand;
    const delId = e.target.closest("[data-delete-demand]")?.dataset.deleteDemand;
    const restoreId = e.target.closest("[data-restore-demand]")?.dataset.restoreDemand;
    if (editId) {
      const d = demands.find((x) => String(x.id) === editId);
      if (d) bindForm(d);
      return;
    }
    if (delId && confirm("Снять запрос с публикации? Поставщики перестанут его видеть.")) {
      try {
        await api(`/api/my/demands/${delId}`, { method: "DELETE" });
        await load();
      } catch (err) {
        alert(err.message);
      }
      return;
    }
    if (restoreId && confirm("Вернуть запрос в публикацию? Поставщики снова увидят его в разделе предложений.")) {
      try {
        await api(`/api/my/demands/${restoreId}/restore`, { method: "POST" });
        await load();
      } catch (err) {
        alert(err.message);
      }
    }
  });

  bindForm();
  load();
}
