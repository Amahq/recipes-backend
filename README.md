# 🧾 Chokoreto Backend - Infraestructura y Despliegue

Este archivo documenta la arquitectura de despliegue del backend de Chokoreto usando **Cloudflare Workers + D1** y **GitHub Actions**.

---

## 🌐 Estructura de entornos

| Entorno       | Branch Git       | Worker Name              | Base de datos         |
|---------------|------------------|---------------------------|------------------------|
| `development` | `development`    | `recipes-backend-dev`    | `recipes-db-dev`       |
| `production`  | `main`           | `recipes-backend-prod`   | `recipes-db-prod`      |

Cada entorno tiene su propia base D1 y se actualiza automáticamente vía GitHub Actions.

---

## 🚀 Despliegue automático por branch

### ✅ Workflows activos:

- `.github/workflows/deploy-dev.yml` → ejecutado al hacer push en `development`
- `.github/workflows/deploy-prod.yml` → ejecutado al hacer push en `main`

### 🔐 Requiere un secret llamado `CF_API_TOKEN` con permisos de Cloudflare Workers

---

## 🔧 Configuración de `wrangler.toml`

El archivo define 2 entornos con bindings D1 separados:

```toml
name = "recipes-backend"
main = "src/index.ts"
compatibility_date = "2025-06-24"

[[d1_databases]]
binding = "DB"
database_name = "recipes-db-dev"
database_id = "xxxxxxxx-dev"

[env.production]
name = "recipes-backend-prod"

[[env.production.d1_databases]]
binding = "DB"
database_name = "recipes-db-prod"
database_id = "xxxxxxxx-prod"
```

---

## 🛠 Inicializar la base de datos

Usá `schema.sql` para crear las tablas necesarias.

```bash
# Desarrollo
npx wrangler d1 execute recipes-db-dev --file schema.sql --remote

# Producción
npx wrangler d1 execute recipes-db-prod --file schema.sql --remote --env production
```

---

## ✅ Comandos útiles

- Ver listado de bases:
  ```bash
  npx wrangler d1 list
  ```

- Ejecutar comandos SQL:
  ```bash
  npx wrangler d1 execute recipes-db-dev --command "SELECT * FROM materials;" --remote
  ```

---

## 📦 Recomendado

- Usar `authFetch()` en frontend para rutas protegidas
- Mantener el archivo `schema.sql` siempre actualizado tras cambios

---

## 🧪 Para probar despliegue

```bash
git commit --allow-empty -m "test: trigger GitHub Actions"
git push origin development
```

O para producción:

```bash
git checkout main
git merge development
git push origin main
```

---