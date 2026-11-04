import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWiremint, type WiremintInstance } from "../../src/index.js";
import { startControlServer, type ControlServerInstance } from "../../src/control/control-server.js";
import { ControlClient } from "../../src/cli/control-client/client.js";
import { getRuntimeFilePath } from "../../src/control/runtime-manager.js";

describe("CLI Control Plane Integration", () => {
  let app: WiremintInstance;
  let controlServer: ControlServerInstance | null = null;
  let tempDir: string;
  let mockPort: number;

  function getAvailablePort(): number {
    return 43_000 + Math.floor(Math.random() * 5_000);
  }

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "wiremint-ctrl-int-"));
    mockPort = getAvailablePort();

    app = createWiremint({
      server: { port: mockPort },
      scenarios: [
        {
          id: "error-mode",
          name: "Error Simulation Mode",
          description: "All services return 500 error",
        },
      ],
      routes: [
        {
          method: "GET",
          path: "/data",
          response: {
            status: 200,
            body: { message: "Normal operational response" },
          },
          scenarios: {
            "error-mode": {
              status: 500,
              body: { message: "Simulated upstream failure" },
            },
          },
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

  it("orchestrates mock server via ControlClient across processes", async () => {
    await app.listen();
    const serverUrl = `http://127.0.0.1:${mockPort}`;

    controlServer = await startControlServer({
      app,
      serverUrl,
      version: "0.1.0",
      cwd: tempDir,
    });

    const client = new ControlClient(tempDir);

    // 1. Verify health check
    const health = await client.getHealth();
    expect(health.status).toBe("ok");
    expect(health.serverUrl).toBe(serverUrl);

    // 2. Initial request (default scenario)
    const res1 = await fetch(`${serverUrl}/data`);
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1).toEqual({ message: "Normal operational response" });

    // 3. Inspect requests via ControlClient
    const inspected = await client.getRequests();
    expect(inspected.requests.length).toBeGreaterThanOrEqual(1);
    expect(inspected.requests[0]?.statusCode).toBe(200);

    // 4. Switch scenario to error-mode via ControlClient
    const scenarioResult = await client.setActiveScenario("error-mode");
    expect(scenarioResult.active.id).toBe("error-mode");

    // 5. Verify that subsequent HTTP request receives the scenario override!
    const res2 = await fetch(`${serverUrl}/data`);
    expect(res2.status).toBe(500);
    const body2 = await res2.json();
    expect(body2).toEqual({ message: "Simulated upstream failure" });

    // 6. Reset scenario
    const resetResult = await client.resetScenario("error-mode");
    expect(resetResult.success).toBe(true);

    // 7. Close and verify runtime file cleanup
    await controlServer.close();
    controlServer = null;

    expect(existsSync(getRuntimeFilePath(tempDir))).toBe(false);
  });
});

