import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findConfigFile, resolveExplicitConfigFile } from "../../src/config/config-discovery.js";
import { ConfigurationError } from "../../src/core/errors.js";

describe("Config Discovery", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "wiremint-discovery-test-"));
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it("returns null when no config file exists in directory", () => {
    const result = findConfigFile(tempDir);
    expect(result).toBeNull();
  });

  it("discovers wiremint.config.ts when present", () => {
    const configPath = join(tempDir, "wiremint.config.ts");
    writeFileSync(configPath, "export default {};");

    const result = findConfigFile(tempDir);
    expect(result).toBe(configPath);
  });

  it("discovers wiremint.config.json when present", () => {
    const configPath = join(tempDir, "wiremint.config.json");
    writeFileSync(configPath, "{}");

    const result = findConfigFile(tempDir);
    expect(result).toBe(configPath);
  });

  it("discovers wiremint.config.js when present", () => {
    const configPath = join(tempDir, "wiremint.config.js");
    writeFileSync(configPath, "module.exports = {};");

    const result = findConfigFile(tempDir);
    expect(result).toBe(configPath);
  });

  it("discovers wiremint.config.mjs when present", () => {
    const configPath = join(tempDir, "wiremint.config.mjs");
    writeFileSync(configPath, "export default {};");

    const result = findConfigFile(tempDir);
    expect(result).toBe(configPath);
  });

  it("throws ConfigurationError when multiple config files exist (ambiguity detection)", () => {
    writeFileSync(join(tempDir, "wiremint.config.ts"), "export default {};");
    writeFileSync(join(tempDir, "wiremint.config.json"), "{}");

    expect(() => findConfigFile(tempDir)).toThrow(ConfigurationError);
    expect(() => findConfigFile(tempDir)).toThrow(/Ambiguous configuration files detected/);
  });

  describe("resolveExplicitConfigFile", () => {
    it("resolves existing relative config file", () => {
      const configPath = join(tempDir, "custom.config.json");
      writeFileSync(configPath, "{}");

      const result = resolveExplicitConfigFile("custom.config.json", tempDir);
      expect(result).toBe(configPath);
    });

    it("resolves existing absolute config file", () => {
      const configPath = join(tempDir, "custom.config.json");
      writeFileSync(configPath, "{}");

      const result = resolveExplicitConfigFile(configPath);
      expect(result).toBe(configPath);
    });

    it("throws ConfigurationError when explicit config file does not exist", () => {
      expect(() =>
        resolveExplicitConfigFile("non-existent.config.ts", tempDir),
      ).toThrow(ConfigurationError);
      expect(() =>
        resolveExplicitConfigFile("non-existent.config.ts", tempDir),
      ).toThrow(/Configuration file not found/);
    });
  });
});

