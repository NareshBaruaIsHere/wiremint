import { DEFAULT_HOST, DEFAULT_MAX_BODY_SIZE } from "../core/context.js";
import type { InspectorConfig } from "../inspector/types.js";
import type { LoggingConfig, ResolvedWiremintConfig, ServerConfig } from "./types.js";

/** Default HTTP server port for Wiremint. */
export const DEFAULT_PORT = 3001;

/** Default HTTP server host address. */
export { DEFAULT_HOST };

/** Default HTTP server basePath. */
export const DEFAULT_BASE_PATH = "/";

/** Default maximum body size in bytes (1 MiB). */
export { DEFAULT_MAX_BODY_SIZE };

/** Default server configuration values. */
export const DEFAULT_SERVER_CONFIG: Required<ServerConfig> = {
  port: DEFAULT_PORT,
  host: DEFAULT_HOST,
  basePath: DEFAULT_BASE_PATH,
  maxBodySize: DEFAULT_MAX_BODY_SIZE,
};

/** Default inspector configuration values. */
export const DEFAULT_INSPECTOR_CONFIG: InspectorConfig = {
  enabled: true,
  maxEntries: 1000,
  captureRequestBody: true,
  captureResponseBody: true,
  maxBodySize: 10_000,
};

/** Default logging configuration values. */
export const DEFAULT_LOGGING_CONFIG: Required<LoggingConfig> = {
  enabled: true,
  level: "info",
};

/** Authoritative baseline defaults for a fully resolved Wiremint configuration. */
export const DEFAULT_RESOLVED_CONFIG: ResolvedWiremintConfig = {
  server: { ...DEFAULT_SERVER_CONFIG },
  routes: [],
  scenarios: [],
  simulation: undefined,
  inspector: { ...DEFAULT_INSPECTOR_CONFIG },
  middleware: [],
  logging: { ...DEFAULT_LOGGING_CONFIG },
};

/**
 * Standard configuration file names supported by Wiremint discovery.
 * Checked in discovery order.
 */
export const CONFIG_FILE_NAMES = [
  "wiremint.config.ts",
  "wiremint.config.js",
  "wiremint.config.mjs",
  "wiremint.config.json",
] as const;

