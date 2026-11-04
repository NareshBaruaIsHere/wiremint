import { describe, expect, it } from "vitest";
import { createWiremint } from "../../src/core/engine.js";
import { createWiremintTestClient } from "../../src/testing/test-client.js";

describe("Test Client Simulation Controls", () => {
  it("allows disabling simulation completely using simulation: false", async () => {
    const app = createWiremint({
      simulation: {
        latency: { min: 100, max: 200 },
        failure: { rate: 1.0, statusCode: 500 },
      },
    });

    app.get("/fast", () => ({ status: 200, body: { fast: true } }));

    // Test client with simulation disabled
    const client = createWiremintTestClient(app, { simulation: false });
    const res = await client.get("/fast");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ fast: true });
    expect(res.duration).toBeLessThan(80); // Did not wait 100-200ms
  });

  it("allows injecting failure rate dynamically", async () => {
    const app = createWiremint();
    app.get("/endpoint", () => ({ status: 200, body: { ok: true } }));

    const client = createWiremintTestClient(app);

    // Initial call without failure
    const res1 = await client.get("/endpoint");
    expect(res1.status).toBe(200);

    // Override simulation with 100% failure rate
    client.setSimulation({
      failure: { rate: 1.0, statusCode: 503 },
    });

    const res2 = await client.get("/endpoint");
    expect(res2.status).toBe(503);

    // Revert simulation
    client.resetSimulation();
    const res3 = await client.get("/endpoint");
    expect(res3.status).toBe(200);
  });

  it("handles timeout simulation cleanly", async () => {
    const app = createWiremint();
    app.get("/slow-backend", async () => {
      await new Promise((r) => setTimeout(r, 200));
      return { status: 200, body: { ok: true } };
    });

    const client = createWiremintTestClient(app, {
      simulation: {
        timeout: { after: 30, statusCode: 504 },
      },
    });

    const res = await client.get("/slow-backend");
    expect(res.status).toBe(504);
  });
});
