import type { MockResponse, RequestContext, RouteHandler, WiremintOptions } from "../core/types.js";
import type { RouteHandlerOrConfig, ScenarioRouteConfig } from "../scenarios/types.js";
import type { RouteConfig, RouteResponseConfig, WiremintConfig } from "./types.js";
import type { WiremintInstance } from "../core/engine.js";
import { RouteError } from "../core/errors.js";

export interface InterpolationOptions {
  /**
   * If true, throws RouteError when a placeholder cannot be resolved.
   * If false, missing params/query resolve to empty string, and unrecognized roots are preserved.
   */
  strict?: boolean;
}

/**
 * Safely resolves a template path like "params.id" or "query.name" from RequestContext without eval.
 */
function resolveContextValue(
  context: RequestContext,
  path: string,
  options: InterpolationOptions = {},
): string | null {
  const parts = path.trim().split(".");
  if (parts.length === 0) return options.strict ? null : "";

  const root = parts[0];
  if (root === "params" && parts[1]) {
    const val = context.params[parts[1]];
    if (val !== undefined) return val;
    if (options.strict) {
      throw new RouteError(
        `Unresolved route parameter "{{params.${parts[1]}}}" on route ${context.method} ${context.path}`,
      );
    }
    return "";
  }

  if (root === "query" && parts[1]) {
    const qVal = context.query[parts[1]];
    if (qVal !== undefined) {
      return Array.isArray(qVal) ? qVal.join(",") : qVal;
    }
    if (options.strict) {
      throw new RouteError(
        `Unresolved query parameter "{{query.${parts[1]}}}" on route ${context.method} ${context.path}`,
      );
    }
    return "";
  }

  if (root === "scenario") {
    if (parts[1] === "id") return context.scenario.id;
    if (parts[1] === "name") return context.scenario.name;
    if (parts[1] === "description") return context.scenario.description ?? "";
    if (options.strict) {
      throw new RouteError(
        `Unresolved scenario property "{{scenario.${parts[1]}}}" on route ${context.method} ${context.path}`,
      );
    }
    return "";
  }

  if (root === "requestId") {
    return context.requestId;
  }

  if (options.strict) {
    throw new RouteError(
      `Unknown template placeholder "{{${path}}}" on route ${context.method} ${context.path}`,
    );
  }

  // In non-strict mode, preserve unrecognized placeholder syntax intact
  return null;
}

/**
 * Recursively interpolates safe {{params.*}} and {{query.*}} placeholders in JSON objects/arrays.
 * Zero eval or dynamic code execution.
 */
export function interpolateValue(
  val: unknown,
  context: RequestContext,
  options: InterpolationOptions = {},
): unknown {
  if (typeof val === "string") {
    // If the string is purely a single placeholder e.g. "{{params.id}}"
    const exactMatch = val.match(/^\{\{([a-zA-Z0-9_.]+)\}\}$/);
    if (exactMatch) {
      const resolved = resolveContextValue(context, exactMatch[1], options);
      return resolved !== null ? resolved : val;
    }

    // Embedded placeholders e.g. "User {{params.id}} details"
    return val.replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, (match, key) => {
      const resolved = resolveContextValue(context, key, options);
      return resolved !== null ? resolved : match;
    });
  }

  if (Array.isArray(val)) {
    return val.map((item) => interpolateValue(item, context, options));
  }

  if (val !== null && typeof val === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val)) {
      result[k] = interpolateValue(v, context, options);
    }
    return result;
  }

  return val;
}

/**
 * Compile a declarative response (static object or function) into a dynamic RouteHandler.
 */
function compileResponseTarget(
  target: RouteResponseConfig,
  options: InterpolationOptions = {},
): RouteHandler {
  if (typeof target === "function") {
    return target as RouteHandler;
  }

  return (context: RequestContext): MockResponse => {
    const status = target.status ?? 200;
    const headers = target.headers ? { ...target.headers } : undefined;
    const body = target.body !== undefined
      ? interpolateValue(target.body, context, options)
      : undefined;

    return { status, headers, body };
  };
}

/**
 * Applies declarative routes, scenarios, and middleware from a WiremintConfig or WiremintOptions to a WiremintInstance.
 */
export function applyConfig(app: WiremintInstance, config: WiremintConfig | WiremintOptions): void {
  // 1. Register application scenarios
  if (config.scenarios && Array.isArray(config.scenarios)) {
    for (const s of config.scenarios) {
      app.scenario(s.id, {
        name: s.name,
        description: s.description,
        initialState: s.initialState,
      });
    }
  }

  // 2. Register middleware
  if (config.middleware) {
    for (const mw of config.middleware) {
      app.use(mw);
    }
  }

  // 3. Register declarative routes
  if (config.routes) {
    for (const route of config.routes) {
      const method = route.method.toLowerCase() as
        | "get"
        | "post"
        | "put"
        | "patch"
        | "delete"
        | "options";

      if (typeof app[method] !== "function") {
        continue;
      }

      const interpOpts: InterpolationOptions = { strict: route.strictInterpolation };

      // Check if route has scenario overrides or sequences
      if (route.scenarios || route.sequence) {
        const scenarioConfig: ScenarioRouteConfig = {};

        if (route.response) {
          scenarioConfig.default = compileResponseTarget(route.response, interpOpts);
        }

        if (route.scenarios) {
          scenarioConfig.scenarios = {};
          for (const [sId, sTarget] of Object.entries(route.scenarios)) {
            scenarioConfig.scenarios[sId] = compileResponseTarget(sTarget, interpOpts);
          }
        }

        if (route.sequence) {
          scenarioConfig.sequence = route.sequence.map((s) => compileResponseTarget(s, interpOpts));
          scenarioConfig.afterEnd = route.afterEnd;
        }

        app[method](route.path, scenarioConfig as RouteHandlerOrConfig, route.options);
      } else if (route.response) {
        const handler = compileResponseTarget(route.response, interpOpts);
        app[method](route.path, handler, route.options);
      }
    }
  }
}
