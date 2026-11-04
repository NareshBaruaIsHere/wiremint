import type { MockResponse, RequestContext, RouteHandler } from "../core/types.js";

/**
 * In-memory state store for a scenario.
 */
export interface ScenarioState {
  /** Retrieve a value by key. */
  get<T = unknown>(key: string): T | undefined;
  /** Set a value for key. */
  set<T = unknown>(key: string, value: T): void;
  /** Check if a key exists in state. */
  has(key: string): boolean;
  /** Delete a key from state. Returns true if key was present. */
  delete(key: string): boolean;
  /** Remove all keys from state. */
  clear(): void;
  /** Return an isolated snapshot of all state entries. */
  snapshot(): Record<string, unknown>;
}

/**
 * Public metadata describing a registered scenario.
 */
export interface ScenarioMetadata {
  /** Stable unique identifier (e.g. "happy-path", "server-outage"). */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Optional description explaining the mock scenario. */
  description?: string;
}

/**
 * Configuration supplied when defining a scenario via `app.scenario()`.
 */
export interface ScenarioDefinition {
  /** Human-readable display name. Defaults to capitalized ID. */
  name?: string;
  /** Description of what this scenario represents. */
  description?: string;
  /** Initial state populated when scenario is created or reset. */
  initialState?: Record<string, unknown>;
}

/**
 * Request-scoped scenario context accessible via `context.scenario`.
 */
export interface ScenarioContext {
  /** Active scenario ID. */
  id: string;
  /** Active scenario display name. */
  name: string;
  /** Active scenario description. */
  description?: string;
  /** Scenario-scoped isolated state store. */
  state: ScenarioState;
  /** Reset this scenario's state and sequence counters to initial values. */
  reset(): void;
}

/**
 * Options for configuring scenario resolution on the Wiremint app.
 */
export interface ScenarioEngineOptions {
  /**
   * The default scenario to use when no scenario is active or requested.
   * @default "default"
   */
  defaultScenario?: string;
  /**
   * Whether to allow HTTP request-based scenario selection via headers or query parameters.
   * @default true
   */
  allowHttpSelection?: boolean;
  /**
   * HTTP header name to check for scenario ID.
   * @default "x-wiremint-scenario"
   */
  headerName?: string;
  /**
   * Query parameter name to check for scenario ID.
   * @default "__scenario"
   */
  queryParam?: string;
}

/**
 * Sequence configuration for sequential responses.
 */
export interface SequenceConfig<T = unknown> {
  /** Ordered list of responses or handlers to serve sequentially. */
  sequence: (MockResponse<T> | RouteHandler<T>)[];
  /**
   * Behavior after the final response in the sequence is reached.
   * - "repeat-last": Repeat the last response (default)
   * - "cycle": Cycle back to the first response
   * @default "repeat-last"
   */
  afterEnd?: "repeat-last" | "cycle";
}

/**
 * Single scenario target which can be a handler, static response, or sequence.
 */
export type ScenarioTarget<T = unknown> =
  | RouteHandler<T>
  | MockResponse<T>
  | SequenceConfig<T>;

/**
 * Scenario-specific route definition object passed to `app.get()`, `app.post()`, etc.
 */
export interface ScenarioRouteConfig<T = unknown> {
  /** Default response or handler when no scenario matches or no scenario override is specified. */
  default?: RouteHandler<T> | MockResponse<T>;
  /** Map of scenario ID to scenario-specific response, handler, or sequence. */
  scenarios?: Record<string, ScenarioTarget<T>>;
  /** Sequential responses when route is used as a standalone sequence. */
  sequence?: (MockResponse<T> | RouteHandler<T>)[];
  /** Sequential behavior after reaching the end of the sequence. */
  afterEnd?: "repeat-last" | "cycle";
}

/**
 * Input accepted by route registration methods: either a standard handler or a ScenarioRouteConfig.
 */
export type RouteHandlerOrConfig<T = unknown> =
  | RouteHandler<T>
  | ScenarioRouteConfig<T>;

