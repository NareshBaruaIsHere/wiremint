import { describe, it, expect } from "vitest";
import { runWithTimeout, getTimeoutResponse } from "../../src/simulation/timeout.js";
import { sleep } from "../../src/simulation/latency.js";

describe("runWithTimeout", () => {
  it("resolves with task result when task finishes before timeout", async () => {
    const outcome = await runWithTimeout(async () => {
      await sleep(10);
      return { ok: true, data: "hello" };
    }, 200);

    expect(outcome.timedOut).toBe(false);
    expect(outcome.result).toEqual({ ok: true, data: "hello" });
  });

  it("returns timedOut: true when task exceeds timeout", async () => {
    const outcome = await runWithTimeout(async () => {
      await sleep(200);
      return { ok: true };
    }, 20);

    expect(outcome.timedOut).toBe(true);
    expect(outcome.result).toBeUndefined();
  });

  it("propagates error when task throws before timeout", async () => {
    await expect(
      runWithTimeout(async () => {
        throw new Error("Immediate handler failure");
      }, 100),
    ).rejects.toThrow("Immediate handler failure");
  });

  it("safely handles late task rejection without crashing or unhandled rejection", async () => {
    let lateErrorThrown = false;
    const outcome = await runWithTimeout(async () => {
      await sleep(50);
      lateErrorThrown = true;
      throw new Error("Late failure after timeout");
    }, 10);

    expect(outcome.timedOut).toBe(true);

    // Wait for the delayed task to throw
    await sleep(70);
    expect(lateErrorThrown).toBe(true);
  });

  it("cancels timer and resolves when abort signal is triggered", async () => {
    const controller = new AbortController();
    const promise = runWithTimeout(
      async () => {
        await sleep(500);
        return "done";
      },
      1000,
      controller.signal,
    );

    controller.abort();
    const outcome = await promise;
    expect(outcome.timedOut).toBe(false);
    expect(outcome.result).toBeUndefined();
  });
});

describe("getTimeoutResponse", () => {
  it("returns default 504 gateway timeout", () => {
    const resp = getTimeoutResponse({ after: 1000 });
    expect(resp.statusCode).toBe(504);
    expect(resp.body).toEqual({
      error: "Simulated gateway timeout",
      statusCode: 504,
      simulated: true,
    });
  });

  it("supports custom status code, headers, and body", () => {
    const resp = getTimeoutResponse({
      after: 1000,
      statusCode: 408,
      headers: { "X-Timeout": "true" },
      body: { error: "Request timed out", code: "TIMEOUT" },
    });
    expect(resp.statusCode).toBe(408);
    expect(resp.headers).toEqual({ "X-Timeout": "true" });
    expect(resp.body).toEqual({ error: "Request timed out", code: "TIMEOUT" });
  });
});

