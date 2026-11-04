# Configuration Engine

Wiremint can be configured declaratively via TypeScript, JavaScript, or JSON configuration files.

## Discovery Order

Wiremint automatically searches for configuration files in the current working directory in the following order:

1. `wiremint.config.ts`
2. `wiremint.config.js`
3. `wiremint.config.mjs`
4. `wiremint.config.json`

## Defining a TypeScript Configuration

Use `defineConfig` for full autocomplete and type safety:

```typescript
// wiremint.config.ts
import { defineConfig } from "wiremint/config";

export default defineConfig({
  server: {
    port: 3000,
    host: "127.0.0.1",
    basePath: "/api",
  },

  simulation: {
    latency: { min: 50, max: 200, jitter: 15 },
    failure: { rate: 0.05, statusCode: 503 },
  },

  scenarios: [
    {
      id: "maintenance",
      name: "Maintenance Mode",
      description: "Returns 503 across core endpoints",
    },
  ],

  routes: [
    {
      method: "GET",
      path: "/users",
      response: {
        status: 200,
        body: [{ id: 1, name: "Alice" }],
      },
      scenarios: {
        maintenance: {
          status: 503,
          body: { error: "Database offline" },
        },
      },
    },
  ],
});
```

## JSON Configuration

```json
{
  "$schema": "https://wiremint.dev/schema.json",
  "port": 3000,
  "basePath": "/api",
  "routes": [
    {
      "method": "GET",
      "path": "/health",
      "response": {
        "status": 200,
        "body": { "ok": true }
      }
    }
  ]
}
```

## Configuration Precedence

When multiple configuration sources exist, Wiremint applies configuration in the following four-level hierarchy:

1. **CLI Flags**: `--port 8080`, `--host 0.0.0.0`, `--base-path /v2` (Highest priority)
2. **Environment Variables**: `WIREMINT_PORT`, `WIREMINT_BASE_PATH`, `WIREMINT_LATENCY_FIXED`
3. **Configuration File**: Values declared in `wiremint.config.ts` or `wiremint.config.json`
4. **Built-in Defaults**: Port `3000`, host `127.0.0.1`, `basePath` `""` (Lowest priority)

