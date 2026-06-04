USE foodsource;
SET NAMES utf8mb4;

INSERT INTO categories (id, label) VALUES
  ('ingredients', 'Ингредиенты и сырьё'),
  ('ready', 'Готовая продукция'),
  ('packaging', 'Упаковка'),
  ('dairy', 'Молочная продукция'),
  ('meat', 'Мясо и птица'),
  ('bakery', 'Хлебобулочные изделия'),
  ('beverages', 'Напитки'),
  ('frozen', 'Заморозка');

INSERT INTO regions (name) VALUES
  ('Москва'),
  ('Московская область'),
  ('Санкт-Петербург'),
  ('Екатеринбург'),
  ('Свердловская область'),
  ('Казань'),
  ('Новосибирск'),
  ('Краснодар'),
  ('Ростов-на-Дону'),
  ('Вся Россия'),
  ('Челябинск');

-- min_order — всегда в рублях (₽)
INSERT INTO suppliers (id, name, city, description, rating, reviews_count, min_order, min_order_kg, price_hint, has_certificates, delivery, source, response_time, phone, email, website) VALUES
  ('agrorus', 'АгроРус Опт', 'Москва', 'Оптовые поставки муки, круп, замороженных овощей для пекарен и столовых.', 4.6, 128, 'от 15 000 ₽', 50, 'мука — от 42 ₽/кг', 1, 'Самовывоз Подольск; доставка МО — от 3 500 ₽', 'Каталог «Продовольственный рынок»', '1–2 рабочих дня', '+7 (495) 123-45-67', 'opt@agrorus-demo.ru', 'https://example.com/agrorus'),
  ('uralgrain', 'УралГрейн', 'Екатеринбург', 'Мельница: мука, крупы, хлебопекарные смеси для производств Урала.', 4.8, 54, 'от 19 000 ₽', 500, 'ржаная мука — от 38 ₽/кг', 1, 'Ж/д и авто по Уралу; ТК в регионы', 'Региональный агропортал Урала', 'в день обращения', '+7 (343) 200-11-22', 'sales@uralgrain-demo.ru', 'https://example.com/uralgrain'),
  ('msk-spices', 'Специи Москва', 'Москва', 'Специи, приправы, сухие смеси для общепита и производств.', 4.3, 67, 'от 8 000 ₽', 10, 'паприка — от 420 ₽/кг', 1, 'Курьер по Москве от 8 000 ₽', 'B2B-каталог ингредиентов', '1 рабочий день', '+7 (495) 555-10-20', 'spices@msk-spices-demo.ru', 'https://example.com/msk-spices'),

  ('gastroline', 'ГастроЛайн', 'Москва', 'Готовые блюда для dark kitchen, кейтеринга и корпоративного питания.', 4.2, 203, 'от 30 000 ₽', 30, 'блюда sous-vide — от 280 ₽/порция', 1, 'Рефрижератор; доставка от 50 000 ₽', 'Отраслевой рейтинг HoReCa', '1 рабочий день', '+7 (495) 900-77-88', 'b2b@gastroline-demo.ru', 'https://example.com/gastroline'),
  ('chefkit', 'ШефКит', 'Санкт-Петербург', 'Готовая продукция: соусы, гарниры, полуфабрикаты премиум-сегмента.', 4.5, 88, 'от 25 000 ₽', 25, 'соус томатный — от 180 ₽/кг', 1, 'Доставка СПб и МСК', 'Каталог шеф-поваров', '1–2 рабочих дня', '+7 (812) 400-55-66', 'chef@chefkit-demo.ru', 'https://example.com/chefkit'),
  ('foodready-kzn', 'КазаньФуд', 'Казань', 'Готовые обеды и блюда на развес для столовых и офисов.', 4.0, 34, 'от 18 000 ₽', 20, 'комплекс обед — от 220 ₽/порция', 1, 'Развозка по Казани', 'Локальный HoReCa-каталог', '1 рабочий день', '+7 (843) 222-11-00', 'kzn@foodready-demo.ru', NULL),

  ('packpro', 'PackPro Food', 'Санкт-Петербург', 'Упаковка для готовой еды: лотки, крышки, плёнка, этикетки.', 4.4, 89, 'от 25 000 ₽', NULL, 'контейнер PP — от 8 ₽/шт.', 1, 'Склад СПб; экспресс СЗФО', 'Выставка PIR Expo', '2–3 рабочих дня', '+7 (812) 555-00-11', 'hello@packpro-demo.ru', 'https://example.com/packpro'),
  ('eco-box', 'ЭкоУпаковка МСК', 'Москва', 'Эко-упаковка для доставки еды: крафт, бумага, дерево.', 3.9, 15, 'от 3 000 ₽', NULL, 'крафт-контейнер — от 6 ₽/шт.', 0, 'Курьер по Москве от 10 000 ₽', 'Яндекс.Карты', '2 рабочих дня', '+7 (495) 000-12-34', 'info@ecobox-demo.ru', 'https://example.com/ecobox'),
  ('taraopt', 'ТараОпт', 'Москва', 'Пищевая упаковка оптом: лотки, стаканы, пакеты с брендированием.', 4.1, 52, 'от 12 000 ₽', NULL, 'стакан 400 мл — от 4 ₽/шт.', 1, 'Отгрузка со склада Москва', 'Поставщики упаковки МСК', '1 рабочий день', '+7 (495) 777-88-99', 'sales@taraopt-demo.ru', 'https://example.com/taraopt'),

  ('milkural', 'Молоко Урала', 'Первоуральск', 'Молоко, сливки, творог, сметана для кондитерских и кофеен.', 4.7, 37, 'от 10 400 ₽', 100, 'молоко 3,2% — от 52 ₽/л', 1, 'Автопарк по Свердловской области', 'Объединение производителей', '1–2 рабочих дня', '+7 (343) 777-33-44', 'opt@milkural-demo.ru', NULL),
  ('molokomsk', 'МолокоМСК', 'Москва', 'Молочная продукция для кофеен, пекарен и ритейла.', 4.4, 95, 'от 15 000 ₽', 80, 'сливки 33% — от 185 ₽/л', 1, 'Доставка МСК и МО', 'Молочный дистрибьютор', '1 рабочий день', '+7 (495) 301-22-33', 'b2b@molokomsk-demo.ru', 'https://example.com/molokomsk'),
  ('uraldairy', 'УралМолоко', 'Екатеринбург', 'Творог, сметана, масло слабосоленое оптом с Урала.', 4.6, 41, 'от 12 000 ₽', 60, 'творог 9% — от 310 ₽/кг', 1, 'Доставка по Уралу', 'Региональный каталог', 'в день обращения', '+7 (343) 555-66-77', 'sales@uraldairy-demo.ru', 'https://example.com/uraldairy'),

  ('meatdon', 'ДонМясоПром', 'Ростов-на-Дону', 'Птица и говядина охлаждённая и замороженная.', 4.5, 76, 'от 20 000 ₽', 100, 'куриное филе — от 195 ₽/кг', 1, 'Рефрижератор по ЮФО', 'B2B-маркетплейс', 'в день обращения', '+7 (863) 111-22-33', 'sales@meatdon-demo.ru', 'https://example.com/meatdon'),
  ('ptitsaopt', 'ПтицаОпт', 'Краснодар', 'Куриное мясо, субпродукты, фарш для общепита.', 4.3, 112, 'от 18 000 ₽', 90, 'филе куриное — от 188 ₽/кг', 1, 'Ежедневная отгрузка с птицефабрики', 'Южный агрокластер', '1 рабочий день', '+7 (861) 333-44-55', 'ptica@ptitsaopt-demo.ru', 'https://example.com/ptitsaopt'),
  ('urfarm-meat', 'УралФерма', 'Челябинск', 'Говядина и баранина охлаждённая, разделка под заказ.', 4.4, 29, 'от 22 000 ₽', 50, 'говядина вырезка — от 720 ₽/кг', 1, 'Доставка Урал и ТК', 'Фермерское объединение', '2 рабочих дня', '+7 (351) 200-33-44', 'meat@urfarm-demo.ru', NULL),

  ('krdbakery', 'КубаньХлебСнаб', 'Краснодар', 'Полуфабрикаты и готовая выпечка для фастфуда.', 4.3, 41, 'от 2 400 ₽', 40, 'булочка бургер — от 12 ₽/шт.', 1, 'Развозка по Краснодару', 'Каталог Краснодара', '1 рабочий день', '+7 (861) 222-33-44', 'supply@krdbakery-demo.ru', 'https://example.com/krdbakery'),
  ('hlebopt', 'ХлебОпт МСК', 'Москва', 'Замороженная выпечка и тесто для пекарен и кафе.', 4.2, 63, 'от 5 000 ₽', 25, 'круассан — от 28 ₽/шт.', 1, 'Ночная доставка Москва', 'Пекарни Москвы', '1 рабочий день', '+7 (495) 888-12-12', 'hleb@hlebopt-demo.ru', 'https://example.com/hlebopt'),
  ('bakeural', 'УралВыпечка', 'Екатеринбург', 'Булочки, пироги, слоёное тесто заморозка.', 4.1, 38, 'от 14 000 ₽', 35, 'пирог яблочный — от 95 ₽/шт.', 1, 'Склад Екатеринбург', 'Региональный пекарня-каталог', '1–2 рабочих дня', '+7 (343) 111-22-33', 'bake@bakeural-demo.ru', 'https://example.com/bakeural'),

  ('novosibtea', 'СибЧай и напитки', 'Новосибирск', 'Сиропы, чай, какао для кофеен.', 4.1, 19, 'от 5 000 ₽', 5, 'сиропы — от 320 ₽/л', 0, 'ТК по России', 'Сарафанное радио', '3–5 рабочих дней', '+7 (383) 444-55-66', 'order@novosibtea-demo.ru', 'https://example.com/novosibtea'),
  ('drinkmos', 'ДринкМосква', 'Москва', 'Соки, лимонады, концентраты для баров и ресторанов.', 4.0, 47, 'от 7 000 ₽', 10, 'апельсиновый сок — от 95 ₽/л', 1, 'Доставка МСК', 'Напитки HoReCa', '1 рабочий день', '+7 (495) 606-77-88', 'drink@drinkmos-demo.ru', 'https://example.com/drinkmos'),
  ('syruplab', 'СиропЛаб', 'Казань', 'Сиропы, топпинги, пюре для кофеен собственного производства.', 4.5, 71, 'от 6 000 ₽', 8, 'сироп карамель — от 290 ₽/л', 1, 'Отгрузка Казань и ТК', 'Кофейный каталог', '1–2 рабочих дня', '+7 (843) 505-11-22', 'lab@syruplab-demo.ru', 'https://example.com/syruplab'),

  ('spbfish', 'СеверРыба', 'Санкт-Петербург', 'Рыба и морепродукты для премиум-кухни.', 4.9, 62, 'от 29 000 ₽', 20, 'лосось филе — от 1 450 ₽/кг', 1, 'Ночная доставка СПб и МСК', 'Клуб шеф-поваров', 'в день обращения', '+7 (812) 333-44-55', 'chef@severfish-demo.ru', 'https://example.com/severfish'),
  ('frostfood', 'ФростФуд', 'Москва', 'Замороженные овощи, ягоды, полуфабрикаты.', 4.3, 84, 'от 18 000 ₽', 40, 'овощи микс — от 95 ₽/кг', 1, 'Склад Москва; ТК', 'Каталог заморозки', '1 рабочий день', '+7 (495) 404-55-66', 'frost@frostfood-demo.ru', 'https://example.com/frostfood'),
  ('icefish-nsk', 'СибРыба', 'Новосибирск', 'Рыба и морепродукты заморозка для ресторанов Сибири.', 4.2, 33, 'от 16 000 ₽', 15, 'минтай филе — от 210 ₽/кг', 1, 'ТК по СФО', 'Сибирский fish-каталог', '2–3 рабочих дня', '+7 (383) 777-00-11', 'fish@icefish-demo.ru', NULL);

INSERT INTO supplier_categories (supplier_id, category_id) VALUES
  ('agrorus', 'ingredients'), ('uralgrain', 'ingredients'), ('msk-spices', 'ingredients'),
  ('gastroline', 'ready'), ('chefkit', 'ready'), ('foodready-kzn', 'ready'),
  ('packpro', 'packaging'), ('eco-box', 'packaging'), ('taraopt', 'packaging'),
  ('milkural', 'dairy'), ('molokomsk', 'dairy'), ('uraldairy', 'dairy'),
  ('meatdon', 'meat'), ('ptitsaopt', 'meat'), ('urfarm-meat', 'meat'),
  ('krdbakery', 'bakery'), ('hlebopt', 'bakery'), ('bakeural', 'bakery'), ('uralgrain', 'bakery'),
  ('novosibtea', 'beverages'), ('drinkmos', 'beverages'), ('syruplab', 'beverages'),
  ('spbfish', 'frozen'), ('frostfood', 'frozen'), ('icefish-nsk', 'frozen'),
  ('agrorus', 'frozen');

INSERT INTO supplier_regions (supplier_id, region_id)
SELECT 'agrorus', id FROM regions WHERE name IN ('Москва', 'Московская область', 'Вся Россия');
INSERT INTO supplier_regions (supplier_id, region_id)
SELECT 'uralgrain', id FROM regions WHERE name IN ('Екатеринбург', 'Свердловская область', 'Вся Россия');
INSERT INTO supplier_regions (supplier_id, region_id)
SELECT 'msk-spices', id FROM regions WHERE name IN ('Москва', 'Московская область');
INSERT INTO supplier_regions (supplier_id, region_id)
SELECT 'gastroline', id FROM regions WHERE name IN ('Москва', 'Казань', 'Вся Россия');
INSERT INTO supplier_regions (supplier_id, region_id)
SELECT 'chefkit', id FROM regions WHERE name IN ('Санкт-Петербург', 'Москва', 'Вся Россия');
INSERT INTO supplier_regions (supplier_id, region_id)
SELECT 'foodready-kzn', id FROM regions WHERE name IN ('Казань', 'Вся Россия');
INSERT INTO supplier_regions (supplier_id, region_id)
SELECT 'packpro', id FROM regions WHERE name IN ('Санкт-Петербург', 'Москва', 'Вся Россия');
INSERT INTO supplier_regions (supplier_id, region_id)
SELECT 'eco-box', id FROM regions WHERE name IN ('Москва', 'Московская область');
INSERT INTO supplier_regions (supplier_id, region_id)
SELECT 'taraopt', id FROM regions WHERE name IN ('Москва', 'Вся Россия');
INSERT INTO supplier_regions (supplier_id, region_id)
SELECT 'milkural', id FROM regions WHERE name IN ('Екатеринбург', 'Свердловская область', 'Челябинск');
INSERT INTO supplier_regions (supplier_id, region_id)
SELECT 'molokomsk', id FROM regions WHERE name IN ('Москва', 'Московская область');
INSERT INTO supplier_regions (supplier_id, region_id)
SELECT 'uraldairy', id FROM regions WHERE name IN ('Екатеринбург', 'Свердловская область');
INSERT INTO supplier_regions (supplier_id, region_id)
SELECT 'meatdon', id FROM regions WHERE name IN ('Ростов-на-Дону', 'Краснодар', 'Вся Россия');
INSERT INTO supplier_regions (supplier_id, region_id)
SELECT 'ptitsaopt', id FROM regions WHERE name IN ('Краснодар', 'Ростов-на-Дону');
INSERT INTO supplier_regions (supplier_id, region_id)
SELECT 'urfarm-meat', id FROM regions WHERE name IN ('Челябинск', 'Екатеринбург', 'Вся Россия');
INSERT INTO supplier_regions (supplier_id, region_id)
SELECT 'krdbakery', id FROM regions WHERE name IN ('Краснодар', 'Ростов-на-Дону');
INSERT INTO supplier_regions (supplier_id, region_id)
SELECT 'hlebopt', id FROM regions WHERE name IN ('Москва', 'Московская область');
INSERT INTO supplier_regions (supplier_id, region_id)
SELECT 'bakeural', id FROM regions WHERE name IN ('Екатеринбург', 'Свердловская область');
INSERT INTO supplier_regions (supplier_id, region_id)
SELECT 'novosibtea', id FROM regions WHERE name IN ('Новосибирск', 'Вся Россия');
INSERT INTO supplier_regions (supplier_id, region_id)
SELECT 'drinkmos', id FROM regions WHERE name IN ('Москва', 'Вся Россия');
INSERT INTO supplier_regions (supplier_id, region_id)
SELECT 'syruplab', id FROM regions WHERE name IN ('Казань', 'Вся Россия');
INSERT INTO supplier_regions (supplier_id, region_id)
SELECT 'spbfish', id FROM regions WHERE name IN ('Санкт-Петербург', 'Москва');
INSERT INTO supplier_regions (supplier_id, region_id)
SELECT 'frostfood', id FROM regions WHERE name IN ('Москва', 'Вся Россия');
INSERT INTO supplier_regions (supplier_id, region_id)
SELECT 'icefish-nsk', id FROM regions WHERE name IN ('Новосибирск', 'Вся Россия');

INSERT INTO certificates (supplier_id, name) VALUES
  ('agrorus', 'ХАССП'), ('agrorus', 'ISO 22000'),
  ('uralgrain', 'ГОСТ'), ('uralgrain', 'Сертификат качества'),
  ('msk-spices', 'Декларация соответствия'),
  ('packpro', 'EAC'), ('packpro', 'Пищевой контакт'),
  ('gastroline', 'ХАССП'), ('gastroline', 'Ветеринарные сопроводительные'),
  ('chefkit', 'ХАССП'),
  ('milkural', 'ТР ТС 033/2013'), ('milkural', 'СГР'),
  ('molokomsk', 'ХАССП'),
  ('uraldairy', 'ГОСТ'),
  ('meatdon', 'ХАССП'), ('meatdon', 'Ветсертификат'),
  ('ptitsaopt', 'Ветсертификат'),
  ('urfarm-meat', 'ХАССП'),
  ('krdbakery', 'Декларация'),
  ('hlebopt', 'Санитарно-эпидемиологическое заключение'),
  ('spbfish', 'MSC (по запросу)'), ('spbfish', 'Ветсертификат'), ('spbfish', 'ХАССП'),
  ('frostfood', 'ХАССП'),
  ('syruplab', 'Декларация');

INSERT INTO products (supplier_id, name, category_id, description, price_hint, min_order, unit) VALUES
  ('agrorus', 'Мука пшеничная в/с', 'ingredients', 'Мешки 25–50 кг', 'от 42 ₽/кг', 'от 2 100 ₽', 'кг'),
  ('msk-spices', 'Паприка копчёная', 'ingredients', 'Фасовка 1 кг', 'от 420 ₽/кг', 'от 4 200 ₽', 'кг'),
  ('uralgrain', 'Мука ржаная', 'ingredients', 'Мешок 25 кг', 'от 38 ₽/кг', 'от 950 ₽', 'кг'),
  ('gastroline', 'Говядина sous-vide', 'ready', 'Порции', 'от 420 ₽/порция', 'от 12 600 ₽', 'порция'),
  ('chefkit', 'Соус томатный базовый', 'ready', 'Ведро 5 кг', 'от 180 ₽/кг', 'от 900 ₽', 'кг'),
  ('foodready-kzn', 'Комплекс обед стандарт', 'ready', 'Порция', 'от 220 ₽/порция', 'от 4 400 ₽', 'порция'),
  ('packpro', 'Контейнер PP 500 мл', 'packaging', 'С крышкой', 'от 8 ₽/шт.', 'от 80 000 ₽', 'шт.'),
  ('eco-box', 'Контейнер крафт 750 мл', 'packaging', 'С крышкой', 'от 6 ₽/шт.', 'от 3 000 ₽', 'шт.'),
  ('taraopt', 'Стакан 400 мл', 'packaging', 'Прозрачный', 'от 4 ₽/шт.', 'от 3 000 ₽', 'шт.'),
  ('milkural', 'Молоко 3,2%', 'dairy', 'Пастеризованное', 'от 52 ₽/л', 'от 10 400 ₽', 'л'),
  ('molokomsk', 'Сливки 33%', 'dairy', '1 л', 'от 185 ₽/л', 'от 14 800 ₽', 'л'),
  ('uraldairy', 'Творог 9%', 'dairy', 'Блок 5 кг', 'от 310 ₽/кг', 'от 18 600 ₽', 'кг'),
  ('meatdon', 'Куриное филе', 'meat', 'Охлаждённое', 'от 195 ₽/кг', 'от 19 500 ₽', 'кг'),
  ('ptitsaopt', 'Филе куриное', 'meat', 'Сорт А', 'от 188 ₽/кг', 'от 16 920 ₽', 'кг'),
  ('urfarm-meat', 'Говядина вырезка', 'meat', 'Охлаждённая', 'от 720 ₽/кг', 'от 36 000 ₽', 'кг'),
  ('krdbakery', 'Булочка для бургера', 'bakery', 'Заморозка', 'от 12 ₽/шт.', 'от 2 400 ₽', 'шт.'),
  ('hlebopt', 'Круассан классический', 'bakery', 'Заморозка', 'от 28 ₽/шт.', 'от 700 ₽', 'шт.'),
  ('bakeural', 'Пирог яблочный', 'bakery', 'Заморозка', 'от 95 ₽/шт.', 'от 3 325 ₽', 'шт.'),
  ('novosibtea', 'Сироп ваниль', 'beverages', '1 л', 'от 320 ₽/л', 'от 1 920 ₽', 'л'),
  ('drinkmos', 'Сок апельсиновый', 'beverages', '1 л', 'от 95 ₽/л', 'от 950 ₽', 'л'),
  ('syruplab', 'Сироп карамель', 'beverages', '1 л', 'от 290 ₽/л', 'от 2 320 ₽', 'л'),
  ('spbfish', 'Лосось филе с/м', 'frozen', 'Норвегия', 'от 1 450 ₽/кг', 'от 29 000 ₽', 'кг'),
  ('frostfood', 'Овощи микс 4 сезона', 'frozen', '2,5 кг', 'от 95 ₽/кг', 'от 9 500 ₽', 'кг'),
  ('icefish-nsk', 'Минтай филе', 'frozen', 'Блочная заморозка', 'от 210 ₽/кг', 'от 3 150 ₽', 'кг');
