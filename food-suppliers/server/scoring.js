export function scoreSupplier(supplier, filters) {
  let score = supplier.rating * 20;
  const reasons = [];

  const filterCity = String(filters.city || "").trim().toLowerCase();
  if (filterCity && supplier.city.toLowerCase() === filterCity) {
    score += 25;
    reasons.push("Поставщик в выбранном городе");
  }

  if (supplier.hasCertificates) {
    score += 12;
    reasons.push("Есть сертификаты и документы");
  }

  if (supplier.priceHint || (supplier.products && supplier.products.length)) {
    score += 8;
    reasons.push("Указаны цены на продукцию");
  }

  if (supplier.contacts.website) score += 4;

  if (filters.budgetKg) {
    const budget = Number(filters.budgetKg);
    if (supplier.minOrderKg != null) {
      if (supplier.minOrderKg <= budget) {
        score += 18;
        reasons.push(
          `Мин. заказ (${supplier.minOrderKg} кг) укладывается в ваш объём`
        );
      } else {
        score -= 25;
        reasons.push(
          `Мин. заказ выше желаемого объёма (${supplier.minOrderKg} кг)`
        );
      }
    }
  }

  const fastResponse = ["30 минут", "45 минут", "1 час"];
  if (
    fastResponse.includes(supplier.responseTime) ||
    supplier.responseTime.includes("день обращения")
  ) {
    score += 6;
    reasons.push("Быстрый ответ на запрос");
  }

  score += Math.min(supplier.reviewsCount / 10, 8);

  return { score: Math.round(score), reasons: [...new Set(reasons)].slice(0, 4) };
}
