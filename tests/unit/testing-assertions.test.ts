import { describe, expect, it } from "vitest";
import {
  expectBody,
  expectClientError,
  expectError,
  expectHeader,
  expectHeaderMissing,
  expectJson,
  expectServerError,
  expectStatus,
  expectSuccessful,
  expectText,
  TestAssertionError,
} from "../../src/testing/assertions/index.js";
import type { TestResponse } from "../../src/testing/types.js";

function createMockResponse(overrides: Partial<TestResponse> = {}): TestResponse {
  return {
    status: 200,
    statusCode: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: { id: 1, name: "Naresh", role: "developer" },
    text: '{"id":1,"name":"Naresh","role":"developer"}',
    json: () => ({ id: 1, name: "Naresh", role: "developer" }),
    requestId: "req-1",
    duration: 5,
    ok: true,
    ...overrides,
  };
}

describe("Testing Assertions", () => {
  describe("Status assertions", () => {
    it("expectStatus passes when status matches", () => {
      const res = createMockResponse({ status: 200 });
      expect(() => expectStatus(res, 200)).not.toThrow();
    });

    it("expectStatus throws TestAssertionError when status does not match", () => {
      const res = createMockResponse({ status: 404 });
      expect(() => expectStatus(res, 200)).toThrow(TestAssertionError);
    });

    it("expectSuccessful passes for 2xx responses", () => {
      expect(() => expectSuccessful(createMockResponse({ status: 200, ok: true }))).not.toThrow();
      expect(() => expectSuccessful(createMockResponse({ status: 204, ok: true }))).not.toThrow();
    });

    it("expectSuccessful throws for non-2xx responses", () => {
      expect(() => expectSuccessful(createMockResponse({ status: 500, ok: false }))).toThrow(
        TestAssertionError,
      );
    });

    it("expectClientError passes for 4xx and throws for others", () => {
      expect(() => expectClientError(createMockResponse({ status: 400 }))).not.toThrow();
      expect(() => expectClientError(createMockResponse({ status: 404 }))).not.toThrow();
      expect(() => expectClientError(createMockResponse({ status: 200 }))).toThrow(TestAssertionError);
    });

    it("expectServerError passes for 5xx and throws for others", () => {
      expect(() => expectServerError(createMockResponse({ status: 500 }))).not.toThrow();
      expect(() => expectServerError(createMockResponse({ status: 503 }))).not.toThrow();
      expect(() => expectServerError(createMockResponse({ status: 200 }))).toThrow(TestAssertionError);
    });
  });

  describe("Header assertions", () => {
    it("expectHeader verifies presence and value", () => {
      const res = createMockResponse({
        headers: { "x-custom": "my-header", "content-type": "application/json" },
      });

      expect(() => expectHeader(res, "x-custom")).not.toThrow();
      expect(() => expectHeader(res, "X-Custom", "my-header")).not.toThrow();
      expect(() => expectHeader(res, "content-type", /json/)).not.toThrow();

      expect(() => expectHeader(res, "missing-header")).toThrow(TestAssertionError);
      expect(() => expectHeader(res, "x-custom", "wrong-val")).toThrow(TestAssertionError);
    });

    it("expectHeaderMissing verifies absence", () => {
      const res = createMockResponse({ headers: { "content-type": "application/json" } });
      expect(() => expectHeaderMissing(res, "authorization")).not.toThrow();
      expect(() => expectHeaderMissing(res, "content-type")).toThrow(TestAssertionError);
    });
  });

  describe("Body & JSON assertions", () => {
    it("expectJson verifies JSON body and deep partial subsets", () => {
      const res = createMockResponse({
        body: { id: 1, name: "Naresh", tags: ["a", "b"], nested: { active: true } },
      });

      expect(() => expectJson(res)).not.toThrow();
      expect(() => expectJson(res, { name: "Naresh" })).not.toThrow();
      expect(() => expectJson(res, { nested: { active: true } })).not.toThrow();

      expect(() => expectJson(res, { name: "Wrong" })).toThrow(TestAssertionError);
    });

    it("expectBody checks exact equality", () => {
      const res = createMockResponse({ body: { ok: true } });
      expect(() => expectBody(res, { ok: true })).not.toThrow();
      expect(() => expectBody(res, { ok: false })).toThrow(TestAssertionError);
    });

    it("expectText checks string substring or regex match", () => {
      const res = createMockResponse({ text: "Hello World" });
      expect(() => expectText(res, "Hello")).not.toThrow();
      expect(() => expectText(res, /^Hello/)).not.toThrow();
      expect(() => expectText(res, "Goodbye")).toThrow(TestAssertionError);
    });

    it("expectError verifies error response status and message", () => {
      const res = createMockResponse({
        status: 400,
        ok: false,
        body: { error: "Invalid parameter format" },
        text: '{"error":"Invalid parameter format"}',
      });

      expect(() => expectError(res)).not.toThrow();
      expect(() => expectError(res, 400)).not.toThrow();
      expect(() => expectError(res, 400, "parameter format")).not.toThrow();
      expect(() => expectError(res, 400, /Invalid/)).not.toThrow();

      expect(() => expectError(res, 404)).toThrow(TestAssertionError);
      expect(() => expectError(res, 400, "different message")).toThrow(TestAssertionError);
    });
  });
});

