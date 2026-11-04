import type { MockResponse } from "../../core/types.js";

/**
 * Creates a 200 OK mock response with an optional JSON body.
 */
export function ok<T = unknown>(body?: T, headers?: Record<string, string>): MockResponse<T> {
  return {
    status: 200,
    headers: { "Content-Type": "application/json", ...headers },
    body,
  };
}

/**
 * Creates a 201 Created mock response.
 */
export function created<T = unknown>(body?: T, headers?: Record<string, string>): MockResponse<T> {
  return {
    status: 201,
    headers: { "Content-Type": "application/json", ...headers },
    body,
  };
}

/**
 * Creates a 204 No Content mock response.
 */
export function noContent(): MockResponse<void> {
  return {
    status: 204,
  };
}

/**
 * Creates a 200 OK mock response returning an empty list.
 */
export function emptyList(): MockResponse<unknown[]> {
  return {
    status: 200,
    headers: { "Content-Type": "application/json" },
    body: [],
  };
}

/**
 * Creates a 404 Not Found mock response.
 */
export function notFound(message = "Resource not found"): MockResponse<{ error: string }> {
  return {
    status: 404,
    headers: { "Content-Type": "application/json" },
    body: { error: message },
  };
}

/**
 * Creates a 401 Unauthorized mock response.
 */
export function unauthorized(message = "Unauthorized"): MockResponse<{ error: string }> {
  return {
    status: 401,
    headers: { "Content-Type": "application/json" },
    body: { error: message },
  };
}

/**
 * Creates a 403 Forbidden mock response.
 */
export function forbidden(message = "Forbidden"): MockResponse<{ error: string }> {
  return {
    status: 403,
    headers: { "Content-Type": "application/json" },
    body: { error: message },
  };
}

/**
 * Creates a 500 Internal Server Error mock response.
 */
export function serverError(
  message = "Internal server error",
): MockResponse<{ error: string }> {
  return {
    status: 500,
    headers: { "Content-Type": "application/json" },
    body: { error: message },
  };
}

/**
 * Wraps a mock response or handler with an artificial delay.
 */
export function slow<T = unknown>(
  delayMs: number,
  response: MockResponse<T> = ok() as MockResponse<T>,
): () => Promise<MockResponse<T>> {
  return async () => {
    await new Promise((r) => setTimeout(r, delayMs));
    return response;
  };
}

export const presets = {
  ok,
  created,
  noContent,
  emptyList,
  notFound,
  unauthorized,
  forbidden,
  serverError,
  slow,
};

