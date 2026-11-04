import type { HTTPMethod, MockResponse, RouteHandler, RequestContext } from "../core/types.js";
import type { RouteOptions, SimulationConfig } from "../simulation/types.js";
import type { ScenarioMetadata } from "../scenarios/types.js";
import type { InspectorConfig } from "../inspector/types.js";
export type { InspectorConfig };
import type { Middleware } from "../middleware/types.js";

/**
 * Server configuration options.
 */
export interface ServerConfig {
  /**
   * Port the HTTP mock server will listen on.
   * Must be between 1 and 65535.
   * @default 3001
   */
  port?: number;

  /**
   * Host address to bind the HTTP server to.
   * @default "127.0.0.1"
   */
  host?: string;

  /**
   * URL prefix prepended to all registered routes.
   * Must start with `/` if provided.
   * @default "/"
   */
  basePath?: string;

  /**
   * Maximum incoming request body size in bytes.
   * @default 1_048_576 (1 MiB)
   */
  maxBodySize?: number;
}

/**
 * Declarative route response definition.
 * Can be a static MockResponse object or a handler function.
 */
export type RouteResponseConfig<T = unknown> =
  | MockResponse<T>
  | RouteHandler<T>;

/**
 * Declarative route definition in a configuration file.
 */
export interface RouteConfig<T = unknown> {
  /** HTTP method for the route. */
  method: HTTPMethod;

  /** Path pattern (e.g. `/users` or `/users/:id`). Must start with `/`. */
  path: string;

  /**
   * Default response or handler for this route.
   */
  response?: RouteResponseConfig<T>;

  /**
   * Scenario-specific response overrides keyed by scenario ID.
   */
  scenarios?: Record<string, RouteResponseConfig<T>>;

  /**
   * Sequence of responses returned on consecutive requests.
   */
  sequence?: Array<RouteResponseConfig<T>>;

  /**
   * What to do after reaching the end of the response sequence.
   * @default "repeat-last"
   */
  afterEnd?: "repeat-last" | "cycle";

  /**
   * Optional per-route simulation settings.
   */
  options?: RouteOptions;

  /**
   * Whether unresolved template placeholders (e.g. {{params.missing}}) throw an error.
   * If false, missing parameters resolve to an empty string.
   * @default false
   */
  strictInterpolation?: boolean;
}

/**
 * Declarative scenario definition in a configuration file.
 */
export interface ScenarioConfig {
  /** Unique scenario identifier (alphanumeric, dashes, underscores). */
  id: string;

  /** Human-readable scenario name. */
  name: string;

  /** Optional descriptive summary of the scenario. */
  description?: string;

  /** Initial in-memory state store data for this scenario. */
  initialState?: Record<string, unknown>;
}

/**
 * Logging configuration options.
 */
export interface LoggingConfig {
  /**
   * Whether terminal logging is enabled.
   * @default true
   */
  enabled?: boolean;

  /**
   * Log level threshold.
   * @default "info"
   */
  level?: "silent" | "error" | "warn" | "info" | "debug";
}

/**
 * Top-level Wiremint configuration structure.
 */
export interface WiremintConfig {
  /** HTTP server settings. */
  server?: ServerConfig;

  /** Declarative mock routes. */
  routes?: RouteConfig[];

  /** Application scenario definitions. */
  scenarios?: ScenarioConfig[];

  /** Global network simulation settings. */
  simulation?: SimulationConfig;

  /** Request Inspector settings. */
  inspector?: InspectorConfig | boolean;

  /** Middleware functions to register in the pipeline (TypeScript/JavaScript configs). */
  middleware?: Middleware[];

  /** Logging options. */
  logging?: LoggingConfig;
}

/**
 * Fully resolved Wiremint configuration with all defaults and environment overrides applied.
 */
export interface ResolvedWiremintConfig {
  server: {
    port: number;
    host: string;
    basePath: string;
    maxBodySize: number;
  };
  routes: RouteConfig[];
  scenarios: ScenarioConfig[];
  simulation?: SimulationConfig;
  inspector: InspectorConfig;
  middleware: Middleware[];
  logging: {
    enabled: boolean;
    level: "silent" | "error" | "warn" | "info" | "debug";
  };
  /** Path to the configuration file loaded, if one was used. */
  configFile?: string;
}

/**
 * Options accepted by `loadConfig()`.
 */
export interface LoadConfigOptions {
  /**
   * Working directory to discover configuration files from.
   * @default process.cwd()
   */
  cwd?: string;

  /**
   * Explicit path to a configuration file.
   * If provided, auto-discovery is bypassed.
   */
  configFile?: string;

  /**
   * Environment variable dictionary to read from.
   * @default process.env
   */
  env?: Record<string, string | undefined>;

  /**
   * Programmatic overrides applied on top of the loaded configuration.
   */
  overrides?: WiremintConfig;
}

/**
 * Detailed error record for configuration validation failures.
 */
export interface ValidationErrorDetail {
  /** Path in the configuration object (e.g. "server.port" or "routes[0].method"). */
  path: string;
  /** Human-readable explanation of why the value is invalid. */
  message: string;
}
