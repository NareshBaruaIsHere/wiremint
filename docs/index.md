---
layout: home

hero:
  name: "Wiremint"
  text: "Build without waiting for your backend."
  tagline: "A TypeScript-first API mocking and network simulation toolkit for frontend and fullstack teams."
  image:
    src: /logo.svg
    alt: Wiremint Logo
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started/quick-start
    - theme: alt
      text: View on GitHub
      link: https://github.com/NareshBaruaIsHere/wiremint

features:
  - title: TypeScript-First API Mocking
    details: Strong typings, dynamic route parameters, automated JSON parsing, and zero external runtime HTTP dependencies.
  - title: Realistic Network Simulation
    details: Inject latency, jitter, HTTP failure rates, connection drops, and request timeouts globally or per-route.
  - title: Scenario-Based Responses
    details: Define named scenarios like happy-path, maintenance, or auth-expired with isolated state stores and sequence counters.
  - title: Request Inspector & Redaction
    details: Bounded chronological request history, statistical analytics, and automatic credential redaction for sensitive data.
  - title: Zero-Port Testing Toolkit
    details: Test mock APIs directly in Vitest or Jest using in-process dispatch with zero socket bindings and no port collisions.
  - title: Developer CLI & Control Plane
    details: Run mock servers from declarative configs with live authenticated scenario switching and request inspection.
---

## Quick Example

```typescript
import { createWiremint } from "wiremint";

const app = createWiremint({
  basePath: "/api",
  simulation: {
    latency: { min: 100, max: 250, jitter: 20 },
  },
});

app.scenario("maintenance", {
  name: "Maintenance Mode",
  description: "Returns 503 service unavailable",
});

app.get("/users", {
  default: () => ({ status: 200, body: [{ id: 1, name: "Naresh" }] }),
  scenarios: {
    maintenance: () => ({ status: 503, body: { error: "Database maintenance in progress" } }),
  },
});

await app.listen({ port: 3001 });
console.log("Wiremint mock server running on http://127.0.0.1:3001/api");
```

## In-Process Unit Testing

Test mock APIs directly inside your test suite without starting a server:

```typescript
import { createWiremint } from "wiremint";
import { createWiremintTestClient, expectStatus, expectJson } from "wiremint/testing";

const app = createWiremint();
app.get("/users", () => ({ status: 200, body: [{ id: 1, name: "Alice" }] }));

// Zero network ports opened!
const client = createWiremintTestClient(app);

const res = await client.get("/users");
expectStatus(res, 200);
expectJson(res, [{ id: 1, name: "Alice" }]);
```
