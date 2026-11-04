import { describe, expect, it } from "vitest";
import { createWiremint } from "../../src/core/engine.js";
import { createWiremintTestClient } from "../../src/testing/test-client.js";

describe("In-Process Test Client", () => {
  it("supports all standard HTTP methods without opening network ports", async () => {
    const app = createWiremint();

    app.get("/items", () => ({ status: 200, body: ["item1"] }));
    app.post("/items", ({ body }) => ({ status: 201, body: { created: true, body } }));
    app.put("/items/:id", ({ params, body }) => ({ status: 200, body: { id: params.id, body } }));
    app.patch("/items/:id", ({ params, body }) => ({ status: 200, body: { patched: params.id, body } }));
    app.delete("/items/:id", ({ params }) => ({ status: 204 }));
    app.options("/items", () => ({
      status: 200,
      headers: { Allow: "GET,POST,PUT,PATCH,DELETE,OPTIONS" },
    }));

    const client = createWiremintTestClient(app);

    // GET
    const getRes = await client.get("/items");
    expect(getRes.status).toBe(200);
    expect(getRes.ok).toBe(true);
    expect(getRes.body).toEqual(["item1"]);

    // POST
    const postRes = await client.post("/items", { body: { name: "NewItem" } });
    expect(postRes.status).toBe(201);
    expect(postRes.body).toEqual({ created: true, body: { name: "NewItem" } });

    // PUT
    const putRes = await client.put("/items/42", { body: { price: 100 } });
    expect(putRes.status).toBe(200);
    expect(putRes.body).toEqual({ id: "42", body: { price: 100 } });

    // PATCH
    const patchRes = await client.patch("/items/42", { body: { partial: true } });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body).toEqual({ patched: "42", body: { partial: true } });

    // DELETE
    const delRes = await client.delete("/items/42");
    expect(delRes.status).toBe(204);

    // OPTIONS
    const optRes = await client.optionsRoute("/items");
    expect(optRes.status).toBe(200);
    expect(optRes.headers["allow"]).toBe("GET,POST,PUT,PATCH,DELETE,OPTIONS");
  });

  it("merges query parameters from both URL string and options.query", async () => {
    const app = createWiremint();
    app.get("/search", ({ query }) => ({ status: 200, body: query }));

    const client = createWiremintTestClient(app);
    const res = await client.get("/search?filter=active&sort=asc", {
      query: { page: 2, limit: 10, tags: ["ts", "node"] },
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      filter: "active",
      sort: "asc",
      page: "2",
      limit: "10",
      tags: ["ts", "node"],
    });
  });

  it("merges client defaultHeaders with per-request headers", async () => {
    const app = createWiremint();
    app.get("/auth", ({ headers }) => ({
      status: 200,
      body: {
        apiKey: headers["x-api-key"],
        auth: headers["authorization"],
      },
    }));

    const client = createWiremintTestClient(app, {
      defaultHeaders: { "x-api-key": "default-key" },
    });

    const res = await client.get("/auth", {
      headers: { authorization: "Bearer token-123" },
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      apiKey: "default-key",
      auth: "Bearer token-123",
    });
  });

  it("handles string, Buffer, and JSON bodies", async () => {
    const app = createWiremint();
    app.post("/text", ({ body, headers }) => ({
      status: 200,
      body: { body, isText: typeof body === "string" || typeof body === "object" },
    }));

    const client = createWiremintTestClient(app);

    // String body
    const textRes = await client.post("/text", { body: "raw plain string" });
    expect(textRes.status).toBe(200);

    // Buffer body
    const bufRes = await client.post("/text", {
      body: Buffer.from(JSON.stringify({ buffer: true })),
      headers: { "content-type": "application/json" },
    });
    expect(bufRes.status).toBe(200);
    expect(bufRes.body).toEqual({ body: { buffer: true }, isText: true });
  });

  it("supports deterministic request ID override", async () => {
    const app = createWiremint();
    app.get("/id-check", ({ requestId }) => ({
      status: 200,
      body: { requestId },
    }));

    const client = createWiremintTestClient(app);
    const res = await client.get("/id-check", {
      requestId: "custom-deterministic-id-777",
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ requestId: "custom-deterministic-id-777" });
    expect(res.requestId).toBe("custom-deterministic-id-777");
  });

  it("returns 404 for unknown routes", async () => {
    const app = createWiremint();
    const client = createWiremintTestClient(app);

    const res = await client.get("/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.ok).toBe(false);
  });

  it("calculates execution duration and exposes json() accessor", async () => {
    const app = createWiremint();
    app.get("/data", () => ({ status: 200, body: { score: 99 } }));

    const client = createWiremintTestClient(app);
    const res = await client.get("/data");

    expect(res.duration).toBeGreaterThanOrEqual(0);
    expect(res.json<{ score: number }>().score).toBe(99);
    expect(res.text).toContain('"score":99');
  });
});
