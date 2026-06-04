USE foodsource;
SET NAMES utf8mb4;

UPDATE products SET price_per_unit = COALESCE(price_per_unit, 42) WHERE supplier_id = 'agrorus' AND name LIKE 'Мука пшеничная%';
UPDATE products SET price_per_unit = COALESCE(price_per_unit, 420) WHERE supplier_id = 'msk-spices';
UPDATE products SET price_per_unit = COALESCE(price_per_unit, 38) WHERE supplier_id = 'uralgrain';
UPDATE products SET price_per_unit = COALESCE(price_per_unit, 420) WHERE supplier_id = 'gastroline';
UPDATE products SET price_per_unit = COALESCE(price_per_unit, 180) WHERE supplier_id = 'chefkit';
UPDATE products SET price_per_unit = COALESCE(price_per_unit, 220) WHERE supplier_id = 'foodready-kzn';
UPDATE products SET price_per_unit = COALESCE(price_per_unit, 8) WHERE supplier_id = 'packpro';
UPDATE products SET price_per_unit = COALESCE(price_per_unit, 6) WHERE supplier_id = 'eco-box';
UPDATE products SET price_per_unit = COALESCE(price_per_unit, 4) WHERE supplier_id = 'taraopt';
UPDATE products SET price_per_unit = COALESCE(price_per_unit, 52) WHERE supplier_id = 'milkural';
UPDATE products SET price_per_unit = COALESCE(price_per_unit, 185) WHERE supplier_id = 'molokomsk';
UPDATE products SET price_per_unit = COALESCE(price_per_unit, 310) WHERE supplier_id = 'uraldairy';
UPDATE products SET price_per_unit = COALESCE(price_per_unit, 195) WHERE supplier_id = 'meatdon';
UPDATE products SET price_per_unit = COALESCE(price_per_unit, 188) WHERE supplier_id = 'ptitsaopt';
UPDATE products SET price_per_unit = COALESCE(price_per_unit, 720) WHERE supplier_id = 'urfarm-meat';
UPDATE products SET price_per_unit = COALESCE(price_per_unit, 12) WHERE supplier_id = 'krdbakery';
UPDATE products SET price_per_unit = COALESCE(price_per_unit, 28) WHERE supplier_id = 'hlebopt';
UPDATE products SET price_per_unit = COALESCE(price_per_unit, 95) WHERE supplier_id = 'bakeural';
UPDATE products SET price_per_unit = COALESCE(price_per_unit, 320) WHERE supplier_id = 'novosibtea';
UPDATE products SET price_per_unit = COALESCE(price_per_unit, 95) WHERE supplier_id = 'drinkmos';
UPDATE products SET price_per_unit = COALESCE(price_per_unit, 290) WHERE supplier_id = 'syruplab';
UPDATE products SET price_per_unit = COALESCE(price_per_unit, 1450) WHERE supplier_id = 'spbfish';
UPDATE products SET price_per_unit = COALESCE(price_per_unit, 95) WHERE supplier_id = 'frostfood';
UPDATE products SET price_per_unit = COALESCE(price_per_unit, 210) WHERE supplier_id = 'icefish-nsk';

INSERT IGNORE INTO buyer_demands (id, company_name, city, region, business_type, category_id, volume_text, volume_kg, budget_text, description, contact_phone, contact_email) VALUES
  (1, 'Кафе «Утро»', 'Москва', 'Москва', 'Кафе', 'bakery', 'до 80 кг/нед', 80, 'до 25 000 ₽', 'Ищем поставщика выпечки и заморозки для кофейни.', '+7 (495) 111-22-33', 'buy@cafeutro.ru'),
  (2, 'Dark Kitchen «Вок»', 'Москва', 'Москва', 'Dark kitchen', 'ready', '120–200 порций/день', 150, 'от 40 000 ₽', 'Нужны готовые соусы и полуфабрикаты с стабильной поставкой.', '+7 (495) 222-33-44', 'zakaz@vok-dk.ru'),
  (3, 'Сеть «Маркет Fresh»', 'Санкт-Петербург', 'Санкт-Петербург', 'Ритейл', 'dairy', 'от 500 л/нед', 500, 'гибко', 'Закупка молочной продукции для 4 магазинов.', '+7 (812) 333-44-55', 'milk@marketfresh.ru'),
  (4, 'Столовая «Север»', 'Екатеринбург', 'Екатеринбург', 'Столовая', 'meat', 'от 300 кг/мес', 300, 'до 200 000 ₽', 'Курица и говядина охлаждённые, сертификаты обязательны.', '+7 (343) 444-55-66', 'tender@sever-ural.ru'),
  (5, 'Ресторан «Панорама»', 'Казань', 'Казань', 'Ресторан', 'frozen', 'от 150 кг', 150, 'от 80 000 ₽', 'Рыба и овощи заморозка, поставка 2 раза в неделю.', '+7 (843) 555-66-77', 'chef@panorama-kzn.ru'),
  (6, 'Пекарня «Бородин»', 'Москва', 'Московская область', 'Пекарня', 'ingredients', 'мука 2–4 т/мес', 3000, 'от 120 000 ₽', 'Мука в/с и ржаная, долгосрочный контракт.', '+7 (495) 666-77-88', 'flour@borodin-bakery.ru'),
  (7, 'Офис-питание «ЛанчБокс»', 'Москва', 'Москва', 'Кейтеринг', 'ready', '800 порций/нед', 800, 'от 150 000 ₽', 'Готовые обеды, важна пунктуальность.', '+7 (495) 777-88-99', 'ops@lunchbox.ru'),
  (8, 'Магазин «Специи+»', 'Новосибирск', 'Новосибирск', 'Ритейл', 'ingredients', 'до 50 кг', 50, 'до 30 000 ₽', 'Специи и сиропы для напитков.', '+7 (383) 888-99-00', 'buy@spicesplus.ru'),
  (9, 'Суши-бар «Тихий»', 'Краснодар', 'Краснодар', 'Ресторан', 'frozen', 'лосось от 80 кг', 80, 'от 100 000 ₽', 'Филе лосося с/м, MSC желательно.', '+7 (861) 999-00-11', 'fish@tihiy.ru'),
  (10, 'Кофейня «Зерно»', 'Ростов-на-Дону', 'Ростов-на-Дону', 'Кафе', 'beverages', 'сиропы 40 л/мес', 40, 'до 15 000 ₽', 'Сиропы и соки, мелкий опт.', '+7 (863) 100-20-30', 'bar@zerno-cafe.ru'),
  (11, 'Гостиница «Волга»', 'Самара', 'Самара', 'HoReCa', 'packaging', 'контейнеры 50 000 шт', NULL, 'от 200 000 ₽', 'Упаковка для доставки завтраков в номера.', '+7 (846) 200-30-40', 'supply@volga-hotel.ru'),
  (12, 'Пиццерия «Форно»', 'Москва', 'Москва', 'Ресторан', 'ingredients', 'мука 800 кг/мес', 800, 'от 35 000 ₽', 'Мука и соусы для пиццы, ищем надёжного партнёра.', '+7 (495) 300-40-50', 'orders@forno-pizza.ru');
