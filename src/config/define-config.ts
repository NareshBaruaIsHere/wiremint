import type { WiremintConfig } from "./types.js";

export type ConfigFn = () => WiremintConfig | Promise<WiremintConfig>;
export type ConfigExport = WiremintConfig | Promise<WiremintConfig> | ConfigFn;

/**
 * Type-safe configuration helper providing autocomplete and compile-time validation.
 * Supports static objects, promises, and asynchronous factory functions.
 *
 * @example
 * ```ts
 * import { defineConfig } from "wiremint/config";
 *
 * export default defineConfig({
 *   server: {
 *     port: 3001,
 *     basePath: "/api",
 *   },
 *   routes: [
 *     {
 *       method: "GET",
 *       path: "/health",
 *       response: { status: 200, body: { ok: true } },
 *     },
 *   ],
 * });
 * ```
 */
export function defineConfig(config: ConfigExport): ConfigExport {
  return config;
}

