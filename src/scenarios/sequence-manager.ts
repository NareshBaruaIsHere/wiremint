/**
 * Thread-safe sequence counter and execution manager tracking sequential responses per route and scenario.
 */
export class SequenceManager {
  /** Map of `${routeKey}:${scenarioId}` to current sequence index */
  private readonly counters = new Map<string, number>();
  /** Map of `${routeKey}:${scenarioId}` to in-flight queue promise for strict FIFO ordering */
  private readonly queues = new Map<string, Promise<unknown>>();

  /**
   * Advance the counter for a given route and scenario, returning the current index to serve.
   */
  next(
    routeKey: string,
    scenarioId: string,
    sequenceLength: number,
    afterEnd: "repeat-last" | "cycle" = "repeat-last",
  ): number {
    if (sequenceLength <= 0) return 0;

    const key = `${routeKey}:${scenarioId}`;
    const currentIndex = this.counters.get(key) ?? 0;

    let nextIndex: number;
    if (currentIndex + 1 < sequenceLength) {
      nextIndex = currentIndex + 1;
    } else {
      nextIndex = afterEnd === "cycle" ? 0 : sequenceLength - 1;
    }

    this.counters.set(key, nextIndex);
    return currentIndex;
  }

  /**
   * Run an asynchronous sequence step in strict FIFO arrival order for the given route and scenario.
   * Guarantees that concurrent requests resolve their sequence steps in exact sequential order,
   * even if earlier handlers perform asynchronous operations.
   */
  async runSequential<T>(
    routeKey: string,
    scenarioId: string,
    step: (index: number) => Promise<T> | T,
    sequenceLength: number,
    afterEnd: "repeat-last" | "cycle" = "repeat-last",
  ): Promise<T> {
    const key = `${routeKey}:${scenarioId}`;
    const previous = this.queues.get(key) ?? Promise.resolve();

    let resolveCurrent!: () => void;
    const current = new Promise<void>((resolve) => {
      resolveCurrent = resolve;
    });

    // Advance index synchronously at reservation time so index assignment matches arrival order
    const index = this.next(routeKey, scenarioId, sequenceLength, afterEnd);

    // Chain this request onto the sequence queue
    this.queues.set(key, current);

    try {
      // Wait for any earlier request on this sequence to complete its response/step
      await previous;
      return await step(index);
    } finally {
      resolveCurrent();
      if (this.queues.get(key) === current) {
        this.queues.delete(key);
      }
    }
  }

  /**
   * Reset all sequence counters and queues associated with a given scenario.
   */
  resetScenario(scenarioId: string): void {
    const suffix = `:${scenarioId}`;
    for (const key of this.counters.keys()) {
      if (key.endsWith(suffix)) {
        this.counters.delete(key);
        this.queues.delete(key);
      }
    }
  }

  /**
   * Reset all sequence counters and queues across all scenarios and routes.
   */
  resetAll(): void {
    this.counters.clear();
    this.queues.clear();
  }
}
