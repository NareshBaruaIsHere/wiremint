import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfigFile } from "../../src/config/config-loader.js";
import { ConfigurationError } from "../../src/core/errors.js";

describe("Config Loader", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "wiremint-loader-test-"));
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  describe("JSON configuration loading", () => {
    it("loads valid JSON config file", async () => {
      const filePath = join(tempDir, "wiremint.config.json");
      writeFileSync(filePath, JSON.stringify({ server: { port: 8080 } }));

      const config = await loadConfigFile(filePath);
      expect(config.server?.port).toBe(8080);
    });

    it("throws ConfigurationError on malformed JSON", async () => {
      const filePath = join(tempDir, "wiremint.config.json");
      writeFileSync(filePath, "{ invalid json");

      await expect(loadConfigFile(filePath)).rejects.toThrow(ConfigurationError);
      await expect(loadConfigFile(filePath)).rejects.toThrow(/Failed to parse JSON/);
    });

    it("throws ConfigurationError if JSON is not an object", async () => {
      const filePath = join(tempDir, "wiremint.config.json");
      writeFileSync(filePath, JSON.stringify(["not", "an", "object"]));

      await expect(loadConfigFile(filePath)).rejects.toThrow(ConfigurationError);
      await expect(loadConfigFile(filePath)).rejects.toThrow(/must contain a top-level object/);
    });
  });

  describe("JavaScript / ESM configuration loading", () => {
    it("loads config from .mjs with default export", async () => {
      const filePath = join(tempDir, "wiremint.config.mjs");
      writeFileSync(
        filePath,
        "export default { server: { port: 9000, host: '0.0.0.0' } };",
      );

      const config = await loadConfigFile(filePath);
      expect(config.server?.port).toBe(9000);
      expect(config.server?.host).toBe("0.0.0.0");
    });

    it("loads config from .mjs with named config export", async () => {
      const filePath = join(tempDir, "wiremint.config.mjs");
      writeFileSync(
        filePath,
        "export const config = { server: { port: 9001 } };",
      );

      const config = await loadConfigFile(filePath);
      expect(config.server?.port).toBe(9001);
    });

    it("loads config from .mjs with async factory function", async () => {
      const filePath = join(tempDir, "wiremint.config.mjs");
      writeFileSync(
        filePath,
        "export default async () => ({ server: { port: 9002 } });",
      );

      const config = await loadConfigFile(filePath);
      expect(config.server?.port).toBe(9002);
    });

    it("throws ConfigurationError when factory function throws", async () => {
      const filePath = join(tempDir, "wiremint.config.mjs");
      writeFileSync(
        filePath,
        "export default async () => { throw new Error('Dynamic failure'); };",
      );

      await expect(loadConfigFile(filePath)).rejects.toThrow(ConfigurationError);
      await expect(loadConfigFile(filePath)).rejects.toThrow(/Configuration factory in .* threw an error/);
    });

    it("throws ConfigurationError if file has no exports", async () => {
      const filePath = join(tempDir, "wiremint.config.mjs");
      writeFileSync(filePath, "const a = 1;");

      await expect(loadConfigFile(filePath)).rejects.toThrow(ConfigurationError);
      await expect(loadConfigFile(filePath)).rejects.toThrow(/must export a default configuration/);
    });

    it("loads basic .ts configuration file", async () => {
      const filePath = join(tempDir, "wiremint.config.ts");
      writeFileSync(
        filePath,
        "interface ServerOpts { port: number; }; const server: ServerOpts = { port: 9005 }; export default { server };",
      );

      const config = await loadConfigFile(filePath);
      expect(config.server?.port).toBe(9005);
    });

    it("loads .ts config importing a local .ts module", async () => {
      const helperPath = join(tempDir, "helper.ts");
      writeFileSync(helperPath, "export const port: number = 9006;");

      const configPath = join(tempDir, "wiremint.config.ts");
      writeFileSync(
        configPath,
        "import { port } from './helper.ts'; export default { server: { port } };",
      );

      const config = await loadConfigFile(configPath);
      expect(config.server?.port).toBe(9006);
    });

    it("throws ConfigurationError when .ts config has invalid syntax", async () => {
      const configPath = join(tempDir, "wiremint.config.ts");
      writeFileSync(
        configPath,
        "export default { server: { port: ;;; } };",
      );

      await expect(loadConfigFile(configPath)).rejects.toThrow(ConfigurationError);
      await expect(loadConfigFile(configPath)).rejects.toThrow(/Failed to load configuration file/);
    });
  });

  describe("Unsupported formats", () => {
    it("throws ConfigurationError on unsupported extensions", async () => {
      const filePath = join(tempDir, "wiremint.config.yaml");
      writeFileSync(filePath, "port: 3000");

      await expect(loadConfigFile(filePath)).rejects.toThrow(ConfigurationError);
      await expect(loadConfigFile(filePath)).rejects.toThrow(/Unsupported configuration file format/);
    });
  });
});

