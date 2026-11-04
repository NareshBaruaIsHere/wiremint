# Stateful Mocking & Sequences

Real APIs change state when resources are created, updated, or deleted. Wiremint provides scenario-scoped in-memory state stores and sequential response queues.

## Scenario-Scoped State Store

Each scenario has an isolated `StateStore` that persists across requests:

```typescript
app.scenario("cart-session", {
  name: "Shopping Cart Session",
  initialState: {
    cart: [{ id: "item-1", name: "Keyboard", price: 80 }],
  },
});

app.get("/api/cart", ({ scenario }) => {
  const cart = scenario.state.get("cart") ?? [];
  return { status: 200, body: cart };
});

app.post("/api/cart", ({ body, scenario }) => {
  const currentCart = scenario.state.get<any[]>("cart") ?? [];
  const updatedCart = [...currentCart, body];
  scenario.state.set("cart", updatedCart);

  return { status: 201, body: updatedCart };
});
```

When switching from `cart-session` to another scenario, each scenario maintains its own independent state.

## Resetting Scenario State

Reset in-memory state back to its initial configuration:

```typescript
// Reset specific scenario
app.resetScenario("cart-session");

// Reset all scenarios
app.resetAllScenarios();
```

## Sequential Responses

Simulate polling, retry loops, or multi-step processes with sequential responses:

```typescript
app.get("/api/deployment/status", {
  sequence: [
    { status: 200, body: { status: "queued", progress: 0 } },
    { status: 200, body: { status: "building", progress: 50 } },
    { status: 200, body: { status: "live", progress: 100 } },
  ],
  afterEnd: "repeat-last", // or "loop" or "error"
});
```

- `"repeat-last"`: Once the sequence finishes, subsequent requests continue to return the last response.
- `"loop"`: Restarts from the beginning of the sequence.
- `"error"`: Rejects subsequent requests with `500 Sequence exhausted`.

