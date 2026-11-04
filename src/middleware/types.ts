import type { HTTPMethod } from "../core/types.js";
import type { ScenarioContext } from "../scenarios/types.js";

/**
 * Function invoked to yield execution to the next middleware or route handler in the pipeline.
 */
export type NextFunction = () => Promise<void>;

/**
 * Context passed to middleware during request processing.
 * Exposes immutable request properties and mutable response properties.
 */
export interface MiddlewareContext {
  /** Unique identifier for the incoming request. */
  readonly requestId: string;

  /** HTTP method of the request. */
  readonly method: HTTPMethod | string;

  /** Full request URL string. */
  readonly url: string;

  /** Request path with basePath stripped. */
  readonly path: string;

  /** Parsed query string parameters. */
  readonly query: Record<string, string | string[]>;

  /** Dynamic route parameters extracted during route matching (empty object if no route matched). */
  readonly params: Record<string, string>;

  /** Incoming request headers. */
  readonly headers: Record<string, string | string[] | undefined>;

  /** Parsed request body. */
  readonly body: unknown;

  /**
   * AbortSignal triggered if the client disconnects or if a timeout occurs.
   */
  readonly signal: AbortSignal;

  /**
   * Scenario context providing metadata and state store access.
   */
  readonly scenario: ScenarioContext;

  /**
   * HTTP status code for the response. Can be set or modified by middleware.
   */
  statusCode?: number;

  /**
   * Response headers record. Can be modified by middleware or via `setHeader`.
   */
  responseHeaders: Record<string, string>;

  /**
   * Response body. Can be set or modified by middleware.
   */
  responseBody?: unknown;

  /**
   * Set a response header (case-insensitive name).
   */
  setHeader(name: string, value: string): void;

  /**
   * Get an incoming request header (case-insensitive name).
   */
  getHeader(name: string): string | undefined;
}

/**
 * Middleware function definition following the onion execution pattern.
 */
export type Middleware = (
  context: MiddlewareContext,
  next: NextFunction,
) => Promise<void> | void;

/**
 * Internal representation of a registered middleware.
 */
export interface MiddlewareRegistration {
  /** Optional path prefix for path-scoped middleware (e.g. "/api"). */
  path?: string;
  /** Middleware handler function. */
  middleware: Middleware;
}

/**
 * Options for registering middleware.
 */
export interface MiddlewareOptions {
  /** Optional path prefix to restrict middleware execution. */
  path?: string;
}

