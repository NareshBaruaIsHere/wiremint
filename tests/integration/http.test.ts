import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createWiremint, type WiremintInstance } from "../../src/index.js";

/**
 * Helper to make HTTP requests during tests.
 */
async function request(
  path: string,
  options: RequestInit = {},
): Promise<{ status: number; headers: Headers; body: unknown }> {
  const res = await fetch(`http://127.0.0.1:0${path}`.replace(":0", `:${port}`), options);
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

let app: WiremintInstance;
let port: number;

describe("HTTP integration", () => {
  beforeAll(async () => {
    // Use a random available port.
    port = 40_000 + Math.floor(Math.random() * 10_000);

    app = createWiremint({ basePath: "/api" });

    app.get("/users", () => ({
      status: 200,
      body: [
        { id: 1, name: "Naresh" },
        { id: 2, name: "Rahim" },
      ],
    }));

    app.post("/users", ({ body }) => ({
      status: 201,
      body: { created: true, data: body },
    }));

    app.get("/users/:id", ({ params }) => ({
      status: 200,
      body: { id: params.id, name: "Naresh" },
    }));

    app.get("/search", ({ query }) => ({
      status: 200,
      body: { query },
    }));

    app.get("/custom-headers", () => ({
      status: 200,
      headers: { "X-Custom": "wiremint" },
      body: { ok: true },
    }));

    app.get("/error-route", () => {
      throw new Error("Intentional handler error");
    });

    app.get("/status-route", () => ({
      status: 204,
    }));

    await app.listen({ port });
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET returns JSON array", async () => {
    const res = await request("/api/users");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: 1, name: "Naresh" },
      { id: 2, name: "Rahim" },
    ]);
  });

  it("POST receives JSON body", async () => {
    const res = await request("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New User" }),
    });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      created: true,
      data: { name: "New User" },
    });
  });

  it("dynamic route returns correct params", async () => {
    const res = await request("/api/users/42");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: "42", name: "Naresh" });
  });

  it("query parameters work", async () => {
    const res = await request("/api/search?q=hello&lang=en");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ query: { q: "hello", lang: "en" } });
  });

  it("repeated query parameters become arrays", async () => {
    const res = await request("/api/search?tag=a&tag=b");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ query: { tag: ["a", "b"] } });
  });

  it("custom response headers work", async () => {
    const res = await request("/api/custom-headers");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-custom")).toBe("wiremint");
  });

  it("returns correct status codes", async () => {
    const res = await request("/api/status-route");
    expect(res.status).toBe(204);
  });

  it("invalid JSON returns 400", async () => {
    const res = await request("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json{",
    });
    expect(res.status).toBe(400);
  });

  it("unknown endpoint returns 404", async () => {
    const res = await request("/api/nonexistent");
    expect(res.status).toBe(404);
  });

  it("path outside basePath returns 404", async () => {
    const res = await request("/other/path");
    expect(res.status).toBe(404);
  });

  it("handler exception returns controlled 500", async () => {
    const res = await request("/api/error-route");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
  });

  it("server closes correctly", async () => {
    const tempApp = createWiremint();
    const tempPort = port + 1;
    tempApp.get("/ping", () => ({ status: 200, body: "pong" }));

    await tempApp.listen({ port: tempPort });
    const res = await fetch(`http://127.0.0.1:${tempPort}/ping`);
    expect(res.status).toBe(200);

    await tempApp.close();

    // After close, connections should be refused.
    await expect(
      fetch(`http://127.0.0.1:${tempPort}/ping`),
    ).rejects.toThrow();
  });

  it("prevents double listen", async () => {
    await expect(app.listen({ port: port + 2 })).rejects.toThrow(
      /already listening/,
    );
  });

  it("OPTIONS without explicit route returns 204", async () => {
    const res = await request("/api/users", { method: "OPTIONS" });
    expect(res.status).toBe(204);
  });

  it("HEAD returns headers without body", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/users`, {
      method: "HEAD",
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json");

    const text = await res.text();
    expect(text).toBe("");
  });
});
