import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createWiremint, type WiremintInstance } from "../../src/index.js";

let app: WiremintInstance;
let port: number;

async function request(
  path: string,
  options: RequestInit = {},
): Promise<{ status: number; headers: Headers; body: unknown }> {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, options);
  const text = await res.text();
  let body: unknown = text;
  if (text && res.headers.get("content-type")?.includes("application/json")) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: res.status, headers: res.headers, body };
}

describe("Middleware Pipeline Integration", () => {
  const executionTrace: string[] = [];

  beforeAll(async () => {
    port = 48_000 + Math.floor(Math.random() * 1_000);

    app = createWiremint({ basePath: "/api" });

    // 1. Global logging / tracing middleware (Onion demonstration)
    app.use(async (ctx, next) => {
      executionTrace.push(`Global:before:${ctx.method}:${ctx.path}`);
      ctx.setHeader("x-wiremint-trace", "traced");

      await next();

      executionTrace.push(`Global:after:${ctx.statusCode}`);
    });

    // 2. Path-scoped authentication middleware on "/admin"
    app.use("/admin", async (ctx, next) => {
      const authHeader = ctx.getHeader("authorization");
      if (!authHeader || authHeader !== "Bearer valid-token") {
        ctx.statusCode = 401;
        ctx.responseBody = { error: "Unauthorized access" };
        return; // Short-circuit: intentionally do not call next()
      }
      await next();
    });

    // 3. Response-wrapping middleware on "/wrapped"
    app.use("/wrapped", async (ctx, next) => {
      await next();
      ctx.responseBody = {
        success: ctx.statusCode === 200,
        payload: ctx.responseBody,
        timestamp: "mocked-time",
      };
    });

    // 4. Broken middleware route that terminates without next() or response
    app.use("/broken-hanging", async () => {
      // Intentionally does nothing
    });

    // 5. Throwing middleware
    app.use("/exploding", async () => {
      throw new Error("Middleware exploded intentionally");
    });

    // Register test routes
    app.get("/items", () => ({
      status: 200,
      body: [{ id: "item-1" }, { id: "item-2" }],
    }));

    app.get("/admin/dashboard", () => ({
      status: 200,
      body: { secretMetric: 42 },
    }));

    app.get("/wrapped/data", () => ({
      status: 200,
      body: { name: "Product X" },
    }));

    app.get("/broken-hanging/test", () => ({
      status: 200,
      body: { message: "Should not be reached" },
    }));

    app.get("/exploding/test", () => ({
      status: 200,
      body: { message: "Should not be reached" },
    }));

    await app.listen({ port });
  });

  afterAll(async () => {
    await app.close();
  });

  it("executes global middleware onion-style around route handlers and sets custom response headers", async () => {
    executionTrace.length = 0;

    const res = await request("/api/items");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-wiremint-trace")).toBe("traced");
    expect(res.body).toEqual([{ id: "item-1" }, { id: "item-2" }]);

    expect(executionTrace).toEqual([
      "Global:before:GET:/items",
      "Global:after:200",
    ]);
  });

  it("short-circuits request when path-scoped auth middleware rejects unauthorized requests", async () => {
    // 1. Unauthorized request
    const resUnauthorized = await request("/api/admin/dashboard");
    expect(resUnauthorized.status).toBe(401);
    expect(resUnauthorized.body).toEqual({ error: "Unauthorized access" });

    // 2. Authorized request
    const resAuthorized = await request("/api/admin/dashboard", {
      headers: { authorization: "Bearer valid-token" },
    });
    expect(resAuthorized.status).toBe(200);
    expect(resAuthorized.body).toEqual({ secretMetric: 42 });
  });

  it("allows middleware to transform response body on the return leg of the onion", async () => {
    const res = await request("/api/wrapped/data");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      payload: { name: "Product X" },
      timestamp: "mocked-time",
    });
  });

  it("returns controlled 500 when middleware terminates without calling next() or producing a response", async () => {
    const res = await request("/api/broken-hanging/test");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
  });

  it("returns controlled 500 when middleware throws an unhandled error", async () => {
    const res = await request("/api/exploding/test");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
  });

  it("runs middleware pipeline on 404 requests and captures status 404 in after-phase", async () => {
    executionTrace.length = 0;

    const res = await request("/api/non-existent-route");
    expect(res.status).toBe(404);
    expect(res.headers.get("x-wiremint-trace")).toBe("traced");

    expect(executionTrace).toEqual([
      "Global:before:GET:/non-existent-route",
      "Global:after:404",
    ]);
  });
});

