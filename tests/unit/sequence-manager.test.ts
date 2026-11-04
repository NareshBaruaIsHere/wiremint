import { describe, it, expect } from "vitest";
import { SequenceManager } from "../../src/scenarios/sequence-manager.js";

describe("SequenceManager", () => {
  it("advances index monotonically", () => {
    const seq = new SequenceManager();
    expect(seq.next("GET:/users", "default", 3)).toBe(0);
    expect(seq.next("GET:/users", "default", 3)).toBe(1);
    expect(seq.next("GET:/users", "default", 3)).toBe(2);
  });

  it("repeats last response when afterEnd is repeat-last (default)", () => {
    const seq = new SequenceManager();
    expect(seq.next("GET:/status", "default", 2, "repeat-last")).toBe(0);
    expect(seq.next("GET:/status", "default", 2, "repeat-last")).toBe(1);
    expect(seq.next("GET:/status", "default", 2, "repeat-last")).toBe(1);
    expect(seq.next("GET:/status", "default", 2, "repeat-last")).toBe(1);
  });

  it("cycles back to first response when afterEnd is cycle", () => {
    const seq = new SequenceManager();
    expect(seq.next("GET:/status", "default", 2, "cycle")).toBe(0);
    expect(seq.next("GET:/status", "default", 2, "cycle")).toBe(1);
    expect(seq.next("GET:/status", "default", 2, "cycle")).toBe(0);
    expect(seq.next("GET:/status", "default", 2, "cycle")).toBe(1);
  });

  it("isolates counters between different routes and scenarios", () => {
    const seq = new SequenceManager();

    // Advance Route A in Scenario 1
    expect(seq.next("GET:/a", "scenario-1", 5)).toBe(0);
    expect(seq.next("GET:/a", "scenario-1", 5)).toBe(1);

    // Route A in Scenario 2 remains at index 0
    expect(seq.next("GET:/a", "scenario-2", 5)).toBe(0);

    // Route B in Scenario 1 remains at index 0
    expect(seq.next("GET:/b", "scenario-1", 5)).toBe(0);
  });

  it("resetScenario() only resets counters for the specified scenario", () => {
    const seq = new SequenceManager();
    seq.next("GET:/items", "scenario-1", 3);
    seq.next("GET:/items", "scenario-1", 3); // next is 2

    seq.next("GET:/items", "scenario-2", 3);
    seq.next("GET:/items", "scenario-2", 3); // next is 2

    seq.resetScenario("scenario-1");

    // scenario-1 reset to 0
    expect(seq.next("GET:/items", "scenario-1", 3)).toBe(0);
    // scenario-2 unaffected (returns 2)
    expect(seq.next("GET:/items", "scenario-2", 3)).toBe(2);
  });

  it("resetAll() resets all counters across all routes and scenarios", () => {
    const seq = new SequenceManager();
    seq.next("GET:/a", "s1", 3);
    seq.next("GET:/b", "s2", 3);

    seq.resetAll();

    expect(seq.next("GET:/a", "s1", 3)).toBe(0);
    expect(seq.next("GET:/b", "s2", 3)).toBe(0);
  });

  describe("runSequential (concurrency & FIFO order)", () => {
    it("executes concurrent asynchronous tasks in strict FIFO arrival order", async () => {
      const seq = new SequenceManager();
      const executionOrder: number[] = [];

      // Task 0 has an artificial delay of 30ms
      const p0 = seq.runSequential("GET:/data", "default", async (idx) => {
        await new Promise((r) => setTimeout(r, 30));
        executionOrder.push(idx);
        return `step-${idx}`;
      }, 3);

      // Task 1 has 0ms delay, arrives immediately after p0 synchronously
      const p1 = seq.runSequential("GET:/data", "default", async (idx) => {
        executionOrder.push(idx);
        return `step-${idx}`;
      }, 3);

      // Task 2 arrives synchronously right after p1
      const p2 = seq.runSequential("GET:/data", "default", async (idx) => {
        executionOrder.push(idx);
        return `step-${idx}`;
      }, 3);

      const [res0, res1, res2] = await Promise.all([p0, p1, p2]);

      expect(res0).toBe("step-0");
      expect(res1).toBe("step-1");
      expect(res2).toBe("step-2");

      // Execution order must strictly follow FIFO arrival order [0, 1, 2]
      expect(executionOrder).toEqual([0, 1, 2]);
    });

    it("continues queue execution even if a preceding step fails", async () => {
      const seq = new SequenceManager();

      const p0 = seq.runSequential("GET:/failing", "default", async () => {
        throw new Error("step 0 exploded");
      }, 2);

      const p1 = seq.runSequential("GET:/failing", "default", async (idx) => {
        return `recovered-${idx}`;
      }, 2);

      await expect(p0).rejects.toThrow("step 0 exploded");
      const res1 = await p1;
      expect(res1).toBe("recovered-1");
    });
  });
});

