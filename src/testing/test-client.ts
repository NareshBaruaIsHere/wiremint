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
  private activeScenarioId: string | undefined;
  private clientSimulation: SimulationConfig | boolean | null | undefined;
  private readonly recordedRequestIds = new Set<string>();
  private closed = false;

  constructor(app: WiremintInstance, options: TestClientOptions = {}) {
    this.app = app;
    this.options = options;
    this.activeScenarioId = options.scenario;
    this.clientSimulation = options.simulation;
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
    const headers: Record<string, string | string[] | undefined> = {
      ...(this.options.defaultHeaders as Record<string, string> | undefined),
      ...(options.headers as Record<string, string> | undefined),
    };

    const effectiveScenario = options.scenario ?? this.activeScenarioId ?? this.options.scenario;
    const effectiveSimulation =
      options.simulation !== undefined ? options.simulation : this.clientSimulation;

    const response = await dispatchInProcessRequest(this.app, method, effectivePath, {
      ...options,
      headers,
      scenario: effectiveScenario,
      simulation: effectiveSimulation,
    });

    if (response.requestId) {
      this.recordedRequestIds.add(response.requestId);
    }

    return response;
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
   * Returns all requests recorded by this test client in chronological order.
   */
  history(): RequestRecord[] {
    const all = this.app.inspect().getRequests({ order: "oldest-first" });
    return all.filter((r) => this.recordedRequestIds.has(r.id));
  }

  /**
   * Returns the most recent request recorded by this test client.
   */
  lastRequest(): RequestRecord | undefined {
    const all = this.history();
    return all.length > 0 ? all[all.length - 1] : undefined;
  }

  /**
   * Clears recorded request history for this test client.
   */
  clearHistory(): void {
    this.app.inspect().deleteRequests(this.recordedRequestIds);
    this.recordedRequestIds.clear();
  }

  /**
   * Finds requests matching filter criteria recorded by this test client.
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
   * Switch the active application scenario for this test client.
   */
  setScenario(id: string): void {
    this.activeScenarioId = id;
  }

  /**
   * Get metadata describing the currently active scenario for this test client.
   */
  getScenario(): ScenarioMetadata {
    if (this.activeScenarioId) {
      const found = this.app.listScenarios().find((s) => s.id === this.activeScenarioId);
      if (found) return found;
      return { id: this.activeScenarioId, name: this.activeScenarioId, description: "" };
    }
    return this.app.getScenario();
  }

  /**
   * Reset in-memory state and sequential response counters for a scenario.
   * If `id` is omitted, resets the currently active scenario for this client.
   */
  resetScenario(id?: string): void {
    const target = id ?? this.activeScenarioId ?? this.app.getScenario().id;
    this.app.resetScenario(target);
  }

  /**
   * List all registered application scenarios.
   */
  listScenarios(): ScenarioMetadata[] {
    return this.app.listScenarios();
  }

  /**
   * Clear the client's active scenario, reverting back to the default scenario.
   */
  clearScenario(): void {
    this.activeScenarioId = undefined;
  }

  // --- Network Simulation Controls ---

  /**
   * Overrides or disables simulation dynamically for this test client.
   * Pass `false` to disable simulation completely.
   * Pass `null` or `undefined` to revert to baseline settings.
   */
  setSimulation(config?: SimulationConfig | boolean | null): void {
    this.clientSimulation = config;
  }

  /**
   * Reverts simulation settings back to the test client's initial options.
   */
  resetSimulation(): void {
    this.clientSimulation = this.options.simulation;
  }

  // --- Lifecycle Management ---

  /**
   * Resets test client state: clears request history, resets scenario state,
   * restores initial scenario selection, and restores initial simulation settings.
   */
  reset(): void {
    this.clearHistory();
    this.clearScenario();
    this.resetSimulation();
    this.app.resetAllScenarios();
  }

  /**
   * Idempotent test client cleanup.
   */
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.clearHistory();
    this.activeScenarioId = undefined;
    this.clientSimulation = undefined;
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
 * Creates a completely isolated Wiremint application and test client.
 */
createWiremintTestClient.isolated = function isolated(
  options: TestClientOptions = {},
): WiremintTestClient {
  const app = createWiremint();
  return new WiremintTestClient(app, options);
};

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
