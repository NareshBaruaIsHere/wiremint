import { describe, expect, it } from "vitest";
import { createWiremint } from "../../src/core/engine.js";
import { createWiremintTestClient } from "../../src/testing/test-client.js";

describe("Test Client Scenario Integration", () => {
  it("switches and inspects active scenarios", async () => {
    const app = createWiremint({
      scenarios: [
        { id: "maintenance", name: "Maintenance Mode", description: "API is down" },
      ],
    });

    app.get("/status", {
      default: () => ({ status: 200, body: { status: "ok" } }),
      scenarios: {
        maintenance: () => ({ status: 503, body: { status: "down" } }),
      },
    });

    const client = createWiremintTestClient(app);

    // Initial default
    const res1 = await client.get("/status");
    expect(res1.status).toBe(200);

    // Switch scenario
    client.setScenario("maintenance");
    expect(client.getScenario().id).toBe("maintenance");

    const res2 = await client.get("/status");
    expect(res2.status).toBe(503);

    // Clear scenario
    client.clearScenario();
    expect(client.getScenario().id).toBe("default");

    const res3 = await client.get("/status");
    expect(res3.status).toBe(200);
  });

  it("supports per-request scenario selection without mutating global scenario", async () => {
    const app = createWiremint({
      scenarios: [{ id: "special", name: "Special Response" }],
    });

    app.get("/info", {
      default: () => ({ status: 200, body: { mode: "normal" } }),
      scenarios: {
        special: () => ({ status: 200, body: { mode: "special" } }),
      },
    });

    const client = createWiremintTestClient(app);

    const normalRes = await client.get("/info");
    expect(normalRes.body).toEqual({ mode: "normal" });

    // Per-request override
    const specialRes = await client.get("/info", { scenario: "special" });
    expect(specialRes.body).toEqual({ mode: "special" });

    // Global active scenario remained "default"
    expect(client.getScenario().id).toBe("default");
    const afterRes = await client.get("/info");
    expect(afterRes.body).toEqual({ mode: "normal" });
  });

  it("resets sequential responses on resetScenario()", async () => {
    const app = createWiremint();
    app.get("/seq", {
      sequence: [
        { status: 200, body: { step: 1 } },
        { status: 200, body: { step: 2 } },
      ],
      afterEnd: "repeat-last",
    });

    const client = createWiremintTestClient(app);
    const r1 = await client.get("/seq");
    expect(r1.body).toEqual({ step: 1 });

    const r2 = await client.get("/seq");
    expect(r2.body).toEqual({ step: 2 });

    // Reset scenario counters
    client.resetScenario();

    const r3 = await client.get("/seq");
    expect(r3.body).toEqual({ step: 1 });
  });
});

