/** Логин демо-аккаунта поставщика по id карточки */
export function sellerLoginFromSupplierId(supplierId) {
  return `s_${String(supplierId).replace(/-/g, "_")}`.slice(0, 32);
}

/** Логин демо-аккаунта покупателя по id заявки */
export function buyerLoginFromDemandId(demandId) {
  return `b_${demandId}`;
}

const KNOWN_PASSWORDS = {
  admin1: "admin2",
  user1: "user2",
};

/** Пароль для отображения в админке (демо и служебные учётки) */
export function displayPasswordForUsername(username) {
  const u = String(username || "").trim();
  if (!u) return null;
  if (KNOWN_PASSWORDS[u]) return KNOWN_PASSWORDS[u];
  if (/^s_/.test(u) || /^b_\d+$/.test(u)) return "demo";
  return null;
}

export function accountFieldsForSupplier(supplierId, linkedUsername) {
  const expectedLogin = sellerLoginFromSupplierId(supplierId);
  const login = linkedUsername || expectedLogin;
  const password = displayPasswordForUsername(login) ?? (linkedUsername ? "—" : "demo");
  const missing = !linkedUsername;
  return { login, password, expectedLogin, missing };
}

export function accountFieldsForBuyer(demandId, linkedUsername) {
  const expectedLogin = buyerLoginFromDemandId(demandId);
  const login = linkedUsername || expectedLogin;
  const password = displayPasswordForUsername(login) ?? (linkedUsername ? "—" : "demo");
  const missing = !linkedUsername;
  return { login, password, expectedLogin, missing };
}
