import { ScenarioError } from "../core/errors.js";
import type { ScenarioDefinition, ScenarioMetadata } from "./types.js";
import { StateStore } from "./state-store.js";

/** Valid format for scenario IDs: alphanumeric characters, hyphens, underscores, dots. */
const VALID_ID_PATTERN = /^[a-zA-Z0-9_.-]+$/;

/**
 * Internal record for a registered scenario.
 */
export interface RegisteredScenario {
  metadata: ScenarioMetadata;
  stateStore: StateStore;
  initialState?: Record<string, unknown>;
}

/**
 * Registry holding all defined application scenarios in insertion order.
 */
export class ScenarioRegistry {
  private readonly scenarios = new Map<string, RegisteredScenario>();

  constructor(defaultScenarioId = "default") {
    // Automatically register default scenario
    this.register(defaultScenarioId, {
      name: "Default",
      description: "Default application state",
    });
  }

  /**
   * Register a new scenario. Throws ScenarioError if ID is invalid or already registered.
   */
  register(id: string, definition?: ScenarioDefinition): ScenarioMetadata {
    if (!id || typeof id !== "string") {
      throw new ScenarioError("Scenario ID must be a non-empty string");
    }

    const trimmedId = id.trim();
    if (!trimmedId || !VALID_ID_PATTERN.test(trimmedId)) {
      throw new ScenarioError(
        `Invalid scenario ID "${id}". Scenario IDs may only contain letters, numbers, hyphens, underscores, and dots.`,
      );
    }

    if (this.scenarios.has(trimmedId)) {
      throw new ScenarioError(
        `Scenario already registered: "${trimmedId}". Scenario IDs must be unique.`,
      );
    }

    const name = definition?.name?.trim() || trimmedId;
    const description = definition?.description?.trim();
    const initialState = definition?.initialState;
    const stateStore = new StateStore(initialState);

    const metadata: ScenarioMetadata = {
      id: trimmedId,
      name,
      description,
    };

    this.scenarios.set(trimmedId, {
      metadata,
      stateStore,
      initialState,
    });

    return metadata;
  }

  /**
   * Retrieve a registered scenario by ID.
   */
  get(id: string): RegisteredScenario | undefined {
    return this.scenarios.get(id);
  }

  /**
   * Check if a scenario is registered.
   */
  has(id: string): boolean {
    return this.scenarios.has(id);
  }

  /**
   * List all registered scenarios in registration order.
   */
  list(): ScenarioMetadata[] {
    const list: ScenarioMetadata[] = [];
    for (const item of this.scenarios.values()) {
      list.push({ ...item.metadata });
    }
    return list;
  }

  /**
   * Reset the state store of a registered scenario.
   */
  reset(id: string): void {
    const scenario = this.scenarios.get(id);
    if (!scenario) {
      throw new ScenarioError(`Cannot reset unknown scenario: "${id}"`);
    }
    scenario.stateStore.reset();
  }

  /**
   * Reset state stores for all registered scenarios.
   */
  resetAll(): void {
    for (const scenario of this.scenarios.values()) {
      scenario.stateStore.reset();
    }
  }
}

