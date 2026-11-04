import { describe, it, expect, vi } from "vitest";
import { executeMiddlewarePipeline } from "../../src/middleware/middleware-executor.js";
import { createMiddlewareContext } from "../../src/middleware/middleware-context.js";
import { StateStore } from "../../src/scenarios/state-store.js";

function makeDummyContext() {
  return createMiddlewareContext({
    requestId: "req-1",
    method: "GET",
    url: "http://localhost/test",
    path: "/test",
    query: {},
    params: {},
    headers: { authorization: "Bearer secret" },
    body: undefined,
    signal: new AbortController().signal,
    scenario: {
      id: "default",
      name: "Default",
      state: new StateStore(),
      reset: () => {},
    },
  });
}

describe("MiddlewareExecutor (Onion Architecture)", () => {
  it("executes middleware in registration order before handler, and reverse order after handler", async () => {
    const context = makeDummyContext();
    const trace: string[] = [];

    const mwA = async (_ctx: any, next: any) => {
      trace.push("A:before");
      await next();
      trace.push("A:after");
    };

    const mwB = async (_ctx: any, next: any) => {
      trace.push("B:before");
      await next();
      trace.push("B:after");
    };

    const handler = async () => {
      trace.push("handler");
      context.statusCode = 200;
      context.responseBody = { ok: true };
    };

    await executeMiddlewarePipeline([mwA, mwB], context, handler);

    expect(trace).toEqual([
      "A:before",
      "B:before",
      "handler",
      "B:after",
      "A:after",
    ]);
  });

  it("throws descriptive error when next() is called multiple times", async () => {
    const context = makeDummyContext();

    const badMw = async (_ctx: any, next: any) => {
      await next();
      await next(); // second invocation!
    };

    await expect(
      executeMiddlewarePipeline([badMw], context, async () => {}),
    ).rejects.toThrow(/next\(\) called multiple times/i);
  });

  it("allows middleware to short-circuit if response status/body is set", async () => {
    const context = makeDummyContext();
    const handler = vi.fn();

    const authMw = async (ctx: any) => {
      ctx.statusCode = 401;
      ctx.responseBody = { error: "Unauthorized" };
      // Intentionally does NOT call next()
    };

    await executeMiddlewarePipeline([authMw], context, handler);

    expect(handler).not.toHaveBeenCalled();
    expect(context.statusCode).toBe(401);
    expect(context.responseBody).toEqual({ error: "Unauthorized" });
  });

  it("throws descriptive error when middleware terminates without calling next() and without producing a response", async () => {
    const context = makeDummyContext();

    const hangingMw = async () => {
      // Does not call next() AND does not set status or body
    };

    await expect(
      executeMiddlewarePipeline([hangingMw], context, async () => {}),
    ).rejects.toThrow(/without calling next\(\) and without producing a response/i);
  });

  it("allows middleware to inspect and modify response headers and body", async () => {
    const context = makeDummyContext();

    const timingMw = async (ctx: any, next: any) => {
      ctx.setHeader("x-custom-header", "wiremint-v1");
      await next();
      ctx.responseBody = {
        ...ctx.responseBody,
        wrapped: true,
      };
    };

    const handler = async () => {
      context.statusCode = 200;
      context.responseBody = { data: 123 };
    };

    await executeMiddlewarePipeline([timingMw], context, handler);

    expect(context.responseHeaders["x-custom-header"]).toBe("wiremint-v1");
    expect(context.responseBody).toEqual({ data: 123, wrapped: true });
  });
});

