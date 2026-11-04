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

describe("Scenario Engine & Stateful Mocking Integration", () => {
  beforeAll(async () => {
    port = 46_000 + Math.floor(Math.random() * 4_000);

    app = createWiremint({
      basePath: "/api",
    });

    // 1. Register application scenarios
    app.scenario("empty-state", {
      name: "Empty State",
      description: "No records available",
    });

    app.scenario("server-outage", {
      name: "Server Outage",
      description: "Upstream service failure",
    });

    app.scenario("authenticated", {
      name: "Authenticated",
      initialState: {
        cart: [{ id: "item-101", name: "Keyboard", price: 75 }],
      },
    });

    app.scenario("guest", {
      name: "Guest",
      initialState: {
        cart: [],
      },
    });

    // 2. Scenario-specific route definition
    app.get("/products", {
      default: () => ({
        status: 200,
        body: [
          { id: 1, name: "Laptop" },
          { id: 2, name: "Monitor" },
        ],
      }),
      scenarios: {
        "empty-state": () => ({
          status: 200,
          body: [],
        }),
        "server-outage": () => ({
          status: 503,
          body: { error: "Database cluster is unreachable" },
        }),
      },
    });

    // 3. Stateful cart endpoints
    app.get("/cart", ({ scenario }) => ({
      status: 200,
      body: scenario.state.get("cart") ?? [],
    }));

    app.post("/cart", ({ body, scenario }) => {
      const currentCart = scenario.state.get<any[]>("cart") ?? [];
      const updated = [...currentCart, body];
      scenario.state.set("cart", updated);
      return {
        status: 201,
        body: updated,
      };
    });

    // 4. Sequential response route
    app.get("/health-check", {
      sequence: [
        { status: 503, body: { status: "degraded", attempt: 1 } },
        { status: 200, body: { status: "healthy", attempt: 2 } },
      ],
      afterEnd: "repeat-last",
    });

    // 4b. Asynchronous sequential response route for concurrency verification
    app.get("/async-sequence", {
      sequence: [
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 40));
          return { status: 200, body: { step: 1, delay: 40 } };
        },
        async () => {
          return { status: 200, body: { step: 2, delay: 0 } };
        },
      ],
      afterEnd: "repeat-last",
    });

    // 5. Context inspection route
    app.get("/current-scenario", ({ scenario }) => ({
      status: 200,
      body: {
        id: scenario.id,
        name: scenario.name,
        description: scenario.description,
      },
    }));

    await app.listen({ port });
  });

  afterAll(async () => {
    await app.close();
  });

  describe("Scenario Registration & Listing", () => {
    it("lists all registered scenarios including default in registration order", () => {
      const scenarios = app.listScenarios();
      const ids = scenarios.map((s) => s.id);
      expect(ids).toEqual([
        "default",
        "empty-state",
        "server-outage",
        "authenticated",
        "guest",
      ]);
    });
  });

  describe("Global Scenario Switching", () => {
    it("returns default response when active scenario is default", async () => {
      const res = await request("/api/products");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([
        { id: 1, name: "Laptop" },
        { id: 2, name: "Monitor" },
      ]);
    });

    it("switches response dynamically when app.setScenario() is called", async () => {
      app.setScenario("empty-state");
      const resEmpty = await request("/api/products");
      expect(resEmpty.status).toBe(200);
      expect(resEmpty.body).toEqual([]);

      app.setScenario("server-outage");
      const resOutage = await request("/api/products");
      expect(resOutage.status).toBe(503);
      expect((resOutage.body as any).error).toBe("Database cluster is unreachable");

      // Revert back
      app.clearScenario();
      const resDefault = await request("/api/products");
      expect(resDefault.status).toBe(200);
      expect(resDefault.body).toHaveLength(2);
    });
  });

  describe("HTTP-based Scenario Selection", () => {
    it("activates scenario via x-wiremint-scenario header without mutating global scenario", async () => {
      expect(app.getScenario().id).toBe("default");

      const res = await request("/api/products", {
        headers: { "x-wiremint-scenario": "empty-state" },
      });
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);

      // Global scenario must remain untouched
      expect(app.getScenario().id).toBe("default");

      // Subsequent request without header gets default response
      const resNormal = await request("/api/products");
      expect(resNormal.body).toHaveLength(2);
    });

    it("activates scenario via __scenario query parameter", async () => {
      const res = await request("/api/products?__scenario=server-outage");
      expect(res.status).toBe(503);
      expect(app.getScenario().id).toBe("default");
    });

    it("prioritizes header selection over query parameter", async () => {
      const res = await request("/api/products?__scenario=server-outage", {
        headers: { "x-wiremint-scenario": "empty-state" },
      });
      // Header "empty-state" (200, []) takes precedence over query "server-outage" (503)
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("returns HTTP 400 when an unknown scenario is requested via header", async () => {
      const res = await request("/api/products", {
        headers: { "x-wiremint-scenario": "non-existent" },
      });
      expect(res.status).toBe(400);
      expect((res.body as any).error).toMatch(/unknown scenario "non-existent"/i);
    });
  });

  describe("Stateful Mock Storage", () => {
    it("maintains isolated state across requests within a scenario", async () => {
      // 1. Initial cart in authenticated scenario
      const res1 = await request("/api/cart", {
        headers: { "x-wiremint-scenario": "authenticated" },
      });
      expect(res1.body).toEqual([
        { id: "item-101", name: "Keyboard", price: 75 },
      ]);

      // 2. Add item to cart in authenticated scenario
      const res2 = await request("/api/cart", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wiremint-scenario": "authenticated",
        },
        body: JSON.stringify({ id: "item-102", name: "Mouse", price: 40 }),
      });
      expect(res2.status).toBe(201);
      expect(res2.body).toEqual([
        { id: "item-101", name: "Keyboard", price: 75 },
        { id: "item-102", name: "Mouse", price: 40 },
      ]);

      // 3. Guest scenario state remains completely isolated (empty cart)
      const resGuest = await request("/api/cart", {
        headers: { "x-wiremint-scenario": "guest" },
      });
      expect(resGuest.body).toEqual([]);

      // 4. Authenticated scenario maintains updated cart
      const res3 = await request("/api/cart", {
        headers: { "x-wiremint-scenario": "authenticated" },
      });
      expect(res3.body).toHaveLength(2);

      // 5. Reset restores authenticated initial state
      app.resetScenario("authenticated");
      const resReset = await request("/api/cart", {
        headers: { "x-wiremint-scenario": "authenticated" },
      });
      expect(resReset.body).toEqual([
        { id: "item-101", name: "Keyboard", price: 75 },
      ]);
    });
  });

  describe("Sequential Responses", () => {
    it("serves responses in order and repeats the last response", async () => {
      // 1. First request -> 503
      const res1 = await request("/api/health-check");
      expect(res1.status).toBe(503);
      expect((res1.body as any).attempt).toBe(1);

      // 2. Second request -> 200
      const res2 = await request("/api/health-check");
      expect(res2.status).toBe(200);
      expect((res2.body as any).attempt).toBe(2);

      // 3. Third request -> repeats 200
      const res3 = await request("/api/health-check");
      expect(res3.status).toBe(200);
      expect((res3.body as any).attempt).toBe(2);

      // 4. Reset scenario resets the sequence counter
      app.resetScenario("default");

      // 5. Next request returns 503 again
      const resAfterReset = await request("/api/health-check");
      expect(resAfterReset.status).toBe(503);
      expect((resAfterReset.body as any).attempt).toBe(1);
    });

    it("preserves strict sequential ordering during concurrent asynchronous requests", async () => {
      // Fire request 1 and request 2 concurrently.
      // Handler 1 has an asynchronous 40ms delay; Handler 2 has 0ms delay.
      const [res1, res2] = await Promise.all([
        request("/api/async-sequence"),
        request("/api/async-sequence"),
      ]);

      expect(res1.status).toBe(200);
      expect((res1.body as any).step).toBe(1);

      expect(res2.status).toBe(200);
      expect((res2.body as any).step).toBe(2);
    });
  });

  describe("Context Inspection", () => {
    it("exposes active scenario id, name, and description in context", async () => {
      const res = await request("/api/current-scenario", {
        headers: { "x-wiremint-scenario": "empty-state" },
      });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: "empty-state",
        name: "Empty State",
        description: "No records available",
      });
    });
  });
});

