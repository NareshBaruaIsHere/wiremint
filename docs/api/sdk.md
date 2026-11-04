# Core SDK Reference (`wiremint`)

The primary entry point for Wiremint programmatic usage.

```typescript
import { createWiremint } from "wiremint";
```

## `createWiremint(options?)`

Creates a new Wiremint application instance.

### Parameters

- `options` *(optional)*: `WiremintOptions`
  - `port` *(number)*: Default HTTP port (default: `3000`).
  - `host` *(string)*: Default host address (default: `"127.0.0.1"`).
  - `basePath` *(string)*: Optional URL prefix for all routes (e.g. `"/api"`).
  - `maxBodySize` *(number)*: Maximum request body in bytes (default: `1_048_576`).
  - `simulation` *(SimulationConfig)*: Global network simulation configuration.
  - `inspector` *(InspectorConfig)*: Request inspector and redaction configuration.
  - `scenarios` *(ScenarioConfig[])*: List of named application scenarios.

---

## `WiremintInstance` Methods

### Route Registration

- `app.get(path, handlerOrConfig, options?)`
- `app.post(path, handlerOrConfig, options?)`
- `app.put(path, handlerOrConfig, options?)`
- `app.patch(path, handlerOrConfig, options?)`
- `app.delete(path, handlerOrConfig, options?)`
- `app.options(path, handlerOrConfig, options?)`
- `app.head(path, handlerOrConfig, options?)`

### Middleware & Events

- `app.use(middleware)`: Register global middleware.
- `app.use(path, middleware)`: Register path-scoped middleware.
- `app.on(event, listener)`: Subscribe to typed request lifecycle event.
- `app.off(event, listener)`: Unsubscribe from event.

### Scenarios & State

- `app.scenario(id, definition)`: Register named scenario.
- `app.setScenario(id)`: Set active scenario.
- `app.getScenario()`: Get active scenario metadata.
- `app.listScenarios()`: List all registered scenarios.
- `app.resetScenario(id?)`: Reset state store and sequences for scenario.
- `app.resetAllScenarios()`: Reset all scenario stores and sequences.
- `app.clearScenario()`: Revert to `"default"` scenario.

### Lifecycle & In-Process Execution

- `app.listen(options?)`: Start HTTP server. Returns `Promise<void>`.
- `app.close()`: Stop HTTP server. Returns `Promise<void>`.
- `app.handleRequest(req, res)`: Execute request pipeline in-process directly.
- `app.inspect()`: Access the `RequestInspector`.
