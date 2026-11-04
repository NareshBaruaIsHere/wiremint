/**
 * Abstraction for random number generation in simulation modules.
 */
export interface RandomGenerator {
  /**
   * Return a floating-point number in the half-open interval [0, 1).
   */
  next(): number;
}

/**
 * Default production random generator backed by `Math.random()`.
 */
export class MathRandomGenerator implements RandomGenerator {
  next(): number {
    return Math.random();
  }
}

/**
 * Deterministic random generator for tests that cycles through a provided sequence of numbers.
 */
export class SequenceRandomGenerator implements RandomGenerator {
  private index = 0;
  private readonly values: number[];
  private readonly loop: boolean;

  constructor(values: number[], loop = true) {
    if (values.length === 0) {
      throw new Error("SequenceRandomGenerator requires at least one value");
    }
    this.values = [...values];
    this.loop = loop;
  }

  next(): number {
    if (this.index >= this.values.length) {
      if (this.loop) {
        this.index = 0;
      } else {
        return this.values[this.values.length - 1]!;
      }
    }
    const val = this.values[this.index]!;
    this.index++;
    return val;
  }

  reset(): void {
    this.index = 0;
  }
}

/**
 * Deterministic pseudo-random number generator (Mulberry32) initialized with a 32-bit integer seed.
 */
export class SeededRandomGenerator implements RandomGenerator {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

