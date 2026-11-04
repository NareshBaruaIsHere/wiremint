import { describe, it, expect } from "vitest";
import { adaptRouteHandler, isScenarioRouteConfig } from "../../src/scenarios/route-adapter.js";
import { SequenceManager } from "../../src/scenarios/sequence-manager.js";
import type { RequestContext } from "../../src/core/types.js";
import { StateStore } from "../../src/scenarios/state-store.js";

function mockContext(scenarioId = "default"): RequestContext {
  return {
    method: "GET",
    path: "/test",
    params: {},
    query: {},
    headers: {},
    body: undefined,
    signal: new AbortController().signal,
    scenario: {
      id: scenarioId,
      name: scenarioId,
      state: new StateStore(),
      reset: () => {},
    },
  };
}

describe("route-adapter", () => {
  it("identifies scenario config vs function handler", () => {
    expect(isScenarioRouteConfig(() => ({ status: 200 }))).toBe(false);
    expect(isScenarioRouteConfig({ default: () => ({ status: 200 }) })).toBe(true);
    expect(isScenarioRouteConfig({ sequence: [{ status: 200 }] })).toBe(true);
  });

  it("returns raw function handler directly without modification", async () => {
    const rawHandler = () => ({ status: 201, body: "created" });
    const seq = new SequenceManager();
    const adapted = adaptRouteHandler("GET", "/test", rawHandler, seq);

    expect(adapted).toBe(rawHandler);
    const res = await adapted(mockContext());
    expect(res).toEqual({ status: 201, body: "created" });
  });

  it("selects scenario-specific handler when matching active scenario", async () => {
    const seq = new SequenceManager();
    const adapted = adaptRouteHandler(
      "GET",
      "/users",
      {
        default: () => ({ status: 200, body: ["default-user"] }),
        scenarios: {
          "empty-state": () => ({ status: 200, body: [] }),
          "server-error": { status: 500, body: { error: "down" } },
        },
      },
      seq,
    );

    // Active: default
    const resDefault = await adapted(mockContext("default"));
    expect(resDefault.body).toEqual(["default-user"]);

    // Active: empty-state (function handler)
    const resEmpty = await adapted(mockContext("empty-state"));
    expect(resEmpty.body).toEqual([]);

    // Active: server-error (static MockResponse)
    const resError = await adapted(mockContext("server-error"));
    expect(resError.status).toBe(500);
    expect(resError.body).toEqual({ error: "down" });
  });

  it("falls back to default when active scenario has no override", async () => {
    const seq = new SequenceManager();
    const adapted = adaptRouteHandler(
      "GET",
      "/items",
      {
        default: { status: 200, body: ["item-1"] },
        scenarios: {
          "special-mode": { status: 200, body: ["special"] },
        },
      },
      seq,
    );

    const res = await adapted(mockContext("unconfigured-scenario"));
    expect(res.body).toEqual(["item-1"]);
  });

  it("executes standalone sequential responses", async () => {
    const seq = new SequenceManager();
    const adapted = adaptRouteHandler(
      "GET",
      "/status",
      {
        sequence: [
          { status: 503, body: { attempt: 1 } },
          { status: 200, body: { attempt: 2 } },
        ],
      },
      seq,
    );

    const ctx = mockContext("default");
    const r1 = await adapted(ctx);
    expect(r1.status).toBe(503);

    const r2 = await adapted(ctx);
    expect(r2.status).toBe(200);

    // Repeats last
    const r3 = await adapted(ctx);
    expect(r3.status).toBe(200);
  });
});

