# Frontend Portfolio Landing

Статический лендинг-портфолио под вакансию **Frontend-разработчик**. Структура заточена под оценку релевантности опыта, а не просто перечисление навыков.

## Структура подачи

1. **Hero** — позиционирование и краткий профиль под вакансию
2. **Соответствие роли** — «требование → опыт → результат»
3. **Стек** — технологии, сгруппированные по категориям
4. **Проекты** — задача, роль, стек, релевантность для frontend
5. **Опыт** — хронология с акцентом на frontend-задачи
6. **Контакты**

## Быстрый просмотр

Откройте `index.html` в браузере или запустите локальный сервер:

```bash
cd ~/Projects/frontend-portfolio
python3 -m http.server 8080
```

Откройте: http://localhost:8080

## Что заменить перед сдачей

| Место | Файл |
|-------|------|
| Имя, город, headline | `index.html` → секция `.hero` |
| Блок «Почему подхожу» | `index.html` → `#fit` (подставьте пункты из текста вакансии) |
| Проекты и ссылки | `index.html` → `#projects` |
| Опыт | `index.html` → `#experience` |
| Email, Telegram, GitHub | `index.html` → `#contact` |

## Деплой на GitHub Pages

1. Создайте репозиторий на GitHub
2. Загрузите содержимое папки
3. Settings → Pages → Source: **Deploy from branch** → `main` / `/ (root)`

Ссылка будет вида: `https://<username>.github.io/<repo>/`

## Тестовое задание: FoodSource

Прототип сервиса поиска поставщиков продуктов питания — папка [`food-suppliers/`](food-suppliers/README.md).

```bash
cd food-suppliers && python3 -m http.server 8080
```

## Файлы

- `index.html` — разметка и контент
- `styles.css` — стили, адаптив, тёмная тема
- `main.js` — мобильное меню и подсветка секций
- `food-suppliers/` — прототип FoodSource (отдельное SPA)
