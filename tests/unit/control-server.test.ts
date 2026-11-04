import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWiremint, type WiremintInstance } from "../../src/index.js";
import { startControlServer, type ControlServerInstance } from "../../src/control/control-server.js";
import { getRuntimeFilePath } from "../../src/control/runtime-manager.js";

describe("Control Server & Authentication", () => {
  let app: WiremintInstance;
  let controlServer: ControlServerInstance | null = null;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "wiremint-ctrl-test-"));
    app = createWiremint({
      scenarios: [
        { id: "beta", name: "Beta Users" },
        { id: "maintenance", name: "Maintenance" },
      ],
      routes: [
        {
          method: "GET",
          path: "/users",
          response: { status: 200, body: [{ id: 1 }] },
        },
      ],
    });
  });

  afterEach(async () => {
    if (controlServer) {
      await controlServer.close();
      controlServer = null;
    }
    await app.close();
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it("binds strictly to 127.0.0.1 and creates .wiremint/runtime.json", async () => {
    controlServer = await startControlServer({
      app,
      serverUrl: "http://127.0.0.1:3001",
      version: "0.1.0",
      cwd: tempDir,
    });

    expect(controlServer.host).toBe("127.0.0.1");
    expect(controlServer.port).toBeGreaterThan(0);
    expect(controlServer.token).toHaveLength(64); // 32 hex bytes

    const runtimePath = getRuntimeFilePath(tempDir);
    expect(existsSync(runtimePath)).toBe(true);
  });

  it("rejects unauthorized requests with 401", async () => {
    controlServer = await startControlServer({
      app,
      serverUrl: "http://127.0.0.1:3001",
      version: "0.1.0",
      cwd: tempDir,
    });

    // 1. Missing Authorization header
    const resNoAuth = await fetch(`http://127.0.0.1:${controlServer.port}/health`);
    expect(resNoAuth.status).toBe(401);

    // 2. Invalid Bearer token
    const resBadAuth = await fetch(`http://127.0.0.1:${controlServer.port}/health`, {
      headers: { Authorization: "Bearer wrong-token" },
    });
    expect(resBadAuth.status).toBe(401);
  });

  it("serves /health, /routes, and /scenarios with valid token", async () => {
    controlServer = await startControlServer({
      app,
      serverUrl: "http://127.0.0.1:3001",
      version: "0.1.0",
      cwd: tempDir,
    });

    const headers = { Authorization: `Bearer ${controlServer.token}` };

    // GET /health
    const healthRes = await fetch(`http://127.0.0.1:${controlServer.port}/health`, { headers });
    expect(healthRes.status).toBe(200);
    const healthJson = await healthRes.json();
    expect(healthJson.status).toBe("ok");
    expect(healthJson.serverUrl).toBe("http://127.0.0.1:3001");

    // GET /routes
    const routesRes = await fetch(`http://127.0.0.1:${controlServer.port}/routes`, { headers });
    expect(routesRes.status).toBe(200);
    const routesJson = await routesRes.json();
    expect(routesJson.routes).toEqual([{ method: "GET", path: "/users" }]);

    // GET /scenarios
    const scenariosRes = await fetch(`http://127.0.0.1:${controlServer.port}/scenarios`, { headers });
    expect(scenariosRes.status).toBe(200);
    const scenariosJson = await scenariosRes.json();
    expect(scenariosJson.active.id).toBe("default");
    expect(scenariosJson.scenarios.map((s: { id: string }) => s.id)).toContain("beta");
  });

  it("switches active scenario via POST /scenarios/active", async () => {
    controlServer = await startControlServer({
      app,
      serverUrl: "http://127.0.0.1:3001",
      version: "0.1.0",
      cwd: tempDir,
    });

    const headers = {
      Authorization: `Bearer ${controlServer.token}`,
      "Content-Type": "application/json",
    };

    // 1. Switch to beta
    const postRes = await fetch(`http://127.0.0.1:${controlServer.port}/scenarios/active`, {
      method: "POST",
      headers,
      body: JSON.stringify({ scenarioId: "beta" }),
    });
    expect(postRes.status).toBe(200);
    expect(app.getScenario().id).toBe("beta");

    // 2. Attempt to switch to non-existent scenario
    const badPost = await fetch(`http://127.0.0.1:${controlServer.port}/scenarios/active`, {
      method: "POST",
      headers,
      body: JSON.stringify({ scenarioId: "nonexistent" }),
    });
    expect(badPost.status).toBe(404);
    expect(app.getScenario().id).toBe("beta"); // Unchanged
  });

  it("cleans up .wiremint/runtime.json when control server closes", async () => {
    controlServer = await startControlServer({
      app,
      serverUrl: "http://127.0.0.1:3001",
      version: "0.1.0",
      cwd: tempDir,
    });

    const runtimePath = getRuntimeFilePath(tempDir);
    expect(existsSync(runtimePath)).toBe(true);

    await controlServer.close();
    controlServer = null;

    expect(existsSync(runtimePath)).toBe(false);
  });
});

