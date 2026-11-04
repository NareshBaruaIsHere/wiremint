import { describe, expect, it } from "vitest";
import { createWiremint } from "../../src/core/engine.js";
import { createWiremintTestClient } from "../../src/testing/test-client.js";

describe("Test Client Lifecycle Management", () => {
  it("resets state, counters, history, and simulation on client.reset()", async () => {
    const app = createWiremint({
      scenarios: [{ id: "temp", name: "Temporary" }],
    });
    app.get("/test", () => ({ status: 200 }));

    const client = createWiremintTestClient(app);
    await client.get("/test");
    client.setScenario("temp");
    client.setSimulation({ failure: { rate: 1.0, statusCode: 500 } });

    expect(client.history()).toHaveLength(1);
    expect(client.getScenario().id).toBe("temp");

    client.reset();

    expect(client.history()).toHaveLength(0);
    expect(client.getScenario().id).toBe("default");

    // Simulation is restored to baseline (no failure)
    const res = await client.get("/test");
    expect(res.status).toBe(200);
  });

  it("close() is idempotent and prevents subsequent requests", async () => {
    const app = createWiremint();
    app.get("/data", () => ({ status: 200 }));

    const client = createWiremintTestClient(app);
    await client.get("/data");

    await client.close();
    await client.close(); // Idempotent repeated call

    await expect(client.get("/data")).rejects.toThrow(/is closed/);
  });
});
