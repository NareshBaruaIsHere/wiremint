import type { RequestRecord } from "../inspector/types.js";
import type { ScenarioMetadata } from "../scenarios/types.js";

/**
 * Runtime metadata written to .wiremint/runtime.json
 */
export interface RuntimeInfo {
  pid: number;
  controlHost: string;
  controlPort: number;
  token: string;
  serverUrl: string;
  version: string;
  createdAt: string;
}

/**
 * Health check response from control plane
 */
export interface ControlHealthResponse {
  status: "ok";
  pid: number;
  uptime: number;
  version: string;
  serverUrl: string;
}

/**
 * Query parameters for filtering inspected requests via control plane
 */
export interface RequestFilterParams {
  limit?: number;
  method?: string;
  path?: string;
  status?: number;
  scenario?: string;
}

/**
 * Scenarios response from control plane
 */
export interface ControlScenariosResponse {
  active: ScenarioMetadata;
  scenarios: ScenarioMetadata[];
}
