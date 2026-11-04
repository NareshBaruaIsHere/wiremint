import { describe, it, expect } from "vitest";
import { evaluateFailure } from "../../src/simulation/failure.js";
import { SequenceRandomGenerator } from "../../src/simulation/random.js";

describe("evaluateFailure", () => {
  it("returns shouldFail: false when config is undefined", () => {
    const rng = new SequenceRandomGenerator([0.1]);
    expect(evaluateFailure(undefined, rng)).toEqual({ shouldFail: false });
  });

  it("returns shouldFail: false when enabled is false", () => {
    const rng = new SequenceRandomGenerator([0]);
    expect(evaluateFailure({ enabled: false, rate: 1 }, rng)).toEqual({
      shouldFail: false,
    });
  });

  it("returns shouldFail: false when rate is 0", () => {
    const rng = new SequenceRandomGenerator([0]);
    expect(evaluateFailure({ rate: 0 }, rng)).toEqual({ shouldFail: false });
  });

  it("returns shouldFail: true when rate is 1", () => {
    const rng = new SequenceRandomGenerator([0.99]);
    const outcome = evaluateFailure({ rate: 1 }, rng);
    expect(outcome.shouldFail).toBe(true);
    expect(outcome.statusCode).toBe(500);
    expect(outcome.body).toEqual({
      error: "Simulated internal server error",
      statusCode: 500,
      simulated: true,
    });
  });

  it("evaluates partial failure rate deterministically", () => {
    // rate = 0.5. rng: [0.2, 0.8] -> first fails, second succeeds
    const rng = new SequenceRandomGenerator([0.2, 0.8]);
    expect(evaluateFailure({ rate: 0.5 }, rng).shouldFail).toBe(true);
    expect(evaluateFailure({ rate: 0.5 }, rng).shouldFail).toBe(false);
  });

  it("supports custom status code and custom response body", () => {
    const rng = new SequenceRandomGenerator([0]);
    const outcome = evaluateFailure(
      {
        rate: 1,
        statusCode: 503,
        headers: { "Retry-After": "120" },
        body: { error: "Service currently overloaded", code: "OVERLOAD" },
      },
      rng,
    );

    expect(outcome.shouldFail).toBe(true);
    expect(outcome.statusCode).toBe(503);
    expect(outcome.headers).toEqual({ "Retry-After": "120" });
    expect(outcome.body).toEqual({
      error: "Service currently overloaded",
      code: "OVERLOAD",
    });
  });

  it("provides sensible default messages for different status codes", () => {
    const rng = new SequenceRandomGenerator([0]);

    const res502 = evaluateFailure({ rate: 1, statusCode: 502 }, rng);
    expect((res502.body as any).error).toBe("Simulated bad gateway");

    const res503 = evaluateFailure({ rate: 1, statusCode: 503 }, rng);
    expect((res503.body as any).error).toBe("Simulated service unavailable");

    const res504 = evaluateFailure({ rate: 1, statusCode: 504 }, rng);
    expect((res504.body as any).error).toBe("Simulated gateway timeout");

    const res429 = evaluateFailure({ rate: 1, statusCode: 429 }, rng);
    expect((res429.body as any).error).toBe("Simulated too many requests");
  });
});

