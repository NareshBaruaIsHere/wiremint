import { describe, it, expect } from "vitest";
import { evaluateConnectionDrop } from "../../src/simulation/connection.js";
import { SequenceRandomGenerator } from "../../src/simulation/random.js";

describe("evaluateConnectionDrop", () => {
  it("returns shouldDrop: false when config is undefined", () => {
    const rng = new SequenceRandomGenerator([0]);
    expect(evaluateConnectionDrop(undefined, rng)).toEqual({ shouldDrop: false });
  });

  it("returns shouldDrop: false when enabled is false", () => {
    const rng = new SequenceRandomGenerator([0]);
    expect(evaluateConnectionDrop({ enabled: false, dropRate: 1 }, rng)).toEqual({
      shouldDrop: false,
    });
  });

  it("returns shouldDrop: false when dropRate is 0", () => {
    const rng = new SequenceRandomGenerator([0]);
    expect(evaluateConnectionDrop({ dropRate: 0 }, rng)).toEqual({ shouldDrop: false });
  });

  it("returns shouldDrop: true when dropRate is 1", () => {
    const rng = new SequenceRandomGenerator([0.99]);
    expect(evaluateConnectionDrop({ dropRate: 1 }, rng)).toEqual({ shouldDrop: true });
  });

  it("evaluates partial drop rate deterministically", () => {
    // dropRate = 0.3. rng: [0.1, 0.5] -> first drops, second keeps
    const rng = new SequenceRandomGenerator([0.1, 0.5]);
    expect(evaluateConnectionDrop({ dropRate: 0.3 }, rng).shouldDrop).toBe(true);
    expect(evaluateConnectionDrop({ dropRate: 0.3 }, rng).shouldDrop).toBe(false);
  });
});

