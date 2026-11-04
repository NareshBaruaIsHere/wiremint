import type {
  HTTPMethod,
  RouteDefinition,
  RouteHandler,
} from "../core/types.js";
import type { RouteOptions } from "../simulation/types.js";
import { validateSimulationConfig } from "../simulation/simulation-engine.js";
import { RouteError } from "../core/errors.js";
import { matchRoute, normalizePath } from "./route.js";

/**
 * Result returned when the router successfully resolves a request.
 */
export interface RouteResult {
  path: string;
  handler: RouteHandler;
  params: Record<string, string>;
  options?: RouteOptions;
}

/**
 * In-memory route registry with pattern matching.
 */
export class Router {
  private readonly routes: RouteDefinition[] = [];

  /**
   * Register a route. Throws if a route with the same method
   * and normalised path is already registered.
   */
  register(
    method: HTTPMethod,
    path: string,
    handler: RouteHandler,
    options?: RouteOptions,
  ): void {
    if (options?.simulation) {
      validateSimulationConfig(options.simulation);
    }

    const normalised = normalizePath(path);

    const duplicate = this.routes.some(
      (r) => r.method === method && r.path === normalised,
    );

    if (duplicate) {
      throw new RouteError(
        `Route already registered: ${method} ${normalised}`,
      );
    }

    this.routes.push({ method, path: normalised, handler, options });
  }

  /**
   * Find the first route matching the given method and path.
   * Returns the handler and extracted params, or `undefined`.
   */
  find(method: HTTPMethod, path: string): RouteResult | undefined {
    const normalised = normalizePath(path);

    for (const route of this.routes) {
      if (route.method !== method) continue;

      const match = matchRoute(route.path, normalised);
      if (match.matched) {
        return {
          path: route.path,
          handler: route.handler,
          params: match.params,
          options: route.options,
        };
      }
    }

    return undefined;
  }

  /**
   * Return a shallow copy of all registered routes.
   */
  getRoutes(): RouteDefinition[] {
    return [...this.routes];
  }
}
