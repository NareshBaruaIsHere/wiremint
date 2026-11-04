import { describe, it, expect } from "vitest";
import { RequestInspector } from "../../src/inspector/request-inspector.js";
import type { RequestRecord } from "../../src/inspector/types.js";

function mockRecord(id: string, overrides: Partial<RequestRecord> = {}): RequestRecord {
  return {
    id,
    timestamp: new Date().toISOString(),
    method: "GET",
    url: "http://localhost/api/test",
    path: "/api/test",
    query: {},
    request: { headers: {} },
    outcome: overrides.outcome ?? "success",
    statusCode: "statusCode" in overrides ? overrides.statusCode : 200,
    duration: overrides.duration ?? 25,
    ...overrides,
  };
}

describe("RequestInspector", () => {
  it("records requests and returns defensive immutable copies", () => {
    const inspector = new RequestInspector({ maxEntries: 10 });
    const original = mockRecord("req-1", {
      request: { headers: { host: "localhost" }, body: { key: "initial" } },
    });

    inspector.record(original);

    const retrieved = inspector.getRequest("req-1");
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe("req-1");

    // Mutate retrieved copy
    (retrieved!.request.body as any).key = "MUTATED";

    // Internal record remains unaffected
    const retrievedAgain = inspector.getRequest("req-1");
    expect((retrievedAgain!.request.body as any).key).toBe("initial");
  });

  it("calculates accurate aggregate statistics across retained records", () => {
    const inspector = new RequestInspector();

    inspector.record(mockRecord("r1", { method: "GET", statusCode: 200, outcome: "success", duration: 10 }));
    inspector.record(mockRecord("r2", { method: "GET", statusCode: 200, outcome: "success", duration: 20 }));
    inspector.record(mockRecord("r3", { method: "POST", statusCode: 500, outcome: "error", duration: 30 }));
    inspector.record(mockRecord("r4", { method: "POST", statusCode: 504, outcome: "timeout", duration: 40 }));
    inspector.record(mockRecord("r5", { method: "DELETE", outcome: "aborted", statusCode: undefined }));
    inspector.record(mockRecord("r6", { method: "GET", outcome: "connection-dropped", statusCode: undefined }));

    const stats = inspector.stats();

    expect(stats.totalRequests).toBe(6);
    expect(stats.successfulRequests).toBe(2);
    expect(stats.failedRequests).toBe(1);
    expect(stats.timeoutRequests).toBe(1);
    expect(stats.abortedRequests).toBe(1);
    expect(stats.connectionDroppedRequests).toBe(1);
    // (10 + 20 + 30 + 40) / 4 = 25
    expect(stats.averageDuration).toBe(25);

    expect(stats.methods).toEqual({ GET: 3, POST: 2, DELETE: 1 });
    expect(stats.statusCodes).toEqual({ 200: 2, 500: 1, 504: 1 });
    expect(stats.outcomes).toEqual({
      success: 2,
      error: 1,
      timeout: 1,
      aborted: 1,
      "connection-dropped": 1,
    });
  });

  it("acts as a no-op when disabled", () => {
    const inspector = new RequestInspector({ enabled: false });

    inspector.record(mockRecord("r1"));
    expect(inspector.size).toBe(0);
    expect(inspector.getRequests()).toEqual([]);
    expect(inspector.getRequest("r1")).toBeUndefined();
    expect(inspector.stats().totalRequests).toBe(0);
  });

  it("clears all stored requests", () => {
    const inspector = new RequestInspector();
    inspector.record(mockRecord("r1"));
    inspector.record(mockRecord("r2"));
    expect(inspector.size).toBe(2);

    inspector.clear();
    expect(inspector.size).toBe(0);
    expect(inspector.getRequests()).toEqual([]);
  });
});
