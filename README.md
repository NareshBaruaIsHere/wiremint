# Wiremint

**Build without waiting for your backend.**

Wiremint is a TypeScript-first API mocking and network simulation toolkit. Create mock API endpoints, simulate realistic network conditions, and test frontend applications — without depending on a real backend.

## Installation

```bash
npm install wiremint
# or
pnpm add wiremint
```

**Requires Node.js 22 or later.**

## Quick Start

```typescript
import { createWiremint } from "wiremint";

const app = createWiremint({
  basePath: "/api",
  simulation: {
    latency: { min: 100, max: 300, jitter: 25 },
    failure: { rate: 0.05, statusCode: 503 },
  },
});

// Register named application scenarios
app.scenario("happy-path", { name: "Happy Path", description: "Normal data" });
app.scenario("empty-state", { name: "Empty State", description: "Zero records" });

// Scenario-specific responses
app.get("/users", {
  default: () => ({
    status: 200,
    body: [
      { id: 1, name: "Naresh" },
      { id: 2, name: "Rahim" },
    ],
  }),
  scenarios: {
    "empty-state": () => ({ status: 200, body: [] }),
  },
});

app.get("/users/:id", ({ params }) => ({
  status: 200,
  body: { id: params.id, name: "Naresh" },
}));

app.post("/users", ({ body }) => ({
  status: 201,
  body: { created: true, data: body },
}));

await app.listen({ port: 3001 });
console.log("Wiremint is running on http://127.0.0.1:3001");
```

---

## Scenario Engine & Stateful Mocking

Wiremint allows developers to define, activate, switch, reset, and inspect named mock application scenarios. A scenario represents an isolated mock backend state (e.g. `happy-path`, `empty-state`, `server-outage`, `authenticated`, `payment-failed`).

### 1. Registering Scenarios

Register named scenarios with metadata and optional initial state:

```typescript
app.scenario("server-outage", {
  name: "Server Outage",
  description: "Simulates upstream database cluster failure",
});

app.scenario("authenticated", {
  name: "Authenticated User",
  description: "User with pre-populated cart and preferences",
  initialState: {
    cart: [{ id: "item-101", name: "Keyboard", price: 75 }],
    credits: 500,
  },
});
```

### 2. Scenario-Specific Route Responses

Define distinct responses or handlers per scenario on a single endpoint:

```typescript
app.get("/products", {
  default: () => ({
    status: 200,
    body: [
      { id: 1, name: "Laptop" },
      { id: 2, name: "Monitor" },
    ],
  }),
  scenarios: {
    "empty-state": () => ({
      status: 200,
      body: [],
    }),
    "server-outage": () => ({
      status: 503,
      body: { error: "Service unavailable" },
    }),
  },
});
```

### 3. Scenario Selection Mechanisms

Wiremint supports three independent scenario selection mechanisms with clear precedence:

1. **HTTP Header** (`x-wiremint-scenario`): Perfect for automated frontend integration tests (e.g., Playwright, Cypress).
2. **Query Parameter** (`?__scenario=...`): Great for manual browser testing and QA link sharing.
3. **Globally Active Scenario** (`app.setScenario(id)`): Set programmatically in your test harness.
4. **Default Scenario** (`"default"`): Fallback when no scenario is requested.

```bash
# Activate empty-state scenario for this single request via header:
curl -H "x-wiremint-scenario: empty-state" http://127.0.0.1:3001/api/products

# Activate server-outage scenario for this single request via query param:
curl "http://127.0.0.1:3001/api/products?__scenario=server-outage"
```

> **Safety & Isolation:** HTTP header and query parameter selections are **strictly request-scoped**. They never mutate the globally active scenario.

### 4. Stateful Mock Storage

Each scenario has an isolated, in-memory state store accessible via `context.scenario.state`:

```typescript
app.get("/cart", ({ scenario }) => ({
  status: 200,
  body: scenario.state.get("cart") ?? [],
}));

app.post("/cart", ({ body, scenario }) => {
  const cart = scenario.state.get<any[]>("cart") ?? [];
  const updatedCart = [...cart, body];
  scenario.state.set("cart", updatedCart);

  return {
    status: 201,
    body: updatedCart,
  };
});
```

State store methods:
- `scenario.state.get<T>(key)`: Returns a deep-cloned copy of the value (protects store from reference mutations).
- `scenario.state.set<T>(key, value)`: Stores a deep-cloned copy. Strictly validates that data is structured-cloneable (primitives, objects, arrays, Maps, Sets, Dates, etc.). Attempting to store functions or symbols throws a `ScenarioError` to prevent silent state corruption or mutable reference leaks.
- `scenario.state.has(key)`: Returns boolean indicating key existence.
- `scenario.state.delete(key)`: Deletes key from state.
- `scenario.state.clear()`: Clears all state keys.
- `scenario.state.snapshot()`: Returns deep clone of all entries.

### 5. Sequential Responses

Simulate polling, retry loops, or multi-step state transitions using response sequences:

```typescript
app.get("/status", {
  sequence: [
    { status: 503, body: { status: "provisioning", step: 1 } },
    { status: 503, body: { status: "deploying", step: 2 } },
    { status: 200, body: { status: "ready", step: 3 } },
  ],
  afterEnd: "repeat-last", // "repeat-last" (default) or "cycle"
});
```

- **Independent Tracking**: Counters are tracked independently per route and per scenario.
- **Strict FIFO Concurrency**: Synchronous index reservation coupled with promise-chained execution ensures that concurrent requests execute and complete in strict sequential order, even when earlier steps involve asynchronous operations or artificial latency.

### 6. Reset & Inspection APIs

```typescript
// Inspect active scenario metadata
const active = app.getScenario();
// { id: "happy-path", name: "Happy Path", description: "..." }

// List all registered scenarios
const all = app.listScenarios();

// Reset a specific scenario's state and sequence counters to initial state
app.resetScenario("authenticated");

// Reset active scenario
app.resetScenario();

// Revert active scenario back to default
app.clearScenario();
```

### Limitations & Security Considerations

- **In-Memory Storage**: Scenario state is kept in-memory and resets on process restarts. It is intended for developer tooling, prototyping, and automated tests, not durable database storage.
- **HTTP Scenario Selection**: Allows client requests to choose scenarios. If deploying Wiremint to an exposed staging environment, you can disable HTTP selection via `createWiremint({ scenarios: { allowHttpSelection: false } })`.

---

## Network Simulation Engine

Wiremint includes a modular network simulation engine that accurately mimics production network conditions:

- **Fixed and variable latency** with jitter
- **Random HTTP failure injection** with customizable status codes and payloads
- **Request timeout simulation** with controlled HTTP 504 responses
- **Abrupt connection drops**
- **Global defaults** and **per-route overrides**
- **Deterministic random number generation** for unit and integration testing

### 1. Latency Simulation

```typescript
const app = createWiremint({
  simulation: {
    latency: {
      min: 200,
      max: 800,
      jitter: 50, // introduces +/- 50ms variation; clamped to >= 0ms
    },
  },
});
```

### 2. Random Failure Injection

```typescript
const app = createWiremint({
  simulation: {
    failure: {
      rate: 0.1, // 10% of requests fail
      statusCode: 503,
      body: { error: "Service temporarily unavailable. Please retry later." },
      headers: { "Retry-After": "30" },
    },
  },
});
```

> **Note:** When a simulated failure triggers, the route handler is **not** executed.

### 3. Timeout Simulation

```typescript
app.get(
  "/slow-report",
  async () => {
    await fetchLongReport();
    return { status: 200, body: { done: true } };
  },
  {
    simulation: {
      timeout: {
        after: 2000, // times out after 2000ms
        statusCode: 504,
        body: { error: "Gateway timed out waiting for upstream report" },
      },
    },
  },
);
```

### 4. Connection Drop Simulation

```typescript
app.get(
  "/flaky-stream",
  () => ({ status: 200, body: "stream-data" }),
  {
    simulation: {
      connection: {
        dropRate: 0.05, // 5% of connections are abruptly terminated
      },
    },
  },
);
```

---

## Middleware Pipeline

Wiremint provides an asynchronous, onion-style middleware pipeline. Middleware executes in registration order before the route handler, and in reverse order on the return leg.

### 1. Global Middleware

```typescript
app.use(async (ctx, next) => {
  console.log(`--> [${ctx.requestId}] ${ctx.method} ${ctx.path}`);

  // Modify response headers
  ctx.setHeader("x-response-time", "recorded");

  await next(); // Yields control downstream to next middleware / route handler

  console.log(`<-- [${ctx.requestId}] ${ctx.statusCode}`);
});
```

### 2. Path-Scoped Middleware

Restrict middleware to specific route paths or prefixes:

```typescript
app.use("/admin", async (ctx, next) => {
  const token = ctx.getHeader("authorization");
  if (!token || token !== "Bearer admin-secret") {
    // Terminate request early without calling next()
    ctx.statusCode = 401;
    ctx.responseBody = { error: "Unauthorized access" };
    return;
  }
  await next();
});
```

### 3. Middleware Context

```typescript
interface MiddlewareContext {
  readonly requestId: string;
  readonly method: HTTPMethod | string;
  readonly url: string;
  readonly path: string;
  readonly query: Record<string, string | string[]>;
  readonly params: Record<string, string>;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly body: unknown;
  readonly signal: AbortSignal;
  readonly scenario: ScenarioContext;

  statusCode?: number;
  responseHeaders: Record<string, string>;
  responseBody?: unknown;

  setHeader(name: string, value: string): void;
  getHeader(name: string): string | undefined;
}
```

### 4. Middleware Execution Rules
- `next()` must only be called once per middleware invocation; calling it multiple times throws a descriptive error.
- Middleware terminating without `next()` short-circuits the request and sends the response defined in `ctx.statusCode` / `ctx.responseBody`.
- If middleware terminates without calling `next()` and without setting a response, Wiremint safely returns a controlled 500 error rather than leaving the request hanging.

---

## Request Inspector & History

Wiremint features a bounded in-memory Request Inspector for debugging, auditing, and automated assertions.

### 1. Configuration

```typescript
const app = createWiremint({
  inspector: {
    enabled: true,             // Enable/disable inspector (default: true)
    maxEntries: 1000,          // Maximum records stored (FIFO ring buffer)
    captureRequestBody: true,  // Record incoming request bodies (default: true)
    captureResponseBody: true, // Record outgoing response bodies (default: true)
    maxBodySize: 10_000,       // Max body size in bytes before truncation (default: 10KB)
    sensitiveKeys: ["api_key"], // Additional sensitive keys to redact
  },
});
```

### 2. Public Inspector API

```typescript
const inspector = app.inspect();

// Retrieve all recorded requests (newest-first by default)
const history = inspector.getRequests();

// Filter requests
const failed = inspector.getRequests({ outcome: "error" });
const usersPosts = inspector.getRequests({ path: "/users", method: "POST" });
const outageReqs = inspector.getRequests({ scenarioId: "server-outage" });

// Lookup by ID (returns defensive immutable copy)
const record = inspector.getRequest("request-id");

// Aggregate statistics
const stats = inspector.stats();
// { totalRequests, successfulRequests, failedRequests, timeoutRequests, averageDuration, ... }

// Clear recorded history
inspector.clear();
```

### 3. Sensitive Data Redaction
To protect secrets and credentials, sensitive headers, query parameters, URLs, error messages, and body keys are automatically sanitized before storage in inspector history:
- **Default Redacted Keys**: `authorization`, `proxy-authorization`, `cookie`, `set-cookie`, `x-api-key`, `api-key`, `password`, `secret`, `token`, `access_token`, `refresh_token`, `client_secret`.
- **Query Parameter & URL Sanitization**: Sensitive keys in query parameters (e.g. `?token=...&api_key=...`) and raw URL query strings are redacted with `"[REDACTED]"` in inspector records, while route handlers and middleware contexts retain original authentic values.
- **Deep Recursive Body Redaction**: Recursively redacts nested JSON properties and arrays without mutating original request or response objects.
- **Error Message Sanitization**: Automatically scrubs Bearer tokens, credential assignments (`password=...`, `api_key=...`), and database connection string passwords (`postgres://user:password@host`) from recorded error details while preserving diagnostic error types and messages.

---

## Typed Event System

Subscribe to strongly typed request lifecycle events for telemetry, metrics, or custom test harnesses.

```typescript
// Subscribe to request start
const unsubStart = app.on("request:start", (event) => {
  console.log(`Request started: ${event.requestId} ${event.method} ${event.path}`);
});

// Subscribe to route match
app.on("request:match", (event) => {
  console.log(`Matched ${event.matchedRoute} with scenario ${event.scenarioId}`);
});

// Subscribe to terminal completion (guaranteed to fire at most once)
app.on("request:complete", (event) => {
  console.log(`Request completed: ID=${event.requestId} Outcome=${event.outcome} (${event.duration}ms)`);
});

// Unsubscribe when finished
unsubStart();
```

### Supported Events

| Event | When Emitted | Key Payload Fields |
|---|---|---|
| `request:start` | New request enters Wiremint | `requestId`, `method`, `url`, `path`, `timestamp` |
| `request:match` | Route successfully matched | `requestId`, `matchedRoute`, `method`, `params`, `scenarioId` |
| `request:success` | Request finishes with status < 400 | `requestId`, `statusCode`, `duration`, `matchedRoute`, `scenarioId` |
| `request:error` | Request finishes with status >= 400 or unhandled error | `requestId`, `error: { name, message }`, `statusCode` |
| `request:complete` | Terminal request outcome reached (fires once) | `requestId`, `outcome`, `statusCode`, `duration`, `timestamp` |
| `listener:error` | Event listener threw an exception | `event`, `error` |

> **Safety**: Errors thrown inside event listeners are captured safely and routed to `listener:error`; they will never crash the server or disrupt HTTP responses.

---

## API Reference

### `createWiremint(options?)`

Create a new Wiremint mock server instance.

| Option | Type | Default | Description |
|---|---|---|---|
| `basePath` | `string` | `"/"` | URL prefix for all routes. |
| `maxBodySize` | `number` | `1048576` | Maximum request body size in bytes (1 MiB). |
| `simulation` | `SimulationConfig` | `undefined` | Global network simulation settings. |
| `scenarios` | `ScenarioEngineOptions` | `undefined` | Scenario engine settings (`allowHttpSelection`, `headerName`, `queryParam`). |
| `inspector` | `InspectorConfig \| boolean` | `{ enabled: true }` | Request Inspector and history recording settings. |

### Route Registration

```typescript
app.get(path, handlerOrConfig, options?);
app.post(path, handlerOrConfig, options?);
app.put(path, handlerOrConfig, options?);
app.patch(path, handlerOrConfig, options?);
app.delete(path, handlerOrConfig, options?);
app.options(path, handlerOrConfig, options?);
```

Each handler receives a `RequestContext` and returns a `MockResponse`:

```typescript
interface RequestContext {
  readonly requestId: string;            // Unique request identifier
  method: HTTPMethod;
  path: string;
  params: Record<string, string>;       // Route params (:id)
  query: Record<string, string | string[]>;  // Query string
  headers: Record<string, string | string[] | undefined>;
  body: unknown;                         // Parsed JSON body
  signal: AbortSignal;                   // Aborts on client disconnect or timeout
  scenario: ScenarioContext;             // Active scenario context & state store
}
```

---

## Configuration Engine

Wiremint can be configured declaratively using configuration files (`wiremint.config.ts`, `wiremint.config.js`, `wiremint.config.mjs`, or `wiremint.config.json`) or programmatically via `createWiremint(config)`.

### 1. Defining Configuration with `defineConfig`

Use the `defineConfig` helper from `wiremint/config` for complete type safety and IDE autocompletion:

```typescript
// wiremint.config.ts
import { defineConfig } from "wiremint/config";

export default defineConfig({
  server: {
    port: 3001,
    host: "127.0.0.1",
    basePath: "/api",
  },
  simulation: {
    latency: { min: 100, max: 300, jitter: 50 },
    failure: { rate: 0.05, statusCode: 500 },
  },
  inspector: {
    enabled: true,
    maxEntries: 1000,
    sensitiveKeys: ["api_key", "password", "token"],
  },
  scenarios: [
    {
      id: "maintenance",
      name: "Maintenance Mode",
      description: "Checkout returns 503 during system maintenance",
    },
  ],
  routes: [
    // Dynamic parameter and query interpolation
    {
      method: "GET",
      path: "/users/:id",
      response: {
        status: 200,
        body: {
          id: "{{params.id}}",
          search: "{{query.q}}",
          activeScenario: "{{scenario.name}}",
        },
      },
    },
    // Scenario-specific declarative responses
    {
      method: "POST",
      path: "/checkout",
      response: {
        status: 200,
        body: { orderId: "ord_123", status: "confirmed" },
      },
      scenarios: {
        maintenance: {
          status: 503,
          body: { error: "Checkout is unavailable" },
        },
      },
    },
    // Sequential responses (polling simulation)
    {
      method: "GET",
      path: "/poll",
      sequence: [
        { status: 202, body: { progress: "queued" } },
        { status: 202, body: { progress: "running" } },
        { status: 200, body: { progress: "completed" } },
      ],
      afterEnd: "repeat-last",
    },
  ],
});
```

### 2. Loading Configuration

Wiremint can automatically discover your config file or load from an explicit path:

```typescript
import { createWiremint } from "wiremint";

// Discovers wiremint.config.ts / .js / .mjs / .json in current directory
const app = await createWiremint.fromConfig();
await app.listen();

// Or load an explicit file path:
const app = await createWiremint.fromConfig("./config/custom.wiremint.json");
await app.listen();
```

### 3. Safe Dynamic Value Interpolation

Declarative route responses can safely interpolate request data without dynamic code evaluation (`eval` / `new Function` are never used):

| Template Placeholder | Source Value | Example |
|---|---|---|
| `{{params.<key>}}` | Dynamic route parameter | `{{params.id}}` |
| `{{query.<key>}}` | URL query parameter | `{{query.search}}` |
| `{{scenario.id}}` | Current scenario ID | `"default"` |
| `{{scenario.name}}` | Current scenario display name | `"Happy Path"` |
| `{{requestId}}` | Unique incoming request ID | `"req_123456789"` |

### 4. Configuration Precedence & Environment Overrides

Wiremint resolves configuration using a 4-tier precedence hierarchy:

```
Authoritative Defaults  <  Configuration File  <  Environment Variables  <  Runtime Overrides
```

The following environment variables override file settings without changing code:

| Variable | Description | Example |
|---|---|---|
| `WIREMINT_PORT` | HTTP port (1-65535) | `WIREMINT_PORT=8080` |
| `WIREMINT_HOST` | Host address to bind | `WIREMINT_HOST=0.0.0.0` |
| `WIREMINT_BASE_PATH` | Base URL path prefix (must start with `/`) | `WIREMINT_BASE_PATH=/api/v2` |
| `WIREMINT_INSPECTOR_ENABLED` | Toggle request inspector (`true`/`false`/`1`/`0`) | `WIREMINT_INSPECTOR_ENABLED=false` |
| `WIREMINT_LOG_LEVEL` | Log level (`silent`, `error`, `warn`, `info`, `debug`) | `WIREMINT_LOG_LEVEL=debug` |

### 5. Ambiguity Detection

If multiple configuration files exist in the same directory (e.g. both `wiremint.config.ts` and `wiremint.config.json`), Wiremint halts with a descriptive `ConfigurationError` to prevent ambiguous or unpredictable runtime state.

---

## Developer CLI (Milestone 06)

Wiremint includes a command-line interface (`wiremint`) that lets you initialize mock projects, start development mock servers, inspect live traffic, and switch scenarios on the fly without boilerplate code.

### Installation & Execution

Run on-demand with `pnpm dlx` or `npx`:

```bash
pnpm dlx wiremint <command>
# or
npx wiremint <command>
```

Or install locally in your project:

```bash
pnpm add -D wiremint
```

### CLI Commands

#### 1. `wiremint init`
Initialize a new Wiremint mock project with a template configuration, `.gitignore`, and starter documentation:

```bash
wiremint init
# Or initialize with JSON configuration:
wiremint init --format json
```

#### 2. `wiremint dev`
Start the local mock API server with real-time request logging:

```bash
wiremint dev
# Override port or configuration path:
wiremint dev --port 4000
wiremint dev --config ./custom.config.ts
```

Output:
```text
Wiremint v0.1.0 — Build without waiting for your backend.

  Mock API server running

  Server:    http://127.0.0.1:3001/api
  Config:    wiremint.config.ts
  Control:   127.0.0.1:52134 (authenticated)

  Routes:
    GET     /api/health
    GET     /api/users/:id

  Watching incoming requests... (Press Ctrl+C to stop)

10:14:22 AM  GET     /api/users/42                  200     12ms
10:14:25 AM  POST    /api/checkout                  503     15ms
```

#### 3. `wiremint routes`
Display all registered endpoints, response types, and attached scenarios:

```bash
wiremint routes
# Output as JSON:
wiremint routes --json
```

#### 4. `wiremint doctor`
Verify Node.js version, configuration file discovery, schema validity, port availability, and project dependencies:

```bash
wiremint doctor
```

#### 5. `wiremint inspect`
Query live traffic captured by a running Wiremint server:

```bash
wiremint inspect
# Filter recent requests:
wiremint inspect --limit 10 --method GET --status 200
# Output as JSON:
wiremint inspect --json
```

#### 6. `wiremint scenario`
Inspect and manipulate application scenarios on a running Wiremint server:

```bash
# List all scenarios and see which is active:
wiremint scenario list

# Show active scenario metadata:
wiremint scenario show

# Switch the active scenario in real time:
wiremint scenario set offline

# Reset state store and sequence counters for a scenario:
wiremint scenario reset offline
```

### Local Control Plane Security

When you execute `wiremint inspect` or `wiremint scenario set`, the CLI connects to a running mock server through an internal **Local Control Plane**:

1. **Strict Localhost Binding**: The administration server binds strictly to `127.0.0.1` on an ephemeral OS-assigned port. It never binds to external interfaces (`0.0.0.0`).
2. **Cryptographic Authentication**: Every server run generates an ephemeral 32-byte cryptographically secure random token (`crypto.randomBytes(32)`).
3. **Bearer Token Validation**: Every control request requires `Authorization: Bearer <token>`, validated using constant-time comparison (`crypto.timingSafeEqual`) to prevent timing attacks.
4. **Runtime Connection File**: Connection parameters are stored in `.wiremint/runtime.json` (permission `0o600`).
5. **Automatic Cleanup**: When the server shuts down (or on `SIGINT`/`SIGTERM`), `.wiremint/runtime.json` is automatically deleted.

---

## Error Handling

Wiremint provides custom error classes for programmatic error handling:

```typescript
import {
  WiremintError,
  RouteError,
  ConfigurationError,
  ServerError,
  ScenarioError,
} from "wiremint";
```

| Error Class | Code | When |
|---|---|---|
| `WiremintError` | varies | Base class for all errors |
| `RouteError` | `ERR_ROUTE` | Duplicate routes, invalid route definitions |
| `ConfigurationError` | `ERR_CONFIG` | Invalid options, invalid simulation configuration |
| `ServerError` | `ERR_SERVER` | Server lifecycle issues (e.g. double listen) |
| `ScenarioError` | `ERR_SCENARIO` | Duplicate scenario IDs, unknown scenario activation, invalid ID format |

---

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Type-check
pnpm typecheck

# Build package
pnpm build
```

---

## Roadmap

- [x] Core HTTP engine and dynamic router (Milestone 01)
- [x] Network simulation engine: latency, failures, timeouts, connection drops (Milestone 02)
- [x] Named API scenarios & stateful mock responses (Milestone 03)
- [x] Middleware pipeline (Milestone 04)
- [x] Request inspection and history recording (Milestone 04)
- [x] Strongly typed request lifecycle event system (Milestone 04)
- [x] Configuration engine & declarative mock servers (Milestone 05)
- [x] Developer CLI & local control plane (Milestone 06)
- [ ] Offline-like network simulation & browser connectivity modes
- [ ] Documentation website

---

## Contributing

Contributions are welcome. Please open an issue first to discuss what you would like to change.

## License

[MIT](LICENSE)
