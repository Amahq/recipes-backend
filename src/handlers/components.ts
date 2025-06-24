import { Hono } from "hono";

export const handleComponentRoutes = () => {
  const router = new Hono();

  // Agregar componente (material o sub-receta)
  router.post("/:id/components", async (c) => {
    const recipeId = Number(c.req.param("id"));
    const { component_type, component_id, quantity } = await c.req.json();

    if (!["material", "recipe"].includes(component_type)) {
      return c.json({ error: "component_type must be 'material' or 'recipe'" }, 400);
    }

    if (!component_id || typeof quantity !== "number") {
      return c.json({ error: "Missing component_id or quantity" }, 400);
    }

    const recipe = await c.env.DB.prepare("SELECT id FROM recipes WHERE id = ?").bind(recipeId).first();
    if (!recipe) return c.json({ error: "Recipe not found" }, 404);

    const table = component_type === "material" ? "materials" : "recipes";
    const comp = await c.env.DB.prepare(`SELECT id FROM ${table} WHERE id = ?`).bind(component_id).first();
    if (!comp) return c.json({ error: "Component not found" }, 404);

    await c.env.DB.prepare(`
      INSERT INTO recipe_components (recipe_id, component_type, component_id, quantity)
      VALUES (?, ?, ?, ?)
    `).bind(recipeId, component_type, component_id, quantity).run();

    return c.json({ success: true });
  });

  // Modificar un componente existente
  router.put("/:id/components/:componentId", async (c) => {
    const recipeId = Number(c.req.param("id"));
    const componentId = Number(c.req.param("componentId"));
    const { quantity } = await c.req.json();

    if (typeof quantity !== "number") {
      return c.json({ error: "Missing or invalid quantity" }, 400);
    }

    const result = await c.env.DB.prepare(`
      UPDATE recipe_components SET quantity = ? WHERE recipe_id = ? AND component_id = ?
    `).bind(quantity, recipeId, componentId).run();

    if (result.changes === 0) {
      return c.json({ error: "Component not found" }, 404);
    }

    return c.json({ success: true });
  });

  // Eliminar un componente de una receta
  router.delete("/:id/components/:componentId", async (c) => {
    const recipeId = Number(c.req.param("id"));
    const componentId = Number(c.req.param("componentId"));

    const result = await c.env.DB.prepare(`
      DELETE FROM recipe_components WHERE recipe_id = ? AND component_id = ?
    `).bind(recipeId, componentId).run();

    if (result.changes === 0) {
      return c.json({ error: "Component not found" }, 404);
    }

    return c.json({ success: true });
  });

  return router;
};
