import { Router } from "express";
import routes from "./routes.js";
import authRoutes from "./authRoutes.js";
import adminRoutes from "./adminRoutes.js";
import buyerDemandRoutes from "./buyerDemandRoutes.js";
import proposalRoutes from "./proposalRoutes.js";
import myAccountRoutes from "./myAccountRoutes.js";
import orderRoutes from "./orderRoutes.js";

/** Все API-маршруты в одном месте */
const api = Router();

api.use(routes);
api.use(authRoutes);
api.use(buyerDemandRoutes);
api.use(proposalRoutes);
api.use(myAccountRoutes);
api.use(orderRoutes);
api.use(adminRoutes);

export default api;
