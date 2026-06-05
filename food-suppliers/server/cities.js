import { query } from "./db.js";

export async function listCities() {
  const rows = await query(
    `SELECT DISTINCT TRIM(city) AS city FROM (
      SELECT city FROM suppliers
      UNION ALL SELECT city FROM buyer_demands
      UNION ALL SELECT city FROM users
    ) AS all_cities
    WHERE city IS NOT NULL AND TRIM(city) != ''
    ORDER BY city`
  );
  return rows.map((r) => r.city);
}
