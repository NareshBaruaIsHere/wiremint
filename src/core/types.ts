import type { RouteOptions, SimulationConfig } from "../simulation/types.js";
import type { ScenarioContext, ScenarioEngineOptions } from "../scenarios/types.js";
import type { InspectorConfig } from "../inspector/types.js";
import type {
  LoggingConfig,
  RouteConfig,
  ScenarioConfig,
  ServerConfig,
} from "../config/types.js";
import type { Middleware } from "../middleware/types.js";

/**
 * Supported HTTP methods for mock route registration.
 */
export type HTTPMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "OPTIONS";

/**
 * The set of HTTP methods that may carry a request body.
 * Used internally to decide whether to parse the body.
 */
export const BODY_METHODS: ReadonlySet<string> = new Set([
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
]);

/**
 * A mock response returned by a route handler.
 * @template T - The type of the response body.
 */
export interface MockResponse<T = unknown> {
  /** HTTP status code. Defaults to 200. */
  status?: number;
  /** Custom response headers. */
  headers?: Record<string, string>;
  /** Response body — serialised as JSON. */
  body?: T;
}

/**
 * Incoming request context supplied to every route handler.
 */
export interface RequestContext {
  /** Unique identifier for the incoming request. */
  readonly requestId: string;
  /** The HTTP method of the request. */
  method: HTTPMethod;
  /** The matched pathname (after basePath stripping). */
  path: string;
  /** Dynamic route parameters (e.g. `:id` → `params.id`). */
  params: Record<string, string>;
  /** Parsed query-string parameters. */
  query: Record<string, string | string[]>;
  /** Raw request headers. */
  headers: Record<string, string | string[] | undefined>;
  /** Parsed JSON body, or `undefined` when absent. */
  body: unknown;
  /**
   * An AbortSignal that aborts if the client disconnects before receiving a response,
   * or if the request execution times out.
   */
  signal: AbortSignal;
  /**
   * Active scenario context providing metadata, isolated state store, and reset capability.
   */
  scenario: ScenarioContext;
}

/**
 * A function that handles a matched route and produces a response.
 */
export type RouteHandler<T = unknown> = (
  context: RequestContext,
) => MockResponse<T> | Promise<MockResponse<T>>;

/**
 * Stored definition of a registered route.
 */
export interface RouteDefinition {
  method: HTTPMethod;
  /** The route pattern, e.g. `/users/:id`. */
  path: string;
  handler: RouteHandler;
  /** Optional per-route configuration, including simulation settings. */
  options?: RouteOptions;
}

/**
 * Options for the underlying HTTP server.
 */
export interface ServerOptions {
  /** Port to listen on. @default 3001 */
  port?: number;
  /** Host/IP to bind. @default "127.0.0.1" */
  host?: string;
}

/**
 * Top-level options accepted by `createWiremint()`.
 */
export interface WiremintOptions {
  /**
   * HTTP server settings (port, host, basePath, maxBodySize).
   */
  server?: ServerConfig;
  /**
   * Declarative mock routes to register automatically upon startup.
   */
  routes?: RouteConfig[];
  /**
   * Application scenario definitions.
   */
  scenarios?: ScenarioConfig[] | ScenarioEngineOptions;
  /**
   * Middleware to register in the pipeline.
   */
  middleware?: Middleware[];
  /**
   * Logging configuration.
   */
  logging?: LoggingConfig;
  /**
   * A path prefix prepended to every registered route.
   * Must start with `/` if provided.
   * @example "/api"
   */
  basePath?: string;
  /**
   * Maximum request body size in bytes.
   * Requests exceeding this limit receive a 413 response.
   * @default 1_048_576 (1 MiB)
   */
  maxBodySize?: number;
  /**
   * Global network simulation settings.
   */
  simulation?: SimulationConfig;
  /**
   * Request Inspector and history recording configuration.
   * Pass `false` or `{ enabled: false }` to disable inspection.
   * @default { enabled: true, maxEntries: 1000 }
   */
  inspector?: InspectorConfig | boolean;
}
