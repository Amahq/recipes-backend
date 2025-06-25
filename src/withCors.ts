import type { MiddlewareHandler } from "hono";

// Regex que permite subdominios y raíz de testing y producción
const dynamicAllowedRegex =
  /^https:\/\/([a-z0-9-]+\.)*chokoreto(?:-testing|v1)\.pages\.dev$/;

export const withCors: MiddlewareHandler = async (c, next) => {
  const origin = c.req.header("Origin");
    // 🔍 Log del origin recibido
  console.log("CORS Origin header:", origin);
  const isAllowed = origin && dynamicAllowedRegex.test(origin);

  if (isAllowed) {
    c.header("Access-Control-Allow-Origin", origin);
  }

  c.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (c.req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": isAllowed ? origin! : "",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  await next();
};
