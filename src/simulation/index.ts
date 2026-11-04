export type {
  LatencyConfig,
  FailureConfig,
  TimeoutConfig,
  ConnectionConfig,
  SimulationConfig,
  RouteSimulationConfig,
  RouteOptions,
  ResolvedSimulationConfig,
} from "./types.js";

export {
  type RandomGenerator,
  MathRandomGenerator,
  SequenceRandomGenerator,
  SeededRandomGenerator,
} from "./random.js";

export { calculateLatency, sleep } from "./latency.js";
export { evaluateFailure, type FailureOutcome } from "./failure.js";
export { evaluateConnectionDrop, type ConnectionOutcome } from "./connection.js";
export { runWithTimeout, getTimeoutResponse, type TimeoutResult } from "./timeout.js";
export {
  SimulationEngine,
  resolveSimulationConfig,
  validateSimulationConfig,
  validateLatencyConfig,
  validateFailureConfig,
  validateTimeoutConfig,
  validateConnectionConfig,
} from "./simulation-engine.js";

