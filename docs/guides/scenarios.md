# Scenario Engine

A scenario represents a named mock backend state (e.g. `happy-path`, `empty-state`, `maintenance`, `rate-limited`). Scenarios allow frontend developers to test diverse application states without modifying endpoint implementations.

## Defining Scenarios

Register scenarios with metadata:

```typescript
app.scenario("maintenance", {
  name: "Maintenance Mode",
  description: "Simulates upstream scheduled maintenance",
});

app.scenario("vip-user", {
  name: "VIP User",
  description: "User with platinum tier permissions and perks",
});
```

## Scenario-Specific Route Responses

Define distinct responses per scenario on a single endpoint:

```typescript
app.get("/api/dashboard", {
  default: () => ({
    status: 200,
    body: { items: [{ id: 1, name: "Project Alpha" }] },
  }),
  scenarios: {
    maintenance: () => ({
      status: 503,
      body: { error: "Dashboard is undergoing scheduled maintenance" },
    }),
    "vip-user": () => ({
      status: 200,
      body: { items: [{ id: 1, name: "Project Alpha" }], perks: ["Priority Support"] },
    }),
  },
});
```

## Switching Scenarios

### 1. HTTP Header Selection
Pass the `x-wiremint-scenario` header in any HTTP client or frontend app:

```bash
curl -H "x-wiremint-scenario: maintenance" http://127.0.0.1:3000/api/dashboard
```

### 2. URL Query Parameter
Append `?__scenario=<id>` to the request URL:

```bash
curl http://127.0.0.1:3000/api/dashboard?__scenario=vip-user
```

### 3. Programmatic Switching
Switch the globally active scenario on the Wiremint instance:

```typescript
app.setScenario("maintenance");
app.clearScenario(); // Reverts to "default"
```

### 4. CLI Control Plane
Switch scenarios live in a running server from the command line:

```bash
wiremint scenario set maintenance
```

