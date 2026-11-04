import { ConfigurationError } from "../core/errors.js";
import type { WiremintConfig } from "./types.js";

const VALID_LOG_LEVELS = new Set(["silent", "error", "warn", "info", "debug"]);

/**
 * Parses and validates supported WIREMINT_* environment variables into a partial WiremintConfig.
 * Never mutates process.env.
 */
export function parseEnvironmentConfig(
  env: Record<string, string | undefined> = process.env,
): Partial<WiremintConfig> {
  const config: Partial<WiremintConfig> = {};

  // 1. WIREMINT_PORT
  const portStr = env.WIREMINT_PORT;
  if (portStr !== undefined && portStr !== "") {
    const port = Number(portStr);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new ConfigurationError(
        `Invalid WIREMINT_PORT: expected an integer between 1 and 65535, received: "${portStr}"`,
      );
    }
    config.server = { ...config.server, port };
  }

  // 2. WIREMINT_HOST
  const hostStr = env.WIREMINT_HOST;
  if (hostStr !== undefined) {
    const trimmed = hostStr.trim();
    if (trimmed.length === 0) {
      throw new ConfigurationError(
        'Invalid WIREMINT_HOST: expected a non-empty string',
      );
    }
    config.server = { ...config.server, host: trimmed };
  }

  // 3. WIREMINT_BASE_PATH
  const basePathStr = env.WIREMINT_BASE_PATH;
  if (basePathStr !== undefined && basePathStr !== "") {
    if (!basePathStr.startsWith("/")) {
      throw new ConfigurationError(
        `Invalid WIREMINT_BASE_PATH: must start with "/", received: "${basePathStr}"`,
      );
    }
    config.server = { ...config.server, basePath: basePathStr };
  }

  // 4. WIREMINT_INSPECTOR_ENABLED
  const inspectorStr = env.WIREMINT_INSPECTOR_ENABLED;
  if (inspectorStr !== undefined && inspectorStr !== "") {
    const lower = inspectorStr.trim().toLowerCase();
    if (lower === "true" || lower === "1" || lower === "yes" || lower === "on") {
      config.inspector = { enabled: true };
    } else if (lower === "false" || lower === "0" || lower === "no" || lower === "off") {
      config.inspector = { enabled: false };
    } else {
      throw new ConfigurationError(
        `Invalid WIREMINT_INSPECTOR_ENABLED: expected a boolean (true/false, 1/0), received: "${inspectorStr}"`,
      );
    }
  }

  // 5. WIREMINT_LOG_LEVEL
  const logLevelStr = env.WIREMINT_LOG_LEVEL;
  if (logLevelStr !== undefined && logLevelStr !== "") {
    const lower = logLevelStr.trim().toLowerCase();
    if (!VALID_LOG_LEVELS.has(lower)) {
      throw new ConfigurationError(
        `Invalid WIREMINT_LOG_LEVEL: expected one of "silent", "error", "warn", "info", "debug", received: "${logLevelStr}"`,
      );
    }
    config.logging = {
      ...config.logging,
      level: lower as "silent" | "error" | "warn" | "info" | "debug",
    };
  }

  return config;
}

