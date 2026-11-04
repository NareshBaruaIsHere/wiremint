import { describe, expect, it } from "vitest";
import { parseEnvironmentConfig } from "../../src/config/environment.js";
import { ConfigurationError } from "../../src/core/errors.js";

describe("Environment Variable Config Parsing", () => {
  it("returns empty object when no WIREMINT_* env variables are present", () => {
    const config = parseEnvironmentConfig({});
    expect(config).toEqual({});
  });

  describe("WIREMINT_PORT", () => {
    it("parses valid port number", () => {
      const config = parseEnvironmentConfig({ WIREMINT_PORT: "4000" });
      expect(config.server?.port).toBe(4000);
    });

    it("throws ConfigurationError on invalid port", () => {
      expect(() => parseEnvironmentConfig({ WIREMINT_PORT: "invalid" })).toThrow(
        ConfigurationError,
      );
      expect(() => parseEnvironmentConfig({ WIREMINT_PORT: "0" })).toThrow(
        ConfigurationError,
      );
      expect(() => parseEnvironmentConfig({ WIREMINT_PORT: "70000" })).toThrow(
        ConfigurationError,
      );
    });
  });

  describe("WIREMINT_HOST", () => {
    it("parses valid host string", () => {
      const config = parseEnvironmentConfig({ WIREMINT_HOST: "0.0.0.0" });
      expect(config.server?.host).toBe("0.0.0.0");
    });

    it("throws ConfigurationError on empty host string", () => {
      expect(() => parseEnvironmentConfig({ WIREMINT_HOST: "   " })).toThrow(
        ConfigurationError,
      );
    });
  });

  describe("WIREMINT_BASE_PATH", () => {
    it("parses valid basePath", () => {
      const config = parseEnvironmentConfig({ WIREMINT_BASE_PATH: "/api/v2" });
      expect(config.server?.basePath).toBe("/api/v2");
    });

    it("throws ConfigurationError when basePath lacks leading slash", () => {
      expect(() => parseEnvironmentConfig({ WIREMINT_BASE_PATH: "api/v2" })).toThrow(
        ConfigurationError,
      );
    });
  });

  describe("WIREMINT_INSPECTOR_ENABLED", () => {
    it("parses truthy values", () => {
      for (const val of ["true", "1", "yes", "on", "TRUE"]) {
        const config = parseEnvironmentConfig({ WIREMINT_INSPECTOR_ENABLED: val });
        expect(config.inspector).toEqual({ enabled: true });
      }
    });

    it("parses falsy values", () => {
      for (const val of ["false", "0", "no", "off", "FALSE"]) {
        const config = parseEnvironmentConfig({ WIREMINT_INSPECTOR_ENABLED: val });
        expect(config.inspector).toEqual({ enabled: false });
      }
    });

    it("throws ConfigurationError on invalid boolean value", () => {
      expect(() =>
        parseEnvironmentConfig({ WIREMINT_INSPECTOR_ENABLED: "not-a-bool" }),
      ).toThrow(ConfigurationError);
    });
  });

  describe("WIREMINT_LOG_LEVEL", () => {
    it("parses valid log levels", () => {
      for (const level of ["silent", "error", "warn", "info", "debug"]) {
        const config = parseEnvironmentConfig({ WIREMINT_LOG_LEVEL: level });
        expect(config.logging?.level).toBe(level);
      }
    });

    it("throws ConfigurationError on invalid log level", () => {
      expect(() => parseEnvironmentConfig({ WIREMINT_LOG_LEVEL: "verbose" })).toThrow(
        ConfigurationError,
      );
    });
  });

  it("does not mutate the input environment object", () => {
    const env = Object.freeze({ WIREMINT_PORT: "8080" });
    expect(() => parseEnvironmentConfig(env)).not.toThrow();
  });
});

