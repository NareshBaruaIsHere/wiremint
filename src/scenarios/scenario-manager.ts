import { ScenarioError } from "../core/errors.js";
import type {
  ScenarioContext,
  ScenarioDefinition,
  ScenarioEngineOptions,
  ScenarioMetadata,
} from "./types.js";
import { ScenarioRegistry } from "./scenario-registry.js";
import { SequenceManager } from "./sequence-manager.js";
import type { StateStore } from "./state-store.js";

/**
 * Coordinates scenario registration, active selection, state lifecycle, and request context creation.
 */
export class ScenarioManager {
  private readonly registry: ScenarioRegistry;
  private readonly sequenceManager: SequenceManager;
  private readonly defaultScenarioId: string;
  private activeScenarioId: string;

  constructor(options?: ScenarioEngineOptions) {
    this.defaultScenarioId = options?.defaultScenario?.trim() || "default";
    this.registry = new ScenarioRegistry(this.defaultScenarioId);
    this.sequenceManager = new SequenceManager();
    this.activeScenarioId = this.defaultScenarioId;
  }

  /**
   * Register a new scenario definition.
   */
  register(id: string, definition?: ScenarioDefinition): ScenarioMetadata {
    return this.registry.register(id, definition);
  }

  /**
   * Set the globally active scenario.
   */
  setScenario(id: string): void {
    const trimmedId = id?.trim();
    if (!trimmedId || !this.registry.has(trimmedId)) {
      const available = this.registry.list().map((s) => s.id).join(", ");
      throw new ScenarioError(
        `Cannot activate unknown scenario "${id}". Available scenarios: ${available}`,
      );
    }
    this.activeScenarioId = trimmedId;
  }

  /**
   * Get metadata for the currently active global scenario.
   */
  getScenario(): ScenarioMetadata {
    const active = this.registry.get(this.activeScenarioId);
    if (!active) {
      // Fallback to default
      const def = this.registry.get(this.defaultScenarioId);
      return { ...def!.metadata };
    }
    return { ...active.metadata };
  }

  /**
   * Return the ID of the currently active global scenario.
   */
  getActiveId(): string {
    return this.activeScenarioId;
  }

  /**
   * Return the default scenario ID.
   */
  getDefaultId(): string {
    return this.defaultScenarioId;
  }

  /**
   * List all registered scenarios in registration order.
   */
  listScenarios(): ScenarioMetadata[] {
    return this.registry.list();
  }

  /**
   * Check if a scenario is registered.
   */
  hasScenario(id: string): boolean {
    return this.registry.has(id);
  }

  /**
   * Reset the state store and sequence counters for a scenario.
   * If `id` is omitted, resets the currently active scenario.
   */
  resetScenario(id?: string): void {
    const targetId = id ? id.trim() : this.activeScenarioId;
    if (!this.registry.has(targetId)) {
      throw new ScenarioError(`Cannot reset unknown scenario "${targetId}"`);
    }
    this.registry.reset(targetId);
    this.sequenceManager.resetScenario(targetId);
  }

  /**
   * Clear the active scenario, reverting back to the default scenario.
   */
  clearScenario(): void {
    this.activeScenarioId = this.defaultScenarioId;
  }

  /**
   * Retrieve the isolated state store for a scenario.
   */
  getStateStore(id: string): StateStore {
    const scenario = this.registry.get(id);
    if (!scenario) {
      throw new ScenarioError(`Cannot get state store for unknown scenario "${id}"`);
    }
    return scenario.stateStore;
  }

  /**
   * Get the SequenceManager instance.
   */
  getSequenceManager(): SequenceManager {
    return this.sequenceManager;
  }

  /**
   * Create a request-scoped ScenarioContext for the specified scenario ID.
   */
  createContext(scenarioId: string): ScenarioContext {
    const scenario = this.registry.get(scenarioId);
    if (!scenario) {
      throw new ScenarioError(`Cannot create context for unknown scenario "${scenarioId}"`);
    }

    return {
      id: scenario.metadata.id,
      name: scenario.metadata.name,
      description: scenario.metadata.description,
      state: scenario.stateStore,
      reset: () => {
        this.resetScenario(scenario.metadata.id);
      },
    };
  }
}

