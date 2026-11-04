import { ScenarioError } from "../core/errors.js";
import type { ScenarioState } from "./types.js";

/**
 * Safely clone a value using standard `structuredClone`.
 * Throws a descriptive ScenarioError if the value or any nested property cannot be cloned.
 */
function cloneValue<T>(value: T, context = "value"): T {
  // Functions cannot be cloned
  if (typeof value === "function") {
    throw new ScenarioError(
      `Cannot store function in scenario state (${context}). Functions cannot be cloned or serialized into scenario state.`,
    );
  }

  // Symbols cannot be cloned
  if (typeof value === "symbol") {
    throw new ScenarioError(
      `Cannot store Symbol in scenario state (${context}). Symbols cannot be cloned or serialized into scenario state.`,
    );
  }

  // Primitives and null/undefined are immutable and safe as-is
  if (value === undefined || value === null || typeof value !== "object") {
    return value;
  }

  try {
    return structuredClone(value);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new ScenarioError(
      `Cannot store non-cloneable value in scenario state (${context}). Scenario state only supports cloneable values (primitives, plain objects, arrays, Maps, Sets, Dates): ${errorMsg}`,
    );
  }
}

/**
 * Isolated in-memory key-value state store for mock application scenarios.
 */
export class StateStore implements ScenarioState {
  private readonly data = new Map<string, unknown>();
  private readonly initialState?: Record<string, unknown>;

  constructor(initialState?: Record<string, unknown>) {
    if (initialState) {
      this.initialState = cloneValue(initialState, "initialState");
      this.reset();
    }
  }

  /**
   * Retrieve a value by key. Returns a deep clone to prevent external mutation of store contents.
   */
  get<T = unknown>(key: string): T | undefined {
    const val = this.data.get(key);
    if (val === undefined) return undefined;
    return cloneValue(val, `retrieving key "${key}"`) as T;
  }

  /**
   * Store a value for key. Stores a deep clone to prevent external mutation.
   * Throws ScenarioError if value is non-cloneable.
   */
  set<T = unknown>(key: string, value: T): void {
    this.data.set(key, cloneValue(value, `key "${key}"`));
  }

  /**
   * Check if a key exists in state.
   */
  has(key: string): boolean {
    return this.data.has(key);
  }

  /**
   * Delete a key from state.
   */
  delete(key: string): boolean {
    return this.data.delete(key);
  }

  /**
   * Remove all entries from state.
   */
  clear(): void {
    this.data.clear();
  }

  /**
   * Return a snapshot containing deep clones of all state entries.
   */
  snapshot(): Record<string, unknown> {
    const snap: Record<string, unknown> = {};
    for (const [key, val] of this.data.entries()) {
      snap[key] = cloneValue(val, `snapshot key "${key}"`);
    }
    return snap;
  }

  /**
   * Reset store to its initial state (or empty if no initial state was provided).
   */
  reset(): void {
    this.data.clear();
    if (this.initialState) {
      for (const [key, val] of Object.entries(this.initialState)) {
        this.data.set(key, cloneValue(val, `reset key "${key}"`));
      }
    }
  }
}
