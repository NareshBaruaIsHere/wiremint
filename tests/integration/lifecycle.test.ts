import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createWiremint, type WiremintInstance } from "../../src/index.js";
import http from "node:http";

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

describe("Full Request Lifecycle Integration", () => {
  beforeAll(async () => {
    port = 51_000 + Math.floor(Math.random() * 1_000);

    app = createWiremint({
      basePath: "/api",
      inspector: { enabled: true, maxEntries: 50 },
    });

    // Logging middleware
    app.use(async (ctx, next) => {
      ctx.setHeader("x-req-id", ctx.requestId);
      await next();
    });

    // 1. Route with simulated timeout (50ms)
    app.get(
      "/slow-timeout",
      async ({ signal }) => {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return { status: 200, body: { completed: true } };
      },
      {
        simulation: {
          timeout: { after: 40 },
        },
      },
    );

    // 2. Route with simulated failure (100% rate, 503)
    app.get(
      "/simulated-failure",
      () => ({ status: 200, body: { normal: true } }),
      {
        simulation: {
          failure: { rate: 1.0, statusCode: 503, body: { error: "Downstream DB dead" } },
        },
      },
    );

    // 3. Route with simulated connection drop (100% rate)
    app.get(
      "/simulated-drop",
      () => ({ status: 200, body: { shouldNotArrive: true } }),
      {
        simulation: {
          connection: { dropRate: 1.0 },
        },
      },
    );

    // 4. Long running route for client abort testing
    app.get("/long-running", async ({ signal }) => {
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 500);
        signal.addEventListener("abort", () => clearTimeout(timer));
      });
      return { status: 200, body: { ok: true } };
    });

    await app.listen({ port });
  });

  afterAll(async () => {
    await app.close();
  });

  it("handles simulated timeouts accurately: emits 'timeout' event, returns 504, and records in inspector", async () => {
    const completeFn = vi.fn();
    const unsub = app.on("request:complete", completeFn);

    const res = await request("/api/slow-timeout");
    expect(res.status).toBe(504);

    expect(completeFn).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "timeout",
        statusCode: 504,
      }),
    );

    const record = app.inspect().getRequests({ path: "/slow-timeout" })[0];
    expect(record.outcome).toBe("timeout");
    expect(record.statusCode).toBe(504);
    expect(record.simulation?.timedOut).toBe(true);

    unsub();
  });

  it("handles simulated failure injection: returns 503 and records failure simulation metadata", async () => {
    const res = await request("/api/simulated-failure");
    expect(res.status).toBe(503);
    expect((res.body as any).error).toBe("Downstream DB dead");

    const record = app.inspect().getRequests({ path: "/simulated-failure" })[0];
    expect(record.outcome).toBe("error");
    expect(record.statusCode).toBe(503);
    expect(record.simulation?.failed).toBe(true);
  });

  it("handles simulated connection drop: closes socket and records 'connection-dropped' outcome", async () => {
    const completeFn = vi.fn();
    const unsub = app.on("request:complete", completeFn);

    // Fetch should fail with a connection / socket reset error
    await expect(request("/api/simulated-drop")).rejects.toThrow();

    expect(completeFn).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "connection-dropped",
      }),
    );

    const record = app.inspect().getRequests({ path: "/simulated-drop" })[0];
    expect(record.outcome).toBe("connection-dropped");
    expect(record.simulation?.connectionDropped).toBe(true);

    unsub();
  });

  it("handles client disconnect before response completion: aborts signal and records outcome 'aborted'", async () => {
    const completeFn = vi.fn();
    const unsub = app.on("request:complete", completeFn);

    await new Promise<void>((resolve) => {
      const clientReq = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: "/api/long-running",
          method: "GET",
        },
        () => {},
      );

      clientReq.on("error", () => {
        // Expected on abort
      });

      clientReq.end();

      // Intentionally destroy request socket after 40ms before server finishes (500ms)
      setTimeout(() => {
        clientReq.destroy();
        setTimeout(resolve, 80);
      }, 40);
    });

    expect(completeFn).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "aborted",
      }),
    );

    const record = app.inspect().getRequests({ path: "/long-running" })[0];
    expect(record).toBeDefined();
    expect(record.outcome).toBe("aborted");

    unsub();
  });
});

