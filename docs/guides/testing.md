# Testing Toolkit (`wiremint/testing`)

The testing toolkit allows developers to test mock APIs and frontend integration logic directly within unit and integration tests **without starting a real HTTP server or managing network ports**.

```typescript
import { createWiremint } from "wiremint";
import {
  createWiremintTestClient,
  expectStatus,
  expectJson,
  presets,
} from "wiremint/testing";

const app = createWiremint();
app.get("/users", () => presets.ok([{ id: 1, name: "Alice" }]));

// In-process test client — zero network ports opened!
const client = createWiremintTestClient(app);

const res = await client.get("/users");
expectStatus(res, 200);
expectJson(res, [{ id: 1, name: "Alice" }]);
```

## Why In-Process Testing?

- **Zero Port Collisions**: Runs in-process using simulated Node.js streams. Never conflicts with busy ports in CI or parallel test runners.
- **Full Pipeline Execution**: Executes the exact same pipeline as a live server — routing, middleware, network simulation, scenario resolution, request inspection, and events.
- **Instant Execution**: Sub-millisecond latency per request.

## Creating a Test Client

Create a client from an application instance or directly from a configuration file:

```typescript
// 1. From an existing application
const client = createWiremintTestClient(app, {
  defaultHeaders: { "x-api-key": "test-key" },
  simulation: false, // disable network simulation during tests
});

// 2. From an isolated standalone application
const client = createWiremintTestClient.isolated();

// 3. From a configuration file
const client = await createWiremintTestClient.fromConfig("./wiremint.config.ts");
```

## Sending Requests

```typescript
// GET with query parameters
const res = await client.get("/search", { query: { q: "wiremint", page: 1 } });

// POST with JSON body
const res = await client.post("/users", { body: { name: "Bob" } });

// POST with plain text body
const res = await client.post("/notes", { textBody: "Hello plain text" });

// PUT, PATCH, DELETE, OPTIONS
await client.put("/users/1", { body: { name: "Robert" } });
await client.patch("/users/1", { body: { active: true } });
await client.delete("/users/1");
await client.optionsRoute("/users");
```

## Built-in Assertions

Wiremint includes framework-independent assertion helpers that throw typed `TestAssertionError` errors:

```typescript
import {
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
} from "wiremint/testing";

const res = await client.get("/api/user");

expectStatus(res, 200);
expectSuccessful(res);
expectHeader(res, "content-type", "application/json");
expectHeaderMissing(res, "x-deprecated");
expectJson(res, { name: "Alice" }); // deep subset match
expectText(res, /"name":"Alice"/);
```

## Vitest Matchers Adapter

If you are using Vitest, import our custom matchers under `wiremint/testing/vitest`:

```typescript
// vitest.setup.ts
import { expect } from "vitest";
import { wiremintMatchers } from "wiremint/testing/vitest";

expect.extend(wiremintMatchers);
```

```typescript
// user.test.ts
import { describe, it, expect } from "vitest";

it("verifies response with custom Vitest matchers", async () => {
  const res = await client.get("/api/user");

  expect(res).toHaveStatus(200);
  expect(res).toBeSuccessful();
  expect(res).toHaveHeader("content-type", /json/);
  expect(res).toHaveJson({ name: "Alice" });
  expect(res).toHaveBody({ id: 1, name: "Alice" });
});
```

## Response Presets

Common mock response factories:

```typescript
import { presets } from "wiremint/testing";

app.get("/items", () => presets.ok([{ id: 1 }]));
app.post("/items", () => presets.created({ id: 2 }));
app.delete("/items/:id", () => presets.noContent());
app.get("/empty", () => presets.emptyList());
app.get("/missing", () => presets.notFound("Item not found"));
app.get("/secure", () => presets.unauthorized("Authentication required"));
app.get("/forbidden", () => presets.forbidden("Access denied"));
app.get("/crash", () => presets.serverError("Database unreachable"));
app.get("/slow", presets.slow(300, { data: "delayed payload" }));
```
