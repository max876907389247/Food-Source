export function requireAuth(req, res, next) {
  if (req.session?.user) return next();
  res.status(401).json({ error: "Требуется вход в систему" });
}

export function requireAdmin(req, res, next) {
  if (req.session?.user?.role === "admin") return next();
  res.status(403).json({ error: "Доступ только для администратора" });
}

export function requireSeller(req, res, next) {
  if (!req.session?.user) {
    res.status(401).json({ error: "Требуется вход в систему" });
    return;
  }
  if (req.session.user.audience !== "seller") {
    res.status(403).json({ error: "Доступ только для поставщиков" });
    return;
  }
  next();
}

export function requireBuyer(req, res, next) {
  if (!req.session?.user) {
    res.status(401).json({ error: "Требуется вход в систему" });
    return;
  }
  const audience = req.session.user.audience;
  if (audience !== "buyer" && req.session.user.role !== "admin") {
    res.status(403).json({ error: "Доступ только для покупателей" });
    return;
  }
  next();
}

export function sessionUser(req) {
  if (!req.session?.user) return null;
  const { id, username, role, audience } = req.session.user;
  return {
    id,
    username,
    role,
    audience: audience === "seller" ? "seller" : "buyer",
  };
}
