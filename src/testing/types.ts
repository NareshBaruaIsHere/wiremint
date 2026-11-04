import type { SimulationConfig } from "../simulation/types.js";
import type { RequestRecord } from "../inspector/types.js";
import type { ScenarioMetadata } from "../scenarios/types.js";

/**
 * Options for configuring a Wiremint in-process test client.
 */
export interface TestClientOptions {
  /**
   * Per-test simulation override.
   * Pass `false` to disable simulation completely for fast unit testing.
   */
  simulation?: SimulationConfig | boolean | null;

  /**
   * Base path prefix to prepend to test request paths.
   */
  basePath?: string;

  /**
   * Default headers added to every request sent by this client.
   */
  defaultHeaders?: Record<string, string | string[]>;

  /**
   * Default scenario ID for requests sent by this client.
   */
  scenario?: string;
}

/**
 * Request options for in-process test calls.
 */
export interface TestRequestOptions {
  /**
   * HTTP request headers.
   */
  headers?: Record<string, string | string[] | undefined>;

  /**
   * URL query parameters (merged with any query string in the path).
   */
  query?: Record<string, string | string[] | number | boolean | undefined>;

  /**
   * Request body (JSON serializable value, string, or Buffer).
   */
  body?: unknown;

  /**
   * Scenario ID for this specific request (sent via x-wiremint-scenario).
   */
  scenario?: string;

  /**
   * Explicit request ID override for deterministic test assertions.
   */
  requestId?: string;
}

/**
 * In-process test response returned by the test client.
 */
export interface TestResponse {
  /** HTTP status code (e.g. 200, 404). */
  status: number;

  /** Alias for status. */
  statusCode: number;

  /** Normalized response headers (lowercase keys). */
  headers: Record<string, string | string[]>;

  /**
   * Parsed response body (parsed JSON if available, otherwise raw text).
   */
  body: unknown;

  /**
   * Raw text representation of the response body.
   */
  text: string;

  /**
   * Parse or cast response body as JSON.
   */
  json<T = unknown>(): T;

  /** Unique request tracking ID. */
  requestId: string;

  /** Request duration in milliseconds. */
  duration: number;

  /** Whether the response status code is 2xx (200-299). */
  ok: boolean;

  /** Active scenario during request execution, if available. */
  scenario?: string;
}

/**
 * Filters for querying captured request history in the test client.
 */
export interface RequestFilterOptions {
  method?: string;
  path?: string;
  status?: number;
  scenario?: string;
  limit?: number;
}

export type { RequestRecord, ScenarioMetadata };
