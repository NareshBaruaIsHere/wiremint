/**
 * Base class for all Wiremint errors.
 */
export class WiremintError extends Error {
  /** A machine-readable error code. */
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "WiremintError";
    this.code = code;
    // Restore prototype chain broken by extending built-ins.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Errors related to route registration or resolution.
 */
export class RouteError extends WiremintError {
  constructor(message: string) {
    super(message, "ERR_ROUTE");
    this.name = "RouteError";
  }
}

/**
 * Errors related to invalid configuration.
 */
export class ConfigurationError extends WiremintError {
  constructor(message: string) {
    super(message, "ERR_CONFIG");
    this.name = "ConfigurationError";
  }
}

/**
 * Errors related to the HTTP server lifecycle.
 */
export class ServerError extends WiremintError {
  constructor(message: string) {
    super(message, "ERR_SERVER");
    this.name = "ServerError";
  }
}

/**
 * Errors related to scenario registration, selection, or state.
 */
export class ScenarioError extends WiremintError {
  constructor(message: string) {
    super(message, "ERR_SCENARIO");
    this.name = "ScenarioError";
  }
}
