import type { TimeoutConfig } from "./types.js";

/**
 * Result of executing a task under timeout constraints.
 */
export interface TimeoutResult<T> {
  timedOut: boolean;
  result?: T;
}

/**
 * Executes an asynchronous task within a specified timeout limit.
 * If the task does not complete before `timeoutMs`, `timedOut: true` is returned.
 * Prevents unhandled rejections if the task rejects after timeout.
 */
export async function runWithTimeout<T>(
  task: () => Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<TimeoutResult<T>> {
  if (timeoutMs <= 0) {
    const result = await task();
    return { timedOut: false, result };
  }

  let timer: NodeJS.Timeout | undefined;
  let settled = false;

  return new Promise<TimeoutResult<T>>((resolve, reject) => {
    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      signal?.removeEventListener("abort", onAbort);
    };

    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ timedOut: false });
    };

    signal?.addEventListener("abort", onAbort, { once: true });

    timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ timedOut: true });
    }, timeoutMs);

    task()
      .then((res) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve({ timedOut: false, result: res });
      })
      .catch((err) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err);
      });
  });
}

/**
 * Build the HTTP response returned when a timeout occurs.
 */
export function getTimeoutResponse(config: TimeoutConfig): {
  statusCode: number;
  headers?: Record<string, string>;
  body: unknown;
} {
  const statusCode = config.statusCode ?? 504;
  const body =
    config.body !== undefined
      ? config.body
      : {
          error: "Simulated gateway timeout",
          statusCode,
          simulated: true,
        };

  return {
    statusCode,
    headers: config.headers,
    body,
  };
}

