function matchesRegion(supplier, region) {
  if (!region) return true;
  const r = region.trim().toLowerCase();
  return supplier.regions.some(
    (x) =>
      x.toLowerCase() === r ||
      x.toLowerCase().includes(r) ||
      r.includes(x.toLowerCase()) ||
      x === "Вся Россия"
  );
}

export function scoreSupplier(supplier, filters) {
  let score = supplier.rating * 20;
  const reasons = [];

  if (filters.region && matchesRegion(supplier, filters.region)) {
    score += 15;
    if (
      supplier.city.toLowerCase().includes(filters.region.toLowerCase().split(" ")[0])
    ) {
      score += 10;
      reasons.push("Работает в выбранном регионе");
    } else if (supplier.regions.includes("Вся Россия")) {
      reasons.push("Доставка по всей России");
    } else {
      reasons.push("Покрывает ваш регион");
    }
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
