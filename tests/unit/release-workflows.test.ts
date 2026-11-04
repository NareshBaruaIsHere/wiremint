import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

describe("CI, Release & Docs Workflows (M08.1)", () => {
  const rootDir = resolve(import.meta.dirname, "../..");
  const workflowsDir = resolve(rootDir, ".github/workflows");

  it("verifies release.yml uses OIDC trusted publishing and guarded dispatch", () => {
    const releasePath = resolve(workflowsDir, "release.yml");
    expect(existsSync(releasePath)).toBe(true);

    const content = readFileSync(releasePath, "utf-8");

    // Guarded manual workflow_dispatch with boolean publish input defaulting to false
    expect(content).toContain("workflow_dispatch:");
    expect(content).toContain("publish:");
    expect(content).toContain("type: boolean");
    expect(content).toContain("default: false");

    // Must NOT contain on: release: published (prevents unverified automatic triggers)
    expect(content).not.toContain("types: [published]");

    // Permissions for OIDC trusted publishing
    expect(content).toContain("id-token: write");
    expect(content).toContain("contents: read");

    // Uses Node.js 26 (bundles npm >= 11.5.1) and pinned pnpm 10.5.2
    expect(content).toContain("node-version: 26");
    expect(content).toContain("version: 10.5.2");

    // Command uses npm publish with provenance
    expect(content).toContain("npm publish --provenance --access public");

    // No long-lived NPM_TOKEN secret requirement
    expect(content).not.toContain("secrets.NPM_TOKEN");
  });

  it("verifies ci.yml tests across Node 22, 24, 26 and Ubuntu + Windows", () => {
    const ciPath = resolve(workflowsDir, "ci.yml");
    expect(existsSync(ciPath)).toBe(true);

    const content = readFileSync(ciPath, "utf-8");

    // Operating systems
    expect(content).toContain("ubuntu-latest");
    expect(content).toContain("windows-latest");

    // Node versions: 22 (min supported), 24, and 26
    expect(content).toMatch(/node-version:\s*\[\s*22,\s*24,\s*26\s*\]/);

    // Pinned pnpm version 10.5.2
    expect(content).toContain("version: 10.5.2");
  });

  it("verifies docs.yml deploys to GitHub Pages via official actions", () => {
    const docsPath = resolve(workflowsDir, "docs.yml");
    expect(existsSync(docsPath)).toBe(true);

    const content = readFileSync(docsPath, "utf-8");

    // Pinned pnpm version 10.5.2
    expect(content).toContain("version: 10.5.2");

    // Uses upload-pages-artifact and deploy-pages
    expect(content).toContain("actions/upload-pages-artifact@v3");
    expect(content).toContain("actions/deploy-pages@v4");

    // Upload artifact path
    expect(content).toContain("./docs/.vitepress/dist");

    // GitHub Pages environment and permissions
    expect(content).toContain("environment:");
    expect(content).toContain("name: github-pages");
    expect(content).toContain("pages: write");
    expect(content).toContain("id-token: write");
  });
});
