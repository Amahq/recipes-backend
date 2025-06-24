import { Hono } from "hono";

export const handleMaterialRoutes = () => {
  const router = new Hono();

  router.get("/", async (c) => {
    console.log(">>> GET /api/materials");
    const { results } = await c.env.DB.prepare("SELECT * FROM materials").all();
    return c.json(results);
  });

  router.post("/", async (c) => {
    const { name, unit } = await c.req.json();
    const result = await c.env.DB.prepare("INSERT INTO materials (name, unit) VALUES (?, ?)").bind(name, unit).run();
    return c.json({ success: true, id: result.meta.last_row_id });
  });

  router.put("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const { name, unit } = await c.req.json();
    const result = await c.env.DB.prepare("UPDATE materials SET name = ?, unit = ? WHERE id = ?").bind(name, unit, id).run();
    return c.json({ success: result.success });
  });

  router.delete("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const result = await c.env.DB.prepare("DELETE FROM materials WHERE id = ?").bind(id).run();
    return c.json({ success: result.success });
  });

  return router;
};