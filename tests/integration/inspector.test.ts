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

describe("Request Inspector Integration", () => {
  beforeAll(async () => {
    port = 49_000 + Math.floor(Math.random() * 1_000);

    app = createWiremint({
      basePath: "/api",
      inspector: {
        enabled: true,
        maxEntries: 10,
        captureRequestBody: true,
        captureResponseBody: true,
        sensitiveKeys: ["api_secret", "credit_card"],
      },
    });

    app.scenario("special-mode", {
      name: "Special Mode",
      description: "Testing scenario tagging in inspector",
    });

    app.get("/users", () => ({
      status: 200,
      body: [{ id: 1, name: "Naresh" }],
    }));

    app.post("/login", ({ body }) => ({
      status: 200,
      body: { loggedIn: true, received: body },
    }));

    app.get("/error-endpoint", () => {
      throw new Error("Simulated backend crash");
    });

    app.get("/query-test", ({ query }) => ({
      status: 200,
      body: { receivedQuery: query },
    }));

    app.get("/sensitive-error", () => {
      throw new Error("Failed to connect with Bearer eyJhbGciOiJ... and api_key=secret-db-key");
    });

    await app.listen({ port });
  });

  afterAll(async () => {
    await app.close();
  });

  it("records successful requests with metadata, duration, and status code", async () => {
    app.inspect().clear();

    const res = await request("/api/users");
    expect(res.status).toBe(200);

    const history = app.inspect().getRequests();
    expect(history).toHaveLength(1);

    const record = history[0];
    expect(record.method).toBe("GET");
    expect(record.path).toBe("/users");
    expect(record.statusCode).toBe(200);
    expect(record.outcome).toBe("success");
    expect(typeof record.duration).toBe("number");
    expect(record.matchedRoute).toBe("/users");
    expect(record.response?.body).toEqual([{ id: 1, name: "Naresh" }]);
  });

  it("redacts sensitive headers and request body keys according to security rules", async () => {
    app.inspect().clear();

    await request("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer super-secret-token",
        "X-Api-Key": "my-api-key-999",
        "API_SECRET": "top-secret-val",
      },
      body: JSON.stringify({
        username: "naresh",
        password: "MySuperSecretPassword",
        credit_card: "4111-2222-3333-4444",
      }),
    });

    const requests = app.inspect().getRequests({ method: "POST" });
    expect(requests).toHaveLength(1);

    const record = requests[0];

    // Verify sensitive request headers are redacted
    expect(record.request.headers["authorization"]).toBe("[REDACTED]");
    expect(record.request.headers["x-api-key"]).toBe("[REDACTED]");
    expect(record.request.headers["api_secret"]).toBe("[REDACTED]");
    expect(record.request.headers["content-type"]).toBe("application/json");

    // Verify sensitive request body properties are redacted
    const body = record.request.body as any;
    expect(body.username).toBe("naresh");
    expect(body.password).toBe("[REDACTED]");
    expect(body.credit_card).toBe("[REDACTED]");
  });

  it("redacts sensitive query parameters in inspector records while preserving raw values for route handlers", async () => {
    app.inspect().clear();

    const res = await request(
      "/api/query-test?token=my-token-123&user_id=101&api_key=my-key-456&page=2",
    );
    expect(res.status).toBe(200);

    // 1. The route handler received raw query parameters intact
    const responsePayload = res.body as any;
    expect(responsePayload.receivedQuery.token).toBe("my-token-123");
    expect(responsePayload.receivedQuery.api_key).toBe("my-key-456");
    expect(responsePayload.receivedQuery.user_id).toBe("101");
    expect(responsePayload.receivedQuery.page).toBe("2");

    // 2. The inspector record has sensitive values redacted
    const record = app.inspect().getRequests({ path: "/query-test" })[0];
    expect(record).toBeDefined();

    // Query object in record is redacted
    expect(record.query["token"]).toBe("[REDACTED]");
    expect(record.query["api_key"]).toBe("[REDACTED]");
    expect(record.query["user_id"]).toBe("101");
    expect(record.query["page"]).toBe("2");

    // Raw URL in record is redacted
    expect(record.url).toContain("token=[REDACTED]");
    expect(record.url).toContain("api_key=[REDACTED]");
    expect(record.url).toContain("user_id=101");
    expect(record.url).toContain("page=2");
    expect(record.url).not.toContain("my-token-123");
    expect(record.url).not.toContain("my-key-456");
  });

  it("sanitizes credentials from error messages recorded in inspector", async () => {
    app.inspect().clear();

    const res = await request("/api/sensitive-error");
    expect(res.status).toBe(500);

    const record = app.inspect().getRequests({ path: "/sensitive-error" })[0];
    expect(record).toBeDefined();
    expect(record.error?.message).toContain("Bearer [REDACTED]");
    expect(record.error?.message).toContain("api_key=[REDACTED]");
    expect(record.error?.message).not.toContain("eyJhbGciOiJ...");
    expect(record.error?.message).not.toContain("secret-db-key");
  });

  it("records 404, 400, and 500 error requests with appropriate error outcomes", async () => {
    app.inspect().clear();

    // 1. 404
    await request("/api/missing-page");

    // 2. 500
    await request("/api/error-endpoint");

    const failed = app.inspect().getRequests({ errorOnly: true });
    expect(failed).toHaveLength(2);

    const rec404 = app.inspect().getRequests({ statusCode: 404 })[0];
    expect(rec404.outcome).toBe("error");
    expect(rec404.path).toBe("/missing-page");

    const rec500 = app.inspect().getRequests({ statusCode: 500 })[0];
    expect(rec500.outcome).toBe("error");
    expect(rec500.error?.message).toMatch(/simulated backend crash/i);
  });

  it("records active scenario ID associated with the request", async () => {
    app.inspect().clear();

    await request("/api/users", {
      headers: { "x-wiremint-scenario": "special-mode" },
    });

    const records = app.inspect().getRequests({ scenarioId: "special-mode" });
    expect(records).toHaveLength(1);
    expect(records[0].scenarioId).toBe("special-mode");
  });

  it("computes accurate inspector statistics", async () => {
    app.inspect().clear();

    await request("/api/users"); // 200
    await request("/api/users"); // 200
    await request("/api/missing"); // 404
    await request("/api/error-endpoint"); // 500

    const stats = app.inspect().stats();
    expect(stats.totalRequests).toBe(4);
    expect(stats.successfulRequests).toBe(2);
    expect(stats.failedRequests).toBe(2);
    expect(stats.statusCodes[200]).toBe(2);
    expect(stats.statusCodes[404]).toBe(1);
    expect(stats.statusCodes[500]).toBe(1);
    expect(stats.methods["GET"]).toBe(4);
    expect(stats.averageDuration).toBeGreaterThanOrEqual(0);
  });

  it("bounds memory storage to maxEntries (evicting oldest records)", async () => {
    app.inspect().clear();

    // Capacity is configured as 10
    for (let i = 1; i <= 15; i++) {
      await request(`/api/users?index=${i}`);
    }

    const history = app.inspect().getRequests({ order: "oldest-first" });
    expect(history).toHaveLength(10);

    // Oldest 5 (index 1..5) should have been evicted; remaining are index 6..15
    expect(history[0].url).toContain("index=6");
    expect(history[9].url).toContain("index=15");
  });
});

