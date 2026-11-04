import { describe, it, expect } from "vitest";
import { StateStore } from "../../src/scenarios/state-store.js";
import { ScenarioError } from "../../src/core/errors.js";

describe("StateStore", () => {
  it("stores and retrieves primitive values", () => {
    const store = new StateStore();
    store.set("count", 42);
    store.set("name", "Naresh");
    store.set("isActive", true);

    expect(store.get("count")).toBe(42);
    expect(store.get("name")).toBe("Naresh");
    expect(store.get("isActive")).toBe(true);
    expect(store.has("count")).toBe(true);
    expect(store.has("missing")).toBe(false);
  });

  it("deletes entries", () => {
    const store = new StateStore();
    store.set("temp", 123);
    expect(store.delete("temp")).toBe(true);
    expect(store.delete("temp")).toBe(false);
    expect(store.has("temp")).toBe(false);
    expect(store.get("temp")).toBeUndefined();
  });

  it("clears all entries", () => {
    const store = new StateStore();
    store.set("a", 1);
    store.set("b", 2);
    store.clear();

    expect(store.has("a")).toBe(false);
    expect(store.has("b")).toBe(false);
    expect(store.snapshot()).toEqual({});
  });

  it("prevents external reference mutation on get() and set()", () => {
    const store = new StateStore();
    const originalArray = [{ id: 1 }];

    store.set("items", originalArray);
    // Mutate the original reference externally
    originalArray.push({ id: 2 });

    const fromStore = store.get<any[]>("items");
    expect(fromStore).toEqual([{ id: 1 }]);

    // Mutate the retrieved value
    fromStore!.push({ id: 3 });

    // Store value should remain untouched
    expect(store.get<any[]>("items")).toEqual([{ id: 1 }]);
  });

  it("snapshot() returns a deep cloned representation of state", () => {
    const store = new StateStore();
    store.set("user", { name: "Naresh", profile: { role: "admin" } });

    const snap = store.snapshot();
    expect(snap).toEqual({
      user: { name: "Naresh", profile: { role: "admin" } },
    });

    // Mutate snapshot
    (snap.user as any).name = "Hacked";
    expect((store.get("user") as any).name).toBe("Naresh");
  });

  it("initializes with initial state and restores it on reset()", () => {
    const store = new StateStore({
      cart: ["item-1"],
      balance: 100,
    });

    expect(store.get("cart")).toEqual(["item-1"]);
    expect(store.get("balance")).toBe(100);

    store.set("cart", ["item-1", "item-2"]);
    store.set("balance", 50);

    store.reset();

    expect(store.get("cart")).toEqual(["item-1"]);
    expect(store.get("balance")).toBe(100);
  });

  it("isolates distinct StateStore instances completely", () => {
    const storeA = new StateStore({ count: 1 });
    const storeB = new StateStore({ count: 1 });

    storeA.set("count", 99);
    expect(storeA.get("count")).toBe(99);
    expect(storeB.get("count")).toBe(1);
  });

  describe("Non-cloneable values error handling", () => {
    it("throws ScenarioError when attempting to store a function", () => {
      const store = new StateStore();
      expect(() => store.set("fn", () => {})).toThrow(ScenarioError);
      expect(() => store.set("fn", () => {})).toThrow(/cannot store function/i);
    });

    it("throws ScenarioError when attempting to store a Symbol", () => {
      const store = new StateStore();
      expect(() => store.set("sym", Symbol("test"))).toThrow(ScenarioError);
      expect(() => store.set("sym", Symbol("test"))).toThrow(/cannot store symbol/i);
    });

    it("throws ScenarioError when object contains non-cloneable nested function", () => {
      const store = new StateStore();
      expect(() => store.set("badObj", { compute: () => 42 })).toThrow(ScenarioError);
      expect(() => store.set("badObj", { compute: () => 42 })).toThrow(
        /cannot store non-cloneable/i,
      );
    });

    it("throws ScenarioError when initialState contains non-cloneable value", () => {
      expect(() => new StateStore({ bad: () => {} })).toThrow(ScenarioError);
    });
  });
});

