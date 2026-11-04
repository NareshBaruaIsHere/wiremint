/**
 * Supported outcomes for a request in Wiremint.
 */
export type RequestOutcome =
  | "success"
  | "error"
  | "timeout"
  | "aborted"
  | "connection-dropped";

/**
 * Payload definitions for all lifecycle events emitted by Wiremint.
 */
export interface WiremintEventMap {
  /**
   * Emitted when a new HTTP request enters Wiremint.
   */
  "request:start": {
    requestId: string;
    method: string;
    url: string;
    path: string;
    timestamp: string;
  };

  /**
   * Emitted when an incoming request is matched to a route.
   */
  "request:match": {
    requestId: string;
    matchedRoute: string;
    method: string;
    params: Record<string, string>;
    scenarioId: string;
  };

  /**
   * Emitted when a request completes successfully (HTTP status < 400).
   */
  "request:success": {
    requestId: string;
    statusCode: number;
    duration: number;
    matchedRoute?: string;
    scenarioId?: string;
  };

  /**
   * Emitted when a request processing fails (HTTP status >= 400 or unhandled error).
   */
  "request:error": {
    requestId: string;
    error: {
      name: string;
      message: string;
      code?: string;
    };
    statusCode?: number;
  };

  /**
   * Emitted exactly once when request processing reaches a terminal outcome.
   */
  "request:complete": {
    requestId: string;
    outcome: RequestOutcome;
    statusCode?: number;
    duration: number;
    timestamp: string;
  };

  /**
   * Emitted when an event listener throws an exception during dispatch.
   */
  "listener:error": {
    event: string;
    error: unknown;
  };
}

export type EventName = keyof WiremintEventMap;

export type EventListener<K extends EventName> = (
  payload: WiremintEventMap[K],
) => void | Promise<void>;

export type Unsubscribe = () => void;

