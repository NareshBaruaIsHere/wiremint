import type {
  HTTPMethod,
  MockResponse,
  RouteHandler,
  ServerOptions,
  WiremintOptions,
} from "./types.js";
import type { RouteOptions } from "../simulation/types.js";
import type {
  RouteHandlerOrConfig,
  ScenarioDefinition,
  ScenarioMetadata,
} from "../scenarios/types.js";
import { ConfigurationError } from "./errors.js";
import { Router } from "../router/router.js";
import { normalizePath } from "../router/route.js";
import { createMockServer } from "../server/http-server.js";
import { DEFAULT_MAX_BODY_SIZE } from "./context.js";
import {
  ScenarioManager,
  ScenarioResolver,
  adaptRouteHandler,
} from "../scenarios/index.js";
import {
  MiddlewareManager,
  type Middleware,
} from "../middleware/index.js";
import {
  RequestInspector,
  type InspectorConfig,
} from "../inspector/index.js";
import {
  TypedEventEmitter,
  type EventName,
  type EventListener,
  type Unsubscribe,
} from "../events/index.js";
import { DEFAULT_PORT, DEFAULT_HOST } from "../config/defaults.js";
import { applyConfig } from "../config/config-applier.js";
import { loadConfig } from "../config/config-resolver.js";
import type { LoadConfigOptions, ResolvedWiremintConfig } from "../config/types.js";

/**
 * The public Wiremint instance returned by `createWiremint()`.
 */
export interface WiremintInstance {
  /** Register a GET route with a handler function or scenario config. */
  get<T = unknown>(
    path: string,
    handlerOrConfig: RouteHandlerOrConfig<T>,
    options?: RouteOptions,
  ): void;
  /** Register a POST route with a handler function or scenario config. */
  post<T = unknown>(
    path: string,
    handlerOrConfig: RouteHandlerOrConfig<T>,
    options?: RouteOptions,
  ): void;
  /** Register a PUT route with a handler function or scenario config. */
  put<T = unknown>(
    path: string,
    handlerOrConfig: RouteHandlerOrConfig<T>,
    options?: RouteOptions,
  ): void;
  /** Register a PATCH route with a handler function or scenario config. */
  patch<T = unknown>(
    path: string,
    handlerOrConfig: RouteHandlerOrConfig<T>,
    options?: RouteOptions,
  ): void;
  /** Register a DELETE route with a handler function or scenario config. */
  delete<T = unknown>(
    path: string,
    handlerOrConfig: RouteHandlerOrConfig<T>,
    options?: RouteOptions,
  ): void;
  /** Register an OPTIONS route with a handler function or scenario config. */
  options<T = unknown>(
    path: string,
    handlerOrConfig: RouteHandlerOrConfig<T>,
    options?: RouteOptions,
  ): void;
  /** List all registered routes. */
  routes(): { method: HTTPMethod; path: string }[];

  /** Register global middleware in the pipeline. */
  use(middleware: Middleware): void;
  /** Register path-scoped middleware in the pipeline. */
  use(path: string, middleware: Middleware): void;

  /** Access the Request Inspector API. */
  inspect(): RequestInspector;

  /** Subscribe to a typed request lifecycle event. Returns an unsubscribe function. */
  on<K extends EventName>(event: K, listener: EventListener<K>): Unsubscribe;
  /** Unsubscribe a listener from a lifecycle event. */
  off<K extends EventName>(event: K, listener: EventListener<K>): void;

  /** Register a named application scenario. */
  scenario(id: string, definition?: ScenarioDefinition): ScenarioMetadata;
  /** Set the globally active application scenario. */
  setScenario(id: string): void;
  /** Get metadata describing the currently active global scenario. */
  getScenario(): ScenarioMetadata;
  /** List all registered scenarios in registration order. */
  listScenarios(): ScenarioMetadata[];
  /** Reset state store and sequence counters for a scenario (defaults to active scenario). */
  resetScenario(id?: string): void;
  /** Clear the active scenario, reverting back to the default scenario. */
  clearScenario(): void;

  /** Start the HTTP server. */
  listen(options?: ServerOptions): Promise<void>;
  /** Stop the HTTP server. */
  close(): Promise<void>;
}

/**
 * Create a new Wiremint mock server instance.
 *
 * @example
 * ```ts
 * const app = createWiremint({ basePath: "/api" });
 *
 * app.use(async (ctx, next) => {
 *   console.log(`[${ctx.requestId}] ${ctx.method} ${ctx.path}`);
 *   await next();
 * });
 *
 * app.scenario("empty-state", {
 *   name: "Empty State",
 *   description: "No items found",
 * });
 *
 * app.get("/users", {
 *   default: () => ({ status: 200, body: [{ id: 1, name: "Naresh" }] }),
 *   scenarios: {
 *     "empty-state": () => ({ status: 200, body: [] }),
 *   },
 * });
 *
 * await app.listen({ port: 3001 });
 * ```
 */
export function createWiremint(options: WiremintOptions = {}): WiremintInstance {
  if (
    options !== null &&
    (typeof options === "function" ||
      (typeof options === "object" &&
        "then" in options &&
        typeof (options as { then?: unknown }).then === "function"))
  ) {
    throw new ConfigurationError(
      "createWiremint() received an unresolved Promise or factory function. Synchronous createWiremint() requires an already-resolved configuration object. Use 'await createWiremint.fromConfig()' or 'await' the configuration before passing it to createWiremint().",
    );
  }

  const rawBasePath = options.server?.basePath ?? options.basePath;
  const basePath = rawBasePath
    ? normalizePath(rawBasePath)
    : "/";

  // Validate basePath — must start with `/`.
  if (basePath !== "/" && !basePath.startsWith("/")) {
    throw new ConfigurationError(
      `basePath must start with "/", received: "${rawBasePath}"`,
    );
  }

  const maxBodySize =
    options.server?.maxBodySize ?? options.maxBodySize ?? DEFAULT_MAX_BODY_SIZE;

  if (maxBodySize <= 0) {
    throw new ConfigurationError("maxBodySize must be a positive number");
  }

  const defaultPort = options.server?.port ?? DEFAULT_PORT;
  const defaultHost = options.server?.host ?? DEFAULT_HOST;

  const router = new Router();
  const scenarioOptions = Array.isArray(options.scenarios) ? undefined : options.scenarios;
  const scenarioManager = new ScenarioManager(scenarioOptions);
  const scenarioResolver = new ScenarioResolver(scenarioManager, scenarioOptions);
  const eventEmitter = new TypedEventEmitter();
  const middlewareManager = new MiddlewareManager();

  // Configure inspector
  let inspectorConfig: InspectorConfig;
  if (options.inspector === false) {
    inspectorConfig = { enabled: false };
  } else if (typeof options.inspector === "object") {
    inspectorConfig = options.inspector;
  } else {
    inspectorConfig = { enabled: true };
  }
  const inspector = new RequestInspector(inspectorConfig);

  const server = createMockServer(router, {
    basePath,
    maxBodySize,
    simulation: options.simulation,
    scenarioManager,
    scenarioResolver,
    eventEmitter,
    inspector,
    middlewareManager,
  });

  function registerRoute<T>(
    method: HTTPMethod,
    path: string,
    handlerOrConfig: RouteHandlerOrConfig<T>,
    routeOptions?: RouteOptions,
  ): void {
    const compiledHandler = adaptRouteHandler(
      method,
      path,
      handlerOrConfig,
      scenarioManager.getSequenceManager(),
    );
    router.register(method, path, compiledHandler as RouteHandler, routeOptions);
  }

  const instance: WiremintInstance = {
    get: (path, handler, opts) => registerRoute("GET", path, handler, opts),
    post: (path, handler, opts) => registerRoute("POST", path, handler, opts),
    put: (path, handler, opts) => registerRoute("PUT", path, handler, opts),
    patch: (path, handler, opts) => registerRoute("PATCH", path, handler, opts),
    delete: (path, handler, opts) => registerRoute("DELETE", path, handler, opts),
    options: (path, handler, opts) => registerRoute("OPTIONS", path, handler, opts),

    routes() {
      return router.getRoutes().map((r) => ({
        method: r.method,
        path: r.path,
      }));
    },

    use(pathOrMiddleware: string | Middleware, maybeMiddleware?: Middleware) {
      if (typeof pathOrMiddleware === "string") {
        middlewareManager.use(pathOrMiddleware, maybeMiddleware!);
      } else {
        middlewareManager.use(pathOrMiddleware);
      }
    },

    inspect() {
      return inspector;
    },

    on<K extends EventName>(event: K, listener: EventListener<K>): Unsubscribe {
      return eventEmitter.on(event, listener);
    },

    off<K extends EventName>(event: K, listener: EventListener<K>): void {
      eventEmitter.off(event, listener);
    },

    scenario: (id, def) => scenarioManager.register(id, def),
    setScenario: (id) => scenarioManager.setScenario(id),
    getScenario: () => scenarioManager.getScenario(),
    listScenarios: () => scenarioManager.listScenarios(),
    resetScenario: (id) => scenarioManager.resetScenario(id),
    clearScenario: () => scenarioManager.clearScenario(),

    listen(serverOptions?: ServerOptions) {
      const port = serverOptions?.port ?? defaultPort;
      const host = serverOptions?.host ?? defaultHost;
      return server.listen(port, host);
    },

    close() {
      return server.close();
    },
  };

  // Apply declarative configuration (routes, scenarios, middleware)
  applyConfig(instance, options);

  return instance;
}

/**
 * Asynchronously load a Wiremint configuration from disk and instantiate the server.
 */
createWiremint.fromConfig = async function fromConfig(
  pathOrOptions?: string | LoadConfigOptions,
): Promise<WiremintInstance & { config: ResolvedWiremintConfig }> {
  const opts: LoadConfigOptions =
    typeof pathOrOptions === "string"
      ? { configFile: pathOrOptions }
      : (pathOrOptions ?? {});
  const resolved = await loadConfig(opts);
  const app = createWiremint(resolved) as WiremintInstance & {
    config: ResolvedWiremintConfig;
  };
  app.config = resolved;
  return app;
};
