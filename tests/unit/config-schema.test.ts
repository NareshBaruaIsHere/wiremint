import { describe, expect, it } from "vitest";
import { wiremintConfigSchema } from "../../src/config/schema.js";
import { assertValidConfig, validateConfig } from "../../src/config/validate-config.js";
import { ConfigurationError } from "../../src/core/errors.js";

describe("Config Schema & Validation", () => {
  it("validates an empty configuration object with defaults", () => {
    const result = validateConfig({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeDefined();
    }
  });

  describe("Server configuration validation", () => {
    it("accepts valid server port, host, and basePath", () => {
      const result = validateConfig({
        server: {
          port: 8080,
          host: "0.0.0.0",
          basePath: "/api/v1",
          maxBodySize: 2048,
        },
      });
      expect(result.success).toBe(true);
    });

    it("rejects port out of valid range (1 - 65535)", () => {
      const resultUnder = validateConfig({ server: { port: 0 } });
      expect(resultUnder.success).toBe(false);
      if (!resultUnder.success) {
        expect(resultUnder.errors[0]?.path).toBe("server.port");
      }

      const resultOver = validateConfig({ server: { port: 70000 } });
      expect(resultOver.success).toBe(false);
      if (!resultOver.success) {
        expect(resultOver.errors[0]?.path).toBe("server.port");
      }
    });

    it("rejects basePath that does not start with a slash", () => {
      const result = validateConfig({ server: { basePath: "api" } });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0]?.path).toBe("server.basePath");
        expect(result.errors[0]?.message).toContain("must start with");
      }
    });

    it("rejects negative maxBodySize", () => {
      const result = validateConfig({ server: { maxBodySize: -1 } });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0]?.path).toBe("server.maxBodySize");
      }
    });
  });

  describe("Route configuration validation", () => {
    it("accepts valid declarative routes", () => {
      const result = validateConfig({
        routes: [
          {
            path: "/users/:id",
            method: "GET",
            response: {
              status: 200,
              body: { id: "{{params.id}}" },
            },
          },
          {
            path: "/items",
            method: "post",
            response: {
              status: 201,
              body: { created: true },
            },
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("rejects unsupported HTTP methods", () => {
      const result = validateConfig({
        routes: [
          {
            path: "/test",
            // @ts-expect-error testing invalid method
            method: "CONNECT",
            response: { status: 200 },
          },
        ],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0]?.path).toBe("routes[0].method");
      }
    });

    it("rejects route path not starting with '/'", () => {
      const result = validateConfig({
        routes: [
          {
            path: "no-slash",
            method: "GET",
            response: { status: 200 },
          },
        ],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0]?.path).toBe("routes[0].path");
      }
    });

    it("rejects route status outside 100-599", () => {
      const result = validateConfig({
        routes: [
          {
            path: "/test",
            method: "GET",
            response: { status: 99 },
          },
        ],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0]?.path).toBe("routes[0].response.status");
      }
    });

    it("validates sequential responses in routes", () => {
      const result = validateConfig({
        routes: [
          {
            path: "/poll",
            method: "GET",
            sequence: [
              { status: 202, body: { status: "pending" } },
              { status: 200, body: { status: "completed" } },
            ],
            afterEnd: "repeatLast",
          },
        ],
      });
      expect(result.success).toBe(true);
    });
  });

  describe("Scenario configuration validation", () => {
    it("accepts valid scenario definitions", () => {
      const result = validateConfig({
        scenarios: [
          {
            id: "maintenance",
            name: "Maintenance Mode",
            description: "Simulates API downtime",
            initialState: { active: true },
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty scenario id", () => {
      const result = validateConfig({
        scenarios: [
          {
            id: "",
          },
        ],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0]?.path).toBe("scenarios[0].id");
      }
    });
  });

  describe("Simulation and Inspector configuration", () => {
    it("validates simulation parameters", () => {
      const result = validateConfig({
        simulation: {
          latency: { min: 100, max: 200, jitter: 50 },
          failure: { rate: 0.1, statusCode: 500 },
          timeout: { after: 5000, statusCode: 504 },
          connection: { dropRate: 0.05 },
        },
      });
      expect(result.success).toBe(true);
    });

    it("rejects negative latency or jitter", () => {
      const result = validateConfig({
        simulation: { latency: { min: -10, max: 100 } },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0]?.path).toBe("simulation.latency.min");
      }
    });

    it("rejects failure rate > 1", () => {
      const result = validateConfig({
        simulation: { failure: { rate: 1.5 } },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0]?.path).toBe("simulation.failure.rate");
      }
    });

    it("validates inspector boolean and object configs", () => {
      expect(validateConfig({ inspector: true }).success).toBe(true);
      expect(validateConfig({ inspector: false }).success).toBe(true);
      expect(
        validateConfig({
          inspector: {
            enabled: true,
            maxEntries: 500,
            sensitiveKeys: ["api_key"],
          },
        }).success,
      ).toBe(true);
    });
  });

  describe("assertValidConfig error throwing", () => {
    it("throws ConfigurationError with formatted message on invalid config", () => {
      expect(() => {
        assertValidConfig({
          server: {
            port: 99999,
          },
        });
      }).toThrow(ConfigurationError);

      try {
        assertValidConfig({
          server: {
            port: 99999,
          },
        });
      } catch (err) {
        expect(err).toBeInstanceOf(ConfigurationError);
        expect((err as ConfigurationError).message).toContain("server.port");
      }
    });

    it("does not throw on valid config", () => {
      expect(() => {
        assertValidConfig({
          server: {
            port: 3000,
          },
        });
      }).not.toThrow();
    });
  });
});
