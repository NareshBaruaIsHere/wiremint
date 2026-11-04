# Testing API Reference (`wiremint/testing`)

Exports for in-process testing, response assertions, and Vitest matchers.

```typescript
import {
  createWiremintTestClient,
  expectStatus,
  expectSuccessful,
  expectClientError,
  expectServerError,
  expectHeader,
  expectHeaderMissing,
  expectJson,
  expectBody,
  expectText,
  expectError,
  presets,
} from "wiremint/testing";
```

## `createWiremintTestClient(app, options?)`

Creates an in-process test client for a `WiremintInstance`.

### `TestClientOptions`
- `basePath` *(string)*: Prefix to prepend to all request paths.
- `defaultHeaders` *(Record<string, string>)*: Headers added to every test call.
- `scenario` *(string)*: Default scenario ID for this client.
- `simulation` *(SimulationConfig | boolean | null)*: Simulation override for this client.

### Static Factories
- `createWiremintTestClient.isolated(options?)`: Creates a completely independent `WiremintInstance` and client.
- `createWiremintTestClient.fromConfig(path?, options?)`: Loads configuration from disk and returns a client.

---

## `WiremintTestClient` Methods

### HTTP Methods
- `client.get(path, options?)`: In-process GET request. Returns `Promise<TestResponse>`.
- `client.post(path, options?)`: In-process POST request. Returns `Promise<TestResponse>`.
- `client.put(path, options?)`: In-process PUT request. Returns `Promise<TestResponse>`.
- `client.patch(path, options?)`: In-process PATCH request. Returns `Promise<TestResponse>`.
- `client.delete(path, options?)`: In-process DELETE request. Returns `Promise<TestResponse>`.
- `client.optionsRoute(path, options?)`: In-process OPTIONS request. Returns `Promise<TestResponse>`.
- `client.request(method, path, options?)`: In-process generic request. Returns `Promise<TestResponse>`.

### Request Options (`TestRequestOptions`)
- `headers`: Request headers.
- `query`: Query parameters object.
- `body`: JSON serializable value, Buffer, or string.
- `textBody`: Explicit plain text string (sets `content-type: text/plain`).
- `scenario`: Per-request scenario override.
- `requestId`: Explicit request ID for assertions.
- `simulation`: Per-request simulation override (`false` to bypass).

### History & Inspector Testing
- `client.history()`: Returns recorded requests for this client in chronological order.
- `client.lastRequest()`: Most recent request record.
- `client.clearHistory()`: Clears history recorded by this client.
- `client.findRequests(filter)`: Filter recorded requests by method, path, status, or scenario.
- `client.requestCount()`: Total requests recorded by this client.

### Scenario Controls
- `client.setScenario(id)`: Switch active scenario for this client.
- `client.getScenario()`: Get active scenario metadata.
- `client.clearScenario()`: Revert to default scenario.
- `client.resetScenario(id?)`: Reset scenario state and sequence counters.

### Simulation & Lifecycle
- `client.ownership`: *("shared" | "owned")* Ownership mode. `"shared"` for clients wrapping an external application; `"owned"` for isolated clients created via `.isolated()` or `.fromConfig()`.
- `client.setSimulation(config)`: Override simulation for this client.
- `client.resetSimulation()`: Restore initial simulation options.
- `client.reset()`: Resets history, reverts active scenario, and restores simulation settings. In `owned` mode, also resets all scenario state stores and sequential responses (`resetAllScenarios()`); in `shared` mode, shared application scenario state is left untouched.
- `client.close()`: Idempotent cleanup.

---

## Response Object (`TestResponse`)

```typescript
interface TestResponse<T = unknown> {
  status: number;
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: T;
  text: string;
  json<Shape = T>(): Shape;
  requestId: string;
  internalId?: string;
  callId?: string;
  duration: number;
  ok: boolean;
  scenario?: string;
}
```

---

## Vitest Matchers (`wiremint/testing/vitest`)

```typescript
import { wiremintMatchers } from "wiremint/testing/vitest";
expect.extend(wiremintMatchers);
```

Available matchers:
- `expect(res).toHaveStatus(code)`
- `expect(res).toBeSuccessful()`
- `expect(res).toBeClientError()`
- `expect(res).toBeServerError()`
- `expect(res).toHaveHeader(name, expectedRegexOrString?)`
- `expect(res).toHaveJson(expectedSubset)`
- `expect(res).toMatchJson(expectedSubset)`
- `expect(res).toHaveBody(exactBody)`

