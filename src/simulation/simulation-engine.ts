import { ConfigurationError } from "../core/errors.js";
import type {
  ConnectionConfig,
  FailureConfig,
  LatencyConfig,
  ResolvedSimulationConfig,
  RouteSimulationConfig,
  SimulationConfig,
  TimeoutConfig,
} from "./types.js";
import { type RandomGenerator, MathRandomGenerator } from "./random.js";

/**
 * Validates a LatencyConfig object. Throws ConfigurationError if invalid.
 */
export function validateLatencyConfig(config: LatencyConfig): void {
  if (config.fixed !== undefined) {
    if (typeof config.fixed !== "number" || isNaN(config.fixed) || config.fixed < 0) {
      throw new ConfigurationError(
        `Latency 'fixed' must be a non-negative number, received: ${config.fixed}`,
      );
    }
    if (config.min !== undefined || config.max !== undefined) {
      throw new ConfigurationError(
        "Latency configuration cannot specify both 'fixed' and 'min'/'max'",
      );
    }
  }

  const hasMin = config.min !== undefined;
  const hasMax = config.max !== undefined;

  if (hasMin !== hasMax) {
    throw new ConfigurationError(
      "Latency configuration must specify both 'min' and 'max' when using a range",
    );
  }

  if (hasMin && hasMax) {
    if (typeof config.min !== "number" || isNaN(config.min) || config.min < 0) {
      throw new ConfigurationError(
        `Latency 'min' must be a non-negative number, received: ${config.min}`,
      );
    }
    if (typeof config.max !== "number" || isNaN(config.max) || config.max < 0) {
      throw new ConfigurationError(
        `Latency 'max' must be a non-negative number, received: ${config.max}`,
      );
    }
    if (config.min > config.max) {
      throw new ConfigurationError(
        `Latency 'min' (${config.min}) cannot be greater than 'max' (${config.max})`,
      );
    }
  }

  if (config.jitter !== undefined) {
    if (typeof config.jitter !== "number" || isNaN(config.jitter) || config.jitter < 0) {
      throw new ConfigurationError(
        `Latency 'jitter' must be a non-negative number, received: ${config.jitter}`,
      );
    }
  }
}

/**
 * Validates a FailureConfig object. Throws ConfigurationError if invalid.
 */
export function validateFailureConfig(config: FailureConfig): void {
  if (typeof config.rate !== "number" || isNaN(config.rate) || config.rate < 0 || config.rate > 1) {
    throw new ConfigurationError(
      `Failure 'rate' must be a number between 0 and 1 inclusive, received: ${config.rate}`,
    );
  }

  if (config.statusCode !== undefined) {
    if (
      typeof config.statusCode !== "number" ||
      !Number.isInteger(config.statusCode) ||
      config.statusCode < 100 ||
      config.statusCode > 599
    ) {
      throw new ConfigurationError(
        `Failure 'statusCode' must be a valid HTTP status code (100-599), received: ${config.statusCode}`,
      );
    }
  }
}

/**
 * Validates a TimeoutConfig object. Throws ConfigurationError if invalid.
 */
export function validateTimeoutConfig(config: TimeoutConfig): void {
  if (typeof config.after !== "number" || isNaN(config.after) || config.after <= 0) {
    throw new ConfigurationError(
      `Timeout 'after' must be a positive number of milliseconds, received: ${config.after}`,
    );
  }

  if (config.statusCode !== undefined) {
    if (
      typeof config.statusCode !== "number" ||
      !Number.isInteger(config.statusCode) ||
      config.statusCode < 100 ||
      config.statusCode > 599
    ) {
      throw new ConfigurationError(
        `Timeout 'statusCode' must be a valid HTTP status code (100-599), received: ${config.statusCode}`,
      );
    }
  }
}

/**
 * Validates a ConnectionConfig object. Throws ConfigurationError if invalid.
 */
export function validateConnectionConfig(config: ConnectionConfig): void {
  if (
    typeof config.dropRate !== "number" ||
    isNaN(config.dropRate) ||
    config.dropRate < 0 ||
    config.dropRate > 1
  ) {
    throw new ConfigurationError(
      `Connection 'dropRate' must be a number between 0 and 1 inclusive, received: ${config.dropRate}`,
    );
  }
}

/**
 * Validates complete or partial simulation configuration.
 */
export function validateSimulationConfig(
  config?: SimulationConfig | RouteSimulationConfig,
): void {
  if (!config || typeof config !== "object") return;

  if (config.latency && typeof config.latency === "object") {
    validateLatencyConfig(config.latency);
  }

  if (config.failure && typeof config.failure === "object") {
    validateFailureConfig(config.failure);
  }

  if (config.timeout && typeof config.timeout === "object") {
    validateTimeoutConfig(config.timeout);
  }

  if (config.connection && typeof config.connection === "object") {
    validateConnectionConfig(config.connection);
  }
}

/**
 * Merges global and route-level simulation configs into an active configuration.
 */
export function resolveSimulationConfig(
  globalConfig: SimulationConfig | undefined,
  routeConfig: RouteSimulationConfig | undefined,
  defaultRandom?: RandomGenerator,
): ResolvedSimulationConfig | undefined {
  // If route explicitly disables simulation with `false`, no simulation applies.
  if (routeConfig === false) {
    return undefined;
  }

  const routeObj = typeof routeConfig === "object" ? routeConfig : undefined;

  // Check if route or global has enabled: false
  if (routeObj?.enabled === false) {
    return undefined;
  }

  if (!routeObj && globalConfig?.enabled === false) {
    return undefined;
  }

  if (routeObj && routeObj.enabled === undefined && globalConfig?.enabled === false) {
    return undefined;
  }

  // Determine random generator
  const random =
    routeObj?.random ??
    globalConfig?.random ??
    defaultRandom ??
    new MathRandomGenerator();

  // Resolve Latency: route override takes precedence, route: false disables
  let latency: LatencyConfig | undefined;
  if (routeObj?.latency === false) {
    latency = undefined;
  } else if (routeObj?.latency !== undefined) {
    latency = routeObj.latency;
  } else if (globalConfig?.latency && globalConfig.latency.enabled !== false) {
    latency = globalConfig.latency;
  }

  // Resolve Failure
  let failure: FailureConfig | undefined;
  if (routeObj?.failure === false) {
    failure = undefined;
  } else if (routeObj?.failure !== undefined) {
    failure = routeObj.failure;
  } else if (globalConfig?.failure && globalConfig.failure.enabled !== false) {
    failure = globalConfig.failure;
  }

  // Resolve Timeout
  let timeout: TimeoutConfig | undefined;
  if (routeObj?.timeout === false) {
    timeout = undefined;
  } else if (routeObj?.timeout !== undefined) {
    timeout = routeObj.timeout;
  } else if (globalConfig?.timeout && globalConfig.timeout.enabled !== false) {
    timeout = globalConfig.timeout;
  }

  // Resolve Connection
  let connection: ConnectionConfig | undefined;
  if (routeObj?.connection === false) {
    connection = undefined;
  } else if (routeObj?.connection !== undefined) {
    connection = routeObj.connection;
  } else if (globalConfig?.connection && globalConfig.connection.enabled !== false) {
    connection = globalConfig.connection;
  }

  // Check if any simulation feature is active
  const hasActiveLatency = latency !== undefined && latency.enabled !== false;
  const hasActiveFailure = failure !== undefined && failure.enabled !== false && failure.rate > 0;
  const hasActiveTimeout = timeout !== undefined && timeout.enabled !== false && timeout.after > 0;
  const hasActiveConnection =
    connection !== undefined && connection.enabled !== false && connection.dropRate > 0;

  if (!hasActiveLatency && !hasActiveFailure && !hasActiveTimeout && !hasActiveConnection) {
    return undefined;
  }

  return {
    latency: hasActiveLatency ? latency : undefined,
    failure: hasActiveFailure ? failure : undefined,
    timeout: hasActiveTimeout ? timeout : undefined,
    connection: hasActiveConnection ? connection : undefined,
    random,
  };
}

/**
 * Coordination engine managing simulation lifecycle and resolving effective settings.
 */
export class SimulationEngine {
  private readonly globalConfig?: SimulationConfig;
  private readonly defaultRandom: RandomGenerator;
  private overrideConfig?: SimulationConfig | false | null;

  constructor(globalConfig?: SimulationConfig) {
    if (globalConfig) {
      validateSimulationConfig(globalConfig);
    }
    this.globalConfig = globalConfig;
    this.defaultRandom = globalConfig?.random ?? new MathRandomGenerator();
  }

  /**
   * Set or clear a temporary simulation override.
   * Passing `false` completely disables network simulation.
   * Passing `null` or `undefined` restores baseline simulation settings.
   */
  setOverride(config?: SimulationConfig | boolean | null): void {
    if (config === false) {
      this.overrideConfig = false;
      return;
    }
    if (config === true || config === null || config === undefined) {
      this.overrideConfig = null;
      return;
    }
    validateSimulationConfig(config);
    this.overrideConfig = config;
  }

  /**
   * Return the effective active simulation configuration (override if present, else baseline).
   */
  getEffectiveConfig(): SimulationConfig | undefined {
    if (this.overrideConfig === false) return undefined;
    return this.overrideConfig ?? this.globalConfig;
  }

  /**
   * Resolve active simulation settings for a given route match.
   */
  resolve(routeConfig?: RouteSimulationConfig): ResolvedSimulationConfig | undefined {
    if (this.overrideConfig === false) {
      return undefined;
    }
    const base = this.overrideConfig ?? this.globalConfig;
    const rng = base?.random ?? this.defaultRandom;
    return resolveSimulationConfig(base, routeConfig, rng);
  }

  /**
   * Return the configured global simulation configuration.
   */
  getGlobalConfig(): SimulationConfig | undefined {
    return this.globalConfig;
  }
}

