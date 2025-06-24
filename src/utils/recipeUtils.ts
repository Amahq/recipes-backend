export async function expandRecipeWithComponents(db, recipeId, seen = new Set()) {
  if (seen.has(recipeId)) {
    throw new Error(`Recursive reference detected for recipe ID ${recipeId}`);
  }
  seen.add(recipeId);

  const recipe = await db.prepare("SELECT * FROM recipes WHERE id = ?").bind(recipeId).first();
  if (!recipe) throw new Error(`Recipe ID ${recipeId} not found`);

  const { results: components } = await db.prepare(
    "SELECT * FROM recipe_components WHERE recipe_id = ?"
  ).bind(recipeId).all();

  const detailedComponents = [];
  for (const comp of components) {
    if (comp.component_type === "material") {
      const material = await db.prepare("SELECT * FROM materials WHERE id = ?").bind(comp.component_id).first();
      if (material) {
        detailedComponents.push({
          type: "material",
          id: material.id,
          name: material.name,
          unit: material.unit,
          quantity: comp.quantity,
		  row_id: comp.id
        });
      }
    } else if (comp.component_type === "recipe") {
      const subrecipe = await expandRecipeWithComponents(db, comp.component_id, new Set(seen));
      detailedComponents.push({
        type: "recipe",
        id: subrecipe.id,
        name: subrecipe.name,
        quantity: comp.quantity,
        yield: subrecipe.yield,
        procedure: subrecipe.procedure,
        image_url: subrecipe.image_url,
        components: subrecipe.components,
		row_id: comp.id
      });
    }
  }

  return {
    id: recipe.id,
    name: recipe.name,
    yield: recipe.yield,
    procedure: recipe.procedure,
    image_url: recipe.image_url,
    components: detailedComponents
  };
}

export async function calculateRecipeCost(db, recipeId, qty = 1) {
  const totals = {};

  async function expandRecipe(id, multiplier, seen = new Set()) {
    if (seen.has(id)) {
      throw new Error(`Recursive reference detected for recipe ID ${id}`);
    }
    seen.add(id);

    const recipe = await db.prepare("SELECT * FROM recipes WHERE id = ?").bind(id).first();
    if (!recipe) throw new Error(`Recipe ID ${id} not found`);

    const ratio = multiplier / recipe.yield;

    const { results: components } = await db.prepare(
      "SELECT * FROM recipe_components WHERE recipe_id = ?"
    ).bind(id).all();

    for (const comp of components) {
      if (comp.component_type === "material") {
        const material = await db.prepare("SELECT * FROM materials WHERE id = ?").bind(comp.component_id).first();
        if (!material) continue;

        if (!totals[material.id]) {
          totals[material.id] = {
            name: material.name,
            unit: material.unit,
            quantity: 0
          };
        }

        totals[material.id].quantity += comp.quantity * ratio;
      }

      if (comp.component_type === "recipe") {
        await expandRecipe(comp.component_id, comp.quantity * ratio, new Set(seen));
      }
    }
  }

  await expandRecipe(recipeId, qty);

  const materialList = Object.entries(totals).map(([id, data]) => ({ id: Number(id), ...data }));
  const result = [];
  let totalCost = 0;

  for (const item of materialList) {
    const priceRow = await db.prepare(
      "SELECT price FROM material_prices WHERE material_id = ? ORDER BY date DESC LIMIT 1"
    ).bind(item.id).first();

    const unit_price = priceRow?.price || 0;
    const cost = unit_price * item.quantity;
    totalCost += cost;

    result.push({
      name: item.name,
      unit: item.unit,
      quantity: item.quantity,
      unit_price,
      cost
    });
  }

  return {
    recipe_id: recipeId,
    quantity: qty,
    materials: result,
    total_cost: totalCost
  };
}