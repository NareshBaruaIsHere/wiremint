import { describe, it, expect } from "vitest";
import { ScenarioManager } from "../../src/scenarios/scenario-manager.js";
import { ScenarioResolver } from "../../src/scenarios/scenario-resolver.js";
import type { IncomingMessage } from "node:http";

function mockReq(headers: Record<string, string | string[] | undefined> = {}): IncomingMessage {
  return { headers } as unknown as IncomingMessage;
}

describe("ScenarioResolver", () => {
  it("resolves to globally active scenario when no HTTP header/query is present", () => {
    const manager = new ScenarioManager();
    manager.register("active-scenario");
    manager.setScenario("active-scenario");

    const resolver = new ScenarioResolver(manager);
    const result = resolver.resolve(mockReq(), new URL("http://localhost/api/users"));

    expect(result.scenarioId).toBe("active-scenario");
    expect(result.source).toBe("global");
    expect(result.error).toBeUndefined();
  });

  it("resolves to default scenario when default is active", () => {
    const manager = new ScenarioManager();
    const resolver = new ScenarioResolver(manager);
    const result = resolver.resolve(mockReq(), new URL("http://localhost/api/users"));

    expect(result.scenarioId).toBe("default");
    expect(result.source).toBe("default");
  });

  it("resolves from HTTP header (case-insensitive)", () => {
    const manager = new ScenarioManager();
    manager.register("empty-state");

    const resolver = new ScenarioResolver(manager);
    const result = resolver.resolve(
      mockReq({ "x-wiremint-scenario": "empty-state" }),
      new URL("http://localhost/api/users"),
    );

    expect(result.scenarioId).toBe("empty-state");
    expect(result.source).toBe("header");
    // Global active scenario must NOT be mutated!
    expect(manager.getActiveId()).toBe("default");
  });

  it("resolves from query parameter", () => {
    const manager = new ScenarioManager();
    manager.register("server-outage");

    const resolver = new ScenarioResolver(manager);
    const result = resolver.resolve(
      mockReq(),
      new URL("http://localhost/api/users?__scenario=server-outage"),
    );

    expect(result.scenarioId).toBe("server-outage");
    expect(result.source).toBe("query");
    expect(manager.getActiveId()).toBe("default");
  });

  it("prioritizes HTTP header over query parameter", () => {
    const manager = new ScenarioManager();
    manager.register("header-scenario");
    manager.register("query-scenario");

    const resolver = new ScenarioResolver(manager);
    const result = resolver.resolve(
      mockReq({ "x-wiremint-scenario": "header-scenario" }),
      new URL("http://localhost/api/users?__scenario=query-scenario"),
    );

    expect(result.scenarioId).toBe("header-scenario");
    expect(result.source).toBe("header");
  });

  it("returns error for unknown scenario requested via header", () => {
    const manager = new ScenarioManager();
    const resolver = new ScenarioResolver(manager);
    const result = resolver.resolve(
      mockReq({ "x-wiremint-scenario": "phantom" }),
      new URL("http://localhost/api/users"),
    );

    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/unknown scenario "phantom"/i);
  });

  it("returns error for unknown scenario requested via query parameter", () => {
    const manager = new ScenarioManager();
    const resolver = new ScenarioResolver(manager);
    const result = resolver.resolve(
      mockReq(),
      new URL("http://localhost/api/users?__scenario=phantom"),
    );

    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/unknown scenario "phantom"/i);
  });

  it("ignores headers and query parameters when allowHttpSelection is false", () => {
    const manager = new ScenarioManager();
    manager.register("my-scenario");
    manager.setScenario("my-scenario");

    const resolver = new ScenarioResolver(manager, { allowHttpSelection: false });
    const result = resolver.resolve(
      mockReq({ "x-wiremint-scenario": "default" }),
      new URL("http://localhost/api/users?__scenario=default"),
    );

    // Uses global active scenario
    expect(result.scenarioId).toBe("my-scenario");
    expect(result.source).toBe("global");
  });

  it("supports custom headerName and queryParam", () => {
    const manager = new ScenarioManager();
    manager.register("custom-target");

    const resolver = new ScenarioResolver(manager, {
      headerName: "x-custom-mock",
      queryParam: "mock_state",
    });

    const resHeader = resolver.resolve(
      mockReq({ "x-custom-mock": "custom-target" }),
      new URL("http://localhost/api/users"),
    );
    expect(resHeader.scenarioId).toBe("custom-target");

    const resQuery = resolver.resolve(
      mockReq(),
      new URL("http://localhost/api/users?mock_state=custom-target"),
    );
    expect(resQuery.scenarioId).toBe("custom-target");
  });
});

