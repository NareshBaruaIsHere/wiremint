import { describe, it, expectTypeOf } from "vitest";
import {
  createWiremint,
  type HTTPMethod,
  type MockResponse,
  type RequestContext,
  type RouteHandler,
  type WiremintInstance,
  type WiremintOptions,
  type ServerOptions,
  type RouteDefinition,
  WiremintError,
  RouteError,
  ConfigurationError,
  ServerError,
  ScenarioError,
  type SimulationConfig,
  type LatencyConfig,
  type FailureConfig,
  type TimeoutConfig,
  type ConnectionConfig,
  type RouteOptions,
  type RouteSimulationConfig,
  type RandomGenerator,
  SimulationEngine,
  MathRandomGenerator,
  SequenceRandomGenerator,
  SeededRandomGenerator,
  type ScenarioState,
  type ScenarioMetadata,
  type ScenarioDefinition,
  type ScenarioContext,
  type ScenarioEngineOptions,
  type SequenceConfig,
  type ScenarioRouteConfig,
  type RouteHandlerOrConfig,
  StateStore,
  ScenarioRegistry,
  ScenarioManager,
  ScenarioResolver,
  SequenceManager,
} from "../../src/index.js";

describe("Type exports", () => {
  it("HTTPMethod is a union of string literals", () => {
    expectTypeOf<HTTPMethod>().toEqualTypeOf<
      "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS"
    >();
  });

  it("MockResponse has optional fields with generic body", () => {
    expectTypeOf<MockResponse<string>>().toMatchTypeOf<{
      status?: number;
      headers?: Record<string, string>;
      body?: string;
    }>();
  });

  it("RequestContext has required fields", () => {
    expectTypeOf<RequestContext>().toMatchTypeOf<{
      method: HTTPMethod;
      path: string;
      params: Record<string, string>;
      query: Record<string, string | string[]>;
      body: unknown;
      signal: AbortSignal;
    }>();
  });

  it("RouteHandler accepts context and returns MockResponse", () => {
    expectTypeOf<RouteHandler>().toMatchTypeOf<
      (ctx: RequestContext) => MockResponse | Promise<MockResponse>
    >();
  });

  it("RouteDefinition includes method, path, handler", () => {
    expectTypeOf<RouteDefinition>().toMatchTypeOf<{
      method: HTTPMethod;
      path: string;
      handler: RouteHandler;
    }>();
  });

  it("WiremintOptions includes basePath and maxBodySize", () => {
    expectTypeOf<WiremintOptions>().toMatchTypeOf<{
      basePath?: string;
      maxBodySize?: number;
    }>();
  });

  it("ServerOptions includes port and host", () => {
    expectTypeOf<ServerOptions>().toMatchTypeOf<{
      port: number;
      host?: string;
    }>();
  });

  it("createWiremint returns WiremintInstance", () => {
    expectTypeOf(createWiremint).returns.toMatchTypeOf<WiremintInstance>();
  });

  it("WiremintInstance has all route methods and lifecycle", () => {
    type Instance = WiremintInstance;
    expectTypeOf<Instance["get"]>().toBeFunction();
    expectTypeOf<Instance["post"]>().toBeFunction();
    expectTypeOf<Instance["put"]>().toBeFunction();
    expectTypeOf<Instance["patch"]>().toBeFunction();
    expectTypeOf<Instance["delete"]>().toBeFunction();
    expectTypeOf<Instance["options"]>().toBeFunction();
    expectTypeOf<Instance["routes"]>().toBeFunction();
    expectTypeOf<Instance["listen"]>().toBeFunction();
    expectTypeOf<Instance["close"]>().toBeFunction();
  });

  it("handler context is properly typed", () => {
    const app = createWiremint();
    // This should compile — handler receives typed context.
    app.get("/test", (ctx) => {
      expectTypeOf(ctx.params).toEqualTypeOf<Record<string, string>>();
      expectTypeOf(ctx.query).toEqualTypeOf<
        Record<string, string | string[]>
      >();
      expectTypeOf(ctx.body).toEqualTypeOf<unknown>();
      return { status: 200, body: "ok" };
    });
  });
});

describe("Error class hierarchy", () => {
  it("RouteError extends WiremintError", () => {
    const err = new RouteError("test");
    expectTypeOf(err).toMatchTypeOf<WiremintError>();
    expectTypeOf(err.code).toEqualTypeOf<string>();
  });

  it("ConfigurationError extends WiremintError", () => {
    const err = new ConfigurationError("test");
    expectTypeOf(err).toMatchTypeOf<WiremintError>();
  });

  it("ServerError extends WiremintError", () => {
    const err = new ServerError("test");
    expectTypeOf(err).toMatchTypeOf<WiremintError>();
  });
});

describe("Simulation Type exports", () => {
  it("SimulationConfig has optional features", () => {
    expectTypeOf<SimulationConfig>().toMatchTypeOf<{
      enabled?: boolean;
      latency?: LatencyConfig;
      failure?: FailureConfig;
      timeout?: TimeoutConfig;
      connection?: ConnectionConfig;
      random?: RandomGenerator;
    }>();
  });

  it("RouteOptions accepts simulation config", () => {
    expectTypeOf<RouteOptions>().toMatchTypeOf<{
      simulation?: RouteSimulationConfig;
    }>();
  });

  it("Route registration methods accept RouteOptions", () => {
    const app = createWiremint();
    app.get("/users", () => ({ status: 200 }), {
      simulation: {
        latency: { fixed: 500 },
        failure: { rate: 0.1 },
      },
    });
  });

  it("Random generators implement RandomGenerator interface", () => {
    expectTypeOf(new MathRandomGenerator()).toMatchTypeOf<RandomGenerator>();
    expectTypeOf(new SequenceRandomGenerator([0.5])).toMatchTypeOf<RandomGenerator>();
    expectTypeOf(new SeededRandomGenerator(42)).toMatchTypeOf<RandomGenerator>();
    expectTypeOf(new SimulationEngine()).toMatchTypeOf<SimulationEngine>();
  });
});

describe("Scenario Type exports", () => {
  it("ScenarioError extends WiremintError", () => {
    const err = new ScenarioError("test");
    expectTypeOf(err).toMatchTypeOf<WiremintError>();
    expectTypeOf(err.code).toEqualTypeOf<string>();
  });

  it("ScenarioState interface has state methods", () => {
    expectTypeOf<ScenarioState>().toMatchTypeOf<{
      get: <T = unknown>(key: string) => T | undefined;
      set: <T = unknown>(key: string, value: T) => void;
      has: (key: string) => boolean;
      delete: (key: string) => boolean;
      clear: () => void;
      snapshot: () => Record<string, unknown>;
    }>();
  });

  it("ScenarioContext interface has id, name, state, reset", () => {
    expectTypeOf<ScenarioContext>().toMatchTypeOf<{
      id: string;
      name: string;
      description?: string;
      state: ScenarioState;
      reset: () => void;
    }>();
  });

  it("WiremintInstance exposes scenario methods", () => {
    type Instance = WiremintInstance;
    expectTypeOf<Instance["scenario"]>().toBeFunction();
    expectTypeOf<Instance["setScenario"]>().toBeFunction();
    expectTypeOf<Instance["getScenario"]>().toBeFunction();
    expectTypeOf<Instance["listScenarios"]>().toBeFunction();
    expectTypeOf<Instance["resetScenario"]>().toBeFunction();
    expectTypeOf<Instance["clearScenario"]>().toBeFunction();
  });

  it("Route registration accepts ScenarioRouteConfig", () => {
    const app = createWiremint();
    app.get("/items", {
      default: () => ({ status: 200, body: ["item"] }),
      scenarios: {
        "empty-state": () => ({ status: 200, body: [] }),
      },
      sequence: [{ status: 200, body: "seq" }],
    });
  });
});

