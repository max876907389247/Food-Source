import { Router } from "express";
import routes from "./routes.js";
import routesAccount from "./routes-account.js";
import adminRoutes from "./adminRoutes.js";

/** Все API-маршруты в одном месте */
const api = Router();

api.use(routes);
api.use(routesAccount);
api.use(adminRoutes);

export default api;
