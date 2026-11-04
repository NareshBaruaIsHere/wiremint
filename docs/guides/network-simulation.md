# Network Simulation

Wiremint includes a simulation engine designed to replicate real-world network instability, high latency, random failure rates, connection drops, and request timeouts.

## Configuration Options

Configure simulation globally when initializing Wiremint, or per-route:

```typescript
const app = createWiremint({
  simulation: {
    // 1. Latency & Jitter
    latency: {
      min: 100,    // minimum delay in milliseconds
      max: 400,    // maximum delay in milliseconds
      jitter: 30,  // random variance
    },

    // 2. Failure Injection
    failure: {
      rate: 0.1,   // 10% probability of failure
      statusCode: 503,
      body: { error: "Upstream service unavailable" },
    },

    // 3. Connection Interruption
    connection: {
      dropRate: 0.05, // 5% probability of dropped connection
    },

    // 4. Request Timeout
    timeout: {
      after: 2000,    // trigger timeout if handler exceeds 2000ms
      statusCode: 504,
    },
  },
});
```

## Fixed vs. Range Latency

Use `fixed` for predictable delays, or `min`/`max` for realistic variance:

```typescript
// Fixed latency: exactly 250ms
latency: { fixed: 250 }

// Range latency: between 100ms and 500ms
latency: { min: 100, max: 500 }
```

## Per-Route Simulation Overrides

Override or disable simulation for specific routes:

```typescript
// Fast healthcheck (disables simulation completely)
app.get("/health", () => ({ status: 200, body: { ok: true } }), {
  simulation: false,
});

// Artificially slow report generator
app.get("/heavy-report", () => ({ status: 200, body: { data: [] } }), {
  simulation: {
    latency: { fixed: 1500 },
  },
});
```

## Deterministic Testing with Seeded Randomness

Wiremint supports deterministic random number generators for reproducible test suites:

```typescript
import { SeededRandomGenerator } from "wiremint";

const app = createWiremint({
  simulation: {
    failure: { rate: 0.5 },
    random: new SeededRandomGenerator(12345),
  },
});
```

