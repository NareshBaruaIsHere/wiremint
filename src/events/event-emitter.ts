import type {
  EventListener,
  EventName,
  Unsubscribe,
  WiremintEventMap,
} from "./types.js";

/**
 * Strongly typed in-memory event emitter for Wiremint lifecycle events.
 * Guarantees safe listener dispatch, registration-order execution, and unsubscribe support.
 */
export class TypedEventEmitter {
  private readonly listeners = new Map<
    EventName,
    Set<EventListener<any>>
  >();

  /**
   * Subscribe to a lifecycle event.
   * Returns an unsubscribe function to remove the listener.
   */
  on<K extends EventName>(
    event: K,
    listener: EventListener<K>,
  ): Unsubscribe {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener);

    let unsubscribed = false;
    return () => {
      if (unsubscribed) return;
      unsubscribed = true;
      set.delete(listener);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  /**
   * Remove a specific subscribed listener.
   */
  off<K extends EventName>(event: K, listener: EventListener<K>): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(listener);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Emit an event synchronously in listener registration order.
   * Catches any exceptions thrown by user listeners and dispatches them
   * to "listener:error" safely, preventing server crashes or response disruption.
   */
  emit<K extends EventName>(event: K, payload: WiremintEventMap[K]): void {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return;

    // Snapshot listeners so mutations during dispatch do not affect current iteration
    const snapshot = Array.from(set);

    for (const listener of snapshot) {
      try {
        const result = listener(payload);
        // If the listener returned a rejected promise, catch it safely
        if (
          result !== null &&
          typeof result === "object" &&
          "catch" in result &&
          typeof (result as Promise<unknown>).catch === "function"
        ) {
          (result as Promise<unknown>).catch((err) => {
            this.handleListenerError(event, err);
          });
        }
      } catch (err) {
        this.handleListenerError(event, err);
      }
    }
  }

  /**
   * Safely dispatch errors from listener callbacks to "listener:error"
   * without creating recursive loops.
   */
  private handleListenerError(sourceEvent: EventName, error: unknown): void {
    if (sourceEvent === "listener:error") {
      // Avoid recursive error loops
      return;
    }

    const errorListeners = this.listeners.get("listener:error");
    if (!errorListeners || errorListeners.size === 0) {
      return;
    }

    const snapshot = Array.from(errorListeners);
    for (const listener of snapshot) {
      try {
        const result = listener({ event: sourceEvent, error });
        if (
          result !== null &&
          typeof result === "object" &&
          "catch" in result &&
          typeof (result as Promise<unknown>).catch === "function"
        ) {
          (result as Promise<unknown>).catch(() => {
            // Silently swallow async rejections inside listener:error handlers to prevent infinite recursion or unhandled rejections
          });
        }
      } catch {
        // Silently swallow synchronous errors inside listener:error handlers to prevent infinite recursion
      }
    }
  }

  /**
   * Remove all listeners for all events or for a specific event.
   */
  clear(event?: EventName): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Return the count of listeners registered for a given event.
   */
  listenerCount(event: EventName): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

