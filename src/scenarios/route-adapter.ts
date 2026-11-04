import type {
  HTTPMethod,
  MockResponse,
  RequestContext,
  RouteHandler,
} from "../core/types.js";
import type {
  RouteHandlerOrConfig,
  ScenarioRouteConfig,
  ScenarioTarget,
  SequenceConfig,
} from "./types.js";
import type { SequenceManager } from "./sequence-manager.js";

/**
 * Check if the input is a ScenarioRouteConfig object rather than a function handler.
 */
export function isScenarioRouteConfig<T>(
  input: RouteHandlerOrConfig<T>,
): input is ScenarioRouteConfig<T> {
  return typeof input === "object" && input !== null;
}

/**
 * Resolve an individual scenario target (which may be a function, static response, or sequence).
 */
async function resolveTarget<T>(
  target: ScenarioTarget<T>,
  context: RequestContext,
  routeKey: string,
  scenarioId: string,
  sequenceManager: SequenceManager,
): Promise<MockResponse<T>> {
  // If target is a function
  if (typeof target === "function") {
    return target(context);
  }

  // If target is a sequence configuration object
  if ("sequence" in target && Array.isArray((target as SequenceConfig<T>).sequence)) {
    const seqConfig = target as SequenceConfig<T>;
    return sequenceManager.runSequential(
      routeKey,
      scenarioId,
      async (index) => {
        const item = seqConfig.sequence[index];
        if (typeof item === "function") {
          return item(context);
        }
        return (item ?? { status: 200 }) as MockResponse<T>;
      },
      seqConfig.sequence.length,
      seqConfig.afterEnd ?? "repeat-last",
    );
  }

  // Static MockResponse object
  return target as MockResponse<T>;
}

/**
 * Adapts a RouteHandlerOrConfig into a standard RouteHandler.
 * If input is already a function, returns it directly.
 * If input is a ScenarioRouteConfig, produces a RouteHandler that resolves scenario overrides or sequences.
 */
export function adaptRouteHandler<T>(
  method: HTTPMethod,
  path: string,
  handlerOrConfig: RouteHandlerOrConfig<T>,
  sequenceManager: SequenceManager,
): RouteHandler<T> {
  if (typeof handlerOrConfig === "function") {
    return handlerOrConfig;
  }

  const config = handlerOrConfig;
  const routeKey = `${method}:${path}`;

  return async (context: RequestContext): Promise<MockResponse<T>> => {
    const scenarioId = context.scenario?.id ?? "default";

    // 1. Check for scenario-specific handler, response, or sequence
    if (config.scenarios && scenarioId in config.scenarios) {
      const target = config.scenarios[scenarioId]!;
      return resolveTarget(target, context, routeKey, scenarioId, sequenceManager);
    }

    // 2. Check for route-level standalone sequence
    if (config.sequence && Array.isArray(config.sequence)) {
      return sequenceManager.runSequential(
        routeKey,
        scenarioId,
        async (index) => {
          const item = config.sequence![index];
          if (typeof item === "function") {
            return item(context);
          }
          return (item ?? { status: 200 }) as MockResponse<T>;
        },
        config.sequence.length,
        config.afterEnd ?? "repeat-last",
      );
    }

    // 3. Fallback to default handler or response
    if (config.default !== undefined) {
      if (typeof config.default === "function") {
        return config.default(context);
      }
      return config.default;
    }

    // 4. Fallback if no default was specified
    return { status: 200 } as MockResponse<T>;
  };
}
