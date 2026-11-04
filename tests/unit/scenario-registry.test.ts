import { describe, it, expect } from "vitest";
import { ScenarioRegistry } from "../../src/scenarios/scenario-registry.js";
import { ScenarioError } from "../../src/core/errors.js";

describe("ScenarioRegistry", () => {
  it("initializes with default scenario", () => {
    const registry = new ScenarioRegistry("default");
    expect(registry.has("default")).toBe(true);

    const defaultScenario = registry.get("default");
    expect(defaultScenario).toBeDefined();
    expect(defaultScenario!.metadata.name).toBe("Default");
  });

  it("registers a scenario with valid id and metadata", () => {
    const registry = new ScenarioRegistry();
    const meta = registry.register("empty-state", {
      name: "Empty State",
      description: "No items available",
    });

    expect(meta.id).toBe("empty-state");
    expect(meta.name).toBe("Empty State");
    expect(meta.description).toBe("No items available");
    expect(registry.has("empty-state")).toBe(true);
  });

  it("defaults display name to id when not specified", () => {
    const registry = new ScenarioRegistry();
    const meta = registry.register("payment-failed");
    expect(meta.name).toBe("payment-failed");
  });

  it("rejects empty or whitespace scenario IDs", () => {
    const registry = new ScenarioRegistry();
    expect(() => registry.register("")).toThrow(ScenarioError);
    expect(() => registry.register("   ")).toThrow(ScenarioError);
    expect(() => registry.register(null as any)).toThrow(ScenarioError);
  });

  it("rejects invalid characters in scenario IDs", () => {
    const registry = new ScenarioRegistry();
    expect(() => registry.register("bad scenario/id")).toThrow(ScenarioError);
    expect(() => registry.register("bad?name=1")).toThrow(ScenarioError);
    expect(() => registry.register("bad#id")).toThrow(ScenarioError);
  });

  it("rejects duplicate scenario registrations", () => {
    const registry = new ScenarioRegistry();
    registry.register("server-outage");

    expect(() => registry.register("server-outage")).toThrow(ScenarioError);
    expect(() => registry.register("server-outage")).toThrow(/already registered/i);
  });

  it("preserves registration order when listing scenarios", () => {
    const registry = new ScenarioRegistry();
    registry.register("scenario-a");
    registry.register("scenario-b");
    registry.register("scenario-c");

    const list = registry.list();
    const ids = list.map((s) => s.id);
    expect(ids).toEqual(["default", "scenario-a", "scenario-b", "scenario-c"]);
  });

  it("associates scenario with StateStore and respects initial state", () => {
    const registry = new ScenarioRegistry();
    registry.register("with-data", {
      initialState: { counter: 10, items: ["apple"] },
    });

    const scenario = registry.get("with-data");
    expect(scenario).toBeDefined();
    expect(scenario!.stateStore.get("counter")).toBe(10);
    expect(scenario!.stateStore.get("items")).toEqual(["apple"]);

    // Modify state
    scenario!.stateStore.set("counter", 20);
    expect(scenario!.stateStore.get("counter")).toBe(20);

    // Reset restores initial state
    registry.reset("with-data");
    expect(scenario!.stateStore.get("counter")).toBe(10);
  });

  it("throws when resetting an unknown scenario", () => {
    const registry = new ScenarioRegistry();
    expect(() => registry.reset("nonexistent")).toThrow(ScenarioError);
  });
});

