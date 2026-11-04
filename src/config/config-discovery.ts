import { existsSync } from "node:fs";
import { resolve, isAbsolute, basename } from "node:path";
import { ConfigurationError } from "../core/errors.js";
import { CONFIG_FILE_NAMES } from "./defaults.js";

/**
 * Discovers a configuration file in the specified working directory.
 * If multiple supported configuration files exist, throws an ambiguity error.
 * Returns the absolute path of the discovered file, or null if none was found.
 */
export function findConfigFile(cwd: string = process.cwd()): string | null {
  const resolvedCwd = resolve(cwd);
  const found: string[] = [];

  for (const filename of CONFIG_FILE_NAMES) {
    const fullPath = resolve(resolvedCwd, filename);
    if (existsSync(fullPath)) {
      found.push(fullPath);
    }
  }

  if (found.length === 0) {
    return null;
  }

  if (found.length > 1) {
    const names = found.map((p) => `"${basename(p)}"`).join(", ");
    throw new ConfigurationError(
      `Ambiguous configuration files detected in "${resolvedCwd}": found ${names}. Please remove redundant config files or specify one explicitly.`,
    );
  }

  return found[0];
}

/**
 * Resolves an explicitly specified configuration file path.
 * Throws a ConfigurationError if the file does not exist.
 */
export function resolveExplicitConfigFile(
  filePath: string,
  cwd: string = process.cwd(),
): string {
  const resolved = isAbsolute(filePath)
    ? resolve(filePath)
    : resolve(cwd, filePath);

  if (!existsSync(resolved)) {
    throw new ConfigurationError(
      `Configuration file not found: "${resolved}"`,
    );
  }

  return resolved;
}

