import { wiremintConfigSchema } from "./schema.js";
import { ConfigurationError } from "../core/errors.js";
import type { ValidationErrorDetail, WiremintConfig } from "./types.js";

/**
 * Format a Zod path array into a readable dot-and-bracket notation.
 * e.g. ["routes", 0, "method"] -> "routes[0].method"
 */
export function formatConfigPath(path: (string | number | symbol)[]): string {
  if (path.length === 0) return "config";
  return path.reduce<string>((acc, segment) => {
    if (typeof segment === "number") {
      return `${acc}[${segment}]`;
    }
    const str = String(segment);
    return acc ? `${acc}.${str}` : str;
  }, "");
}

export type ValidationResult =
  | { success: true; data: WiremintConfig; errors?: never }
  | { success: false; errors: ValidationErrorDetail[]; message: string; data?: never };

/**
 * Validates an arbitrary input against the Wiremint configuration schema.
 * Returns a typed success object or detailed error list with human-readable paths.
 */
export function validateConfig(config: unknown): ValidationResult {
  const result = wiremintConfigSchema.safeParse(config);

  if (result.success) {
    return {
      success: true,
      data: result.data as WiremintConfig,
    };
  }

  const errors: ValidationErrorDetail[] = result.error.issues.map((issue) => ({
    path: formatConfigPath(issue.path),
    message: issue.message,
  }));

  const messageLines = [
    "Invalid Wiremint configuration:",
    ...errors.map((e) => `  - ${e.path}: ${e.message}`),
  ];
  const message = messageLines.join("\n");

  return {
    success: false,
    errors,
    message,
  };
}

/**
 * Assert that a configuration object is valid, throwing a formatted ConfigurationError if invalid.
 */
export function assertValidConfig(config: unknown): WiremintConfig {
  const result = validateConfig(config);
  if (!result.success) {
    throw new ConfigurationError(result.message);
  }
  return result.data;
}

