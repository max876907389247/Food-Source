import { auth, getUserAudienceLabel, isLoggedIn, openAuthModal } from "./auth.js";

export function canUseBuyerFeatures() {
  return isLoggedIn() && (auth.user.audience === "buyer" || auth.user.role === "admin");
}

export function isSellerAccount() {
  return isLoggedIn() && auth.user.audience === "seller";
}

export function canViewSupplierDetail() {
  return isLoggedIn();
}

export function isReadOnlyViewer() {
  return isLoggedIn() && auth.user.audience === "viewer";
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
      : "Чтобы открыть карточку поставщика, войдите в аккаунт покупателя или наблюдателя.",
  });
}

export function applyAudienceUi(mode) {
  const uiMode = mode === "seller" ? "seller" : "buyer";
  const viewer = isReadOnlyViewer();
  document.body.dataset.audience = uiMode;
  document.body.dataset.readonly = viewer ? "1" : "";

  document.getElementById("buyer-app")?.toggleAttribute("hidden", uiMode !== "buyer");
  document.getElementById("seller-app")?.toggleAttribute("hidden", uiMode !== "seller");

  const showBuyerExtras = uiMode === "buyer" && canUseBuyerFeatures();
  const headerNav = document.getElementById("header-nav");
  const sellerHeaderNav = document.getElementById("seller-header-nav");

  if (uiMode === "seller") {
    headerNav?.setAttribute("hidden", "");
    sellerHeaderNav?.toggleAttribute("hidden", !isSellerAccount());
  } else {
    sellerHeaderNav?.setAttribute("hidden", "");
    headerNav?.toggleAttribute("hidden", !showBuyerExtras);
  }

  document.getElementById("buyer-tab-catalog")?.toggleAttribute("hidden", uiMode !== "buyer" || !showBuyerExtras);
  document.getElementById("seller-tab-proposals")?.toggleAttribute("hidden", !isSellerAccount());
  document.getElementById("seller-tab-products")?.toggleAttribute("hidden", !isSellerAccount());
  document.getElementById("buyer-tab-orders")?.toggleAttribute("hidden", !showBuyerExtras);
  document.getElementById("buyer-tab-demands")?.toggleAttribute("hidden", !showBuyerExtras);
  document.getElementById("compare-bar")?.toggleAttribute("hidden", uiMode !== "buyer" || viewer);

  const badge = document.getElementById("audience-badge");
  if (badge) {
    const seller = uiMode === "seller";
    badge.classList.toggle("audience-badge--seller", seller);
    badge.textContent = isLoggedIn()
      ? `${auth.user.username} (${getUserAudienceLabel()})`
      : seller
        ? "Режим: поставщик (гость)"
        : "Каталог поставщиков";
  }

  document.title =
    uiMode === "seller"
      ? "FoodSource — предложения покупателей"
      : "FoodSource — поиск поставщиков";
}

export async function initAudience() {
  const mode = isLoggedIn() && auth.user.audience === "seller" ? "seller" : "buyer";
  applyAudienceUi(mode);
  return mode;
}
