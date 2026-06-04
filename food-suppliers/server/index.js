import "dotenv/config";
import express from "express";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";
import api from "./api.js";
import { ping } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");
const PORT = Number(process.env.PORT || 3000);

const app = express();

app.use((_req, res, next) => {
  res.charset = "utf-8";
  next();
});

app.use(express.json({ limit: "1mb" }));
app.use(
  session({
    name: "foodsource.sid",
    secret: process.env.SESSION_SECRET || "foodsource-dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: "lax",
    },
  })
);

app.use(api);

app.use(express.static(publicDir, { charset: "utf-8" }));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/") || req.path.includes(".")) {
    next();
    return;
  }
  res.sendFile(path.join(publicDir, "index.html"));
});

app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    res.status(404).json({
      error: "Not found",
      path: req.path,
      method: req.method,
    });
  } else {
    res.status(404).send("Not found");
  }
});

const server = app.listen(PORT, async () => {
  try {
    await ping();
    console.log(`FoodSource: http://localhost:${PORT}`);
    console.log(`Админ-панель: http://localhost:${PORT}/admin.html`);
    console.log("MySQL: подключение успешно (utf8mb4)");
    console.log("API: POST /api/auth/register — регистрация");
    console.log("Админ: admin1 / admin2  |  Демо: s_<id>, b_1…b_12 / demo");
  } catch (err) {
    console.error("MySQL: ошибка подключения —", err.message);
    if (err.code === "ECONNREFUSED") {
      console.error("Запустите БД: npm run db:up && npm run db:wait");
    }
    console.error(
      "Сервер запущен, но без БД API не работает. Остановите (Ctrl+C), поднимите MySQL и снова npm start."
    );
  }
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `\nПорт ${PORT} уже занят — старый процесс Node всё ещё работает.`
    );
    console.error("Остановите его:  npm run stop");
    console.error("Или вручную:     lsof -ti :3000 | xargs kill");
    console.error("Затем снова:     npm start\n");
    process.exit(1);
  }
  console.error("Ошибка запуска сервера:", err.message);
  process.exit(1);
});
