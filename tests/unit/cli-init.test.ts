import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit } from "../../src/cli/commands/init.js";

describe("CLI init Command", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "wiremint-init-test-"));
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it("generates wiremint.config.ts by default", async () => {
    await runInit({ cwd: tempDir, format: "ts" });

    const configPath = join(tempDir, "wiremint.config.ts");
    expect(existsSync(configPath)).toBe(true);

    const content = readFileSync(configPath, "utf-8");
    expect(content).toContain('import { defineConfig } from "wiremint/config";');
    expect(content).toContain("export default defineConfig");

    const gitignorePath = join(tempDir, ".gitignore");
    expect(existsSync(gitignorePath)).toBe(true);
    expect(readFileSync(gitignorePath, "utf-8")).toContain(".wiremint");

    const readmePath = join(tempDir, "README.md");
    expect(existsSync(readmePath)).toBe(true);
  });

  it("generates wiremint.config.json when --format json is specified", async () => {
    await runInit({ cwd: tempDir, format: "json" });

    const configPath = join(tempDir, "wiremint.config.json");
    expect(existsSync(configPath)).toBe(true);

    const content = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed.server.port).toBe(3001);
    expect(Array.isArray(parsed.routes)).toBe(true);
  });

  it("does not overwrite existing config file without --force", async () => {
    const configPath = join(tempDir, "wiremint.config.ts");
    writeFileSync(configPath, "// Original custom content");

    await runInit({ cwd: tempDir, format: "ts", force: false });

    const content = readFileSync(configPath, "utf-8");
    expect(content).toBe("// Original custom content");
  });

  it("overwrites existing config file when --force is passed", async () => {
    const configPath = join(tempDir, "wiremint.config.ts");
    writeFileSync(configPath, "// Original custom content");

    await runInit({ cwd: tempDir, format: "ts", force: true });

    const content = readFileSync(configPath, "utf-8");
    expect(content).toContain("defineConfig");
  });
});

