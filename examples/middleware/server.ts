import { createWiremint } from "../../src/index.js";

const app = createWiremint({ basePath: "/api" });

// 1. Global logging middleware — logs request timing and status code
app.use(async (ctx, next) => {
  const start = performance.now();
  console.log(`--> [${ctx.requestId}] ${ctx.method} ${ctx.path}`);

  // Custom response header set in middleware
  ctx.setHeader("x-powered-by", "Wiremint");

  // Yield control downstream (onion pattern)
  await next();

  const elapsed = (performance.now() - start).toFixed(2);
  console.log(`<-- [${ctx.requestId}] ${ctx.statusCode} (${elapsed}ms)`);
});

// 2. Path-scoped authentication middleware — guards `/admin/*` routes
app.use("/admin", async (ctx, next) => {
  const auth = ctx.getHeader("authorization");
  if (!auth || auth !== "Bearer admin-secret-token") {
    console.warn(`[Auth] Rejected unauthorized request to ${ctx.path}`);
    ctx.statusCode = 401;
    ctx.responseBody = { error: "Unauthorized access: invalid or missing Bearer token" };
    return; // Intentionally terminates the request without executing handler
  }
  await next();
});

// 3. Response envelope middleware on `/v1/*`
app.use("/v1", async (ctx, next) => {
  await next();
  // Wrap response body on the return leg of the onion
  ctx.responseBody = {
    status: ctx.statusCode,
    data: ctx.responseBody,
    meta: {
      requestId: ctx.requestId,
      scenario: ctx.scenario.name,
    },
  };
});

// Register routes
app.get("/users", () => ({
  status: 200,
  body: [
    { id: 1, name: "Naresh" },
    { id: 2, name: "Alex" },
  ],
}));

app.get("/admin/metrics", () => ({
  status: 200,
  body: { memoryUsage: "128MB", activeConnections: 3 },
}));

app.get("/v1/products", () => ({
  status: 200,
  body: [{ id: "p1", name: "Mechanical Keyboard" }],
}));

await app.listen({ port: 3004 });
console.log("Middleware Example running at http://127.0.0.1:3004/api");
console.log("Try:");
console.log("  curl http://127.0.0.1:3004/api/users");
console.log("  curl http://127.0.0.1:3004/api/admin/metrics");
console.log("  curl -H 'Authorization: Bearer admin-secret-token' http://127.0.0.1:3004/api/admin/metrics");
console.log("  curl http://127.0.0.1:3004/api/v1/products");

