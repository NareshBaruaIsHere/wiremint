import { describe, it, expect, vi } from "vitest";
import { TypedEventEmitter } from "../../src/events/event-emitter.js";

describe("TypedEventEmitter", () => {
  it("registers listeners and emits events in registration order", () => {
    const emitter = new TypedEventEmitter();
    const calls: string[] = [];

    emitter.on("request:start", (event) => {
      calls.push(`listener-1:${event.requestId}`);
    });

    emitter.on("request:start", (event) => {
      calls.push(`listener-2:${event.requestId}`);
    });

    emitter.emit("request:start", {
      requestId: "req-1",
      method: "GET",
      url: "http://localhost/users",
      path: "/users",
      timestamp: new Date().toISOString(),
    });

    expect(calls).toEqual(["listener-1:req-1", "listener-2:req-1"]);
  });

  it("unsubscribes listeners cleanly via returned unsubscribe function", () => {
    const emitter = new TypedEventEmitter();
    const listener = vi.fn();

    const unsub = emitter.on("request:complete", listener);
    expect(emitter.listenerCount("request:complete")).toBe(1);

    emitter.emit("request:complete", {
      requestId: "req-1",
      outcome: "success",
      statusCode: 200,
      duration: 12,
      timestamp: new Date().toISOString(),
    });
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    expect(emitter.listenerCount("request:complete")).toBe(0);

    // Second unsubscribe call is a no-op
    unsub();

    emitter.emit("request:complete", {
      requestId: "req-2",
      outcome: "error",
      statusCode: 500,
      duration: 20,
      timestamp: new Date().toISOString(),
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes listeners via off()", () => {
    const emitter = new TypedEventEmitter();
    const listener = vi.fn();

    emitter.on("request:start", listener);
    expect(emitter.listenerCount("request:start")).toBe(1);

    emitter.off("request:start", listener);
    expect(emitter.listenerCount("request:start")).toBe(0);

    emitter.emit("request:start", {
      requestId: "req-1",
      method: "GET",
      url: "http://localhost/test",
      path: "/test",
      timestamp: new Date().toISOString(),
    });
    expect(listener).not.toHaveBeenCalled();
  });

  it("catches synchronous listener exceptions and routes to listener:error without crashing", () => {
    const emitter = new TypedEventEmitter();
    const errorListener = vi.fn();
    const safeListener = vi.fn();

    emitter.on("listener:error", errorListener);

    emitter.on("request:match", () => {
      throw new Error("listener failed badly");
    });

    emitter.on("request:match", safeListener);

    emitter.emit("request:match", {
      requestId: "req-1",
      matchedRoute: "/items/:id",
      method: "GET",
      params: { id: "123" },
      scenarioId: "default",
    });

    // The second listener still ran
    expect(safeListener).toHaveBeenCalledTimes(1);
    // listener:error captured the error
    expect(errorListener).toHaveBeenCalledTimes(1);
    expect(errorListener).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "request:match",
        error: expect.any(Error),
      }),
    );
  });

  it("does not enter recursive loop when listener:error itself throws synchronously", () => {
    const emitter = new TypedEventEmitter();

    emitter.on("listener:error", () => {
      throw new Error("synchronous error handler failure");
    });

    emitter.on("request:start", () => {
      throw new Error("regular error");
    });

    expect(() => {
      emitter.emit("request:start", {
        requestId: "req-1",
        method: "GET",
        url: "http://localhost/test",
        path: "/test",
        timestamp: new Date().toISOString(),
      });
    }).not.toThrow();
  });

  it("safely handles asynchronous rejections inside listener:error without unhandled rejections", async () => {
    const emitter = new TypedEventEmitter();
    let secondListenerRan = false;

    // Asynchronous listener that returns a rejected Promise
    emitter.on("listener:error", async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      throw new Error("asynchronous error handler rejection");
    });

    // Companion listener to verify subsequent listeners still execute
    emitter.on("listener:error", () => {
      secondListenerRan = true;
    });

    emitter.on("request:start", () => {
      throw new Error("regular error");
    });

    expect(() => {
      emitter.emit("request:start", {
        requestId: "req-1",
        method: "GET",
        url: "http://localhost/test",
        path: "/test",
        timestamp: new Date().toISOString(),
      });
    }).not.toThrow();

    expect(secondListenerRan).toBe(true);

    // Wait a brief tick to ensure any async rejection is caught and does not trigger unhandledRejection
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
});

