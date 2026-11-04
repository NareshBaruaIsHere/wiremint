import type { RequestRecord } from "./types.js";

/**
 * Bounded FIFO in-memory store for request records.
 * Uses an insertion-ordered Map for O(1) appends, O(1) lookups by ID,
 * and O(1) oldest-record evictions when capacity is exceeded.
 */
export class RequestStore {
  private readonly records = new Map<string, RequestRecord>();
  public readonly maxEntries: number;

  constructor(maxEntries: number = 1000) {
    this.maxEntries = Math.max(1, maxEntries);
  }

  /**
   * Add a request record to the store.
   * If capacity is exceeded, evicts the oldest recorded item.
   */
  push(record: RequestRecord): void {
    // If the record ID already exists, delete it first to maintain insertion order
    if (this.records.has(record.id)) {
      this.records.delete(record.id);
    } else if (this.records.size >= this.maxEntries) {
      // Evict oldest record (first item in Map iterator)
      const oldestKey = this.records.keys().next().value;
      if (oldestKey !== undefined) {
        this.records.delete(oldestKey);
      }
    }

    this.records.set(record.id, record);
  }

  /**
   * Look up a request record by ID.
   */
  get(id: string): RequestRecord | undefined {
    return this.records.get(id);
  }

  /**
   * Check if a request record with the given ID exists in history.
   */
  has(id: string): boolean {
    return this.records.has(id);
  }

  /**
   * Return all currently retained records in chronological insertion order (oldest to newest).
   */
  getAll(): RequestRecord[] {
    return Array.from(this.records.values());
  }

  /**
   * Return the count of currently retained records.
   */
  get size(): number {
    return this.records.size;
  }

  /**
   * Delete a request record by ID.
   */
  delete(id: string): boolean {
    return this.records.delete(id);
  }

  /**
   * Clear all records from the store.
   */
  clear(): void {
    this.records.clear();
  }
}

