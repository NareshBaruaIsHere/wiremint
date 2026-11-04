import type { FailureConfig } from "./types.js";
import type { RandomGenerator } from "./random.js";

/**
 * Outcome of evaluating simulated HTTP failure injection.
 */
export interface FailureOutcome {
  shouldFail: boolean;
  statusCode?: number;
  headers?: Record<string, string>;
  body?: unknown;
}

/**
 * Return default human-readable message for standard error status codes.
 */
function getDefaultErrorMessage(statusCode: number): string {
  switch (statusCode) {
    case 500:
      return "Simulated internal server error";
    case 502:
      return "Simulated bad gateway";
    case 503:
      return "Simulated service unavailable";
    case 504:
      return "Simulated gateway timeout";
    case 429:
      return "Simulated too many requests";
    default:
      return `Simulated HTTP ${statusCode} failure`;
  }
}

/**
 * Evaluate whether an incoming request should fail based on simulated failure configuration.
 */
export function evaluateFailure(
  config: FailureConfig | undefined,
  random: RandomGenerator,
): FailureOutcome {
  if (!config || config.enabled === false || config.rate <= 0) {
    return { shouldFail: false };
  }

  if (config.rate >= 1 || random.next() < config.rate) {
    const statusCode = config.statusCode ?? 500;
    const body =
      config.body !== undefined
        ? config.body
        : {
            error: getDefaultErrorMessage(statusCode),
            statusCode,
            simulated: true,
          };

    return {
      shouldFail: true,
      statusCode,
      headers: config.headers,
      body,
    };
  }

  return { shouldFail: false };
}

