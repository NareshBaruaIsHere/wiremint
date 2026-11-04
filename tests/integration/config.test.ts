import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWiremint } from "../../src/index.js";
import type { WiremintInstance } from "../../src/core/engine.js";

describe("Configuration Engine Integration", () => {
  let app: WiremintInstance | null = null;
  let tempDir: string;
  let port: number;

  function getNextPort(): number {
    return 42_000 + Math.floor(Math.random() * 5_000);
  }

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "wiremint-config-int-"));
    port = getNextPort();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it("boots Wiremint using createWiremint(config) with declarative routes and parameter interpolation", async () => {
    app = createWiremint({
      server: {
        port,
        basePath: "/api",
      },
      routes: [
        {
          method: "GET",
          path: "/users/:id",
          response: {
            status: 200,
            headers: { "x-custom": "declarative" },
            body: {
              userId: "{{params.id}}",
              filter: "{{query.q}}",
              meta: {
                reqId: "{{requestId}}",
                scenario: "{{scenario.id}}",
              },
            },
          },
        },
      ],
    });

    await app.listen();
    const res = await fetch(`http://127.0.0.1:${port}/api/users/42?q=active`);

    expect(res.status).toBe(200);
    expect(res.headers.get("x-custom")).toBe("declarative");

    const json = (await res.json()) as {
      userId: string;
      filter: string;
      meta: { scenario: string; reqId: string };
    };
    expect(json.userId).toBe("42");
    expect(json.filter).toBe("active");
    expect(json.meta.scenario).toBe("default");
    expect(json.meta.reqId).toBeDefined();
  });

  it("supports declarative scenarios and scenario-specific responses", async () => {
    app = createWiremint({
      server: { port },
      scenarios: [
        {
          id: "outage",
          name: "System Outage",
          description: "All services return 503",
        },
      ],
      routes: [
        {
          method: "GET",
          path: "/status",
          response: {
            status: 200,
            body: { status: "operational" },
          },
          scenarios: {
            outage: {
              status: 503,
              body: { status: "maintenance" },
            },
          },
        },
      ],
    });

    await app.listen();

    // 1. Default scenario
    const res1 = await fetch(`http://127.0.0.1:${port}/status`);
    expect(res1.status).toBe(200);
    expect(await res1.json()).toEqual({ status: "operational" });

    // 2. Switch to outage scenario
    app.setScenario("outage");
    const res2 = await fetch(`http://127.0.0.1:${port}/status`);
    expect(res2.status).toBe(503);
    expect(await res2.json()).toEqual({ status: "maintenance" });
  });

  it("supports declarative sequential responses", async () => {
    app = createWiremint({
      server: { port },
      routes: [
        {
          method: "GET",
          path: "/job/status",
          sequence: [
            { status: 202, body: { progress: "queued" } },
            { status: 202, body: { progress: "running" } },
            { status: 200, body: { progress: "done" } },
          ],
          afterEnd: "repeat-last",
        },
      ],
    });

    await app.listen();

    const r1 = await (await fetch(`http://127.0.0.1:${port}/job/status`)).json();
    expect(r1).toEqual({ progress: "queued" });

    const r2 = await (await fetch(`http://127.0.0.1:${port}/job/status`)).json();
    expect(r2).toEqual({ progress: "running" });

    const r3 = await (await fetch(`http://127.0.0.1:${port}/job/status`)).json();
    expect(r3).toEqual({ progress: "done" });

    // Repeated last
    const r4 = await (await fetch(`http://127.0.0.1:${port}/job/status`)).json();
    expect(r4).toEqual({ progress: "done" });
  });

  it("supports createWiremint.fromConfig() loading from JSON config file", async () => {
    const configPath = join(tempDir, "wiremint.config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        server: { port, basePath: "/v1" },
        routes: [
          {
            method: "POST",
            path: "/echo",
            response: {
              status: 201,
              body: { ok: true, echoQuery: "{{query.name}}" },
            },
          },
        ],
      }),
    );

    app = await createWiremint.fromConfig(configPath);
    await app.listen();

    const res = await fetch(`http://127.0.0.1:${port}/v1/echo?name=test`, {
      method: "POST",
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ ok: true, echoQuery: "test" });
  });

  it("enables inspector from configuration and captures requests", async () => {
    app = createWiremint({
      server: { port },
      inspector: {
        enabled: true,
        sensitiveKeys: ["token"],
      },
      routes: [
        {
          method: "GET",
          path: "/test",
          response: { status: 200, body: { success: true } },
        },
      ],
    });

    await app.listen();
    await fetch(`http://127.0.0.1:${port}/test?token=supersecret&public=123`);

    const records = app.inspect().getRequests();
    expect(records).toHaveLength(1);
    expect(records[0]?.url).toContain("token=[REDACTED]");
    expect(records[0]?.url).toContain("public=123");
  });
});
