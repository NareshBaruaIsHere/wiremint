import type { RandomGenerator } from "./random.js";

/**
 * Latency simulation configuration options.
 */
export interface LatencyConfig {
  /** Explicit enable/disable toggle. */
  enabled?: boolean;
  /** Fixed delay in milliseconds. */
  fixed?: number;
  /** Minimum random delay in milliseconds. */
  min?: number;
  /** Maximum random delay in milliseconds. */
  max?: number;
  /**
   * Additional jitter in milliseconds applied to the calculated delay (+/- jitter range).
   * The resulting delay is always clamped to >= 0 ms.
   */
  jitter?: number;
}

/**
 * HTTP failure injection configuration.
 */
export interface FailureConfig {
  /** Explicit enable/disable toggle. */
  enabled?: boolean;
  /** Probability of failure between 0 and 1 inclusive. */
  rate: number;
  /**
   * HTTP status code to return when failure is triggered.
   * @default 500
   */
  statusCode?: number;
  /** Custom response headers when failure is triggered. */
  headers?: Record<string, string>;
  /** Custom response body when failure is triggered. */
  body?: unknown;
}

/**
 * Request timeout simulation configuration.
 */
export interface TimeoutConfig {
  /** Explicit enable/disable toggle. */
  enabled?: boolean;
  /**
   * Milliseconds after which a request will time out. Must be > 0.
   */
  after: number;
  /**
   * HTTP status code returned on timeout.
   * @default 504
   */
  statusCode?: number;
  /** Custom response headers returned on timeout. */
  headers?: Record<string, string>;
  /** Custom response body returned on timeout. */
  body?: unknown;
}

/**
 * Connection interruption configuration.
 */
export interface ConnectionConfig {
  /** Explicit enable/disable toggle. */
  enabled?: boolean;
  /** Probability of dropping the connection between 0 and 1 inclusive. */
  dropRate: number;
}

/**
 * Top-level simulation configuration.
 */
export interface SimulationConfig {
  /** Global enable/disable flag for simulation. Defaults to true when configured. */
  enabled?: boolean;
  /** Latency simulation. */
  latency?: LatencyConfig;
  /** Failure injection simulation. */
  failure?: FailureConfig;
  /** Request timeout simulation. */
  timeout?: TimeoutConfig;
  /** Connection drop simulation. */
  connection?: ConnectionConfig;
  /** Custom random generator for deterministic testing. */
  random?: RandomGenerator;
}

/**
 * Route-level simulation configuration.
 * Allows disabling features individually (via `false` or `{ enabled: false }`) or overriding settings.
 */
export type RouteSimulationConfig =
  | boolean
  | {
      enabled?: boolean;
      latency?: LatencyConfig | false;
      failure?: FailureConfig | false;
      timeout?: TimeoutConfig | false;
      connection?: ConnectionConfig | false;
      random?: RandomGenerator;
    };

/**
 * Route options passed to route registration methods (e.g. `app.get(path, handler, options)`).
 */
export interface RouteOptions {
  simulation?: RouteSimulationConfig;
}

/**
 * Merged and resolved simulation settings for an active request.
 */
export interface ResolvedSimulationConfig {
  latency?: LatencyConfig;
  failure?: FailureConfig;
  timeout?: TimeoutConfig;
  connection?: ConnectionConfig;
  random: RandomGenerator;
}

