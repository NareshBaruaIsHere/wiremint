import { describe, it, expect } from "vitest";
import {
  MathRandomGenerator,
  SequenceRandomGenerator,
  SeededRandomGenerator,
} from "../../src/simulation/random.js";

describe("MathRandomGenerator", () => {
  it("returns numbers between 0 and 1", () => {
    const rng = new MathRandomGenerator();
    for (let i = 0; i < 50; i++) {
      const val = rng.next();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });
});

describe("SequenceRandomGenerator", () => {
  it("cycles through provided sequence when loop=true", () => {
    const rng = new SequenceRandomGenerator([0.1, 0.5, 0.9]);
    expect(rng.next()).toBe(0.1);
    expect(rng.next()).toBe(0.5);
    expect(rng.next()).toBe(0.9);
    // Loops back
    expect(rng.next()).toBe(0.1);
    expect(rng.next()).toBe(0.5);
  });

  it("repeats last value when loop=false", () => {
    const rng = new SequenceRandomGenerator([0.2, 0.8], false);
    expect(rng.next()).toBe(0.2);
    expect(rng.next()).toBe(0.8);
    expect(rng.next()).toBe(0.8);
    expect(rng.next()).toBe(0.8);
  });

  it("resets to beginning on reset()", () => {
    const rng = new SequenceRandomGenerator([0.3, 0.7]);
    expect(rng.next()).toBe(0.3);
    rng.reset();
    expect(rng.next()).toBe(0.3);
  });

  it("throws on empty sequence", () => {
    expect(() => new SequenceRandomGenerator([])).toThrow();
  });
});

describe("SeededRandomGenerator", () => {
  it("produces repeatable sequences for the same seed", () => {
    const rng1 = new SeededRandomGenerator(12345);
    const rng2 = new SeededRandomGenerator(12345);

    const seq1 = Array.from({ length: 10 }, () => rng1.next());
    const seq2 = Array.from({ length: 10 }, () => rng2.next());

    expect(seq1).toEqual(seq2);
    for (const val of seq1) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it("produces different sequences for different seeds", () => {
    const rng1 = new SeededRandomGenerator(1);
    const rng2 = new SeededRandomGenerator(2);

    expect(rng1.next()).not.toBe(rng2.next());
  });
});

