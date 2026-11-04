import { describe, it, expect } from "vitest";
import { RequestStore } from "../../src/inspector/request-store.js";
import type { RequestRecord } from "../../src/inspector/types.js";

function createDummyRecord(id: string, path: string = "/test"): RequestRecord {
  return {
    id,
    timestamp: new Date().toISOString(),
    method: "GET",
    url: `http://localhost${path}`,
    path,
    query: {},
    request: { headers: {} },
    outcome: "success",
    statusCode: 200,
  };
}

describe("RequestStore (Bounded History)", () => {
  it("stores and retrieves records by ID", () => {
    const store = new RequestStore(5);
    const rec1 = createDummyRecord("req-1");
    store.push(rec1);

    expect(store.size).toBe(1);
    expect(store.has("req-1")).toBe(true);
    expect(store.get("req-1")?.id).toBe("req-1");
    expect(store.get("non-existent")).toBeUndefined();
  });

  it("evicts oldest records when capacity is exceeded (FIFO)", () => {
    const store = new RequestStore(3);

    store.push(createDummyRecord("req-1"));
    store.push(createDummyRecord("req-2"));
    store.push(createDummyRecord("req-3"));
    expect(store.size).toBe(3);

    // Adding 4th record should evict req-1
    store.push(createDummyRecord("req-4"));
    expect(store.size).toBe(3);
    expect(store.has("req-1")).toBe(false);
    expect(store.has("req-2")).toBe(true);
    expect(store.has("req-3")).toBe(true);
    expect(store.has("req-4")).toBe(true);

    // Adding 5th record should evict req-2
    store.push(createDummyRecord("req-5"));
    expect(store.size).toBe(3);
    expect(store.has("req-2")).toBe(false);

    const allIds = store.getAll().map((r) => r.id);
    expect(allIds).toEqual(["req-3", "req-4", "req-5"]);
  });

  it("clears records cleanly", () => {
    const store = new RequestStore(10);
    store.push(createDummyRecord("req-1"));
    store.push(createDummyRecord("req-2"));

    store.clear();
    expect(store.size).toBe(0);
    expect(store.getAll()).toEqual([]);
  });
});

