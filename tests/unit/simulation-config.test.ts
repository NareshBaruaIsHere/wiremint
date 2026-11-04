import { describe, it, expect } from "vitest";
import { ConfigurationError } from "../../src/core/errors.js";
import {
  SimulationEngine,
  resolveSimulationConfig,
  validateSimulationConfig,
  validateLatencyConfig,
  validateFailureConfig,
  validateTimeoutConfig,
  validateConnectionConfig,
} from "../../src/simulation/simulation-engine.js";
import { SequenceRandomGenerator } from "../../src/simulation/random.js";

describe("Simulation Configuration Validation", () => {
  describe("validateLatencyConfig", () => {
    it("accepts valid fixed latency", () => {
      expect(() => validateLatencyConfig({ fixed: 500 })).not.toThrow();
      expect(() => validateLatencyConfig({ fixed: 0 })).not.toThrow();
    });

    it("rejects negative fixed latency", () => {
      expect(() => validateLatencyConfig({ fixed: -10 })).toThrow(ConfigurationError);
    });

    it("accepts valid min/max range", () => {
      expect(() => validateLatencyConfig({ min: 100, max: 500 })).not.toThrow();
      expect(() => validateLatencyConfig({ min: 200, max: 200 })).not.toThrow();
    });

    it("rejects min without max or max without min", () => {
      expect(() => validateLatencyConfig({ min: 100 })).toThrow(ConfigurationError);
      expect(() => validateLatencyConfig({ max: 500 })).toThrow(ConfigurationError);
    });

    it("rejects min > max", () => {
      expect(() => validateLatencyConfig({ min: 500, max: 100 })).toThrow(ConfigurationError);
    });

    it("rejects both fixed and min/max", () => {
      expect(() => validateLatencyConfig({ fixed: 300, min: 100, max: 500 })).toThrow(
        ConfigurationError,
      );
    });

    it("accepts valid jitter and rejects negative jitter", () => {
      expect(() => validateLatencyConfig({ fixed: 200, jitter: 50 })).not.toThrow();
      expect(() => validateLatencyConfig({ fixed: 200, jitter: -5 })).toThrow(
        ConfigurationError,
      );
    });
  });

  describe("validateFailureConfig", () => {
    it("accepts valid rate between 0 and 1", () => {
      expect(() => validateFailureConfig({ rate: 0 })).not.toThrow();
      expect(() => validateFailureConfig({ rate: 0.5 })).not.toThrow();
      expect(() => validateFailureConfig({ rate: 1 })).not.toThrow();
    });

    it("rejects rate < 0 or > 1", () => {
      expect(() => validateFailureConfig({ rate: -0.1 })).toThrow(ConfigurationError);
      expect(() => validateFailureConfig({ rate: 1.1 })).toThrow(ConfigurationError);
    });

    it("accepts valid statusCode and rejects invalid ones", () => {
      expect(() => validateFailureConfig({ rate: 0.5, statusCode: 503 })).not.toThrow();
      expect(() => validateFailureConfig({ rate: 0.5, statusCode: 99 })).toThrow(
        ConfigurationError,
      );
      expect(() => validateFailureConfig({ rate: 0.5, statusCode: 600 })).toThrow(
        ConfigurationError,
      );
    });
  });

  describe("validateTimeoutConfig", () => {
    it("accepts positive after duration", () => {
      expect(() => validateTimeoutConfig({ after: 1000 })).not.toThrow();
    });

    it("rejects non-positive after duration", () => {
      expect(() => validateTimeoutConfig({ after: 0 })).toThrow(ConfigurationError);
      expect(() => validateTimeoutConfig({ after: -500 })).toThrow(ConfigurationError);
    });

    it("accepts valid statusCode and rejects invalid ones", () => {
      expect(() => validateTimeoutConfig({ after: 500, statusCode: 504 })).not.toThrow();
      expect(() => validateTimeoutConfig({ after: 500, statusCode: 40 })).toThrow(
        ConfigurationError,
      );
    });
  });

  describe("validateConnectionConfig", () => {
    it("accepts valid dropRate between 0 and 1", () => {
      expect(() => validateConnectionConfig({ dropRate: 0 })).not.toThrow();
      expect(() => validateConnectionConfig({ dropRate: 0.2 })).not.toThrow();
      expect(() => validateConnectionConfig({ dropRate: 1 })).not.toThrow();
    });

    it("rejects dropRate < 0 or > 1", () => {
      expect(() => validateConnectionConfig({ dropRate: -0.1 })).toThrow(ConfigurationError);
      expect(() => validateConnectionConfig({ dropRate: 1.5 })).toThrow(ConfigurationError);
    });
  });
});

describe("resolveSimulationConfig", () => {
  it("returns undefined when no simulation is configured", () => {
    expect(resolveSimulationConfig(undefined, undefined)).toBeUndefined();
  });

  it("applies global config when no route override exists", () => {
    const resolved = resolveSimulationConfig(
      { latency: { fixed: 300 }, failure: { rate: 0.1 } },
      undefined,
    );
    expect(resolved).toBeDefined();
    expect(resolved!.latency).toEqual({ fixed: 300 });
    expect(resolved!.failure).toEqual({ rate: 0.1 });
  });

  it("returns undefined when route explicitly disables simulation with false", () => {
    const resolved = resolveSimulationConfig(
      { latency: { fixed: 300 }, failure: { rate: 0.1 } },
      false,
    );
    expect(resolved).toBeUndefined();
  });

  it("returns undefined when route sets enabled: false", () => {
    const resolved = resolveSimulationConfig(
      { latency: { fixed: 300 } },
      { enabled: false },
    );
    expect(resolved).toBeUndefined();
  });

  it("allows route to override specific feature", () => {
    const resolved = resolveSimulationConfig(
      { latency: { fixed: 200 } },
      { latency: { fixed: 800 } },
    );
    expect(resolved).toBeDefined();
    expect(resolved!.latency).toEqual({ fixed: 800 });
  });

  it("allows route to explicitly disable specific feature", () => {
    const resolved = resolveSimulationConfig(
      { latency: { fixed: 200 }, failure: { rate: 0.5 } },
      { latency: false },
    );
    expect(resolved).toBeDefined();
    expect(resolved!.latency).toBeUndefined();
    expect(resolved!.failure).toEqual({ rate: 0.5 });
  });

  it("respects custom random generator from route", () => {
    const customRng = new SequenceRandomGenerator([0.42]);
    const resolved = resolveSimulationConfig(
      { failure: { rate: 0.5 } },
      { random: customRng },
    );
    expect(resolved).toBeDefined();
    expect(resolved!.random.next()).toBe(0.42);
  });
});

describe("SimulationEngine", () => {
  it("validates global config on construction", () => {
    expect(() => new SimulationEngine({ latency: { fixed: -1 } })).toThrow(
      ConfigurationError,
    );
  });

  it("returns global config via getGlobalConfig()", () => {
    const engine = new SimulationEngine({ latency: { fixed: 100 } });
    expect(engine.getGlobalConfig()).toEqual({ latency: { fixed: 100 } });
  });
});

