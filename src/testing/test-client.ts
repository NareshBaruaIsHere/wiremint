import type { WiremintInstance } from "../core/engine.js";
import { createWiremint } from "../core/engine.js";
import { loadConfig } from "../config/config-resolver.js";
import type { SimulationConfig } from "../simulation/types.js";
import type {
  RequestFilterOptions,
  RequestRecord,
  ScenarioMetadata,
  TestClientOptions,
  TestRequestOptions,
  TestResponse,
} from "./types.js";
import { dispatchInProcessRequest } from "./in-process-runner.js";

/**
 * In-process test client for Wiremint applications.
 * Executes requests directly against the Wiremint pipeline without opening a network port.
 */
export class WiremintTestClient {
  readonly app: WiremintInstance;
  private readonly options: TestClientOptions;
  private readonly initialSimulation: SimulationConfig | undefined;
  private closed = false;

  constructor(app: WiremintInstance, options: TestClientOptions = {}) {
    this.app = app;
    this.options = options;
    this.initialSimulation = app.getSimulation();

    // Apply initial simulation override if specified in options
    if (options.simulation !== undefined) {
      app.setSimulation(options.simulation);
    }
  }

  /**
   * Send a generic in-process HTTP request.
   */
  async request(
    method: string,
    path: string,
    options: TestRequestOptions = {},
  ): Promise<TestResponse> {
    if (this.closed) {
      throw new Error("Cannot send request: WiremintTestClient is closed.");
    }

    const basePath = this.options.basePath ?? "";
    const effectivePath = basePath ? `${basePath.replace(/\/$/, "")}/${path.replace(/^\//, "")}` : path;

    // Merge defaultHeaders
    const headers = {
      ...(this.options.defaultHeaders as Record<string, string> | undefined),
      ...(options.headers as Record<string, string> | undefined),
    };

    const effectiveScenario = options.scenario ?? this.options.scenario;

    return dispatchInProcessRequest(this.app, method, effectivePath, {
      ...options,
      headers,
      scenario: effectiveScenario,
    });
  }

  /**
   * Send an in-process GET request.
   */
  get(path: string, options: TestRequestOptions = {}): Promise<TestResponse> {
    return this.request("GET", path, options);
  }

  /**
   * Send an in-process POST request.
   */
  post(path: string, options: TestRequestOptions = {}): Promise<TestResponse> {
    return this.request("POST", path, options);
  }

  /**
   * Send an in-process PUT request.
   */
  put(path: string, options: TestRequestOptions = {}): Promise<TestResponse> {
    return this.request("PUT", path, options);
  }

  /**
   * Send an in-process PATCH request.
   */
  patch(path: string, options: TestRequestOptions = {}): Promise<TestResponse> {
    return this.request("PATCH", path, options);
  }

  /**
   * Send an in-process DELETE request.
   */
  delete(path: string, options: TestRequestOptions = {}): Promise<TestResponse> {
    return this.request("DELETE", path, options);
  }

  /**
   * Send an in-process OPTIONS request.
   */
  optionsRoute(path: string, options: TestRequestOptions = {}): Promise<TestResponse> {
    return this.request("OPTIONS", path, options);
  }

  // --- Request History & Inspector Testing ---

  /**
   * Returns all requests recorded by the inspector in chronological order.
   */
  history(): RequestRecord[] {
    return this.app.inspect().getRequests({ order: "oldest-first" });
  }

  /**
   * Returns the most recent request recorded by the inspector.
   */
  lastRequest(): RequestRecord | undefined {
    const all = this.history();
    return all.length > 0 ? all[all.length - 1] : undefined;
  }

  /**
   * Clears recorded request history.
   */
  clearHistory(): void {
    this.app.inspect().clear();
  }

  /**
   * Finds requests matching filter criteria.
   */
  findRequests(filter: RequestFilterOptions = {}): RequestRecord[] {
    let requests = this.history();

    if (filter.method) {
      const m = filter.method.toUpperCase();
      requests = requests.filter((r) => r.method === m);
    }
    if (filter.path) {
      requests = requests.filter((r) => r.path.includes(filter.path!));
    }
    if (filter.status !== undefined) {
      requests = requests.filter((r) => r.statusCode === filter.status);
    }
    if (filter.scenario) {
      requests = requests.filter((r) => r.scenarioId === filter.scenario);
    }
    if (filter.limit !== undefined && filter.limit > 0) {
      requests = requests.slice(-filter.limit);
    }

    return requests;
  }

  /**
   * Returns the count of requests matching filter criteria.
   */
  requestCount(filter?: RequestFilterOptions): number {
    return this.findRequests(filter).length;
  }

  // --- Scenario Testing Utilities ---

  /**
   * Switch the active application scenario.
   */
  setScenario(id: string): void {
    this.app.setScenario(id);
  }

  /**
   * Get metadata describing the currently active scenario.
   */
  getScenario(): ScenarioMetadata {
    return this.app.getScenario();
  }

  /**
   * Reset in-memory state and sequential response counters for a scenario.
   */
  resetScenario(id?: string): void {
    this.app.resetScenario(id);
  }

  /**
   * List all registered application scenarios.
   */
  listScenarios(): ScenarioMetadata[] {
    return this.app.listScenarios();
  }

  /**
   * Clear the active scenario, reverting back to the default scenario.
   */
  clearScenario(): void {
    this.app.clearScenario();
  }

  // --- Network Simulation Controls ---

  /**
   * Overrides or disables simulation dynamically for this test client.
   * Pass `false` to disable simulation completely.
   * Pass `null` or `undefined` to revert to baseline settings.
   */
  setSimulation(config?: SimulationConfig | boolean | null): void {
    this.app.setSimulation(config);
  }

  /**
   * Reverts simulation settings back to the application's initial baseline.
   */
  resetSimulation(): void {
    this.app.setSimulation(this.initialSimulation);
  }

  // --- Lifecycle Management ---

  /**
   * Resets test client state: clears request history, resets scenario state,
   * and restores initial simulation settings.
   */
  reset(): void {
    this.clearHistory();
    this.clearScenario();
    this.resetSimulation();
  }

  /**
   * Idempotent test client cleanup.
   */
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.resetSimulation();
  }
}

/**
 * Creates an in-process Wiremint test client for an existing Wiremint instance.
 *
 * @example
 * ```ts
 * const app = createWiremint();
 * app.get("/users", () => ({ status: 200, body: [{ id: 1 }] }));
 *
 * const client = createWiremintTestClient(app);
 * const response = await client.get("/users");
 * ```
 */
export function createWiremintTestClient(
  app: WiremintInstance,
  options: TestClientOptions = {},
): WiremintTestClient {
  return new WiremintTestClient(app, options);
}

/**
 * Creates a test client by discovering or loading a Wiremint configuration from disk.
 */
createWiremintTestClient.fromConfig = async function fromConfig(
  pathOrOptions?: string,
  options: TestClientOptions = {},
): Promise<WiremintTestClient> {
  const resolved = await loadConfig(pathOrOptions ? { configFile: pathOrOptions } : {});
  const app = createWiremint(resolved);
  return new WiremintTestClient(app, options);
};
