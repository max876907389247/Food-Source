import { escapeHtml } from "./ui.js";

const STORAGE_PREFIX = "foodsource_quicksetup_";

export function isQuickSetupDone(mode) {
  return localStorage.getItem(`${STORAGE_PREFIX}${mode}`) === "1";
}

export function markQuickSetupDone(mode) {
  localStorage.setItem(`${STORAGE_PREFIX}${mode}`, "1");
}

const BUYER_PRESETS = [
  { label: "Рыба и морепродукты", category: "frozen", query: "лосось" },
  { label: "Мука и ингредиенты", category: "ingredients", query: "мука" },
  { label: "Упаковка для доставки", category: "packaging", query: "" },
  { label: "Молочная продукция", category: "dairy", query: "" },
];

const SELLER_PRESETS = [
  { label: "Рестораны и HoReCa", category: "ready", query: "ресторан" },
  { label: "Ритейл и магазины", category: "", query: "магазин" },
  { label: "Крупный опт", category: "ingredients", query: "опт" },
  { label: "Москва", category: "", city: "Москва" },
];

/**
 * @param {'buyer'|'seller'} mode
 * @param {{ categories: {id:string,label:string}[], cities: string[], fetchSuggestions: () => Promise<object[]>, applyFilters: (f: object) => void }} ctx
 */
export function showQuickSetupWizard(mode, ctx) {
  if (isQuickSetupDone(mode)) return Promise.resolve(false);

  return new Promise((resolve) => {
    const isBuyer = mode === "buyer";
    const presets = isBuyer ? BUYER_PRESETS : SELLER_PRESETS;
    const state = { category: "", city: "", query: "", suggestionId: null };

    let modal = document.getElementById("quick-setup");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "quick-setup";
      modal.className = "overlay quick-setup";
      document.body.appendChild(modal);
    }

    const categoryChips = ctx.categories
      .map(
        (c) =>
          `<button type="button" class="filter-chip" data-chip="category" data-value="${escapeHtml(c.id)}">${escapeHtml(c.label)}</button>`
      )
      .join("");

    const cityChips = (ctx.cities || [])
      .slice(0, 12)
      .map(
        (c) =>
          `<button type="button" class="filter-chip" data-chip="city" data-value="${escapeHtml(c)}">${escapeHtml(c)}</button>`
      )
      .join("");

    const presetBtns = presets
      .map(
        (p, i) =>
          `<button type="button" class="filter-chip filter-chip--preset" data-preset="${i}">${escapeHtml(p.label)}</button>`
      )
      .join("");

    modal.innerHTML = `
      <div class="panel quick-setup__panel" role="dialog" aria-labelledby="quick-setup-title" aria-modal="true">
        <header class="panel__head">
          <h2 id="quick-setup-title" class="quick-setup__title">${
            isBuyer ? "Быстрый подбор поставщиков" : "Быстрый поиск покупателей"
          }</h2>
          <button type="button" class="panel__close" data-close aria-label="Закрыть">×</button>
        </header>
        <div class="panel__body quick-setup__body">
          <p class="quick-setup__lead">${
            isBuyer
              ? "Выберите категории, город и примеры из каталога — мы сразу покажем подходящих поставщиков."
              : "Уточните, каких покупателей вы ищете — заявки отфильтруются автоматически."
          }</p>

          <div class="quick-setup__section">
            <h3 class="quick-setup__section-title">Категория</h3>
            <div class="filter-chip-group" data-chip-group="category">${categoryChips}</div>
          </div>

          <div class="quick-setup__section">
            <h3 class="quick-setup__section-title">Город</h3>
            <div class="filter-chip-group" data-chip-group="city">${cityChips}</div>
          </div>

          <div class="quick-setup__section">
            <h3 class="quick-setup__section-title">Готовые подборки</h3>
            <div class="filter-chip-group">${presetBtns}</div>
          </div>

          <div class="quick-setup__section">
            <h3 class="quick-setup__section-title">${
              isBuyer ? "Популярные поставщики" : "Актуальные заявки"
            }</h3>
            <div class="quick-setup__suggestions" id="quick-setup-suggestions">
              <p class="muted">Загрузка…</p>
            </div>
          </div>
        </div>
        <footer class="panel__foot quick-setup__foot">
          <button type="button" class="btn btn--primary" id="quick-setup-apply">Применить фильтры</button>
          <button type="button" class="btn btn--ghost" id="quick-setup-skip">Пропустить</button>
        </footer>
      </div>
    `;

    const onKeydown = (e) => {
      if (e.key === "Escape") close(false);
    };

    const close = (applied) => {
      modal.hidden = true;
      document.body.classList.remove("modal-open");
      document.removeEventListener("keydown", onKeydown);
      markQuickSetupDone(mode);
      resolve(applied);
    };

    const syncChips = () => {
      modal.querySelectorAll('[data-chip="category"]').forEach((btn) => {
        btn.classList.toggle("is-selected", btn.dataset.value === state.category);
      });
      modal.querySelectorAll('[data-chip="city"]').forEach((btn) => {
        btn.classList.toggle("is-selected", btn.dataset.value === state.city);
      });
      modal.querySelectorAll(".quick-setup__suggestion").forEach((el) => {
        el.classList.toggle("is-selected", el.dataset.id === state.suggestionId);
      });
    };

    modal.querySelectorAll("[data-chip]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const kind = btn.dataset.chip;
        const val = btn.dataset.value;
        if (state[kind] === val) state[kind] = "";
        else state[kind] = val;
        state.suggestionId = null;
        syncChips();
      });
    });

    modal.querySelectorAll("[data-preset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const p = presets[Number(btn.dataset.preset)];
        state.category = p.category || "";
        state.city = p.city || p.region || "";
        state.query = p.query || "";
        state.suggestionId = null;
        syncChips();
      });
    });

    modal.querySelector("#quick-setup-apply")?.addEventListener("click", () => {
      ctx.applyFilters({
        category: state.category,
        city: state.city,
        query: state.query,
      });
      close(true);
    });

    modal.querySelector("#quick-setup-skip")?.addEventListener("click", () => close(false));
    modal.querySelectorAll("[data-close]").forEach((btn) => {
      btn.addEventListener("click", () => close(false));
    });
    modal.onclick = (e) => {
      if (e.target === modal) close(false);
    };
    const panel = modal.querySelector(".quick-setup__panel");
    if (panel) panel.onclick = (e) => e.stopPropagation();

    document.addEventListener("keydown", onKeydown);

    modal.hidden = false;
    document.body.classList.add("modal-open");
    syncChips();

    ctx
      .fetchSuggestions()
      .then((items) => {
        const box = modal.querySelector("#quick-setup-suggestions");
        if (!box) return;
        if (!items.length) {
          box.innerHTML = '<p class="muted">Нет данных для подсказок.</p>';
          return;
        }
        box.innerHTML = items
          .slice(0, 8)
          .map((item) => {
            const title = item.name || item.companyName;
            const meta = item.city || "";
            return `<button type="button" class="quick-setup__suggestion" data-id="${escapeHtml(String(item.id))}"
              data-category="${escapeHtml(item.categories?.[0] || item.categoryId || "")}"
              data-city="${escapeHtml(item.city || item.regions?.[0] || item.region || "")}"
              data-query="${escapeHtml(item.name || item.companyName || "")}">
              <strong>${escapeHtml(title)}</strong>
              <span class="muted">${escapeHtml(meta)}</span>
            </button>`;
          })
          .join("");

        box.querySelectorAll(".quick-setup__suggestion").forEach((btn) => {
          btn.addEventListener("click", () => {
            state.suggestionId = btn.dataset.id;
            state.category = btn.dataset.category || "";
            state.city = btn.dataset.city || "";
            state.query = btn.dataset.query || "";
            syncChips();
          });
        });
      })
      .catch(() => {
        const box = modal.querySelector("#quick-setup-suggestions");
        if (box) box.innerHTML = '<p class="muted">Не удалось загрузить подсказки.</p>';
      });
  });
}

export async function maybeShowQuickSetup(mode, ctx) {
  if (isQuickSetupDone(mode)) return;
  await showQuickSetupWizard(mode, ctx);
}
