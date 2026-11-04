# Your First Mock API

In this tutorial, you will create a complete mock API with dynamic parameters, scenario switching, and network fault injection.

## Step 1: Initialize Project Configuration

Run the Wiremint CLI `init` command:

```bash
pnpm exec wiremint init
```

This creates a default `wiremint.config.ts`:

```typescript
import { defineConfig } from "wiremint/config";

export default defineConfig({
  port: 3000,
  host: "127.0.0.1",
  basePath: "/api",
  simulation: {
    latency: { min: 50, max: 200, jitter: 20 },
  },
  scenarios: [
    { id: "empty-cart", name: "Empty Cart", description: "No items" },
  ],
  routes: [
    {
      method: "GET",
      path: "/items",
      response: {
        status: 200,
        body: [{ id: 1, name: "Keyboard", price: 79 }],
      },
    },
  ],
});
```

## Step 2: Start the Development Server

```bash
pnpm exec wiremint dev
```

The CLI starts your mock server on `http://127.0.0.1:3000/api` and activates an authenticated Local Control Plane.

## Step 3: Inspect Registered Routes

In another terminal window:

```bash
pnpm exec wiremint routes
```

Output:
```
METHOD  PATH       SCENARIO
GET     /api/items (default)
```

## Step 4: Add Scenarios Programmatically

You can also author mock servers using the TypeScript SDK:

```typescript
import { createWiremint } from "wiremint";

const app = createWiremint();

app.scenario("outage", {
  name: "Service Outage",
  description: "Database cluster failure",
});

app.get("/orders", {
  default: () => ({ status: 200, body: [{ id: "ord-1" }] }),
  scenarios: {
    outage: () => ({ status: 503, body: { error: "Database offline" } }),
  },
});

await app.listen({ port: 3000 });
```

Switch scenarios dynamically using HTTP headers:

```bash
curl -H "x-wiremint-scenario: outage" http://127.0.0.1:3000/orders
```

