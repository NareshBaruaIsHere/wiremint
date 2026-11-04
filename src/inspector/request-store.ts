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
    const key = record.internalId ?? record.id;
    // If this specific record key already exists, delete it first to maintain insertion order
    if (this.records.has(key)) {
      this.records.delete(key);
    } else if (this.records.size >= this.maxEntries) {
      // Evict oldest record (first item in Map iterator)
      const oldestKey = this.records.keys().next().value;
      if (oldestKey !== undefined) {
        this.records.delete(oldestKey);
      }
    }

    this.records.set(key, record);
  }

  /**
   * Look up a request record by ID or internal ID.
   */
  get(id: string): RequestRecord | undefined {
    const direct = this.records.get(id);
    if (direct) return direct;
    for (const rec of Array.from(this.records.values()).reverse()) {
      if (rec.id === id) return rec;
    }
    return undefined;
  }

  /**
   * Check if a request record with the given ID exists in history.
   */
  has(id: string): boolean {
    if (this.records.has(id)) return true;
    for (const rec of this.records.values()) {
      if (rec.id === id) return true;
    }
    return false;
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
   * Delete a request record by internal ID or public ID.
   */
  delete(keyOrId: string): boolean {
    if (this.records.delete(keyOrId)) return true;
    let deleted = false;
    for (const [k, rec] of this.records.entries()) {
      if (rec.id === keyOrId || rec.internalId === keyOrId) {
        this.records.delete(k);
        deleted = true;
      }
    }
    return deleted;
  }

  /**
   * Clear all records from the store.
   */
  clear(): void {
    this.records.clear();
  }
}

