import { describe, expect, it } from "vitest";
import { wiremintMatchers } from "../../src/testing/vitest/matchers.js";
import type { TestResponse } from "../../src/testing/types.js";

function makeResponse(overrides: Partial<TestResponse> = {}): TestResponse {
  return {
    status: 200,
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: { id: 1, name: "Alice" },
    text: '{"id":1,"name":"Alice"}',
    json: () => ({ id: 1, name: "Alice" }),
    requestId: "req-1",
    duration: 10,
    ok: true,
    ...overrides,
  };
}

describe("Vitest Matchers Adapter", () => {
  it("toHaveStatus evaluates pass and failure messages", () => {
    const res200 = makeResponse({ status: 200 });
    const res404 = makeResponse({ status: 404 });

    const passResult = wiremintMatchers.toHaveStatus(res200, 200);
    expect(passResult.pass).toBe(true);

    const failResult = wiremintMatchers.toHaveStatus(res404, 200);
    expect(failResult.pass).toBe(false);
    expect(failResult.message()).toContain("Expected response status to be 200");
  });

  it("toBeSuccessful evaluates ok status", () => {
    const okRes = makeResponse({ ok: true, status: 200 });
    const errRes = makeResponse({ ok: false, status: 500 });

    expect(wiremintMatchers.toBeSuccessful(okRes).pass).toBe(true);
    expect(wiremintMatchers.toBeSuccessful(errRes).pass).toBe(false);
  });

  it("toHaveHeader evaluates header presence and values", () => {
    const res = makeResponse({ headers: { "x-token": "secret-123" } });

    expect(wiremintMatchers.toHaveHeader(res, "x-token").pass).toBe(true);
    expect(wiremintMatchers.toHaveHeader(res, "x-token", "secret-123").pass).toBe(true);
    expect(wiremintMatchers.toHaveHeader(res, "x-token", /secret/).pass).toBe(true);

    expect(wiremintMatchers.toHaveHeader(res, "missing").pass).toBe(false);
    expect(wiremintMatchers.toHaveHeader(res, "x-token", "other").pass).toBe(false);
  });

  it("toHaveJson checks JSON format and subset matching", () => {
    const res = makeResponse({ body: { a: 1, b: 2 } });

    expect(wiremintMatchers.toHaveJson(res).pass).toBe(true);
    expect(wiremintMatchers.toHaveJson(res, { a: 1 }).pass).toBe(true);
    expect(wiremintMatchers.toHaveJson(res, { a: 99 }).pass).toBe(false);
  });

  it("toHaveBody checks body equality", () => {
    const res = makeResponse({ body: { ok: true } });

    expect(wiremintMatchers.toHaveBody(res, { ok: true }).pass).toBe(true);
    expect(wiremintMatchers.toHaveBody(res, { ok: false }).pass).toBe(false);
  });

  it("can be registered into Vitest expect", () => {
    expect.extend(wiremintMatchers);

    const res = makeResponse({ status: 200, ok: true, headers: { "content-type": "application/json" } });
    expect(res).toHaveStatus(200);
    expect(res).toBeSuccessful();
    expect(res).toHaveHeader("content-type", /json/);
    expect(res).toHaveJson({ id: 1 });
  });
});
