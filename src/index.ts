// Public SDK entry point.
export { createWiremint } from "./core/engine.js";

// Configuration types and utilities.
export type {
  ServerConfig,
  RouteConfig,
  RouteResponseConfig,
  ScenarioConfig,
  LoggingConfig,
  WiremintConfig,
  ResolvedWiremintConfig,
  LoadConfigOptions,
  ValidationErrorDetail,
} from "./config/index.js";

export {
  defineConfig,
  loadConfig,
  validateConfig,
  assertValidConfig,
  resolveConfig,
  applyConfig,
  findConfigFile,
  parseEnvironmentConfig,
} from "./config/index.js";

// Public types.
export type {
  HTTPMethod,
  MockResponse,
  RequestContext,
  RouteHandler,
  RouteDefinition,
  ServerOptions,
  WiremintOptions,
} from "./core/types.js";

export type { WiremintInstance } from "./core/engine.js";

// Simulation types and classes.
export type {
  SimulationConfig,
  LatencyConfig,
  FailureConfig,
  TimeoutConfig,
  ConnectionConfig,
  RouteSimulationConfig,
  RouteOptions,
  ResolvedSimulationConfig,
  RandomGenerator,
} from "./simulation/index.js";

export {
  SimulationEngine,
  MathRandomGenerator,
  SequenceRandomGenerator,
  SeededRandomGenerator,
} from "./simulation/index.js";

// Scenario types and classes.
export type {
  ScenarioState,
  ScenarioMetadata,
  ScenarioDefinition,
  ScenarioContext,
  ScenarioEngineOptions,
  SequenceConfig,
  ScenarioTarget,
  ScenarioRouteConfig,
  RouteHandlerOrConfig,
} from "./scenarios/index.js";

export {
  StateStore,
  ScenarioRegistry,
  ScenarioManager,
  ScenarioResolver,
  SequenceManager,
} from "./scenarios/index.js";

// Middleware types and classes.
export type {
  Middleware,
  MiddlewareContext,
  NextFunction,
  MiddlewareRegistration,
  MiddlewareOptions,
} from "./middleware/index.js";

export {
  MiddlewareManager,
  createMiddlewareContext,
  executeMiddlewarePipeline,
  matchesMiddlewarePath,
} from "./middleware/index.js";

// Inspector types and classes.
export type {
  InspectorConfig,
  RequestRecord,
  RequestFilter,
  InspectorStats,
} from "./inspector/index.js";

export {
  RequestInspector,
  RequestStore,
  DEFAULT_SENSITIVE_KEYS,
  REDACTED_PLACEHOLDER,
  redactHeaders,
  redactBodyValue,
  sanitizeBody,
  redactQueryParams,
  redactUrl,
  sanitizeErrorMessage,
  sanitizeErrorDetails,
  applyRequestFilters,
} from "./inspector/index.js";

// Event types and classes.
export type {
  RequestOutcome,
  WiremintEventMap,
  EventName,
  EventListener,
  Unsubscribe,
} from "./events/index.js";

export { TypedEventEmitter } from "./events/index.js";

// Error classes.
export {
  WiremintError,
  RouteError,
  ConfigurationError,
  ServerError,
  ScenarioError,
} from "./core/errors.js";
