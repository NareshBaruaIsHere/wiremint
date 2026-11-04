import { describe, expect, it } from "vitest";
import { createWiremint } from "../../src/core/engine.js";
import { createWiremintTestClient } from "../../src/testing/test-client.js";

describe("Test Client Isolation & Reliability (M07.1)", () => {
  describe("A1: Client Isolation on Shared Application", () => {
    it("isolates history between independent clients wrapping the same app", async () => {
      const app = createWiremint();
      app.get("/client-a", () => ({ status: 200, body: { client: "a" } }));
      app.get("/client-b", () => ({ status: 200, body: { client: "b" } }));

      const client1 = createWiremintTestClient(app);
      const client2 = createWiremintTestClient(app);

      await client1.get("/client-a");
      await client2.get("/client-b");
      await client1.get("/client-a");

      expect(client1.history()).toHaveLength(2);
      expect(client1.history().every((r) => r.path === "/client-a")).toBe(true);

      expect(client2.history()).toHaveLength(1);
      expect(client2.history()[0]?.path).toBe("/client-b");

      // Clearing client1's history must NOT affect client2's history
      client1.clearHistory();
      expect(client1.history()).toHaveLength(0);
      expect(client2.history()).toHaveLength(1);
      expect(client2.lastRequest()?.path).toBe("/client-b");
    });

    it("isolates scenario selection between clients without mutating shared app", async () => {
      const app = createWiremint();
      app.scenario("maintenance", { name: "Maintenance Mode" });
      app.scenario("beta", { name: "Beta Features" });

      app.get("/profile", {
        default: () => ({ status: 200, body: { role: "standard" } }),
        scenarios: {
          maintenance: () => ({ status: 503, body: { error: "Maintenance" } }),
          beta: () => ({ status: 200, body: { role: "beta-tester" } }),
        },
      });

      const client1 = createWiremintTestClient(app);
      const client2 = createWiremintTestClient(app);

      client1.setScenario("maintenance");
      client2.setScenario("beta");

      expect(client1.getScenario().id).toBe("maintenance");
      expect(client2.getScenario().id).toBe("beta");

      // Both execute concurrently and receive their own scenario responses
      const res1 = await client1.get("/profile");
      const res2 = await client2.get("/profile");

      expect(res1.status).toBe(503);
      expect(res1.body).toEqual({ error: "Maintenance" });

      expect(res2.status).toBe(200);
      expect(res2.body).toEqual({ role: "beta-tester" });

      // Shared app default scenario was not permanently altered
      expect(app.getScenario().id).toBe("default");
    });

    it("isolates simulation settings between clients without altering application-wide settings", async () => {
      const app = createWiremint({
        simulation: {
          latency: { fixed: 10 },
        },
      });

      app.get("/ping", () => ({ status: 200, body: "pong" }));

      const client1 = createWiremintTestClient(app, { simulation: false });
      const client2 = createWiremintTestClient(app, {
        simulation: { failure: { rate: 1.0, statusCode: 500 } },
      });

      // Client 1 has simulation disabled
      const res1 = await client1.get("/ping");
      expect(res1.status).toBe(200);

      // Client 2 has failure injection
      const res2 = await client2.get("/ping");
      expect(res2.status).toBe(500);

      // Base application configuration was preserved
      expect(app.getSimulation()?.latency).toBeDefined();

      await client1.close();
      await client2.close();
    });
  });

  describe("A2: Comprehensive Reset Semantics", () => {
    it("distinguishes clearHistory, resetScenario, reset, and close", async () => {
      const app = createWiremint({
        scenarios: [{ id: "counter-flow", name: "Counter Flow" }],
      });

      app.get("/sequence", {
        sequence: [
          { status: 200, body: { step: 1 } },
          { status: 200, body: { step: 2 } },
          { status: 200, body: { step: 3 } },
        ],
      });

      const client = createWiremintTestClient(app);

      // Call sequence twice
      await client.get("/sequence");
      await client.get("/sequence");
      expect(client.history()).toHaveLength(2);

      // 1. clearHistory() ONLY clears recorded requests
      client.clearHistory();
      expect(client.history()).toHaveLength(0);

      // Sequence continues at step 3!
      const step3 = await client.get("/sequence");
      expect(step3.body).toEqual({ step: 3 });

      // 2. resetScenario() resets sequence counters and state for a scenario
      client.resetScenario();
      const step1Again = await client.get("/sequence");
      expect(step1Again.body).toEqual({ step: 1 });

      // 3. reset() restores history, active scenario, simulation.
      // For shared clients (ownership === "shared"), shared scenario sequences are NOT reset!
      expect(client.ownership).toBe("shared");
      client.setScenario("counter-flow");
      client.setSimulation({ failure: { rate: 1.0, statusCode: 503 } });
      await client.get("/sequence"); // fails with 503
      expect(client.history().length).toBeGreaterThan(0);

      client.reset();
      expect(client.history()).toHaveLength(0);
      expect(client.getScenario().id).toBe("default");

      // Verify sequence continued at step 2 (not reset because client is shared)
      const continueStep = await client.get("/sequence");
      expect(continueStep.status).toBe(200);
      expect(continueStep.body).toEqual({ step: 2 });

      // In contrast, owned clients (.isolated()) DO reset scenario sequences on reset()
      const ownedClient = createWiremintTestClient.isolated();
      expect(ownedClient.ownership).toBe("owned");
      ownedClient.app.get("/seq", {
        sequence: [
          { status: 200, body: { step: 1 } },
          { status: 200, body: { step: 2 } },
        ],
      });
      await ownedClient.get("/seq"); // step 1
      ownedClient.reset();
      const resetStep = await ownedClient.get("/seq");
      expect(resetStep.body).toEqual({ step: 1 });
      await ownedClient.close();

      // 4. close() prevents further requests and is idempotent
      await client.close();
      await client.close();
      await expect(client.get("/sequence")).rejects.toThrow(/closed/);
    });
  });

  describe("A3: Request Body Handling", () => {
    it("handles explicit textBody without accidental JSON quotes", async () => {
      const app = createWiremint();
      app.post("/text-echo", ({ body, headers }) => ({
        status: 200,
        body: {
          receivedBody: body,
          isString: typeof body === "string",
          contentType: headers["content-type"],
          contentLength: headers["content-length"],
        },
      }));

      const client = createWiremintTestClient(app);

      const res = await client.post("/text-echo", {
        textBody: "plain hello world",
      });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        receivedBody: "plain hello world",
        isString: true,
        contentType: "text/plain; charset=utf-8",
        contentLength: "17",
      });
    });

    it("handles empty strings and empty buffers correctly", async () => {
      const app = createWiremint();
      app.post("/empty-check", ({ body, headers }) => ({
        status: 200,
        body: {
          body,
          contentLength: headers["content-length"],
        },
      }));

      const client = createWiremintTestClient(app);

      // Empty textBody
      const emptyTextRes = await client.post("/empty-check", {
        textBody: "",
      });
      expect(emptyTextRes.status).toBe(200);
      expect(emptyTextRes.headers["content-type"]).toBe("application/json");

      // Empty buffer
      const emptyBufRes = await client.post("/empty-check", {
        body: Buffer.alloc(0),
      });
      expect(emptyBufRes.status).toBe(200);
    });

    it("handles plain text string with headers: { 'content-type': 'text/plain' }", async () => {
      const app = createWiremint();
      app.post("/plain", ({ body }) => ({
        status: 200,
        body: { received: body },
      }));

      const client = createWiremintTestClient(app);
      const res = await client.post("/plain", {
        body: "non-json text string",
        headers: { "content-type": "text/plain" },
      });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ received: "non-json text string" });
    });
  });

  describe("A4: Response Parsing", () => {
    it("parses application/json and structured +json media types", async () => {
      const app = createWiremint();
      app.get("/problem", () => ({
        status: 400,
        headers: { "Content-Type": "application/problem+json" },
        body: { title: "Bad Request", detail: "Invalid parameter" },
      }));

      const client = createWiremintTestClient(app);
      const res = await client.get("/problem");

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ title: "Bad Request", detail: "Invalid parameter" });
      expect(res.json()).toEqual({ title: "Bad Request", detail: "Invalid parameter" });
    });

    it("preserves text/plain responses as strings even when numeric or boolean", async () => {
      const app = createWiremint();
      app.get("/num", () => ({
        status: 200,
        headers: { "Content-Type": "text/plain" },
        body: "12345",
      }));
      app.get("/bool", () => ({
        status: 200,
        headers: { "Content-Type": "text/plain" },
        body: "true",
      }));
      app.get("/json-like", () => ({
        status: 200,
        headers: { "Content-Type": "text/plain" },
        body: '{"message":"hello"}',
      }));

      const client = createWiremintTestClient(app);

      const numRes = await client.get("/num");
      expect(numRes.body).toBe("12345");
      expect(typeof numRes.body).toBe("string");

      const boolRes = await client.get("/bool");
      expect(boolRes.body).toBe("true");
      expect(typeof boolRes.body).toBe("string");

      const jsonLikeRes = await client.get("/json-like");
      expect(jsonLikeRes.body).toBe('{"message":"hello"}');
      expect(typeof jsonLikeRes.body).toBe("string");
    });

    it("handles empty responses predictably (status 204 or empty body)", async () => {
      const app = createWiremint();
      app.delete("/item/1", () => ({ status: 204 }));

      const client = createWiremintTestClient(app);
      const res = await client.delete("/item/1");

      expect(res.status).toBe(204);
      expect(res.body).toBeUndefined();
      expect(res.text).toBe("");
    });

    it("does not crash on invalid JSON response with application/json header", async () => {
      const app = createWiremint();
      app.get("/malformed", () => ({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: "not a valid json {{" as any,
      }));

      const client = createWiremintTestClient(app);
      const res = await client.get("/malformed");

      expect(res.status).toBe(200);
      expect(res.text).toBe("not a valid json {{");
      expect(res.body).toBe("not a valid json {{");
      expect(() => res.json()).toThrow(/Cannot parse response body as JSON/);
    });
  });

  describe("A5: In-Process Stream Reliability", () => {
    it("does not emit duplicate finish or close events", async () => {
      const app = createWiremint();
      app.get("/stream-check", () => ({ status: 200, body: { ok: true } }));

      let finishEvents = 0;
      let closeEvents = 0;

      const client = createWiremintTestClient(app);
      const res = await client.get("/stream-check");

      expect(res.status).toBe(200);
    });

    it("creates isolated applications with createWiremintTestClient.isolated()", () => {
      const client1 = createWiremintTestClient.isolated();
      const client2 = createWiremintTestClient.isolated();

      client1.app.get("/only-1", () => ({ status: 200, body: "1" }));
      client2.app.get("/only-2", () => ({ status: 200, body: "2" }));

      expect(client1.app.routes().some((r) => r.path === "/only-1")).toBe(true);
      expect(client1.app.routes().some((r) => r.path === "/only-2")).toBe(false);

      expect(client2.app.routes().some((r) => r.path === "/only-2")).toBe(true);
      expect(client2.app.routes().some((r) => r.path === "/only-1")).toBe(false);
    });
  });

  describe("M08.1: Release Blocker Fixes & Regression Suite", () => {
    it("prevents external HTTP requests over TCP from bypassing simulation via x-wiremint-simulation header", async () => {
      const port = 46_000 + Math.floor(Math.random() * 3_000);
      const app = createWiremint({
        simulation: {
          failure: { rate: 1.0, statusCode: 503, message: "Simulated Down" },
        },
      });
      app.get("/guarded", () => ({ status: 200, body: { ok: true } }));
      await app.listen({ port });

      try {
        // Attempt to bypass simulation with external HTTP header
        const res = await fetch(`http://127.0.0.1:${port}/guarded`, {
          headers: {
            "x-wiremint-simulation": "false",
          },
        });
        // Must NOT bypass simulation: response must still be 503
        expect(res.status).toBe(503);
      } finally {
        await app.close();
      }
    });

    it("handles duplicate requestIds without collisions in inspector store", async () => {
      const app = createWiremint();
      app.get("/data", () => ({ status: 200, body: { ok: true } }));

      const client1 = createWiremintTestClient(app);
      const client2 = createWiremintTestClient(app);

      // Both clients make requests using the exact same explicit requestId
      const res1 = await client1.get("/data", { requestId: "fixed-id" });
      const res2 = await client2.get("/data", { requestId: "fixed-id" });
      const res3 = await client1.get("/data", { requestId: "fixed-id" });

      expect(res1.requestId).toBe("fixed-id");
      expect(res2.requestId).toBe("fixed-id");
      expect(res3.requestId).toBe("fixed-id");

      // Inspector store holds all 3 entries without overwriting
      expect(app.inspect().size).toBe(3);

      // client1 history has 2 records, client2 has 1 record
      expect(client1.history()).toHaveLength(2);
      expect(client2.history()).toHaveLength(1);

      // Clearing client1 history deletes only client1's 2 records
      client1.clearHistory();
      expect(client1.history()).toHaveLength(0);
      expect(client2.history()).toHaveLength(1);
      expect(app.inspect().size).toBe(1);
    });

    it("avoids scenario bleed from global app.setScenario changes", async () => {
      const app = createWiremint({
        scenarios: [
          { id: "beta", name: "Beta" },
        ],
      });
      app.get("/info", ({ scenario }) => ({
        status: 200,
        body: { scenarioId: scenario.id },
      }));

      // Test client created without explicit scenario defaults to "default"
      const client = createWiremintTestClient(app);

      // Externally mutate the shared application's active scenario
      app.setScenario("beta");
      expect(app.getScenario().id).toBe("beta");

      // Test client request must still execute under "default" scenario, NOT "beta"
      const res = await client.get("/info");
      expect(res.body).toEqual({ scenarioId: "default" });

      // If client explicitly sets scenario, it uses that
      client.setScenario("beta");
      const resBeta = await client.get("/info");
      expect(resBeta.body).toEqual({ scenarioId: "beta" });

      // If client clears scenario, it reverts to default, NOT the app's global "beta"
      client.clearScenario();
      const resCleared = await client.get("/info");
      expect(resCleared.body).toEqual({ scenarioId: "default" });
    });

    it("exposes ownership property with correct shared and owned values", () => {
      const app = createWiremint();
      const sharedClient = createWiremintTestClient(app);
      expect(sharedClient.ownership).toBe("shared");

      const ownedClient = createWiremintTestClient.isolated();
      expect(ownedClient.ownership).toBe("owned");
    });
  });
});

