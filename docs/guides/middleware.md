# Middleware Pipeline

Wiremint features an onion-style asynchronous middleware pipeline, allowing request inspection, authorization checks, logging, and response body transformation.

## Registering Middleware

Register middleware globally or scoped to a specific route prefix:

```typescript
// Global middleware
app.use(async (ctx, next) => {
  ctx.setHeader("x-response-time", "12ms");
  await next();
});

// Path-scoped middleware
app.use("/api/admin", async (ctx, next) => {
  const auth = ctx.headers["authorization"];
  if (!auth || !auth.startsWith("Bearer admin-")) {
    ctx.statusCode = 401;
    ctx.responseBody = { error: "Admin token required" };
    return; // Short-circuit pipeline
  }
  await next();
});
```

## Modifying Response Headers & Bodies

Middleware can modify headers and bodies both before and after `next()`:

```typescript
app.use("/api", async (ctx, next) => {
  const start = performance.now();

  // Pass control down the pipeline
  await next();

  // Post-processing
  const duration = Math.round(performance.now() - start);
  ctx.setHeader("x-execution-time", `${duration}ms`);

  // Transform or wrap response body
  if (ctx.statusCode === 200 && typeof ctx.responseBody === "object") {
    ctx.responseBody = {
      data: ctx.responseBody,
      meta: { executionMs: duration },
    };
  }
});
```

## Short-Circuiting

To abort handler execution (e.g. for authentication failure or rate limiting), set `ctx.statusCode` and `ctx.responseBody` without calling `next()`:

```typescript
app.use("/api/v1", (ctx, next) => {
  if (ctx.headers["x-blocked"] === "true") {
    ctx.statusCode = 403;
    ctx.responseBody = { error: "Access blocked" };
    return;
  }
  return next();
});
```

