import { Hono } from "hono";
import { withCors } from "./withCors";
import { handleMaterialRoutes } from "./handlers/materials";
import { handlePriceRoutes } from "./handlers/prices";
import { handleRecipeRoutes } from "./handlers/recipes";
import { handleComponentRoutes } from "./handlers/components";

export interface Env {
  DB: D1Database;
}

const app = new Hono<{ Bindings: Env }>();

// Middleware CORS
app.use("*", withCors);

// Rutas de la API
app.route("/api/recipes", handleRecipeRoutes());
app.route("/api/components", handleComponentRoutes());
app.route("/api/materials", handleMaterialRoutes());
app.route("/api/prices", handlePriceRoutes());

export default app;