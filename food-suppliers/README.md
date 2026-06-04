# FoodSource — MySQL + Node.js + Express

Сервис поиска и сравнения поставщиков продуктов питания. **Поставщики, регионы, категории, сертификаты и продукция** хранятся в **MySQL** и отдаются через REST API.

## Стек

| Слой | Технология |
|------|------------|
| БД | MySQL 8+ |
| API | Node.js, Express, mysql2 |
| UI | HTML, CSS, JavaScript (fetch) |

## Быстрый старт (рекомендуется: Docker)

**Ошибка `ECONNREFUSED 127.0.0.1:3306`** — MySQL не запущена или контейнер падает.

Если контейнер в цикле `Restarting`, сбросьте volume (часто из‑за битых данных после сбоя):

```bash
docker compose down -v
docker compose up -d
npm run db:wait
```

Поднимите MySQL через Docker:

1. Установите [Docker Desktop](https://www.docker.com/products/docker-desktop/) и запустите приложение.
2. В терминале:

```bash
cd food-suppliers
cp .env.example .env
npm install
npm run setup    # MySQL в Docker + ожидание + проверка данных
npm start
```

Откройте: **http://localhost:3000**

Полезные команды:

| Команда | Действие |
|---------|----------|
| `npm run db:up` | Запустить контейнер MySQL |
| `npm run db:wait` | Дождаться готовности БД |
| `npm run db:check` | Проверить подключение и число поставщиков |
| `npm run db:down` | Остановить контейнер |
| `npm run db:reset` | Пересоздать БД с нуля (удалит volume) |

В `.env` для Docker должны быть: `DB_USER=foodsource`, `DB_PASSWORD=foodsource`.

### Вариант без Docker (локальный MySQL)

Установите MySQL (на macOS: `brew install mysql`, затем `brew services start mysql`), создайте базу:

```bash
mysql -u root -p < sql/schema.sql
mysql -u root -p foodsource < sql/seed.sql
```

В `.env` укажите свой `DB_USER` и `DB_PASSWORD` (часто `root`).

```bash
npm install
npm run db:check
npm start
```

Проверка API: http://localhost:3000/api/health

### Сервер не запускается после команд

| Симптом | Решение |
|---------|---------|
| `EADDRINUSE :::3000` | Уже запущен старый `npm start`: `npm run stop`, затем снова `npm start` |
| `ECONNREFUSED 3306` в `db:wait` | Docker не запущен или MySQL ещё стартует: `npm run db:up`, подождите 30 с, `npm run db:wait` |
| Контейнер `Restarting` | `npm run db:reload` или `docker compose down -v && docker compose up -d` |
| Краш Node при старте | Убедитесь, что в каталоге `food-suppliers` выполнен `npm install` |

После `db:reset` **обязательно** дождитесь БД (`npm run db:wait`), иначе `npm start` поднимется без MySQL.

### Обновление каталога поставщиков

В демо-данных **24 поставщика** (по 2–3 на категорию), минимальный заказ указан **в рублях (₽)**.

```bash
npm run db:reload   # reset + wait + пользователи (admin1/user1)
npm run stop        # если порт 3000 занят старым npm start
npm start
```

Или по шагам: `db:reset` → `db:wait` → `npm start`.

## Кракозябры вместо русского текста

Данные в БД были сохранены в неверной кодировке. **Пересоздайте базу с utf8mb4:**

```bash
npm run db:fix-encoding
npm run db:wait
npm start
```

Команда удалит Docker-volume и заново загрузит `schema.sql`, `seed.sql` с `SET NAMES utf8mb4`.

## Режимы: покупатель и поставщик

- **Гость** — каталог поставщиков без входа.
- **Покупатель** (после входа) — каталог, заказы, свои заявки на закупку.
- **Поставщик** (после входа) — каталог заявок покупателей, ответы на них, раздел **«Мои товары»** (продукция в карточке поставщика для покупателей).

Заказы сохраняются в MySQL (`orders`, `order_items`), нужен вход (`user1` / `user2`).

Если таблицы заказов ещё нет в старой БД: `npm run db:migrate` (без удаления данных). Полный сброс: `npm run db:reset`.

## Авторизация

| Роль | Логин | Пароль |
|------|-------|--------|
| Администратор | `admin1` | `admin2` |
| Пользователь | `user1` | `user2` |

### Демо-аккаунты поставщиков и покупателей

После `npm run db:seed-accounts` (или `npm run setup`) для **каждого** поставщика и заявки покупателя создаётся вход:

| Тип | Логин | Пароль |
|-----|-------|--------|
| Поставщик | `s_<id>` — дефис в id заменён на `_` (например `s_agrorus`, `s_msk_spices`) | `demo` |
| Покупатель (заявка №N) | `b_1` … `b_12` | `demo` |

- **Поставщик** → **Предложения** (заявки покупателей), **Мои товары** (продукция в карточке поставщика).
- **Покупатель** → вкладка **Мои запросы** (публикация и редактирование заявок на закупку).

- На главной: **Регистрация** (новый пользователь → MySQL, роль `user`) и **Войти**.
- Админ после входа: **Админ-панель** → http://localhost:3000/admin.html
- Вкладки админки:
  - **Поставщики** — CRUD в таблице `suppliers`
  - **Пользователи** — CRUD в таблице `users` (логин, роль, пароль)

Для уже работающей БД без таблицы `users`:

```bash
node scripts/seed-users.js
```

### 3. Режим разработки

```bash
npm run dev
```

## Структура БД

```
categories ──┬── supplier_categories ── suppliers
             └── products
regions ──────── supplier_regions ────── suppliers
certificates ─────────────────────────── suppliers
```

- **suppliers** — карточка поставщика, контакты, условия
- **products** — номенклатура поставщика (название, цена, мин. заказ, категория)
- **supplier_categories** / **supplier_regions** — связи многие-ко-многим
- **certificates** — документы поставщика

## API

| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/health` | Проверка подключения к MySQL |
| GET | `/api/categories` | Список категорий |
| GET | `/api/regions` | Список регионов |
| GET | `/api/suppliers` | Поиск: `category`, `region`, `q`, `budgetKg`, `sort`, `ids` |
| GET | `/api/suppliers/:id` | Карточка с продукцией |

Пример:

```
GET /api/suppliers?category=ingredients&region=Екатеринбург&budgetKg=100&sort=score
```

## Почему такой формат

- **MySQL** — привычная реляционная модель для каталогов, связей и фильтров
- **Express** — тонкий API-слой между браузером и БД без тяжёлого фреймворка
- **Статический фронт** — тот же UI, что в прототипе; меняется только источник данных (`fetch` вместо `data.js`)

## Файлы

```
food-suppliers/
├── sql/schema.sql      # схема БД
├── sql/seed.sql        # демо-данные
├── server/             # API
├── public/             # интерфейс
├── package.json
└── .env.example
```
