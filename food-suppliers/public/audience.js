import { auth, getUserAudienceLabel, isLoggedIn, openAuthModal } from "./auth.js";

export function isAdminAccount() {
  return isLoggedIn() && auth.user.role === "admin";
}

export function canUseBuyerFeatures() {
  return isLoggedIn() && auth.user.audience === "buyer" && auth.user.role !== "admin";
}

export function isSellerAccount() {
  return isLoggedIn() && auth.user.audience === "seller";
}

export function promptSellerAuth() {
  openAuthModal("login", {
    audience: "seller",
    message:
      "Чтобы смотреть предложения от покупателей, войдите в аккаунт с типом «поставщик».",
  });
}

export function promptBuyerAuth(forFeatures = false) {
  openAuthModal("login", {
    audience: "buyer",
    message: forFeatures
      ? "Чтобы пользоваться сравнением и заказами, войдите в аккаунт покупателя."
      : "Чтобы открыть карточку поставщика, войдите в аккаунт покупателя.",
  });
}

export function getHeaderOrganizationName() {
  if (!isLoggedIn()) return null;
  const org = String(auth.user.organizationName || "").trim();
  if (org) return org;
  if (auth.user.role === "admin") return "Администратор";
  return auth.user.username;
}

export function applyAudienceUi(mode) {
  const uiMode = mode === "seller" ? "seller" : "buyer";
  document.body.dataset.audience = uiMode;
  document.body.removeAttribute("data-readonly");

  document.getElementById("buyer-app")?.toggleAttribute("hidden", uiMode !== "buyer");
  document.getElementById("seller-app")?.toggleAttribute("hidden", uiMode !== "seller");

  const showBuyerExtras = uiMode === "buyer" && canUseBuyerFeatures();
  const showAdminCatalog = uiMode === "buyer" && isAdminAccount();
  const headerNav = document.getElementById("header-nav");
  const sellerHeaderNav = document.getElementById("seller-header-nav");
  const catalogTab = document.getElementById("buyer-tab-catalog");
  const buyersCatalogTab = document.getElementById("buyer-tab-buyers-catalog");

  if (uiMode === "seller") {
    headerNav?.setAttribute("hidden", "");
    sellerHeaderNav?.toggleAttribute("hidden", !isSellerAccount());
  } else {
    sellerHeaderNav?.setAttribute("hidden", "");
    headerNav?.toggleAttribute("hidden", !showBuyerExtras && !showAdminCatalog);
  }

  if (catalogTab) {
    catalogTab.textContent = showAdminCatalog ? "Каталог поставщиков" : "Каталог";
    catalogTab.toggleAttribute("hidden", uiMode !== "buyer" || (!showBuyerExtras && !showAdminCatalog));
  }
  buyersCatalogTab?.toggleAttribute("hidden", !showAdminCatalog);
  document.getElementById("seller-tab-proposals")?.toggleAttribute("hidden", !isSellerAccount());
  document.getElementById("seller-tab-products")?.toggleAttribute("hidden", !isSellerAccount());
  const hideBuyerPersonalTabs = !showBuyerExtras || showAdminCatalog;
  document.getElementById("buyer-tab-orders")?.toggleAttribute("hidden", hideBuyerPersonalTabs);
  document.getElementById("buyer-tab-demands")?.toggleAttribute("hidden", hideBuyerPersonalTabs);
  document.getElementById("buyer-tab-incoming-proposals")?.toggleAttribute("hidden", hideBuyerPersonalTabs);
  document.getElementById("buyer-tab-favorites")?.toggleAttribute("hidden", hideBuyerPersonalTabs);
  document.body.classList.toggle("is-admin-catalog", showAdminCatalog);
  document.getElementById("seller-tab-my-responses")?.toggleAttribute("hidden", !isSellerAccount());
  document.getElementById("seller-tab-incoming-orders")?.toggleAttribute("hidden", !isSellerAccount());
  document.getElementById("seller-tab-favorites")?.toggleAttribute("hidden", !isSellerAccount());

  const badge = document.getElementById("audience-badge");
  const orgEl = document.getElementById("header-org-name");
  const seller = uiMode === "seller";
  const orgName = getHeaderOrganizationName();

  if (orgEl) {
    if (orgName) {
      orgEl.textContent = orgName;
      orgEl.hidden = false;
    } else {
      orgEl.textContent = "";
      orgEl.hidden = true;
    }
  }

  if (badge) {
    badge.classList.toggle("audience-badge--seller", seller);
    badge.textContent = isLoggedIn()
      ? getUserAudienceLabel()
      : seller
        ? "Режим: поставщик (гость)"
        : "Каталог поставщиков";
  }

  document.title =
    uiMode === "seller"
      ? "FoodSource — предложения покупателей"
      : showAdminCatalog
        ? "FoodSource — каталоги поставщиков и покупателей"
        : "FoodSource — поиск поставщиков";
}

export async function initAudience() {
  const mode = isLoggedIn() && auth.user.audience === "seller" ? "seller" : "buyer";
  applyAudienceUi(mode);
  return mode;
}
