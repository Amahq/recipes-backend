import { Hono } from "hono";

export const handlePriceRoutes = () => {
  const router = new Hono();

  router.post("/", async (c) => {
    const { material_id, price } = await c.req.json();

    if (!material_id || typeof price !== "number") {
      return c.json({ error: "Missing or invalid 'material_id' or 'price'" }, 400);
    }

    await c.env.DB.prepare(
      "INSERT INTO material_prices (material_id, price) VALUES (?, ?)"
    ).bind(material_id, price).run();

    return c.json({ success: true });
  });

  router.get("/", async (c) => {
    const { results } = await c.env.DB.prepare(
      "SELECT * FROM material_prices ORDER BY date DESC"
    ).all();
    return c.json(results);
  });

  router.get("/latest/:material_id", async (c) => {
    const material_id = c.req.param("material_id");

    const { results } = await c.env.DB.prepare(
      "SELECT * FROM material_prices WHERE material_id = ? ORDER BY date DESC LIMIT 1"
    ).bind(material_id).all();

    return c.json(results[0] || null);
  });

  return router;
};