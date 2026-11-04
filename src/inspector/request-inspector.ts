import type {
  InspectorConfig,
  InspectorStats,
  RequestFilter,
  RequestRecord,
} from "./types.js";
import { RequestStore } from "./request-store.js";
import { applyRequestFilters } from "./filters.js";
import { buildSensitiveKeySet } from "./redaction.js";

/**
 * Perform a safe deep copy of a RequestRecord so callers cannot mutate the internal store.
 */
function cloneRecord(record: RequestRecord): RequestRecord {
  try {
    return structuredClone(record);
  } catch {
    // Fallback JSON serialization clone for edge cases
    return JSON.parse(JSON.stringify(record));
  }
}

/**
 * Public Request Inspector API for inspecting recorded HTTP requests, querying history,
 * computing aggregate statistics, and clearing recorded data.
 */
export class RequestInspector {
  private readonly store: RequestStore;
  public readonly isEnabled: boolean;
  public readonly sensitiveKeys: Set<string>;
  public readonly captureRequestBody: boolean;
  public readonly captureResponseBody: boolean;
  public readonly maxBodySize: number;

  constructor(options: InspectorConfig = {}) {
    this.isEnabled = options.enabled !== false;
    this.store = new RequestStore(options.maxEntries ?? 1000);
    this.sensitiveKeys = buildSensitiveKeySet(options.sensitiveKeys);
    this.captureRequestBody = options.captureRequestBody !== false;
    this.captureResponseBody = options.captureResponseBody !== false;
    this.maxBodySize = options.maxBodySize ?? 10_000;
  }

  /**
   * Record a completed request into the inspector store.
   * If inspection is disabled, this is a no-op.
   */
  record(record: RequestRecord): void {
    if (!this.isEnabled) return;
    this.store.push(record);
  }

  /**
   * Retrieve request records matching optional filter criteria.
   * Returns defensive immutable copies.
   */
  getRequests(filter?: RequestFilter): RequestRecord[] {
    if (!this.isEnabled) return [];
    const all = this.store.getAll();
    const filtered = applyRequestFilters(all, filter);
    return filtered.map(cloneRecord);
  }

  /**
   * Look up a single request record by its unique request ID.
   * Returns a defensive immutable copy, or undefined if not found.
   */
  getRequest(id: string): RequestRecord | undefined {
    if (!this.isEnabled) return undefined;
    const record = this.store.get(id);
    return record ? cloneRecord(record) : undefined;
  }

  /**
   * Calculate aggregate statistics across all currently retained request records in history.
   */
  stats(): InspectorStats {
    const records = this.store.getAll();

    let totalDuration = 0;
    let completedCount = 0;
    let successfulRequests = 0;
    let failedRequests = 0;
    let timeoutRequests = 0;
    let abortedRequests = 0;
    let connectionDroppedRequests = 0;

    const statusCodes: Record<number, number> = {};
    const methods: Record<string, number> = {};
    const outcomes: Record<string, number> = {};

    for (const rec of records) {
      // Outcomes distribution
      outcomes[rec.outcome] = (outcomes[rec.outcome] ?? 0) + 1;

      switch (rec.outcome) {
        case "success":
          successfulRequests++;
          break;
        case "error":
          failedRequests++;
          break;
        case "timeout":
          timeoutRequests++;
          break;
        case "aborted":
          abortedRequests++;
          break;
        case "connection-dropped":
          connectionDroppedRequests++;
          break;
      }

      // Methods distribution
      const method = rec.method.toUpperCase();
      methods[method] = (methods[method] ?? 0) + 1;

      // Status codes distribution
      if (rec.statusCode !== undefined) {
        statusCodes[rec.statusCode] = (statusCodes[rec.statusCode] ?? 0) + 1;
      }

      // Duration tracking
      if (rec.duration !== undefined) {
        totalDuration += rec.duration;
        completedCount++;
      }
    }

    const averageDuration =
      completedCount > 0 ? Math.round((totalDuration / completedCount) * 100) / 100 : 0;

    return {
      totalRequests: records.length,
      successfulRequests,
      failedRequests,
      timeoutRequests,
      abortedRequests,
      connectionDroppedRequests,
      averageDuration,
      statusCodes,
      methods,
      outcomes,
    };
  }

  /**
   * Delete a single request record by its unique request ID.
   */
  deleteRequest(id: string): boolean {
    if (!this.isEnabled) return false;
    return this.store.delete(id);
  }

  /**
   * Delete multiple request records by their unique request IDs.
   */
  deleteRequests(ids: Iterable<string>): void {
    if (!this.isEnabled) return;
    for (const id of ids) {
      this.store.delete(id);
    }
  }

  /**
   * Clear all request records currently stored in history.
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get the current number of retained records.
   */
  get size(): number {
    return this.store.size;
  }
}

