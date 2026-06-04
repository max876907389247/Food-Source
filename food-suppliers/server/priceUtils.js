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
