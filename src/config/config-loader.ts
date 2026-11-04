import { readFile } from "node:fs/promises";
import { extname, basename } from "node:path";
import { pathToFileURL } from "node:url";
import { ConfigurationError } from "../core/errors.js";
import type { WiremintConfig } from "./types.js";

/**
 * Loads a raw configuration object from a given file path.
 * Supports .json, .ts, .js, and .mjs files.
 */
export async function loadConfigFile(filePath: string): Promise<WiremintConfig> {
  const ext = extname(filePath).toLowerCase();

  // 1. JSON configuration
  if (ext === ".json") {
    let content: string;
    try {
      content = await readFile(filePath, "utf-8");
    } catch (err) {
      throw new ConfigurationError(
        `Failed to read configuration file "${filePath}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    try {
      const parsed = JSON.parse(content);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new ConfigurationError(
          `JSON configuration file "${filePath}" must contain a top-level object`,
        );
      }
      return parsed as WiremintConfig;
    } catch (err) {
      if (err instanceof ConfigurationError) throw err;
      throw new ConfigurationError(
        `Failed to parse JSON configuration file "${filePath}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // 2. TypeScript / JavaScript configuration (.ts, .js, .mjs)
  if (ext === ".ts" || ext === ".js" || ext === ".mjs") {
    const fileUrl = pathToFileURL(filePath).href;

    let mod: unknown;
    try {
      mod = await import(fileUrl);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      let hint = "";
      if (errMsg.includes("strip-only mode") || errMsg.includes("not supported in strip-only mode")) {
        hint = " Note: Node.js native TypeScript loader operates in type-stripping mode; enums and namespaces are not supported without prior compilation.";
      } else if (errMsg.includes("ERR_MODULE_NOT_FOUND") && ext === ".ts") {
        hint = " Note: In Node.js native ESM, relative TypeScript imports must specify explicit file extensions (e.g. import './helper.ts').";
      }
      throw new ConfigurationError(
        `Failed to load configuration file "${filePath}": ${errMsg}.${hint}`,
      );
    }

    if (typeof mod !== "object" || mod === null) {
      throw new ConfigurationError(
        `Configuration file "${filePath}" must export a configuration object`,
      );
    }

    const modRecord = mod as Record<string, unknown>;
    const exported = modRecord.default !== undefined ? modRecord.default : modRecord.config;

    if (exported === undefined || exported === null) {
      throw new ConfigurationError(
        `Configuration file "${filePath}" must export a default configuration or named "config" export (e.g. export default defineConfig({ ... }))`,
      );
    }

    // Support asynchronous factory functions: export default defineConfig(async () => ({ ... }))
    if (typeof exported === "function") {
      try {
        const resolved = await exported();
        return resolved as WiremintConfig;
      } catch (err) {
        throw new ConfigurationError(
          `Configuration factory in "${filePath}" threw an error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // Support Promises: export default Promise.resolve({ ... })
    if (
      typeof exported === "object" &&
      "then" in exported &&
      typeof (exported as Promise<unknown>).then === "function"
    ) {
      try {
        const resolved = await (exported as Promise<unknown>);
        return resolved as WiremintConfig;
      } catch (err) {
        throw new ConfigurationError(
          `Configuration promise in "${filePath}" rejected: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return exported as WiremintConfig;
  }

  throw new ConfigurationError(
    `Unsupported configuration file format "${basename(filePath)}". Supported formats: .ts, .js, .mjs, .json`,
  );
}
