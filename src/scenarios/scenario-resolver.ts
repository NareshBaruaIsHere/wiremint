import type { IncomingMessage } from "node:http";
import type { ScenarioEngineOptions } from "./types.js";
import type { ScenarioManager } from "./scenario-manager.js";

export const DEFAULT_HEADER_NAME = "x-wiremint-scenario";
export const DEFAULT_QUERY_PARAM = "__scenario";

export interface ScenarioResolutionResult {
  scenarioId: string;
  source: "header" | "query" | "global" | "default";
  error?: string;
}

/**
 * Resolves which scenario should be activated for an incoming HTTP request according to precedence rules:
 * 1. Explicit HTTP header
 * 2. Explicit query parameter
 * 3. Globally active scenario
 * 4. Default scenario
 */
export class ScenarioResolver {
  private readonly manager: ScenarioManager;
  private readonly allowHttpSelection: boolean;
  private readonly headerName: string;
  private readonly queryParam: string;

  constructor(manager: ScenarioManager, options?: ScenarioEngineOptions) {
    this.manager = manager;
    this.allowHttpSelection = options?.allowHttpSelection ?? true;
    this.headerName = (options?.headerName ?? DEFAULT_HEADER_NAME).toLowerCase();
    this.queryParam = options?.queryParam ?? DEFAULT_QUERY_PARAM;
  }

  /**
   * Resolve scenario ID from request headers, query parameters, or global active scenario.
   */
  resolve(req: IncomingMessage, url: URL): ScenarioResolutionResult {
    if (this.allowHttpSelection) {
      // 1. Check HTTP header
      const headerVal = req.headers[this.headerName];
      if (headerVal) {
        const scenarioId = (Array.isArray(headerVal) ? headerVal[0] : headerVal)?.trim();
        if (scenarioId) {
          if (!this.manager.hasScenario(scenarioId)) {
            const available = this.manager.listScenarios().map((s) => s.id).join(", ");
            return {
              scenarioId,
              source: "header",
              error: `Unknown scenario "${scenarioId}" requested via header "${this.headerName}". Available scenarios: ${available}`,
            };
          }
          return { scenarioId, source: "header" };
        }
      }

      // 2. Check query parameter
      const queryVal = url.searchParams.get(this.queryParam)?.trim();
      if (queryVal) {
        if (!this.manager.hasScenario(queryVal)) {
          const available = this.manager.listScenarios().map((s) => s.id).join(", ");
          return {
            scenarioId: queryVal,
            source: "query",
            error: `Unknown scenario "${queryVal}" requested via query parameter "${this.queryParam}". Available scenarios: ${available}`,
          };
        }
        return { scenarioId: queryVal, source: "query" };
      }
    }

    // 3. Globally active scenario
    const activeId = this.manager.getActiveId();
    return {
      scenarioId: activeId,
      source: activeId === this.manager.getDefaultId() ? "default" : "global",
    };
  }
}

