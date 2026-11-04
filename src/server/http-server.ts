import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import type { Router } from "../router/router.js";
import type { HTTPMethod, MockResponse, RequestContext } from "../core/types.js";
import { BODY_METHODS } from "../core/types.js";
import { ServerError } from "../core/errors.js";
import { DEFAULT_HOST, DEFAULT_MAX_BODY_SIZE } from "../core/context.js";
import { normalizePath } from "../router/route.js";
import type { SimulationConfig } from "../simulation/types.js";
import type { ScenarioManager, ScenarioResolver } from "../scenarios/index.js";
import {
  SimulationEngine,
  calculateLatency,
  sleep,
  evaluateConnectionDrop,
  evaluateFailure,
  runWithTimeout,
  getTimeoutResponse,
} from "../simulation/index.js";
import type { TypedEventEmitter, RequestOutcome } from "../events/index.js";
import type { RequestInspector, RequestRecord } from "../inspector/index.js";
import {
  redactHeaders,
  sanitizeBody,
  redactQueryParams,
  redactUrl,
  sanitizeErrorDetails,
} from "../inspector/index.js";
import type { MiddlewareManager } from "../middleware/index.js";
import {
  createMiddlewareContext,
  executeMiddlewarePipeline,
} from "../middleware/index.js";

/** Valid HTTP methods Wiremint will accept. */
const VALID_METHODS: ReadonlySet<string> = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
  "HEAD",
]);

/**
 * Options passed internally to the mock server factory.
 */
export interface MockServerOptions {
  basePath: string;
  maxBodySize: number;
  simulation?: SimulationConfig;
  scenarioManager: ScenarioManager;
  scenarioResolver: ScenarioResolver;
  eventEmitter: TypedEventEmitter;
  inspector: RequestInspector;
  middlewareManager: MiddlewareManager;
}

/**
 * Read the full request body up to a byte limit.
 * Rejects with a `PayloadTooLarge` sentinel on overflow.
 */
function readBody(req: IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;

    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        req.destroy();
        reject(new Error("PayloadTooLarge"));
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

/**
 * Parse query-string parameters from a URL, grouping repeated keys into arrays.
 */
function parseQuery(url: URL): RequestContext["query"] {
  const query: RequestContext["query"] = {};

  url.searchParams.forEach((value, key) => {
    const existing = query[key];
    if (existing === undefined) {
      query[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      query[key] = [existing, value];
    }
  });

  return query;
}

/**
 * Create a Wiremint HTTP server backed by the provided router, scenario manager,
 * middleware manager, request inspector, and typed event emitter.
 */
export function createMockServer(router: Router, options: MockServerOptions) {
  let server: Server | undefined;
  const {
    basePath,
    maxBodySize,
    simulation,
    scenarioManager,
    scenarioResolver,
    eventEmitter,
    inspector,
    middlewareManager,
  } = options;
  const simulationEngine = new SimulationEngine(simulation);

  function stripBasePath(pathname: string): string | null {
    if (basePath === "/") return pathname;
    if (!pathname.startsWith(basePath)) return null;

    const rest = pathname.slice(basePath.length);
    // Must be followed by `/` or end-of-string.
    if (rest.length === 0) return "/";
    if (rest[0] === "/") return rest;
    return null;
  }

  async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const customReqId = req.headers["x-wiremint-request-id"];
    const requestId =
      typeof customReqId === "string" && customReqId.trim().length > 0
        ? customReqId.trim()
        : randomUUID();
    const startTime = performance.now();
    const reqTimestamp = new Date().toISOString();

    let completed = false;
    let matchedRoutePattern: string | undefined = undefined;
    let resolvedScenarioId = "default";
    let parsedParams: Record<string, string> = {};
    let requestBodyForRecord: unknown = undefined;
    let simulationConditions: RequestRecord["simulation"] = undefined;
    let isTimedOut = false;

    const url = new URL(
      req.url ?? "/",
      `http://${req.headers.host ?? "localhost"}`,
    );
          const pathname = normalizePath(url.pathname);
          const method = (req.method ?? "").toUpperCase();
          const routePath = stripBasePath(pathname);
          const effectivePath = routePath ?? pathname;

          // 1. Terminal completion helper — guarantees request:complete and inspector recording occur exactly once
          const finishRequest = (
            outcome: RequestOutcome,
            statusCode?: number,
            err?: { name: string; message: string; code?: string },
            respHeaders?: Record<string, unknown>,
            respBody?: unknown,
          ): void => {
            if (completed) return;
            completed = true;

            const duration = Math.round((performance.now() - startTime) * 100) / 100;
            const completedAt = new Date().toISOString();

            // Emit request:success or request:error
            if (outcome === "success" && statusCode !== undefined && statusCode < 400) {
              eventEmitter.emit("request:success", {
                requestId,
                statusCode,
                duration,
                matchedRoute: matchedRoutePattern,
                scenarioId: resolvedScenarioId,
              });
            } else if (outcome === "error" || (statusCode !== undefined && statusCode >= 400)) {
              eventEmitter.emit("request:error", {
                requestId,
                error: err ?? {
                  name: "HTTPError",
                  message: `Request failed with status ${statusCode ?? 500}`,
                },
                statusCode,
              });
            }

            // Emit request:complete (terminal event)
            eventEmitter.emit("request:complete", {
              requestId,
              outcome,
              statusCode,
              duration,
              timestamp: completedAt,
            });

            // Record into inspector store
            if (inspector.isEnabled) {
              const safeReqHeaders = redactHeaders(
                req.headers as Record<string, unknown>,
                inspector.sensitiveKeys,
              );
              const safeResHeaders = redactHeaders(
                respHeaders,
                inspector.sensitiveKeys,
              );
              const safeReqBody = sanitizeBody(requestBodyForRecord, {
                enabled: inspector.captureRequestBody,
                maxBodySize: inspector.maxBodySize,
                sensitiveKeys: inspector.sensitiveKeys,
              });
              const safeResBody = sanitizeBody(respBody, {
                enabled: inspector.captureResponseBody,
                maxBodySize: inspector.maxBodySize,
                sensitiveKeys: inspector.sensitiveKeys,
              });

              const safeQuery = redactQueryParams(
                parseQuery(url),
                inspector.sensitiveKeys,
              );
              const safeUrl = redactUrl(
                req.url ?? "/",
                inspector.sensitiveKeys,
              );
              const safeError = sanitizeErrorDetails(err);

              inspector.record({
                id: requestId,
                timestamp: reqTimestamp,
                completedAt,
                duration,
                method,
                url: safeUrl,
                path: effectivePath,
                query: safeQuery,
                params: parsedParams,
                matchedRoute: matchedRoutePattern,
                scenarioId: resolvedScenarioId,
                request: {
                  headers: safeReqHeaders,
                  body: safeReqBody,
                },
                response: statusCode !== undefined ? {
                  statusCode,
                  headers: safeResHeaders,
                  body: safeResBody,
                } : undefined,
                statusCode,
                outcome,
                error: safeError,
                simulation: simulationConditions,
              });
            }
          };

          // AbortController to cleanly cancel async timers on client disconnect or timeout
          const abortController = new AbortController();
          res.on("close", () => {
            if (!res.writableEnded && !completed) {
              abortController.abort();
              finishRequest(
                "aborted",
                undefined,
                { name: "AbortError", message: "Client disconnected before response completion" },
              );
            }
          });

          // 2. Emit request:start
          eventEmitter.emit("request:start", {
            requestId,
            method,
            url: req.url ?? "/",
            path: effectivePath,
            timestamp: reqTimestamp,
          });

          try {
            // Reject unsupported methods
            if (!VALID_METHODS.has(method)) {
              res.writeHead(405, { "Content-Type": "application/json" });
              const body = JSON.stringify({ error: "Method not allowed" });
              res.end(body);
              finishRequest(
                "error",
                405,
                { name: "MethodNotAllowed", message: "Method not allowed" },
                { "Content-Type": "application/json" },
                { error: "Method not allowed" },
              );
              return;
            }

            // Strip basePath prefix
            if (routePath === null) {
              res.writeHead(404, { "Content-Type": "application/json" });
              const body = JSON.stringify({ error: "Not found" });
              res.end(body);
              finishRequest(
                "error",
                404,
                { name: "NotFoundError", message: "Not found" },
                { "Content-Type": "application/json" },
                { error: "Not found" },
              );
              return;
            }

            // Resolve scenario for this request
            const scenarioResolution = scenarioResolver.resolve(req, url);
            if (scenarioResolution.error) {
              res.writeHead(400, { "Content-Type": "application/json" });
              const body = JSON.stringify({ error: scenarioResolution.error });
              res.end(body);
              finishRequest(
                "error",
                400,
                { name: "ScenarioError", message: scenarioResolution.error },
                { "Content-Type": "application/json" },
                { error: scenarioResolution.error },
              );
              return;
            }

            resolvedScenarioId = scenarioResolution.scenarioId;
            const scenarioContext = scenarioManager.createContext(
              resolvedScenarioId,
            );

            // HEAD is resolved as GET; OPTIONS without an explicit route returns 204
            const lookupMethod =
              method === "HEAD" ? "GET" : (method as HTTPMethod);

            const route = router.find(lookupMethod, routePath);

            // Auto-handle OPTIONS when no explicit route is registered
            if (!route && method === "OPTIONS") {
              const optionsHeaders: Record<string, string> = {
                "Access-Control-Allow-Methods":
                  "GET,POST,PUT,PATCH,DELETE,OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
              };
              res.writeHead(204, optionsHeaders);
              res.end();
              finishRequest("success", 204, undefined, optionsHeaders);
              return;
            }

            if (route) {
              matchedRoutePattern = route.path;
              parsedParams = route.params;
              eventEmitter.emit("request:match", {
                requestId,
                matchedRoute: route.path,
                method: lookupMethod,
                params: route.params,
                scenarioId: resolvedScenarioId,
              });
            }

            // --- Body parsing ---
            let body: unknown = undefined;

            if (BODY_METHODS.has(method)) {
              let rawBody: string;
              try {
                rawBody = await readBody(req, maxBodySize);
              } catch (err) {
                if (
                  err instanceof Error &&
                  err.message === "PayloadTooLarge"
                ) {
                  res.writeHead(413, {
                    "Content-Type": "application/json",
                  });
                  const errPayload = { error: "Payload too large" };
                  res.end(JSON.stringify(errPayload));
                  finishRequest(
                    "error",
                    413,
                    { name: "PayloadTooLarge", message: "Payload too large" },
                    { "Content-Type": "application/json" },
                    errPayload,
                  );
                } else {
                  res.writeHead(400, {
                    "Content-Type": "application/json",
                  });
                  const errPayload = { error: "Failed to read request body" };
                  res.end(JSON.stringify(errPayload));
                  finishRequest(
                    "error",
                    400,
                    { name: "BadRequest", message: "Failed to read request body" },
                    { "Content-Type": "application/json" },
                    errPayload,
                  );
                }
                return;
              }

              if (rawBody.length > 0) {
                try {
                  body = JSON.parse(rawBody);
                } catch {
                  res.writeHead(400, {
                    "Content-Type": "application/json",
                  });
                  const errPayload = { error: "Invalid JSON body" };
                  res.end(JSON.stringify(errPayload));
                  finishRequest(
                    "error",
                    400,
                    { name: "BadRequest", message: "Invalid JSON body" },
                    { "Content-Type": "application/json" },
                    errPayload,
                  );
                  return;
                }
              }
              requestBodyForRecord = body;
            }

            // Create Middleware Context
            const mwContext = createMiddlewareContext({
              requestId,
              method: lookupMethod,
              url: req.url ?? "/",
              path: routePath,
              query: parseQuery(url),
              params: parsedParams,
              headers: req.headers,
              body,
              signal: abortController.signal,
              scenario: scenarioContext,
            });

            // Matching middleware pipeline for this request path
            const matchingMiddlewares = middlewareManager.getMatching(routePath);

            // Innermost target handler executed after all middleware calls next()
            const innermostHandler = async (): Promise<void> => {
              if (!route) {
                mwContext.statusCode = 404;
                mwContext.responseBody = { error: "Not found" };
                mwContext.setHeader("Content-Type", "application/json");
                return;
              }

              // Resolve effective simulation settings (route override > global)
              const sim = simulationEngine.resolve(route.options?.simulation);

              // 1. Latency simulation
              if (sim?.latency) {
                const delayMs = calculateLatency(sim.latency, sim.random);
                simulationConditions = { ...simulationConditions, latency: delayMs };
                if (delayMs > 0) {
                  await sleep(delayMs, abortController.signal);
                  if (res.destroyed || !res.socket?.writable) {
                    return;
                  }
                }
              }

              // 2. Connection drop simulation
              if (sim?.connection) {
                const drop = evaluateConnectionDrop(sim.connection, sim.random);
                if (drop.shouldDrop) {
                  simulationConditions = { ...simulationConditions, connectionDropped: true };
                  finishRequest(
                    "connection-dropped",
                    undefined,
                    { name: "ConnectionError", message: "Connection dropped by simulation" },
                  );
                  req.destroy();
                  res.destroy();
                  return;
                }
              }

              // 3. Random HTTP failure simulation
              if (sim?.failure) {
                const fail = evaluateFailure(sim.failure, sim.random);
                if (fail.shouldFail) {
                  simulationConditions = { ...simulationConditions, failed: true };
                  mwContext.statusCode = fail.statusCode ?? 500;
                  mwContext.responseBody = fail.body;
                  if (fail.headers) {
                    for (const [k, v] of Object.entries(fail.headers)) {
                      mwContext.setHeader(k, v);
                    }
                  }
                  return;
                }
              }

              // 4. Route handler execution with timeout protection if configured
              const handlerContext: RequestContext = {
                requestId,
                method: lookupMethod,
                path: routePath,
                params: route.params,
                query: parseQuery(url),
                headers: req.headers,
                body,
                signal: abortController.signal,
                scenario: scenarioContext,
              };

              let response: MockResponse;

              if (sim?.timeout) {
                simulationConditions = { ...simulationConditions, timedOut: false };
                const timeoutResult = await runWithTimeout(
                  () => Promise.resolve(route.handler(handlerContext)),
                  sim.timeout.after,
                  abortController.signal,
                );

                if (timeoutResult.timedOut) {
                  simulationConditions.timedOut = true;
                  isTimedOut = true;
                  abortController.abort();

                  const timeoutResp = getTimeoutResponse(sim.timeout);
                  mwContext.statusCode = timeoutResp.statusCode;
                  mwContext.responseBody = timeoutResp.body;
                  if (timeoutResp.headers) {
                    for (const [k, v] of Object.entries(timeoutResp.headers)) {
                      mwContext.setHeader(k, v);
                    }
                  }
                  return;
                }

                if (timeoutResult.result === undefined) {
                  return;
                }

                response = timeoutResult.result;
              } else {
                response = await route.handler(handlerContext);
              }

              mwContext.statusCode = response.status ?? 200;
              mwContext.responseBody = response.body;
              if (response.headers) {
                for (const [k, v] of Object.entries(response.headers)) {
                  mwContext.setHeader(k, v);
                }
              }
            };

            // Execute the middleware pipeline
            await executeMiddlewarePipeline(
              matchingMiddlewares,
              mwContext,
              innermostHandler,
            );

            if (res.headersSent || res.destroyed || !res.socket?.writable) {
              return;
            }

            const statusCode = mwContext.statusCode ?? 200;
            const responseHeaders: Record<string, string> = {
              ...mwContext.responseHeaders,
            };

            if (statusCode === 204 || statusCode === 304) {
              res.writeHead(statusCode, responseHeaders);
              res.end();
              finishRequest(
                statusCode >= 400 ? "error" : "success",
                statusCode,
                undefined,
                responseHeaders,
              );
              return;
            }

            if (!responseHeaders["content-type"] && !responseHeaders["Content-Type"]) {
              responseHeaders["Content-Type"] = "application/json";
            }

            const jsonBody = JSON.stringify(mwContext.responseBody ?? null);

            if (method === "HEAD") {
              responseHeaders["Content-Length"] = String(
                Buffer.byteLength(jsonBody),
              );
              res.writeHead(statusCode, responseHeaders);
              res.end();
              finishRequest(
                statusCode >= 400 ? "error" : "success",
                statusCode,
                undefined,
                responseHeaders,
                mwContext.responseBody,
              );
            } else {
              res.writeHead(statusCode, responseHeaders);
              res.end(jsonBody);
              const outcome: RequestOutcome = isTimedOut
                ? "timeout"
                : statusCode >= 400
                  ? "error"
                  : "success";
              finishRequest(
                outcome,
                statusCode,
                isTimedOut
                  ? { name: "TimeoutError", message: "Gateway timeout" }
                  : statusCode >= 400
                    ? { name: "HTTPError", message: `HTTP status ${statusCode}` }
                    : undefined,
                responseHeaders,
                mwContext.responseBody,
              );
            }
          } catch (error) {
            // Controlled 500 — never expose stack traces to HTTP client
            const errName = error instanceof Error ? error.name : "InternalError";
            const errMessage = error instanceof Error ? error.message : "Internal server error";

            if (!res.headersSent && !res.destroyed) {
              res.writeHead(500, { "Content-Type": "application/json" });
              const errBody = { error: "Internal server error" };
              res.end(JSON.stringify(errBody));
              finishRequest(
                "error",
                500,
                { name: errName, message: errMessage },
                { "Content-Type": "application/json" },
                errBody,
              );
            } else if (!res.destroyed) {
              res.destroy();
              finishRequest(
                "error",
                500,
                { name: errName, message: errMessage },
              );
            }
          }
  }

  return {
    handleRequest,

    listen(port: number, host: string = DEFAULT_HOST): Promise<void> {
      if (server?.listening) {
        return Promise.reject(
          new ServerError("Server is already listening"),
        );
      }

      return new Promise<void>((resolve, reject) => {
        server = createServer((req, res) => {
          handleRequest(req, res).catch(() => {});
        });

        server.once("error", (err) => {
          server = undefined;
          reject(new ServerError(`Failed to start server: ${err.message}`));
        });

        server.listen(port, host, () => {
          resolve();
        });
      });
    },

    close(): Promise<void> {
      return new Promise((resolve, reject) => {
        if (!server?.listening) {
          resolve();
          return;
        }

        server.close((err) => {
          server = undefined;
          if (err) reject(new ServerError(`Failed to close server: ${err.message}`));
          else resolve();
        });
      });
    },

    setSimulationOverride(config?: SimulationConfig | boolean | null): void {
      simulationEngine.setOverride(config);
    },

    getSimulation(): SimulationConfig | undefined {
      return simulationEngine.getEffectiveConfig();
    },
  };
}
