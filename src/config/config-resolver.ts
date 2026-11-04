import { DEFAULT_RESOLVED_CONFIG } from "./defaults.js";
import { parseEnvironmentConfig } from "./environment.js";
import { assertValidConfig } from "./validate-config.js";
import { findConfigFile, resolveExplicitConfigFile } from "./config-discovery.js";
import { loadConfigFile } from "./config-loader.js";
import { ConfigurationError } from "../core/errors.js";
import type {
  InspectorConfig,
  LoadConfigOptions,
  ResolvedWiremintConfig,
  WiremintConfig,
} from "./types.js";

/**
 * Resolves an InspectorConfig or boolean into a normalized InspectorConfig object.
 */
function normalizeInspectorConfig(
  input: InspectorConfig | boolean | undefined,
  base: InspectorConfig,
): InspectorConfig {
  if (input === false) {
    return { ...base, enabled: false };
  }
  if (input === true) {
    return { ...base, enabled: true };
  }
  if (typeof input === "object" && input !== null) {
    return {
      ...base,
      ...input,
      enabled: input.enabled !== undefined ? input.enabled : base.enabled,
    };
  }
  return { ...base };
}

export interface ResolveConfigOptions {
  env?: Record<string, string | undefined>;
  overrides?: WiremintConfig;
  configFile?: string;
}

/**
 * Merges defaults, configuration file settings, environment variables,
 * and programmatic overrides into a ResolvedWiremintConfig.
 *
 * Precedence order:
 * 1. Baseline defaults
 * 2. Configuration file
 * 3. Environment variables (WIREMINT_*)
 * 4. Programmatic overrides
 */
export function resolveConfig(
  config: WiremintConfig = {},
  options: ResolveConfigOptions = {},
): ResolvedWiremintConfig {
  if (
    config !== null &&
    (typeof config === "function" ||
      (typeof config === "object" &&
        "then" in config &&
        typeof (config as { then?: unknown }).then === "function"))
  ) {
    throw new ConfigurationError(
      "resolveConfig() requires an already-resolved configuration object, received a Promise or factory function. Use 'await loadConfig()' or await the configuration promise before calling resolveConfig().",
    );
  }

  // 1. Start from baseline defaults
  const resolved: ResolvedWiremintConfig = {
    server: { ...DEFAULT_RESOLVED_CONFIG.server },
    routes: [...DEFAULT_RESOLVED_CONFIG.routes],
    scenarios: [...DEFAULT_RESOLVED_CONFIG.scenarios],
    simulation: DEFAULT_RESOLVED_CONFIG.simulation,
    inspector: { ...DEFAULT_RESOLVED_CONFIG.inspector },
    middleware: [...DEFAULT_RESOLVED_CONFIG.middleware],
    logging: { ...DEFAULT_RESOLVED_CONFIG.logging },
    configFile: options.configFile,
  };

  // 2. Apply config file values
  if (config.server) {
    resolved.server = { ...resolved.server, ...config.server };
  }
  if (config.routes) {
    resolved.routes = [...config.routes];
  }
  if (config.scenarios) {
    resolved.scenarios = [...config.scenarios];
  }
  if (config.simulation) {
    resolved.simulation = config.simulation;
  }
  if (config.inspector !== undefined) {
    resolved.inspector = normalizeInspectorConfig(
      config.inspector,
      resolved.inspector,
    );
  }
  if (config.middleware) {
    resolved.middleware = [...config.middleware];
  }
  if (config.logging) {
    resolved.logging = { ...resolved.logging, ...config.logging };
  }

  // 3. Apply environment variables
  const envConfig = parseEnvironmentConfig(options.env ?? process.env);
  if (envConfig.server) {
    resolved.server = { ...resolved.server, ...envConfig.server };
  }
  if (envConfig.inspector) {
    resolved.inspector = normalizeInspectorConfig(
      envConfig.inspector,
      resolved.inspector,
    );
  }
  if (envConfig.logging) {
    resolved.logging = { ...resolved.logging, ...envConfig.logging };
  }

  // 4. Apply programmatic overrides
  if (options.overrides) {
    const ov = options.overrides;
    if (ov.server) {
      resolved.server = { ...resolved.server, ...ov.server };
    }
    if (ov.routes) {
      resolved.routes = [...ov.routes];
    }
    if (ov.scenarios) {
      resolved.scenarios = [...ov.scenarios];
    }
    if (ov.simulation) {
      resolved.simulation = ov.simulation;
    }
    if (ov.inspector !== undefined) {
      resolved.inspector = normalizeInspectorConfig(
        ov.inspector,
        resolved.inspector,
      );
    }
    if (ov.middleware) {
      resolved.middleware = [...ov.middleware];
    }
    if (ov.logging) {
      resolved.logging = { ...resolved.logging, ...ov.logging };
    }
  }

  return resolved;
}

/**
 * Discovers, loads, validates, and resolves the Wiremint configuration.
 *
 * @example
 * ```ts
 * const config = await loadConfig();
 * const app = createWiremint(config);
 * await app.listen({ port: config.server.port });
 * ```
 */
export async function loadConfig(
  options: LoadConfigOptions = {},
): Promise<ResolvedWiremintConfig> {
  const cwd = options.cwd ?? process.cwd();

  let resolvedFilePath: string | null = null;
  let rawConfig: WiremintConfig = {};

  if (options.configFile) {
    resolvedFilePath = resolveExplicitConfigFile(options.configFile, cwd);
    rawConfig = await loadConfigFile(resolvedFilePath);
  } else {
    resolvedFilePath = findConfigFile(cwd);
    if (resolvedFilePath) {
      rawConfig = await loadConfigFile(resolvedFilePath);
    }
  }

  // Merge with overrides, environment, and defaults
  const resolved = resolveConfig(rawConfig, {
    env: options.env,
    overrides: options.overrides,
    configFile: resolvedFilePath ?? undefined,
  });

  // Validate the resulting configuration
  assertValidConfig(resolved);

  return resolved;
}

