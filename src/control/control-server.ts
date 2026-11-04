import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { WiremintInstance } from "../core/engine.js";
import { cleanupRuntimeFile, writeRuntimeInfo } from "./runtime-manager.js";
import type { RuntimeInfo } from "./types.js";

export interface ControlServerOptions {
  app: WiremintInstance;
  serverUrl: string;
  version: string;
  port?: number;
  cwd?: string;
}

export interface ControlServerInstance {
  token: string;
  port: number;
  host: string;
  close(): Promise<void>;
}

/**
 * Validates a Bearer token in constant time.
 */
function isTokenValid(authHeader: string | undefined, expectedToken: string): boolean {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  const token = authHeader.slice(7).trim();
  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expectedToken);

  if (tokenBuf.length !== expectedBuf.length) {
    return false;
  }
  return timingSafeEqual(tokenBuf, expectedBuf);
}

/**
 * Sends a structured JSON response.
 */
function sendJson(res: ServerResponse, status: number, data: unknown): void {
  const payload = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
    "Connection": "close",
  });
  res.end(payload);
}

/**
 * Reads and parses JSON request body with a size limit (64 KB).
 */
async function parseJsonBody(req: IncomingMessage, limit = 65536): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let bytes = 0;
    const chunks: Buffer[] = [];

    req.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > limit) {
        reject(new Error("Payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      const raw = Buffer.concat(chunks).toString("utf-8");
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });

    req.on("error", (err) => reject(err));
  });
}

/**
 * Starts the local Wiremint Control Server.
 * Strictly binds to 127.0.0.1 and generates a secure random token.
 */
export async function startControlServer(
  options: ControlServerOptions,
): Promise<ControlServerInstance> {
  const token = randomBytes(32).toString("hex");
  const host = "127.0.0.1";
  const { app, serverUrl, version, cwd = process.cwd() } = options;

  const server: Server = createServer(async (req, res) => {
    // 1. Authenticate every endpoint
    if (!isTokenValid(req.headers.authorization, token)) {
      sendJson(res, 401, { error: "Unauthorized: Invalid or missing control token" });
      return;
    }

    const url = new URL(req.url ?? "/", `http://${host}`);
    const pathname = url.pathname;
    const method = req.method?.toUpperCase() ?? "GET";

    try {
      // GET /health
      if (method === "GET" && pathname === "/health") {
        sendJson(res, 200, {
          status: "ok",
          pid: process.pid,
          uptime: process.uptime(),
          version,
          serverUrl,
        });
        return;
      }

      // GET /routes
      if (method === "GET" && pathname === "/routes") {
        sendJson(res, 200, {
          routes: app.routes(),
        });
        return;
      }

      // GET /requests
      if (method === "GET" && pathname === "/requests") {
        const inspector = app.inspect();
        let requests = inspector.getRequests();

        // Apply filters
        const filterMethod = url.searchParams.get("method")?.toUpperCase();
        if (filterMethod) {
          requests = requests.filter((r) => r.method === filterMethod);
        }

        const filterPath = url.searchParams.get("path");
        if (filterPath) {
          requests = requests.filter((r) => r.path.includes(filterPath));
        }

        const filterStatus = url.searchParams.get("status");
        if (filterStatus) {
          const s = Number(filterStatus);
          if (!Number.isNaN(s)) {
            requests = requests.filter((r) => r.statusCode === s);
          }
        }

        const filterScenario = url.searchParams.get("scenario");
        if (filterScenario) {
          requests = requests.filter((r) => r.scenarioId === filterScenario);
        }

        const limitStr = url.searchParams.get("limit");
        const limit = limitStr ? Math.max(1, Number(limitStr)) : 20;
        const sliced = requests.slice(-limit);

        sendJson(res, 200, {
          total: requests.length,
          requests: sliced,
        });
        return;
      }

      // GET /requests/:id
      if (method === "GET" && pathname.startsWith("/requests/")) {
        const reqId = pathname.slice("/requests/".length);
        const reqRecord = app.inspect().getRequest(reqId);
        if (!reqRecord) {
          sendJson(res, 404, { error: `Request "${reqId}" not found` });
          return;
        }
        sendJson(res, 200, { request: reqRecord });
        return;
      }

      // GET /scenarios
      if (method === "GET" && pathname === "/scenarios") {
        sendJson(res, 200, {
          active: app.getScenario(),
          scenarios: app.listScenarios(),
        });
        return;
      }

      // GET /scenarios/active
      if (method === "GET" && pathname === "/scenarios/active") {
        sendJson(res, 200, {
          active: app.getScenario(),
        });
        return;
      }

      // POST /scenarios/active
      if (method === "POST" && pathname === "/scenarios/active") {
        const body = (await parseJsonBody(req)) as { scenarioId?: string };
        if (!body.scenarioId || typeof body.scenarioId !== "string") {
          sendJson(res, 400, { error: "Missing required 'scenarioId' string parameter" });
          return;
        }

        try {
          app.setScenario(body.scenarioId);
          sendJson(res, 200, {
            success: true,
            active: app.getScenario(),
          });
        } catch (err) {
          sendJson(res, 404, {
            error: err instanceof Error ? err.message : String(err),
          });
        }
        return;
      }

      // POST /scenarios/:id/reset
      if (method === "POST" && pathname.startsWith("/scenarios/") && pathname.endsWith("/reset")) {
        const parts = pathname.split("/");
        const scenarioId = parts[2];
        try {
          app.resetScenario(scenarioId);
          sendJson(res, 200, {
            success: true,
            message: `Scenario '${scenarioId}' state reset to initial values`,
          });
        } catch (err) {
          sendJson(res, 404, {
            error: err instanceof Error ? err.message : String(err),
          });
        }
        return;
      }

      // 404 for unknown endpoints
      sendJson(res, 404, { error: "Endpoint not found on control plane" });
    } catch (err) {
      sendJson(res, 500, {
        error: "Internal control plane error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  return new Promise((resolve, reject) => {
    const bindPort = options.port ?? 0;
    server.listen(bindPort, host, () => {
      const addr = server.address() as AddressInfo;
      const port = addr.port;

      const runtimeInfo: RuntimeInfo = {
        pid: process.pid,
        controlHost: host,
        controlPort: port,
        token,
        serverUrl,
        version,
        createdAt: new Date().toISOString(),
      };

      writeRuntimeInfo(runtimeInfo, cwd);

      resolve({
        token,
        port,
        host,
        close: async () => {
          cleanupRuntimeFile(cwd);
          return new Promise<void>((resClose) => {
            server.close(() => resClose());
          });
        },
      });
    });

    server.on("error", (err) => {
      cleanupRuntimeFile(cwd);
      reject(err);
    });
  });
}
