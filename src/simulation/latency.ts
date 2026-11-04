import type { LatencyConfig } from "./types.js";
import type { RandomGenerator } from "./random.js";

/**
 * Calculate the simulated latency delay in milliseconds based on configuration and randomness.
 * Guaranteed to return an integer >= 0.
 */
export function calculateLatency(
  config: LatencyConfig | undefined,
  random: RandomGenerator,
): number {
  if (!config || config.enabled === false) {
    return 0;
  }

  let delay = 0;

  if (config.fixed !== undefined) {
    delay = config.fixed;
  } else if (config.min !== undefined && config.max !== undefined) {
    const range = config.max - config.min;
    delay = config.min + random.next() * range;
  } else {
    return 0;
  }

  if (config.jitter !== undefined && config.jitter > 0) {
    // Symmetrical jitter in range [-jitter, +jitter]
    const jitterOffset = (random.next() * 2 - 1) * config.jitter;
    delay += jitterOffset;
  }

  return Math.max(0, Math.round(delay));
}

/**
 * Asynchronously pauses execution for `ms` milliseconds.
 * Cancels timer immediately if the provided AbortSignal is triggered.
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

