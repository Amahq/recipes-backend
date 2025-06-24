-- ✅ Schema actualizado a partir de Cloudflare D1 (2025-06-25)
PRAGMA foreign_keys = ON;

CREATE TABLE materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  unit TEXT NOT NULL
);

CREATE TABLE material_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  material_id INTEGER NOT NULL,
  date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  price REAL NOT NULL,
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
);

CREATE TABLE recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  procedure TEXT,
  yield REAL NOT NULL,
  image_url TEXT,
  scheduled_for_deletion INTEGER DEFAULT 0
);

CREATE TABLE recipe_components (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id INTEGER NOT NULL,
  component_type TEXT NOT NULL CHECK(component_type IN ('material', 'recipe')),
  component_id INTEGER NOT NULL,
  quantity REAL NOT NULL,
  scheduled_for_deletion INTEGER DEFAULT 0,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);