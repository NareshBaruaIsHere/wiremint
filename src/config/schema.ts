import { z } from "zod";
import type { WiremintConfig } from "./types.js";

/**
 * Valid HTTP methods accepted for declarative routes.
 */
export const VALID_HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
] as const;

/**
 * Zod schema for ServerConfig.
 */
export const serverConfigSchema = z.object({
  port: z
    .number({ message: "server.port must be a number" })
    .int("server.port must be an integer")
    .min(1, "server.port must be between 1 and 65535")
    .max(65535, "server.port must be between 1 and 65535")
    .optional(),
  host: z
    .string({ message: "server.host must be a string" })
    .min(1, "server.host must be a non-empty string")
    .optional(),
  basePath: z
    .string({ message: "server.basePath must be a string" })
    .refine((val) => val.startsWith("/"), {
      message: 'server.basePath must start with "/"',
    })
    .optional(),
  maxBodySize: z
    .number({ message: "server.maxBodySize must be a number" })
    .int("server.maxBodySize must be an integer")
    .positive("server.maxBodySize must be a positive integer")
    .optional(),
});

/**
 * Zod schema for static MockResponse.
 */
export const mockResponseSchema = z.object({
  status: z
    .number()
    .int("HTTP status code must be an integer")
    .min(100, "HTTP status code must be between 100 and 599")
    .max(599, "HTTP status code must be between 100 and 599")
    .optional(),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.unknown().optional(),
});

/**
 * Zod schema for a route response or handler function.
 */
export const routeResponseSchema = z.union([
  mockResponseSchema,
  z.custom((fn) => typeof fn === "function", {
    message: "Route handler must be a function or MockResponse object",
  }),
]);

/**
 * Zod schema for per-route simulation settings.
 */
export const routeSimulationSchema = z.object({
  latency: z
    .object({
      min: z.number().nonnegative("latency.min must be a non-negative number"),
      max: z.number().nonnegative("latency.max must be a non-negative number"),
      jitter: z.number().nonnegative("latency.jitter must be a non-negative number").optional(),
    })
    .refine((val) => val.max >= val.min, {
      message: "latency.max must be greater than or equal to latency.min",
    })
    .optional(),
  failure: z
    .object({
      rate: z
        .number()
        .min(0, "failure.rate must be between 0 and 1")
        .max(1, "failure.rate must be between 0 and 1"),
      statusCode: z
        .number()
        .int("failure.statusCode must be an integer")
        .min(400, "failure.statusCode must be between 400 and 599")
        .max(599, "failure.statusCode must be between 400 and 599")
        .optional(),
      headers: z.record(z.string(), z.string()).optional(),
      body: z.unknown().optional(),
    })
    .optional(),
  timeout: z
    .object({
      after: z.number().positive("timeout.after must be a positive number"),
      statusCode: z
        .number()
        .int("timeout.statusCode must be an integer")
        .min(400, "timeout.statusCode must be between 400 and 599")
        .max(599, "timeout.statusCode must be between 400 and 599")
        .optional(),
      headers: z.record(z.string(), z.string()).optional(),
      body: z.unknown().optional(),
    })
    .optional(),
  connection: z
    .object({
      dropRate: z
        .number()
        .min(0, "connection.dropRate must be between 0 and 1")
        .max(1, "connection.dropRate must be between 0 and 1"),
    })
    .optional(),
});

export const routeOptionsSchema = z.object({
  simulation: routeSimulationSchema.optional(),
});

/**
 * Zod schema for RouteConfig.
 */
export const routeConfigSchema = z.object({
  method: z.preprocess(
    (val) => (typeof val === "string" ? val.toUpperCase() : val),
    z.enum(VALID_HTTP_METHODS, {
      message: `Unsupported HTTP method. Expected one of: ${VALID_HTTP_METHODS.join(", ")}`,
    }),
  ),
  path: z.string().refine((val) => val.startsWith("/"), {
    message: 'Route path must start with "/"',
  }),
  response: routeResponseSchema.optional(),
  scenarios: z.record(z.string(), routeResponseSchema).optional(),
  sequence: z.array(routeResponseSchema).optional(),
  afterEnd: z
    .preprocess((val) => (val === "repeatLast" ? "repeat-last" : val), z.enum(["repeat-last", "cycle"]))
    .optional(),
  strictInterpolation: z.boolean().optional(),
  options: routeOptionsSchema.optional(),
});

/**
 * Zod schema for ScenarioConfig.
 */
export const scenarioConfigSchema = z.object({
  id: z
    .string()
    .min(1, "Scenario ID cannot be empty")
    .regex(
      /^[a-z0-9-_]+$/i,
      "Scenario ID must contain only alphanumeric characters, dashes, or underscores",
    ),
  name: z.string().min(1, "Scenario name cannot be empty"),
  description: z.string().optional(),
  initialState: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Zod schema for SimulationConfig.
 */
export const simulationConfigSchema = z.object({
  latency: z
    .object({
      min: z.number().nonnegative("latency.min must be a non-negative number"),
      max: z.number().nonnegative("latency.max must be a non-negative number"),
      jitter: z.number().nonnegative("latency.jitter must be a non-negative number").optional(),
    })
    .refine((val) => val.max >= val.min, {
      message: "latency.max must be greater than or equal to latency.min",
    })
    .optional(),
  failure: z
    .object({
      rate: z
        .number()
        .min(0, "failure.rate must be between 0 and 1")
        .max(1, "failure.rate must be between 0 and 1"),
      statusCode: z
        .number()
        .int("failure.statusCode must be an integer")
        .min(400, "failure.statusCode must be between 400 and 599")
        .max(599, "failure.statusCode must be between 400 and 599")
        .optional(),
      headers: z.record(z.string(), z.string()).optional(),
      body: z.unknown().optional(),
    })
    .optional(),
  timeout: z
    .object({
      after: z.number().positive("timeout.after must be a positive number"),
      statusCode: z
        .number()
        .int("timeout.statusCode must be an integer")
        .min(400, "timeout.statusCode must be between 400 and 599")
        .max(599, "timeout.statusCode must be between 400 and 599")
        .optional(),
      headers: z.record(z.string(), z.string()).optional(),
      body: z.unknown().optional(),
    })
    .optional(),
  connection: z
    .object({
      dropRate: z
        .number()
        .min(0, "connection.dropRate must be between 0 and 1")
        .max(1, "connection.dropRate must be between 0 and 1"),
    })
    .optional(),
});

/**
 * Zod schema for InspectorConfig.
 */
export const inspectorConfigSchema = z.union([
  z.boolean(),
  z.object({
    enabled: z.boolean().optional(),
    maxEntries: z
      .number()
      .int("inspector.maxEntries must be an integer")
      .positive("inspector.maxEntries must be a positive integer")
      .optional(),
    captureRequestBody: z.boolean().optional(),
    captureResponseBody: z.boolean().optional(),
    maxBodySize: z
      .number()
      .int("inspector.maxBodySize must be an integer")
      .positive("inspector.maxBodySize must be a positive integer")
      .optional(),
    sensitiveKeys: z.array(z.string()).optional(),
  }),
]);

/**
 * Zod schema for LoggingConfig.
 */
export const loggingConfigSchema = z.object({
  enabled: z.boolean().optional(),
  level: z.enum(["silent", "error", "warn", "info", "debug"]).optional(),
});

/**
 * Top-level Zod schema for WiremintConfig.
 */
export const wiremintConfigSchema = z.object({
  server: serverConfigSchema.optional(),
  routes: z.array(routeConfigSchema).optional(),
  scenarios: z.array(scenarioConfigSchema).optional(),
  simulation: simulationConfigSchema.optional(),
  inspector: inspectorConfigSchema.optional(),
  middleware: z
    .array(
      z.custom((fn) => typeof fn === "function", {
        message: "Middleware must be a function",
      }),
    )
    .optional(),
  logging: loggingConfigSchema.optional(),
});
