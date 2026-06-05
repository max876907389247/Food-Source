import { api } from "./auth.js";

export function createFavoritesStore(targetType) {
  const store = {
    targetType,
    ids: new Set(),
  };

  store.load = async () => {
    const { favorites } = await api(`/api/favorites?type=${targetType}`);
    store.ids = new Set(favorites);
    return store.ids;
  };

  store.has = (id) => store.ids.has(String(id));

  store.toggle = async (id) => {
    const sid = String(id);
    if (store.has(sid)) {
      await api(`/api/favorites/${targetType}/${encodeURIComponent(sid)}`, { method: "DELETE" });
      store.ids.delete(sid);
      return false;
    }
    await api("/api/favorites", {
      method: "POST",
      body: JSON.stringify({ targetType, targetId: sid }),
    });
    store.ids.add(sid);
    return true;
  };

  return store;
}

export function favoriteButtonHtml(id, isFavorite, options = {}) {
  const { sm = true, className = "" } = options;
  const cls = `btn ${sm ? "btn--sm " : ""}${isFavorite ? "btn--active" : "btn--ghost"} btn--favorite ${className}`.trim();
  return `<button type="button" class="${cls}" data-favorite-id="${id}" aria-pressed="${isFavorite ? "true" : "false"}">
    ${isFavorite ? "★ В избранном" : "☆ В избранное"}
  </button>`;
}
