import type { MiddlewareHandler } from "hono";

const allowedOrigins = [
  "https://chokoretov1.pages.dev",
  "https://chokoreto-testing.pages.dev",
  "https://*.chokoreto-testing.pages.dev",
];

export const withCors: MiddlewareHandler = async (c, next) => {
  const origin = c.req.header("Origin");

  if (origin && allowedOrigins.includes(origin)) {
    c.header("Access-Control-Allow-Origin", origin);
  }

  c.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

if (c.req.method === "OPTIONS") {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin && allowedOrigins.includes(origin) ? origin : "",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}


  await next();
};