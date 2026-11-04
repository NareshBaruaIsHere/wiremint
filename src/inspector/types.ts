import type { RequestOutcome } from "../events/types.js";

/**
 * Configuration options for the Request Inspector.
 */
export interface InspectorConfig {
  /**
   * Whether request inspection and history recording is enabled.
   * @default true
   */
  enabled?: boolean;

  /**
   * Maximum number of request records retained in memory.
   * Oldest records are automatically evicted once this capacity is reached.
   * @default 1000
   */
  maxEntries?: number;

  /**
   * Whether to capture and record request bodies.
   * @default true
   */
  captureRequestBody?: boolean;

  /**
   * Whether to capture and record response bodies.
   * @default true
   */
  captureResponseBody?: boolean;

  /**
   * Maximum body size in bytes to record.
   * Larger bodies are truncated or omitted to prevent high memory usage.
   * @default 10_000 (10 KB)
   */
  maxBodySize?: number;

  /**
   * Additional header or JSON keys to redact in captured requests and responses.
   */
  sensitiveKeys?: string[];
}

/**
 * Public, immutable representation of an inspected HTTP request.
 */
export interface RequestRecord {
  /** Unique identifier for this request. */
  id: string;

  /** ISO 8601 timestamp when the request entered Wiremint. */
  timestamp: string;

  /** ISO 8601 timestamp when the request completed. */
  completedAt?: string;

  /** Request duration in milliseconds. */
  duration?: number;

  /** HTTP method (e.g. GET, POST). */
  method: string;

  /** Full request URL including path and query string. */
  url: string;

  /** Normalized pathname (with basePath stripped). */
  path: string;

  /** Parsed query parameters. */
  query: Record<string, string | string[]>;

  /** Dynamic route parameters extracted during matching. */
  params?: Record<string, string>;

  /** The route pattern matched, if any (e.g. `/users/:id`). */
  matchedRoute?: string;

  /** The active scenario ID during this request. */
  scenarioId?: string;

  /** Captured request metadata and body. */
  request: {
    headers: Record<string, unknown>;
    body?: unknown;
  };

  /** Captured response metadata and body. */
  response?: {
    statusCode: number;
    headers: Record<string, unknown>;
    body?: unknown;
  };

  /** HTTP status code returned to the client, if applicable. */
  statusCode?: number;

  /** Terminal outcome of the request. */
  outcome: RequestOutcome;

  /** Error details if the request encountered a terminal failure. */
  error?: {
    name: string;
    message: string;
    code?: string;
  };

  /** Network simulation conditions applied to this request, if any. */
  simulation?: {
    latency?: number;
    failed?: boolean;
    timedOut?: boolean;
    connectionDropped?: boolean;
  };
}

/**
 * Filter options for querying recorded requests.
 */
export interface RequestFilter {
  /** Filter by HTTP method (case-insensitive). */
  method?: string;

  /** Filter by exact path match or prefix match. */
  path?: string;

  /** Filter by exact HTTP status code. */
  statusCode?: number;

  /** Filter by HTTP status code range (inclusive). */
  statusRange?: {
    min?: number;
    max?: number;
  };

  /** Filter by active scenario ID. */
  scenarioId?: string;

  /** Filter by terminal request outcome. */
  outcome?: RequestOutcome;

  /** Filter only failed or error outcomes (outcome === "error" or statusCode >= 400). */
  errorOnly?: boolean;

  /** Filter records recorded at or after this time (Date, ISO string, or timestamp). */
  since?: string | Date | number;

  /** Filter records recorded at or before this time (Date, ISO string, or timestamp). */
  until?: string | Date | number;

  /** Text search matching path, url, error message, or JSON body content. */
  search?: string;

  /** Maximum number of records to return. */
  limit?: number;

  /**
   * Sort order of returned records.
   * @default "newest-first"
   */
  order?: "newest-first" | "oldest-first";
}

/**
 * Aggregated statistics calculated from retained request history.
 */
export interface InspectorStats {
  /** Total count of retained requests. */
  totalRequests: number;

  /** Count of requests that completed successfully. */
  successfulRequests: number;

  /** Count of requests that failed with an error. */
  failedRequests: number;

  /** Count of requests that timed out. */
  timeoutRequests: number;

  /** Count of requests aborted by client disconnection. */
  abortedRequests: number;

  /** Count of requests terminated by connection drops. */
  connectionDroppedRequests: number;

  /** Average duration in milliseconds across completed requests. */
  averageDuration: number;

  /** Frequency distribution of HTTP status codes. */
  statusCodes: Record<number, number>;

  /** Frequency distribution of HTTP methods. */
  methods: Record<string, number>;

  /** Frequency distribution of request outcomes. */
  outcomes: Record<string, number>;
}

