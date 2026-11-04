import { describe, it, expect } from "vitest";
import { MiddlewareManager } from "../../src/middleware/middleware-manager.js";

describe("MiddlewareManager", () => {
  it("registers and matches global middleware across all paths", () => {
    const manager = new MiddlewareManager();
    const globalMw1 = async () => {};
    const globalMw2 = async () => {};

    manager.use(globalMw1);
    manager.use(globalMw2);

    expect(manager.size).toBe(2);
    expect(manager.getMatching("/users")).toEqual([globalMw1, globalMw2]);
    expect(manager.getMatching("/api/items")).toEqual([globalMw1, globalMw2]);
    expect(manager.getMatching("/")).toEqual([globalMw1, globalMw2]);
  });

  it("registers and matches path-scoped middleware accurately", () => {
    const manager = new MiddlewareManager();
    const globalMw = async () => {};
    const apiMw = async () => {};
    const usersMw = async () => {};

    manager.use(globalMw);
    manager.use("/api", apiMw);
    manager.use("/api/users", usersMw);

    // Root path only matches global
    expect(manager.getMatching("/")).toEqual([globalMw]);

    // /api matches global and apiMw
    expect(manager.getMatching("/api")).toEqual([globalMw, apiMw]);

    // /api/products matches global and apiMw
    expect(manager.getMatching("/api/products")).toEqual([globalMw, apiMw]);

    // /api/users matches all three
    expect(manager.getMatching("/api/users")).toEqual([globalMw, apiMw, usersMw]);

    // Prefix collision safety: /api-other should NOT match /api
    expect(manager.getMatching("/api-other")).toEqual([globalMw]);
  });

  it("throws TypeError on invalid registration arguments", () => {
    const manager = new MiddlewareManager();
    expect(() => manager.use("not-a-function" as any)).toThrow(TypeError);
    expect(() => manager.use("/api", "not-a-function" as any)).toThrow(TypeError);
  });
});

