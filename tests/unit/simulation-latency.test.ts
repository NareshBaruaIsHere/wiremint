import { describe, it, expect } from "vitest";
import { calculateLatency, sleep } from "../../src/simulation/latency.js";
import { SequenceRandomGenerator } from "../../src/simulation/random.js";

describe("calculateLatency", () => {
  it("returns 0 when config is undefined", () => {
    const rng = new SequenceRandomGenerator([0.5]);
    expect(calculateLatency(undefined, rng)).toBe(0);
  });

  it("returns 0 when enabled is false", () => {
    const rng = new SequenceRandomGenerator([0.5]);
    expect(calculateLatency({ enabled: false, fixed: 500 }, rng)).toBe(0);
  });

  it("calculates fixed latency", () => {
    const rng = new SequenceRandomGenerator([0.5]);
    expect(calculateLatency({ fixed: 350 }, rng)).toBe(350);
  });

  it("calculates random latency range deterministically", () => {
    // min = 100, max = 500, range = 400
    // rng = 0 -> 100
    // rng = 0.5 -> 300
    // rng = 1 -> 500
    const rng = new SequenceRandomGenerator([0, 0.5, 1]);
    expect(calculateLatency({ min: 100, max: 500 }, rng)).toBe(100);
    expect(calculateLatency({ min: 100, max: 500 }, rng)).toBe(300);
    expect(calculateLatency({ min: 100, max: 500 }, rng)).toBe(500);
  });

  it("applies jitter variation", () => {
    // fixed = 200, jitter = 50
    // jitter offset = (rng * 2 - 1) * 50
    // if rng = 0 -> offset = -50 -> 150
    // if rng = 0.5 -> offset = 0 -> 200
    // if rng = 1 -> offset = +50 -> 250
    const rng = new SequenceRandomGenerator([0, 0.5, 1]);
    expect(calculateLatency({ fixed: 200, jitter: 50 }, rng)).toBe(150);
    expect(calculateLatency({ fixed: 200, jitter: 50 }, rng)).toBe(200);
    expect(calculateLatency({ fixed: 200, jitter: 50 }, rng)).toBe(250);
  });

  it("clamps latency to >= 0 when jitter exceeds base delay", () => {
    // fixed = 10, jitter = 50. If offset is -50, delay = -40 -> clamped to 0
    const rng = new SequenceRandomGenerator([0]);
    expect(calculateLatency({ fixed: 10, jitter: 50 }, rng)).toBe(0);
  });

  it("returns 0 for zero fixed delay", () => {
    const rng = new SequenceRandomGenerator([0.5]);
    expect(calculateLatency({ fixed: 0 }, rng)).toBe(0);
  });
});

describe("sleep", () => {
  it("resolves immediately for 0 or negative ms", async () => {
    const start = Date.now();
    await sleep(0);
    await sleep(-10);
    expect(Date.now() - start).toBeLessThan(50);
  });

  it("resolves after the specified duration", async () => {
    const start = Date.now();
    await sleep(40);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(30);
  });

  it("cancels immediately when aborted", async () => {
    const controller = new AbortController();
    const start = Date.now();

    const promise = sleep(5000, controller.signal);
    // Abort after 20ms
    setTimeout(() => controller.abort(), 20);

    await promise;
    expect(Date.now() - start).toBeLessThan(200);
  });

  it("resolves immediately if signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const start = Date.now();
    await sleep(5000, controller.signal);
    expect(Date.now() - start).toBeLessThan(50);
  });
});

