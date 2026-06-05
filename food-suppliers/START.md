# Запуск FoodSource

Требуется: **Node.js 18+**, **Docker Desktop** (запущен).

## Первый запуск

```bash
cd /Users/trofimov/Projects/frontend-portfolio/food-suppliers
cp .env.example .env
npm install
npm run setup
npm start
```

Откройте: **http://localhost:3000**  
Админка: **http://localhost:3000/admin.html**

## Демо-входы

| Роль | Логин | Пароль |
|------|-------|--------|
| Админ | `admin1` | `admin2` |
| Поставщик | `s_agrorus` | `demo` |
| Покупатель | `b_1` | `demo` |

## Повседневный запуск (БД уже настроена)

```bash
cd /Users/trofimov/Projects/frontend-portfolio/food-suppliers
npm run db:up
npm run db:wait
npm start
```

## Остановка

```bash
npm run stop          # сервер на порту 3000
npm run db:down       # контейнер MySQL
```

## Если порт 3000 занят

```bash
npm run stop
npm start
```

## Если MySQL не подключается

```bash
docker compose down -v
npm run setup
npm start
```

## Публикация на GitHub

Репозиторий: `max876907389247/Food-Source`  
Команды — из корня **frontend-portfolio** (не из `food-suppliers`):

```bash
cd /Users/trofimov/Projects/frontend-portfolio
git remote set-url origin https://github.com/max876907389247/Food-Source.git
git push -u origin main
```

При запросе: **Username** `max876907389247`, **Password** — новый токен `ghp_...` (не пароль от сайта).
