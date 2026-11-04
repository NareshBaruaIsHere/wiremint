import type { HTTPMethod } from "../core/types.js";
import type { ScenarioContext } from "../scenarios/types.js";
import type { MiddlewareContext } from "./types.js";

export interface CreateMiddlewareContextParams {
  requestId: string;
  method: HTTPMethod | string;
  url: string;
  path: string;
  query: Record<string, string | string[]>;
  params: Record<string, string>;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
  signal: AbortSignal;
  scenario: ScenarioContext;
}

/**
 * Creates a MiddlewareContext object with immutable request data and mutable response fields.
 */
export function createMiddlewareContext(
  params: CreateMiddlewareContextParams,
): MiddlewareContext {
  const responseHeaders: Record<string, string> = {};

  return {
    requestId: params.requestId,
    method: params.method,
    url: params.url,
    path: params.path,
    query: Object.freeze({ ...params.query }),
    params: Object.freeze({ ...params.params }),
    headers: Object.freeze({ ...params.headers }),
    body: params.body,
    signal: params.signal,
    scenario: params.scenario,

    statusCode: undefined,
    responseHeaders,
    responseBody: undefined,

    setHeader(name: string, value: string): void {
      responseHeaders[name.toLowerCase()] = value;
    },

    getHeader(name: string): string | undefined {
      const lower = name.toLowerCase();
      for (const [key, val] of Object.entries(params.headers)) {
        if (key.toLowerCase() === lower) {
          if (Array.isArray(val)) {
            return val.join(", ");
          }
          return val;
        }
      }
      return undefined;
    },
  };
}

