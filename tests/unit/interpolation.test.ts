import { describe, expect, it } from "vitest";
import { interpolateValue } from "../../src/config/config-applier.js";
import type { RequestContext } from "../../src/core/types.js";
import { RouteError } from "../../src/core/errors.js";

describe("Dynamic Value Interpolation & Safety", () => {
  const dummyContext: RequestContext = {
    requestId: "req_xyz123",
    method: "GET",
    path: "/users/42",
    params: { id: "42", name: "Alice" },
    query: { filter: "active", tags: ["a", "b"] },
    headers: {},
    body: null,
    signal: new AbortController().signal,
    scenario: {
      id: "test-scenario",
      name: "Test Scenario",
      description: "A scenario for testing",
      state: {
        get: () => undefined,
        set: () => {},
        has: () => false,
        delete: () => false,
        clear: () => {},
        snapshot: () => ({}),
      },
      reset: () => {},
    },
  };

  it("replaces exact and embedded params", () => {
    expect(interpolateValue("{{params.id}}", dummyContext)).toBe("42");
    expect(interpolateValue("User: {{params.name}}", dummyContext)).toBe("User: Alice");
  });

  it("replaces query parameters including array join", () => {
    expect(interpolateValue("{{query.filter}}", dummyContext)).toBe("active");
    expect(interpolateValue("{{query.tags}}", dummyContext)).toBe("a,b");
  });

  it("replaces scenario and requestId placeholders", () => {
    expect(interpolateValue("{{scenario.id}}", dummyContext)).toBe("test-scenario");
    expect(interpolateValue("{{scenario.name}}", dummyContext)).toBe("Test Scenario");
    expect(interpolateValue("{{scenario.description}}", dummyContext)).toBe("A scenario for testing");
    expect(interpolateValue("{{requestId}}", dummyContext)).toBe("req_xyz123");
  });

  it("handles missing parameters in lenient mode by defaulting to empty string", () => {
    expect(interpolateValue("{{params.missing}}", dummyContext)).toBe("");
    expect(interpolateValue("{{query.missing}}", dummyContext)).toBe("");
  });

  it("preserves unrecognized template tags in lenient mode", () => {
    expect(interpolateValue("{{customTemplate}}", dummyContext)).toBe("{{customTemplate}}");
    expect(interpolateValue("Hello {{other.field}}", dummyContext)).toBe("Hello {{other.field}}");
  });

  it("safely handles multiple placeholders in a single string", () => {
    const template = "ID: {{params.id}}, Filter: {{query.filter}}, Req: {{requestId}}";
    expect(interpolateValue(template, dummyContext)).toBe("ID: 42, Filter: active, Req: req_xyz123");
  });

  it("safely handles special regex replacement characters like $, \\, and quotes without corruption", () => {
    const specialContext: RequestContext = {
      ...dummyContext,
      params: { special: "$1 $& $' $$ \\n \\t \"quote\"" },
    };

    const res = interpolateValue("{{params.special}}", specialContext);
    expect(res).toBe("$1 $& $' $$ \\n \\t \"quote\"");
  });

  it("safely handles malformed placeholder syntax without error", () => {
    expect(interpolateValue("{{malformed", dummyContext)).toBe("{{malformed");
    expect(interpolateValue("no brackets", dummyContext)).toBe("no brackets");
    expect(interpolateValue("{{}}", dummyContext)).toBe("{{}}");
  });

  it("recursively interpolates nested objects and arrays", () => {
    const input = {
      user: {
        id: "{{params.id}}",
        tags: ["{{query.filter}}", "static", { req: "{{requestId}}" }],
      },
    };

    const expected = {
      user: {
        id: "42",
        tags: ["active", "static", { req: "req_xyz123" }],
      },
    };

    expect(interpolateValue(input, dummyContext)).toEqual(expected);
  });

  describe("Strict Interpolation Mode", () => {
    it("throws RouteError on missing route param in strict mode", () => {
      expect(() =>
        interpolateValue("{{params.missing}}", dummyContext, { strict: true }),
      ).toThrow(RouteError);
    });

    it("throws RouteError on missing query param in strict mode", () => {
      expect(() =>
        interpolateValue("{{query.missing}}", dummyContext, { strict: true }),
      ).toThrow(RouteError);
    });

    it("throws RouteError on unknown placeholder in strict mode", () => {
      expect(() =>
        interpolateValue("{{unknown.key}}", dummyContext, { strict: true }),
      ).toThrow(RouteError);
    });
  });
});

