import { describe, it, expect } from "vitest";
import { ScenarioManager } from "../../src/scenarios/scenario-manager.js";
import { ScenarioError } from "../../src/core/errors.js";

describe("ScenarioManager", () => {
  it("initializes with default scenario active", () => {
    const manager = new ScenarioManager();
    expect(manager.getActiveId()).toBe("default");
    expect(manager.getScenario().id).toBe("default");
    expect(manager.getScenario().name).toBe("Default");
  });

  it("supports custom default scenario in constructor options", () => {
    const manager = new ScenarioManager({ defaultScenario: "base" });
    expect(manager.getActiveId()).toBe("base");
    expect(manager.getDefaultId()).toBe("base");
    expect(manager.getScenario().id).toBe("base");
  });

  it("activates a registered scenario via setScenario()", () => {
    const manager = new ScenarioManager();
    manager.register("happy-path", { name: "Happy Path" });

    manager.setScenario("happy-path");
    expect(manager.getActiveId()).toBe("happy-path");
    expect(manager.getScenario().id).toBe("happy-path");
    expect(manager.getScenario().name).toBe("Happy Path");
  });

  it("throws ScenarioError when activating an unknown scenario", () => {
    const manager = new ScenarioManager();
    expect(() => manager.setScenario("unknown-id")).toThrow(ScenarioError);
    expect(() => manager.setScenario("unknown-id")).toThrow(/unknown scenario/i);
  });

  it("clearScenario() reverts back to default scenario", () => {
    const manager = new ScenarioManager();
    manager.register("temporary", { name: "Temporary" });

    manager.setScenario("temporary");
    expect(manager.getActiveId()).toBe("temporary");

    manager.clearScenario();
    expect(manager.getActiveId()).toBe("default");
  });

  it("resetScenario() resets state and sequence counters", () => {
    const manager = new ScenarioManager();
    manager.register("scenario-a", {
      initialState: { counter: 5 },
    });

    const store = manager.getStateStore("scenario-a");
    store.set("counter", 100);
    expect(store.get("counter")).toBe(100);

    // Reset specific scenario
    manager.resetScenario("scenario-a");
    expect(store.get("counter")).toBe(5);

    // Reset active scenario when id omitted
    manager.setScenario("scenario-a");
    store.set("counter", 200);
    manager.resetScenario();
    expect(store.get("counter")).toBe(5);
  });

  it("createContext() creates request-scoped context with working reset()", () => {
    const manager = new ScenarioManager();
    manager.register("cart-scenario", {
      name: "Cart Scenario",
      description: "Testing shopping cart",
      initialState: { items: [] },
    });

    const ctx = manager.createContext("cart-scenario");
    expect(ctx.id).toBe("cart-scenario");
    expect(ctx.name).toBe("Cart Scenario");
    expect(ctx.description).toBe("Testing shopping cart");

    ctx.state.set("items", ["book"]);
    expect(ctx.state.get("items")).toEqual(["book"]);

    ctx.reset();
    expect(ctx.state.get("items")).toEqual([]);
  });

  it("throws when creating context for unknown scenario", () => {
    const manager = new ScenarioManager();
    expect(() => manager.createContext("does-not-exist")).toThrow(ScenarioError);
  });
});

