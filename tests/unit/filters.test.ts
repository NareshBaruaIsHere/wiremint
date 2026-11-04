import { describe, it, expect } from "vitest";
import { applyRequestFilters } from "../../src/inspector/filters.js";
import type { RequestRecord } from "../../src/inspector/types.js";

function makeRecord(overrides: Partial<RequestRecord> = {}): RequestRecord {
  return {
    id: overrides.id ?? "id-1",
    timestamp: overrides.timestamp ?? new Date().toISOString(),
    method: overrides.method ?? "GET",
    url: overrides.url ?? "http://localhost/api/users",
    path: overrides.path ?? "/api/users",
    query: overrides.query ?? {},
    request: { headers: {}, body: overrides.request?.body },
    response: overrides.response,
    statusCode: overrides.statusCode ?? 200,
    outcome: overrides.outcome ?? "success",
    scenarioId: overrides.scenarioId,
    error: overrides.error,
  };
}

describe("Inspector Filters", () => {
  const records: RequestRecord[] = [
    makeRecord({
      id: "r1",
      method: "GET",
      path: "/api/users",
      statusCode: 200,
      outcome: "success",
      scenarioId: "happy-path",
      timestamp: "2026-01-01T10:00:00.000Z",
    }),
    makeRecord({
      id: "r2",
      method: "POST",
      path: "/api/users",
      statusCode: 201,
      outcome: "success",
      scenarioId: "happy-path",
      request: { headers: {}, body: { name: "Alice" } },
      timestamp: "2026-01-01T10:05:00.000Z",
    }),
    makeRecord({
      id: "r3",
      method: "GET",
      path: "/api/payments",
      statusCode: 500,
      outcome: "error",
      scenarioId: "payment-failed",
      error: { name: "PaymentError", message: "Gateway connection lost" },
      timestamp: "2026-01-01T10:10:00.000Z",
    }),
    makeRecord({
      id: "r4",
      method: "DELETE",
      path: "/api/users/123",
      statusCode: 404,
      outcome: "error",
      scenarioId: "default",
      timestamp: "2026-01-01T10:15:00.000Z",
    }),
  ];

  it("filters by method case-insensitively", () => {
    const res = applyRequestFilters(records, { method: "post" });
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe("r2");
  });

  it("filters by path and path prefix", () => {
    const exact = applyRequestFilters(records, { path: "/api/payments" });
    expect(exact).toHaveLength(1);
    expect(exact[0].id).toBe("r3");

    const prefix = applyRequestFilters(records, { path: "/api/users" });
    // Should match /api/users (r1, r2) and /api/users/123 (r4)
    expect(prefix.map((r) => r.id).sort()).toEqual(["r1", "r2", "r4"]);
  });

  it("filters by status code and status range", () => {
    const status200 = applyRequestFilters(records, { statusCode: 200 });
    expect(status200).toHaveLength(1);
    expect(status200[0].id).toBe("r1");

    const range = applyRequestFilters(records, { statusRange: { min: 400, max: 599 } });
    expect(range.map((r) => r.id).sort()).toEqual(["r3", "r4"]);
  });

  it("filters by scenarioId and outcome", () => {
    const scenario = applyRequestFilters(records, { scenarioId: "payment-failed" });
    expect(scenario).toHaveLength(1);
    expect(scenario[0].id).toBe("r3");

    const errors = applyRequestFilters(records, { errorOnly: true });
    expect(errors.map((r) => r.id).sort()).toEqual(["r3", "r4"]);
  });

  it("filters by time range (since/until)", () => {
    const res = applyRequestFilters(records, {
      since: "2026-01-01T10:04:00.000Z",
      until: "2026-01-01T10:12:00.000Z",
    });
    expect(res.map((r) => r.id).sort()).toEqual(["r2", "r3"]);
  });

  it("searches across path, url, error message, and body", () => {
    const searchError = applyRequestFilters(records, { search: "gateway" });
    expect(searchError).toHaveLength(1);
    expect(searchError[0].id).toBe("r3");

    const searchBody = applyRequestFilters(records, { search: "alice" });
    expect(searchBody).toHaveLength(1);
    expect(searchBody[0].id).toBe("r2");
  });

  it("respects order and limit", () => {
    const newest = applyRequestFilters(records, { order: "newest-first", limit: 2 });
    expect(newest.map((r) => r.id)).toEqual(["r4", "r3"]);

    const oldest = applyRequestFilters(records, { order: "oldest-first", limit: 2 });
    expect(oldest.map((r) => r.id)).toEqual(["r1", "r2"]);
  });
});

