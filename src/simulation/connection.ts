import type { ConnectionConfig } from "./types.js";
import type { RandomGenerator } from "./random.js";

/**
 * Outcome of evaluating simulated connection drop.
 */
export interface ConnectionOutcome {
  shouldDrop: boolean;
}

/**
 * Evaluate whether an incoming request connection should be dropped.
 */
export function evaluateConnectionDrop(
  config: ConnectionConfig | undefined,
  random: RandomGenerator,
): ConnectionOutcome {
  if (!config || config.enabled === false || config.dropRate <= 0) {
    return { shouldDrop: false };
  }

  if (config.dropRate >= 1 || random.next() < config.dropRate) {
    return { shouldDrop: true };
  }

  return { shouldDrop: false };
}

