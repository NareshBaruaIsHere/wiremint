import pc from "picocolors";
import { basename } from "node:path";
import { loadConfig } from "../../config/config-resolver.js";
import { createWiremint, type WiremintInstance } from "../../core/engine.js";
import { startControlServer, type ControlServerInstance } from "../../control/control-server.js";
import { formatBanner, formatDuration, formatMethod, formatStatusCode } from "../utils/output.js";
import { getPackageVersion } from "../utils/version.js";

export interface DevOptions {
  config?: string;
  port?: number | string;
  host?: string;
  control?: boolean;
  cwd?: string;
}

export async function runDev(options: DevOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  console.log(formatBanner() + "\n");

  // 1. Resolve configuration overrides from CLI flags
  const overrides: Record<string, unknown> = {};
  if (options.port !== undefined) {
    const p = Number(options.port);
    if (!Number.isInteger(p) || p < 1 || p > 65535) {
      throw new Error(`Invalid port: "${options.port}". Expected an integer between 1 and 65535.`);
    }
    overrides.server = { ...(overrides.server as object), port: p };
  }
  if (options.host !== undefined) {
    overrides.server = { ...(overrides.server as object), host: options.host };
  }

  // 2. Load and validate configuration
  const resolved = await loadConfig({
    cwd,
    configFile: options.config,
    overrides,
  });

  const app: WiremintInstance = createWiremint(resolved);

  // 3. Subscribe to real-time request lifecycle events
  const inFlight = new Map<string, { method: string; path: string }>();

  app.on("request:start", (evt) => {
    inFlight.set(evt.requestId, { method: evt.method, path: evt.path });
  });

  app.on("request:complete", (evt) => {
    const meta = inFlight.get(evt.requestId);
    inFlight.delete(evt.requestId);

    const method = meta?.method ?? "GET";
    const path = meta?.path ?? "";
    const status = evt.statusCode ?? (evt.outcome === "success" ? 200 : 500);
    const duration = evt.duration ?? 0;
    const timeStr = pc.gray(new Date().toLocaleTimeString());

    const outcomeSuffix = evt.outcome !== "success" ? ` ${pc.yellow(`(${evt.outcome})`)}` : "";
    console.log(
      `${timeStr}  ${formatMethod(method)} ${path.padEnd(30, " ")} ${formatStatusCode(status)} ${formatDuration(duration)}${outcomeSuffix}`,
    );
  });

  // 4. Start HTTP mock server
  await app.listen({
    port: resolved.server.port,
    host: resolved.server.host,
  });

  const basePath = resolved.server.basePath === "/" ? "" : resolved.server.basePath;
  const serverUrl = `http://${resolved.server.host}:${resolved.server.port}${basePath}`;

  // 5. Start Control Plane (unless explicitly disabled)
  let controlServer: ControlServerInstance | null = null;
  const enableControl = options.control !== false;

  if (enableControl) {
    try {
      controlServer = await startControlServer({
        app,
        serverUrl,
        version: getPackageVersion(),
        cwd,
      });
    } catch (err) {
      console.warn(
        pc.yellow(`Warning: Could not start local control plane: ${err instanceof Error ? err.message : String(err)}`),
      );
    }
  }

  // 6. Print startup details
  console.log(pc.green(pc.bold("  Mock API server running")));
  console.log(`\n  ${pc.bold("Server:")}    ${pc.cyan(serverUrl)}`);
  if (resolved.configFile) {
    console.log(`  ${pc.bold("Config:")}    ${pc.gray(basename(resolved.configFile))}`);
  }
  if (controlServer) {
    console.log(`  ${pc.bold("Control:")}   ${pc.gray(`127.0.0.1:${controlServer.port} (authenticated)`)}`);
  }

  // 7. Display registered routes
  const routes = app.routes();
  console.log(pc.bold("\n  Routes:"));
  if (routes.length === 0) {
    console.log(pc.gray("    (No routes registered in configuration)"));
  } else {
    for (const r of routes) {
      const fullPath = `${basePath}${r.path}`;
      console.log(`    ${formatMethod(r.method)} ${pc.white(fullPath)}`);
    }
  }

  console.log(pc.gray("\n  Watching incoming requests... (Press Ctrl+C to stop)\n"));

  // 8. Graceful shutdown handler
  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(pc.yellow("\n\nShutting down Wiremint mock server..."));

    try {
      if (controlServer) {
        await controlServer.close();
      }
      await app.close();
      console.log(pc.green("✔ Server stopped gracefully.\n"));
    } catch (err) {
      console.error(pc.red("Error during server shutdown:"), err);
    } finally {
      process.exit(0);
    }
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
