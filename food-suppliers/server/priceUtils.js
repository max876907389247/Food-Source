export function formatRuNumber(n) {
  return new Intl.NumberFormat("ru-RU").format(n);
}

export function formatProductPriceHint(pricePerUnit, unit) {
  if (pricePerUnit == null || pricePerUnit === "") return null;
  const price = Number(pricePerUnit);
  if (!Number.isFinite(price) || price < 0) return null;
  return `${formatRuNumber(price)}₽/${unit || "шт."}`;
}

export function formatProductMinOrder(minOrderRub) {
  if (minOrderRub == null || minOrderRub === "") return null;
  const rub = Number(minOrderRub);
  if (!Number.isFinite(rub) || rub < 0) return null;
  return `мин. от ${formatRuNumber(rub)} ₽`;
}

function parseNumericInput(value) {
  if (value == null || value === "") return null;
  const str = String(value).trim();
  const direct = Number(str.replace(/\s/g, "").replace(",", "."));
  if (Number.isFinite(direct) && direct >= 0) return direct;
  const m = str.match(/(\d[\d\s]*(?:[.,]\d+)?)/);
  if (!m) return null;
  const num = Number(m[1].replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(num) && num >= 0 ? num : null;
}

export function parseProductMinOrderInput(value) {
  if (value == null || value === "") return null;
  const fromRub = parseMinOrderRubles(value);
  if (fromRub != null) return fromRub;
  return parseNumericInput(value);
}

/** Извлекает числовую цену из price_hint, например «от 42 ₽/кг» → 42 */
export function parsePriceFromHint(priceHint) {
  if (!priceHint) return null;
  const m = String(priceHint).match(/(\d+(?:[.,]\d+)?)\s*₽/);
  if (!m) return null;
  return Number(m[1].replace(",", "."));
}

export function resolveProductPrice(product) {
  if (product.price_per_unit != null && product.price_per_unit !== "") {
    return Number(product.price_per_unit);
  }
  return parsePriceFromHint(product.price_hint ?? product.priceHint) ?? 0;
}

/** Минимальная сумма заказа в ₽ из текста, например «от 15 000 ₽» → 15000 */
export function parseMinOrderRubles(minOrderText) {
  if (!minOrderText) return null;
  const m = String(minOrderText).match(/(\d[\d\s]*)\s*₽/);
  if (!m) return null;
  const value = Number(m[1].replace(/\s/g, ""));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Лимит бюджета покупателя из текста заявки, например «до 25 000 ₽» */
export const parseBudgetRubles = parseMinOrderRubles;
