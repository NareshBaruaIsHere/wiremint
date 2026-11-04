import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import {
  createWiremint,
  type WiremintInstance,
  SequenceRandomGenerator,
} from "../../src/index.js";

let app: WiremintInstance;
let port: number;
let sideEffectCounter = 0;
let timeoutSideEffectExecuted = false;

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

describe("Network Simulation Integration", () => {
  beforeAll(async () => {
    port = 45_000 + Math.floor(Math.random() * 5_000);

    app = createWiremint({
      basePath: "/api",
      simulation: {
        latency: { fixed: 70 },
      },
    });

    // Route 1: Inherits global latency (70ms)
    app.get("/default-latency", () => ({
      status: 200,
      body: { message: "default latency" },
    }));

    // Route 2: Overrides latency to fast (10ms)
    app.get(
      "/fast-latency",
      () => ({
        status: 200,
        body: { message: "fast" },
      }),
      {
        simulation: {
          latency: { fixed: 10 },
        },
      },
    );

    // Route 3: Disables latency entirely
    app.get(
      "/no-latency",
      () => ({
        status: 200,
        body: { message: "instant" },
      }),
      {
        simulation: {
          latency: false,
        },
      },
    );

    // Route 4: Failure injection with side-effect tracking
    app.get(
      "/failing",
      () => {
        sideEffectCounter++;
        return { status: 200, body: { ok: true } };
      },
      {
        simulation: {
          latency: false,
          failure: {
            rate: 1,
            statusCode: 503,
            body: { error: "Custom simulated failure" },
          },
        },
      },
    );

    // Route 5: Partial failure with deterministic random sequence (first fails, second succeeds)
    const toggleRng = new SequenceRandomGenerator([0.1, 0.9]);
    app.get(
      "/toggle-failure",
      () => ({
        status: 200,
        body: { success: true },
      }),
      {
        simulation: {
          latency: false,
          failure: { rate: 0.5 },
          random: toggleRng,
        },
      },
    );

    // Route 6: Timeout simulation — handler exceeds timeout
    app.get(
      "/slow-timeout",
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return { status: 200, body: { completed: true } };
      },
      {
        simulation: {
          latency: false,
          timeout: { after: 30 },
        },
      },
    );

    // Route 7: Timeout simulation — handler finishes before timeout
    app.get(
      "/fast-timeout",
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { status: 200, body: { completed: true } };
      },
      {
        simulation: {
          latency: false,
          timeout: { after: 200 },
        },
      },
    );

    // Route 8: Connection drop
    app.get(
      "/drop-connection",
      () => ({
        status: 200,
        body: { ok: true },
      }),
      {
        simulation: {
          latency: false,
          connection: { dropRate: 1 },
        },
      },
    );

    // Route 9: POST with body and latency (verifies latency is NOT prematurely aborted by req close)
    app.post(
      "/post-latency",
      ({ body }) => ({
        status: 200,
        body: { received: body },
      }),
      {
        simulation: {
          latency: { fixed: 70 },
        },
      },
    );

    // Route 10: Timeout side effect prevention
    app.post(
      "/timeout-side-effect",
      async ({ signal }) => {
        await new Promise((resolve) => setTimeout(resolve, 90));
        if (!signal.aborted) {
          timeoutSideEffectExecuted = true;
        }
        return { status: 200, body: { done: true } };
      },
      {
        simulation: {
          latency: false,
          timeout: { after: 30 },
        },
      },
    );

    // Route 11: Long latency route for testing client disconnect
    app.get(
      "/client-abort-test",
      () => ({ status: 200, body: "ok" }),
      {
        simulation: {
          latency: { fixed: 5000 },
        },
      },
    );

    await app.listen({ port });
  });

  afterAll(async () => {
    await app.close();
  });

  describe("Latency", () => {
    it("applies global fixed latency", async () => {
      const start = Date.now();
      const res = await request("/api/default-latency");
      const elapsed = Date.now() - start;

      expect(res.status).toBe(200);
      expect(elapsed).toBeGreaterThanOrEqual(60);
    });

    it("allows per-route latency override", async () => {
      const start = Date.now();
      const res = await request("/api/fast-latency");
      const elapsed = Date.now() - start;

      expect(res.status).toBe(200);
      // Fast latency (10ms) should complete well before the global 70ms
      expect(elapsed).toBeLessThan(60);
    });

    it("allows per-route disabling of latency", async () => {
      const start = Date.now();
      const res = await request("/api/no-latency");
      const elapsed = Date.now() - start;

      expect(res.status).toBe(200);
      expect(elapsed).toBeLessThan(50);
    });

    it("preserves latency simulation for POST requests with body (not cancelled by request close)", async () => {
      const start = Date.now();
      const res = await request("/api/post-latency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: "data-payload" }),
      });
      const elapsed = Date.now() - start;

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ received: { item: "data-payload" } });
      // Latency must NOT have been cancelled prematurely by req.on('close')
      expect(elapsed).toBeGreaterThanOrEqual(60);
    });

    it("cancels latency timer immediately when client disconnects before response", async () => {
      let abortedOnError = false;
      await new Promise<void>((resolve) => {
        const clientReq = http.request(
          `http://127.0.0.1:${port}/api/client-abort-test`,
        );
        clientReq.on("error", () => {
          abortedOnError = true;
          resolve();
        });
        clientReq.end();

        // Destroy socket after 20ms
        setTimeout(() => {
          clientReq.destroy();
        }, 20);
      });

      expect(abortedOnError).toBe(true);

      // Verify the server is still healthy and responsive
      const res = await request("/api/no-latency");
      expect(res.status).toBe(200);
    });
  });

  describe("Failure Injection", () => {
    it("returns simulated failure status and body without executing handler", async () => {
      const initialCounter = sideEffectCounter;
      const res = await request("/api/failing");

      expect(res.status).toBe(503);
      expect(res.body).toEqual({ error: "Custom simulated failure" });
      // Handler was NOT executed
      expect(sideEffectCounter).toBe(initialCounter);
    });

    it("handles partial failure rate deterministically", async () => {
      // First call (random = 0.1 < 0.5) fails
      const res1 = await request("/api/toggle-failure");
      expect(res1.status).toBe(500);

      // Second call (random = 0.9 >= 0.5) succeeds
      const res2 = await request("/api/toggle-failure");
      expect(res2.status).toBe(200);
      expect(res2.body).toEqual({ success: true });
    });
  });

  describe("Timeout Simulation", () => {
    it("returns HTTP 504 when handler exceeds timeout", async () => {
      const res = await request("/api/slow-timeout");
      expect(res.status).toBe(504);
      expect((res.body as any).error).toBe("Simulated gateway timeout");
      expect((res.body as any).simulated).toBe(true);
    });

    it("returns normal response when handler completes before timeout", async () => {
      const res = await request("/api/fast-timeout");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ completed: true });
    });

    it("aborts context.signal upon timeout to prevent unwanted handler side effects", async () => {
      const res = await request("/api/timeout-side-effect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transfer: 500 }),
      });

      expect(res.status).toBe(504);
      // Wait for the slow 90ms handler task to finish
      await new Promise((resolve) => setTimeout(resolve, 80));
      // Side effect must NOT have executed because signal.aborted was true
      expect(timeoutSideEffectExecuted).toBe(false);
    });
  });

  describe("Connection Drop Simulation", () => {
    it("abruptly destroys connection when connection drop is triggered", async () => {
      // Fetch will reject because the connection is closed abruptly without a complete HTTP response
      await expect(
        fetch(`http://127.0.0.1:${port}/api/drop-connection`),
      ).rejects.toThrow();
    });
  });

  describe("Global Failure with Route Override", () => {
    it("route can disable global failure using failure: false", async () => {
      const overridePort = port + 10;
      const overrideApp = createWiremint({
        basePath: "/api",
        simulation: {
          failure: { rate: 1, statusCode: 500 },
        },
      });

      // Normal route inherits 100% failure
      overrideApp.get("/failing", () => ({ status: 200, body: "ok" }));

      // Exempt route explicitly disables failure
      overrideApp.get(
        "/exempt",
        () => ({ status: 200, body: { exempt: true } }),
        {
          simulation: {
            failure: false,
          },
        },
      );

      await overrideApp.listen({ port: overridePort });

      const failRes = await fetch(`http://127.0.0.1:${overridePort}/api/failing`);
      expect(failRes.status).toBe(500);

      const exemptRes = await fetch(`http://127.0.0.1:${overridePort}/api/exempt`);
      expect(exemptRes.status).toBe(200);
      const data = await exemptRes.json();
      expect(data).toEqual({ exempt: true });

      await overrideApp.close();
    });
  });
});

