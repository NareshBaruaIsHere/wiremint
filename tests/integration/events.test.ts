import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createWiremint, type WiremintInstance } from "../../src/index.js";

let app: WiremintInstance;
let port: number;

async function request(
  path: string,
  options: RequestInit = {},
): Promise<{ status: number; headers: Headers; body: unknown }> {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, options);
  const text = await res.text();
  let body: unknown = text;
  if (text && res.headers.get("content-type")?.includes("application/json")) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: res.status, headers: res.headers, body };
}

describe("Typed Event System Integration", () => {
  beforeAll(async () => {
    port = 50_000 + Math.floor(Math.random() * 1_000);

    app = createWiremint({ basePath: "/api" });

    app.get("/items/:id", ({ params }) => ({
      status: 200,
      body: { id: params.id, title: "Item" },
    }));

    app.get("/faulty", () => {
      throw new Error("Deliberate failure in handler");
    });

    await app.listen({ port });
  });

  afterAll(async () => {
    await app.close();
  });

  it("emits request lifecycle events in strict chronological order with accurate payloads", async () => {
    const eventSequence: string[] = [];
    let startRequestId = "";
    let matchRequestId = "";
    let successRequestId = "";
    let completeRequestId = "";

    const unsubStart = app.on("request:start", (event) => {
      eventSequence.push("start");
      startRequestId = event.requestId;
      expect(event.method).toBe("GET");
      expect(event.path).toBe("/items/42");
    });

    const unsubMatch = app.on("request:match", (event) => {
      eventSequence.push("match");
      matchRequestId = event.requestId;
      expect(event.matchedRoute).toBe("/items/:id");
      expect(event.params).toEqual({ id: "42" });
    });

    const unsubSuccess = app.on("request:success", (event) => {
      eventSequence.push("success");
      successRequestId = event.requestId;
      expect(event.statusCode).toBe(200);
      expect(typeof event.duration).toBe("number");
    });

    const unsubComplete = app.on("request:complete", (event) => {
      eventSequence.push("complete");
      completeRequestId = event.requestId;
      expect(event.outcome).toBe("success");
      expect(event.statusCode).toBe(200);
    });

    await request("/api/items/42");

    expect(eventSequence).toEqual(["start", "match", "success", "complete"]);
    expect(startRequestId).toBeTruthy();
    expect(startRequestId).toBe(matchRequestId);
    expect(startRequestId).toBe(successRequestId);
    expect(startRequestId).toBe(completeRequestId);

    // Clean up
    unsubStart();
    unsubMatch();
    unsubSuccess();
    unsubComplete();
  });

  it("emits request:error and request:complete with outcome 'error' when handler fails", async () => {
    const errorFn = vi.fn();
    const completeFn = vi.fn();

    const unsubErr = app.on("request:error", errorFn);
    const unsubComp = app.on("request:complete", completeFn);

    const res = await request("/api/faulty");
    expect(res.status).toBe(500);

    expect(errorFn).toHaveBeenCalledTimes(1);
    expect(errorFn).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: expect.stringMatching(/deliberate failure/i),
        }),
        statusCode: 500,
      }),
    );

    expect(completeFn).toHaveBeenCalledTimes(1);
    expect(completeFn).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "error",
        statusCode: 500,
      }),
    );

    unsubErr();
    unsubComp();
  });

  it("handles event listener exceptions without crashing server or altering HTTP responses", async () => {
    const listenerErrorFn = vi.fn();
    const unsubErr = app.on("listener:error", listenerErrorFn);

    const unsubBuggy = app.on("request:start", () => {
      throw new Error("Listener throwing an unhandled bug");
    });

    const res = await request("/api/items/99");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: "99", title: "Item" });

    // listener:error captured the bug cleanly
    expect(listenerErrorFn).toHaveBeenCalledTimes(1);
    expect(listenerErrorFn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "request:start",
        error: expect.any(Error),
      }),
    );

    unsubBuggy();
    unsubErr();
  });

  it("supports unsubscribing listeners so they no longer receive events", async () => {
    const fn = vi.fn();
    const unsubscribe = app.on("request:start", fn);

    await request("/api/items/1");
    expect(fn).toHaveBeenCalledTimes(1);

    unsubscribe();

    await request("/api/items/2");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

