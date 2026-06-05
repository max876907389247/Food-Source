import { bindPhoneField, formatUserPhone, isCompleteUserPhone } from "./phone.js";

export const auth = {
  user: null,
};

export async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(options.headers || {}),
    },
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
  return data;
}

export async function loadSession() {
  const { user } = await api("/api/auth/me");
  auth.user = user;
  return user;
}

export async function login(username, password) {
  const { user } = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  auth.user = user;
  return user;
}

export async function register(payload) {
  const { user } = await api("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  auth.user = user;
  return user;
}

export function getUserAudienceLabel() {
  if (!auth.user) return "";
  if (auth.user.role === "admin") return "админ";
  if (auth.user.audience === "seller") return "поставщик";
  return "покупатель";
}

function syncRegisterAudienceFields(modal) {
  const form = modal?.querySelector("#register-form");
  if (!form) return;
  const audience = form.querySelector('input[name="accountAudience"]:checked')?.value || "buyer";
  const orgBlock = form.querySelector("#register-org-fields");
  const orgInputs = form.querySelectorAll("#register-org-fields [data-org-required]");
  const isOrg = audience === "buyer" || audience === "seller";

  if (orgBlock) orgBlock.hidden = !isOrg;
  orgInputs.forEach((el) => {
    el.required = isOrg;
  });

  const hint = form.querySelector("#register-hint");
  if (hint) {
    if (audience === "seller") {
      hint.textContent =
        "Поставщик: укажите данные организации. После регистрации доступен поиск покупателей.";
    } else {
      hint.textContent =
        "Покупатель: укажите данные организации. После регистрации доступен поиск и сравнение поставщиков.";
    }
  }
}

export async function logout() {
  await api("/api/auth/logout", { method: "POST" });
  auth.user = null;
}

export function isAdmin() {
  return auth.user?.role === "admin";
}

export function renderAuthBar(container) {
  if (!container) return;

  if (auth.user) {
    const adminExtras =
      auth.user.role === "admin"
        ? `<span class="db-status" id="db-status">Проверка БД…</span>
      <a class="btn btn--sm btn--admin-panel" href="admin.html">Админ-панель</a>`
        : "";
    container.innerHTML = `
      ${adminExtras}
      <button type="button" class="btn btn--sm btn--ghost" id="btn-logout">Выйти</button>
    `;
    container.querySelector("#btn-logout")?.addEventListener("click", async () => {
      await logout();
      location.reload();
    });
  } else {
    container.innerHTML = `
      <button type="button" class="btn btn--sm btn--ghost" id="btn-register-open">Регистрация</button>
      <button type="button" class="btn btn--sm btn--primary" id="btn-login-open">Войти</button>
    `;
    container.querySelector("#btn-login-open")?.addEventListener("click", () => openAuthModal("login"));
    container.querySelector("#btn-register-open")?.addEventListener("click", () => openAuthModal("register"));
  }
}

export function openAuthModal(mode = "login", options = {}) {
  let modal = document.getElementById("auth-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "auth-modal";
    modal.className = "overlay";
    modal.hidden = true;
    modal.innerHTML = `
      <div class="panel panel--auth" role="dialog">
        <header class="panel__head">
          <div class="auth-tabs">
            <button type="button" class="auth-tabs__btn is-active" data-auth-tab="login">Вход</button>
            <button type="button" class="auth-tabs__btn" data-auth-tab="register">Регистрация</button>
          </div>
          <button type="button" class="panel__close" data-close aria-label="Закрыть">×</button>
        </header>
        <p class="auth-context-msg" id="auth-context-message" hidden></p>
        <form class="panel__body" id="login-form" data-auth-panel="login">
          <p class="auth-hint" id="login-demo-hint">
            Демо: админ логин — <code>admin1</code> / пароль — <code>admin2</code><br>
            поставщик — <code>s_agrorus</code> / пароль — <code>demo</code><br>
            покупатель — <code>b_1</code> / пароль — <code>demo</code>
          </p>
          <p class="auth-hint auth-hint--sub" id="auth-login-register-hint" hidden>Нет аккаунта? Перейдите на вкладку «Регистрация».</p>
          <label class="field">
            <span class="field__label">Логин</span>
            <input name="username" required autocomplete="username">
          </label>
          <label class="field">
            <span class="field__label">Пароль</span>
            <input name="password" type="password" required autocomplete="current-password">
          </label>
          <p class="auth-error" id="login-error" hidden></p>
          <button type="submit" class="btn btn--primary">Войти</button>
        </form>
        <form class="panel__body" id="register-form" data-auth-panel="register" hidden>
          <p class="auth-hint" id="register-hint">Тип аккаунта нельзя сменить после регистрации.</p>
          <fieldset class="auth-account-type">
            <legend class="field__label">Тип аккаунта</legend>
            <label class="auth-account-type__option">
              <input type="radio" name="accountAudience" value="buyer" checked>
              <span>Покупатель — поиск поставщиков (нужны данные организации)</span>
            </label>
            <label class="auth-account-type__option">
              <input type="radio" name="accountAudience" value="seller">
              <span>Поставщик — поиск покупателей (нужны данные организации)</span>
            </label>
          </fieldset>
          <div id="register-org-fields">
            <label class="field">
              <span class="field__label">Организация</span>
              <input name="organizationName" data-org-required placeholder="ООО «Ресторан»">
            </label>
            <label class="field">
              <span class="field__label">Город</span>
              <input name="city" data-org-required placeholder="Москва">
            </label>
            <label class="field">
              <span class="field__label">Телефон</span>
              <input name="contactPhone" id="register-phone" type="tel" inputmode="tel" placeholder="+7 999-999-99-99" autocomplete="tel" data-org-required>
            </label>
            <label class="field">
              <span class="field__label">Email организации</span>
              <input name="contactEmail" type="email" placeholder="info@company.ru">
            </label>
          </div>
          <label class="field">
            <span class="field__label">Логин (латиница, 3–32 символа)</span>
            <input name="username" required pattern="[a-zA-Z0-9_]{3,32}" autocomplete="username">
          </label>
          <label class="field">
            <span class="field__label">Пароль (мин. 4 символа)</span>
            <input name="password" type="password" required minlength="4" autocomplete="new-password">
          </label>
          <label class="field">
            <span class="field__label">Повтор пароля</span>
            <input name="passwordConfirm" type="password" required minlength="4" autocomplete="new-password">
          </label>
          <p class="auth-error" id="register-error" hidden></p>
          <button type="submit" class="btn btn--primary">Зарегистрироваться</button>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener("click", (e) => {
      if (e.target === modal || e.target.closest("[data-close]")) {
        modal.hidden = true;
        document.body.classList.remove("modal-open");
      }
    });

    modal.querySelectorAll("[data-auth-tab]").forEach((btn) => {
      btn.addEventListener("click", () => setAuthTab(btn.dataset.authTab));
    });

    modal.querySelectorAll('#register-form input[name="accountAudience"]').forEach((radio) => {
      radio.addEventListener("change", () => syncRegisterAudienceFields(modal));
    });

    bindPhoneField(modal.querySelector("#register-phone"));

    modal.querySelector("#login-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const errEl = modal.querySelector("#login-error");
      errEl.hidden = true;
      try {
        await login(fd.get("username"), fd.get("password"));
        modal.hidden = true;
        document.body.classList.remove("modal-open");
        location.reload();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.hidden = false;
      }
    });

    modal.querySelector("#register-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const errEl = modal.querySelector("#register-error");
      errEl.hidden = true;
      try {
        const audience = fd.get("accountAudience") || "buyer";
        const contactPhone = String(fd.get("contactPhone") || "").trim();
        if (audience === "buyer" || audience === "seller") {
          if (!isCompleteUserPhone(contactPhone)) {
            throw new Error("Укажите телефон в формате +7 999-999-99-99");
          }
        }
        await register({
          username: fd.get("username"),
          password: fd.get("password"),
          passwordConfirm: fd.get("passwordConfirm"),
          audience,
          organizationName: fd.get("organizationName"),
          city: fd.get("city"),
          contactPhone: contactPhone ? formatUserPhone(contactPhone) : contactPhone,
          contactEmail: fd.get("contactEmail"),
        });
        modal.hidden = true;
        document.body.classList.remove("modal-open");
        location.reload();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.hidden = false;
      }
    });
  }

  setAuthTab(mode);
  if (options.audience) {
    const radio = modal.querySelector(
      `#register-form input[name="accountAudience"][value="${options.audience}"]`
    );
    if (radio) radio.checked = true;
    syncRegisterAudienceFields(modal);
  }
  const regHint = modal.querySelector("#auth-login-register-hint");
  const demoHint = modal.querySelector("#login-demo-hint");
  if (regHint) regHint.hidden = !options.message;
  if (demoHint) demoHint.hidden = mode !== "login";
  const ctxMsg = modal.querySelector("#auth-context-message");
  if (ctxMsg) {
    const text = options.message || "";
    ctxMsg.textContent = text;
    ctxMsg.hidden = !text;
  }
  const panel = modal.querySelector(".panel");
  panel?.classList.remove("panel--enter");
  void panel?.offsetWidth;
  panel?.classList.add("panel--enter");
  modal.hidden = false;
  document.body.classList.add("modal-open");
}

export function isLoggedIn() {
  return Boolean(auth.user);
}

function setAuthTab(mode) {
  const modal = document.getElementById("auth-modal");
  if (!modal) return;
  modal.querySelectorAll("[data-auth-tab]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.authTab === mode);
  });
  modal.querySelectorAll("[data-auth-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.authPanel !== mode;
  });
}

export async function refreshDbStatus() {
  const el = document.getElementById("db-status");
  if (!el || !isAdmin()) return;
  const health = await api("/api/health").catch(() => ({ ok: false }));
  el.textContent = health.ok ? "MySQL подключена" : "MySQL недоступна";
  el.classList.toggle("db-status--ok", health.ok);
  el.classList.toggle("db-status--err", !health.ok);
}

export async function initAuth(headerSelector = "#auth-bar") {
  try {
    await loadSession();
  } catch {
    auth.user = null;
  }
  renderAuthBar(document.querySelector(headerSelector));
  if (isAdmin()) {
    await refreshDbStatus();
  }
}
