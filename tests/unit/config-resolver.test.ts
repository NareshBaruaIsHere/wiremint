import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, resolveConfig } from "../../src/config/config-resolver.js";
import { DEFAULT_HOST, DEFAULT_PORT, DEFAULT_BASE_PATH } from "../../src/config/defaults.js";
import { createWiremint } from "../../src/core/engine.js";
import { ConfigurationError } from "../../src/core/errors.js";

describe("Config Resolver & Precedence", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "wiremint-resolver-test-"));
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it("throws ConfigurationError when resolveConfig receives an unresolved Promise", () => {
    const promiseConfig = Promise.resolve({ server: { port: 3000 } });
    expect(() =>
      resolveConfig(promiseConfig as unknown as Record<string, unknown>),
    ).toThrow(ConfigurationError);
  });

  it("throws ConfigurationError when synchronous createWiremint receives a Promise or factory function", () => {
    const promiseConfig = Promise.resolve({ server: { port: 3000 } });
    expect(() =>
      createWiremint(promiseConfig as unknown as Record<string, unknown>),
    ).toThrow(ConfigurationError);

    const factoryFn = () => ({ server: { port: 3000 } });
    expect(() =>
      createWiremint(factoryFn as unknown as Record<string, unknown>),
    ).toThrow(ConfigurationError);
  });

  it("returns baseline defaults when called with empty inputs", () => {
    const resolved = resolveConfig({}, { env: {} });
    expect(resolved.server.port).toBe(DEFAULT_PORT);
    expect(resolved.server.host).toBe(DEFAULT_HOST);
    expect(resolved.server.basePath).toBe(DEFAULT_BASE_PATH);
    expect(resolved.inspector.enabled).toBe(true);
    expect(resolved.inspector.maxEntries).toBe(1000);
    expect(resolved.logging.level).toBe("info");
  });

  it("allows config file values to override baseline defaults", () => {
    const resolved = resolveConfig(
      {
        server: { port: 4000, host: "0.0.0.0" },
      },
      { env: {} },
    );
    expect(resolved.server.port).toBe(4000);
    expect(resolved.server.host).toBe("0.0.0.0");
    expect(resolved.server.basePath).toBe(DEFAULT_BASE_PATH); // Default preserved
  });

  it("allows environment variables to override config file values", () => {
    const resolved = resolveConfig(
      {
        server: { port: 4000, host: "127.0.0.1" },
        inspector: true,
      },
      {
        env: {
          WIREMINT_PORT: "5000",
          WIREMINT_INSPECTOR_ENABLED: "false",
        },
      },
    );
    expect(resolved.server.port).toBe(5000); // Env won over file
    expect(resolved.server.host).toBe("127.0.0.1"); // File preserved
    expect(resolved.inspector.enabled).toBe(false); // Env won
  });

  it("allows programmatic overrides to override environment variables", () => {
    const resolved = resolveConfig(
      {
        server: { port: 4000 },
      },
      {
        env: { WIREMINT_PORT: "5000" },
        overrides: {
          server: { port: 6000 },
        },
      },
    );
    expect(resolved.server.port).toBe(6000); // Overrides won over env and file
  });

  it("respects full precedence hierarchy: defaults < file < env < overrides", () => {
    // 1. port: override wins (7000)
    // 2. host: env wins ("0.0.0.0")
    // 3. basePath: file wins ("/api/v1")
    // 4. maxBodySize: default wins (1_048_576)
    const resolved = resolveConfig(
      {
        server: {
          port: 4000,
          host: "10.0.0.1",
          basePath: "/api/v1",
        },
      },
      {
        env: {
          WIREMINT_PORT: "5000",
          WIREMINT_HOST: "0.0.0.0",
        },
        overrides: {
          server: {
            port: 7000,
          },
        },
      },
    );

    expect(resolved.server.port).toBe(7000);
    expect(resolved.server.host).toBe("0.0.0.0");
    expect(resolved.server.basePath).toBe("/api/v1");
    expect(resolved.server.maxBodySize).toBe(1_048_576);
  });

  describe("loadConfig() end-to-end", () => {
    it("loads and resolves config from discovered file in cwd", async () => {
      const configPath = join(tempDir, "wiremint.config.json");
      writeFileSync(
        configPath,
        JSON.stringify({
          server: { port: 8888, basePath: "/test" },
        }),
      );

      const resolved = await loadConfig({ cwd: tempDir, env: {} });
      expect(resolved.server.port).toBe(8888);
      expect(resolved.server.basePath).toBe("/test");
      expect(resolved.configFile).toBe(configPath);
    });

    it("loads explicit config file and applies env overrides", async () => {
      const configPath = join(tempDir, "custom.json");
      writeFileSync(
        configPath,
        JSON.stringify({
          server: { port: 8888 },
        }),
      );

      const resolved = await loadConfig({
        cwd: tempDir,
        configFile: "custom.json",
        env: { WIREMINT_PORT: "9999" },
      });

      expect(resolved.server.port).toBe(9999);
      expect(resolved.configFile).toBe(configPath);
    });
  });
});

