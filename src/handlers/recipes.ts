import { Hono } from "hono";
import { expandRecipeWithComponents, calculateRecipeCost } from "../utils/recipeUtils";

export const handleRecipeRoutes = () => {
  const router = new Hono();
  const AUTH_TOKEN = "Bearer SECRET_TOKEN_123";

  // Crear receta
  router.post("/", async (c) => {
    const { name, procedure, yield: yieldQty, image_url } = await c.req.json();

    if (!name || typeof yieldQty !== "number") {
      return c.json({ error: "Missing name or yield" }, 400);
    }

    const { lastInsertRowId } = await c.env.DB
      .prepare("INSERT INTO recipes (name, procedure, yield, image_url) VALUES (?, ?, ?, ?)")
      .bind(name, procedure ?? "", yieldQty, image_url ?? null)
      .run();

    return c.json({ success: true, id: lastInsertRowId });
  });

   // Clonar receta con debugging
  router.post(":id/clone", async (c) => {
    const db = c.env.DB;
    const id = Number(c.req.param("id"));

    console.log("[clone] Cloning recipe ID:", id);

    const original = await db.prepare("SELECT * FROM recipes WHERE id = ?").bind(id).first();
    if (!original) return c.json({ error: "Original recipe not found" }, 404);

    const newName = original.name + " (Copy)";

    try {
      const cloneRecipeResult = await db.prepare(
        "INSERT INTO recipes (name, procedure, yield, image_url, scheduled_for_deletion) VALUES (?, ?, ?, ?, 1)"
      ).bind(newName, original.procedure, original.yield, original.image_url).run();
		console.log("[clone] Insert result object:", cloneRecipeResult); // Debe mostrar { lastInsertRowId: N }
      const newRecipeId = cloneRecipeResult.meta?.last_row_id;
		console.log("[clone] New recipe created with ID:", newRecipeId);

      const { results: components = [] } = await db.prepare(
        "SELECT component_type, component_id, quantity FROM recipe_components WHERE recipe_id = ?"
      ).bind(id).all();
      console.log("[clone] Found components to clone:", components);

      const insertStatements = components.map((comp) => {
        const { component_type, component_id, quantity } = comp;
        if (
          (component_type === "material" || component_type === "recipe") &&
          typeof component_id === "number" &&
          typeof quantity === "number"
        ) {
          return db.prepare(
            "INSERT INTO recipe_components (recipe_id, component_type, component_id, quantity) VALUES (?, ?, ?, ?)"
          ).bind(newRecipeId, component_type, component_id, quantity);
        } else {
          throw new Error("Invalid component data: " + JSON.stringify(comp));
        }
      });

      try {
	  if (insertStatements.length > 0) {
		const batchResult = await db.batch(insertStatements);
		console.log("[clone] Batch insert result:", batchResult);
	  } else {
		console.log("[clone] No components to clone — skipping batch insert.");
	  }

	  await db.prepare("UPDATE recipes SET scheduled_for_deletion = 0 WHERE id = ?").bind(newRecipeId).run();
	  console.log("[clone] Recipe marked as not scheduled for deletion");
	} catch (componentErr: any) {
	  console.log("[clone] Error cloning components:", componentErr.message);
	  throw new Error("Failed to clone components: " + componentErr.message);
	}

      return c.json({ success: true, id: newRecipeId });
    } catch (err: any) {
      console.log("[clone] General cloning error:", err.message);
      return c.json({ error: err.message });
    }
  });

  // Listar recetas
  router.get("/", async (c) => {
    const db = c.env.DB;
    const page = parseInt(c.req.query("page") || "1", 10);
    const limit = parseInt(c.req.query("limit") || "50", 10);
    const all = c.req.query("all")?.toLowerCase() === "false";

    try {
      let recipes;
      let totalCount = 0;

      if (all) {
        const { results } = await db.prepare("SELECT * FROM recipes").all();
        recipes = results;
        totalCount = recipes.length;
      } else {
        const offset = (page - 1) * limit;
        const { results } = await db.prepare("SELECT * FROM recipes LIMIT ? OFFSET ?").bind(limit, offset).all();
        recipes = results;

        const totalResult = await db.prepare("SELECT COUNT(*) as count FROM recipes").first();
        totalCount = totalResult?.count || 0;
        c.header("X-Total-Count", totalCount.toString());
      }

      const expanded = [];
      for (const recipe of recipes) {
        try {
          const data = await expandRecipeWithComponents(db, recipe.id);
          expanded.push(data);
        } catch (err: any) {
          expanded.push({ id: recipe.id, error: err.message });
        }
      }

      return c.json(expanded);
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  // Ver receta
  router.get(":id", async (c) => {
    const db = c.env.DB;
    const id = Number(c.req.param("id"));

    try {
      const data = await expandRecipeWithComponents(db, id);
      return c.json(data);
    } catch (err: any) {
      return c.json({ error: err.message }, 400);
    }
  });

  // Editar receta
  router.put(":id", async (c) => {
    const id = Number(c.req.param("id"));
    const { name, procedure, yield: yieldQty, image_url } = await c.req.json();

    const existing = await c.env.DB.prepare("SELECT * FROM recipes WHERE id = ?").bind(id).first();
    if (!existing) return c.json({ error: "Recipe not found" }, 404);

    await c.env.DB.prepare(
      "UPDATE recipes SET name = ?, procedure = ?, yield = ?, image_url = ? WHERE id = ?"
    ).bind(name ?? existing.name, procedure ?? existing.procedure, yieldQty ?? existing.yield, image_url ?? existing.image_url, id).run();

    return c.json({ success: true });
  });

  // Eliminar receta (requiere token)
  router.delete(":id", async (c) => {
    const db = c.env.DB;
    const id = Number(c.req.param("id"));
    const authHeader = c.req.header("Authorization");

    if (authHeader !== AUTH_TOKEN) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    try {
      await db.prepare("DELETE FROM recipe_components WHERE recipe_id = ?").bind(id).run();
      const result = await db.prepare("DELETE FROM recipes WHERE id = ?").bind(id).run();

      if (result.success && result.changes > 0) {
        return c.json({ success: true, message: `Recipe ${id} deleted.` });
      } else {
        return c.json({ error: "Recipe not found." }, 404);
      }
    } catch (err: any) {
      return c.json({ error: "Failed to delete recipe: " + err.message }, 500);
    }
  });

  // Purgar recetas marcadas (requiere token)
  router.post("/purge-deleted", async (c) => {
    const db = c.env.DB;
    const authHeader = c.req.header("Authorization");

    if (authHeader !== AUTH_TOKEN) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    try {
      const { results: recipesToDelete = [] } = await db.prepare(
        "SELECT id FROM recipes WHERE scheduled_for_deletion = 1"
      ).all();

      if (recipesToDelete.length === 0) {
        return c.json({ success: true, deleted: 0, message: "No recipes scheduled for deletion." });
      }

      const recipeIds = recipesToDelete.map(r => r.id);

      const deleteComponents = recipeIds.map(id =>
        db.prepare("DELETE FROM recipe_components WHERE recipe_id = ?").bind(id)
      );
      const deleteRecipes = recipeIds.map(id =>
        db.prepare("DELETE FROM recipes WHERE id = ?").bind(id)
      );

      await db.batch([...deleteComponents, ...deleteRecipes]);

      return c.json({
        success: true,
        deleted: recipeIds.length,
        message: `${recipeIds.length} recipes permanently deleted.`
      });
    } catch (err: any) {
      return c.json({ error: "Failed to purge recipes: " + err.message }, 500);
    }
  });

  // Calcular costo total
  router.get(":id/cost", async (c) => {
    const db = c.env.DB;
    const recipeId = Number(c.req.param("id"));
    const qty = parseFloat(c.req.query("qty") || "1");

    try {
      const result = await calculateRecipeCost(db, recipeId, qty);
      return c.json(result);
    } catch (err: any) {
      return c.json({ error: err.message }, 400);
    }
  });

  return router;
};
