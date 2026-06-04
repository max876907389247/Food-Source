/** Преобразование строки БД в объект API (camelCase). */

export function mapSupplierRow(row) {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    description: row.description,
    rating: Number(row.rating),
    reviewsCount: row.reviews_count,
    minOrder: row.min_order,
    minOrderKg: row.min_order_kg,
    priceHint: row.price_hint,
    hasCertificates: Boolean(row.has_certificates),
    delivery: row.delivery,
    source: row.source,
    responseTime: row.response_time,
    workingHours: row.working_hours || "08:00–21:00 (МСК)",
    contacts: {
      phone: row.phone,
      email: row.email,
      website: row.website,
    },
    categories: row.categories ? row.categories.split(",") : [],
    categoryLabels: row.category_labels ? row.category_labels.split("|||") : [],
    regions: row.regions ? row.regions.split("|||") : [],
    certificates: row.certificates ? row.certificates.split("|||") : [],
    products: row.products_json ? JSON.parse(row.products_json) : [],
  };
}

export const SUPPLIER_SELECT = `
  SELECT
    s.*,
    GROUP_CONCAT(DISTINCT sc.category_id ORDER BY sc.category_id) AS categories,
    GROUP_CONCAT(DISTINCT c.label ORDER BY c.label SEPARATOR '|||') AS category_labels,
    GROUP_CONCAT(DISTINCT r.name ORDER BY r.name SEPARATOR '|||') AS regions,
    GROUP_CONCAT(DISTINCT cert.name ORDER BY cert.name SEPARATOR '|||') AS certificates
  FROM suppliers s
  LEFT JOIN supplier_categories sc ON sc.supplier_id = s.id
  LEFT JOIN categories c ON c.id = sc.category_id
  LEFT JOIN supplier_regions sr ON sr.supplier_id = s.id
  LEFT JOIN regions r ON r.id = sr.region_id
  LEFT JOIN certificates cert ON cert.supplier_id = s.id
`;
