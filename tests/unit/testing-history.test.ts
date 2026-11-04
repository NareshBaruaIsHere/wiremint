import { describe, expect, it } from "vitest";
import { createWiremint } from "../../src/core/engine.js";
import { createWiremintTestClient } from "../../src/testing/test-client.js";

describe("Test Client Request History", () => {
  it("tracks recorded requests in execution order", async () => {
    const app = createWiremint();
    app.get("/users", () => ({ status: 200, body: [] }));
    app.post("/users", () => ({ status: 201, body: { id: 1 } }));

    const client = createWiremintTestClient(app);
    await client.get("/users");
    await client.post("/users", { body: { name: "test" } });

    const history = client.history();
    expect(history).toHaveLength(2);
    expect(history[0]?.method).toBe("GET");
    expect(history[0]?.path).toBe("/users");
    expect(history[1]?.method).toBe("POST");
    expect(history[1]?.path).toBe("/users");

    expect(client.lastRequest()?.method).toBe("POST");
    expect(client.requestCount()).toBe(2);
  });

  it("filters history by method, path, status, and scenario", async () => {
    const app = createWiremint({
      scenarios: [{ id: "vip", name: "VIP Scenario" }],
    });
    app.get("/items", () => ({ status: 200, body: [] }));
    app.post("/items", () => ({ status: 201, body: {} }));
    app.get("/orders", () => ({ status: 404, body: { error: "none" } }));

    const client = createWiremintTestClient(app);
    await client.get("/items");
    await client.post("/items");
    await client.get("/orders");
    await client.get("/items", { scenario: "vip" });

    // Filter by method
    expect(client.findRequests({ method: "POST" })).toHaveLength(1);

    // Filter by status
    expect(client.findRequests({ status: 404 })).toHaveLength(1);

    // Filter by path
    expect(client.findRequests({ path: "/orders" })).toHaveLength(1);

    // Filter by scenario
    expect(client.findRequests({ scenario: "vip" })).toHaveLength(1);

    // Limit filter
    expect(client.findRequests({ limit: 2 })).toHaveLength(2);
  });

  it("clears history cleanly", async () => {
    const app = createWiremint();
    app.get("/test", () => ({ status: 200 }));

    const client = createWiremintTestClient(app);
    await client.get("/test");
    expect(client.history()).toHaveLength(1);

    client.clearHistory();
    expect(client.history()).toHaveLength(0);
    expect(client.lastRequest()).toBeUndefined();
  });

  it("preserves security redaction in recorded history", async () => {
    const app = createWiremint({
      inspector: {
        sensitiveKeys: ["api_secret"],
      },
    });
    app.post("/login", () => ({ status: 200, body: { token: "abc" } }));

    const client = createWiremintTestClient(app);
    await client.post("/login?api_secret=supersecret&public=1", {
      headers: { "x-api_secret": "my-secret-val" },
      body: { api_secret: "nested-secret", username: "alice" },
    });

    const last = client.lastRequest();
    expect(last?.url).toContain("api_secret=[REDACTED]");
    expect(last?.url).toContain("public=1");
    expect(last?.request.body).toEqual({
      api_secret: "[REDACTED]",
      username: "alice",
    });
  });
});

