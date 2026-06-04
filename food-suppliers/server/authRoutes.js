import { Router } from "express";
import bcrypt from "bcryptjs";
import { sessionUser } from "./auth.js";
import { createUser, getUserById, getUserByUsername, mapUserRow, normalizeAudience } from "./userRepo.js";

const router = Router();

router.get("/api/auth/me", async (req, res) => {
  const session = sessionUser(req);
  if (!session) {
    res.json({ user: null });
    return;
  }
  const user = await getUserById(session.id);
  res.json({ user: user || null });
});

router.post("/api/auth/login", async (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");

  if (!username || !password) {
    res.status(400).json({ error: "Введите логин и пароль" });
    return;
  }

  const row = await getUserByUsername(username);
  if (!row) {
    res.status(401).json({ error: "Неверный логин или пароль" });
    return;
  }

  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) {
    res.status(401).json({ error: "Неверный логин или пароль" });
    return;
  }

  const user = mapUserRow(row);
  req.session.user = {
    id: user.id,
    username: user.username,
    role: user.role,
    audience: user.audience,
  };

  res.json({ user });
});

router.post("/api/auth/register", async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");
    const passwordConfirm = String(req.body?.passwordConfirm || "");

    if (password !== passwordConfirm) {
      res.status(400).json({ error: "Пароли не совпадают" });
      return;
    }

    const audience = normalizeAudience(req.body?.audience);
    const user = await createUser({
      username,
      password,
      role: "user",
      audience,
      organizationName: req.body?.organizationName,
      city: req.body?.city,
      region: req.body?.region,
      contactPhone: req.body?.contactPhone,
      contactEmail: req.body?.contactEmail,
    });

    req.session.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      audience: user.audience,
    };

    res.status(201).json({ user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/api/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: "Не удалось выйти" });
      return;
    }
    res.clearCookie("foodsource.sid");
    res.json({ ok: true });
  });
});

export default router;
