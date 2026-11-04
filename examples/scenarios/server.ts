import { createWiremint } from "../../src/index.js";

const app = createWiremint({
  basePath: "/api",
});

// 1. Define named application scenarios
app.scenario("happy-path", {
  name: "Happy Path",
  description: "Standard operating responses with populated data",
});

app.scenario("empty-state", {
  name: "Empty State",
  description: "Simulates an account with zero records",
});

app.scenario("server-outage", {
  name: "Server Outage",
  description: "Simulates upstream service failure",
});

app.scenario("authenticated", {
  name: "Authenticated User",
  description: "Pre-populated user profile and shopping cart",
  initialState: {
    user: { id: "u-991", name: "Naresh", role: "admin" },
    cart: [{ id: "prod-1", name: "Mechanical Keyboard", price: 120 }],
  },
});

// 2. Scenario-specific route responses
app.get("/products", {
  default: () => ({
    status: 200,
    body: [
      { id: 1, name: "Laptop", price: 1200 },
      { id: 2, name: "Wireless Mouse", price: 35 },
    ],
  }),
  scenarios: {
    "empty-state": () => ({
      status: 200,
      body: [],
    }),
    "server-outage": () => ({
      status: 503,
      body: { error: "Product catalog database cluster is offline" },
    }),
  },
});

// 3. Stateful mock storage (isolated per scenario)
app.get("/cart", ({ scenario }) => ({
  status: 200,
  body: scenario.state.get("cart") ?? [],
}));

app.post("/cart", ({ body, scenario }) => {
  const currentCart = scenario.state.get<any[]>("cart") ?? [];
  const updatedCart = [...currentCart, body];
  scenario.state.set("cart", updatedCart);

  return {
    status: 201,
    body: updatedCart,
  };
});

// 4. Sequential response route
app.get("/deploy-status", {
  sequence: [
    { status: 503, body: { status: "building", step: 1 } },
    { status: 503, body: { status: "deploying", step: 2 } },
    { status: 200, body: { status: "live", step: 3 } },
  ],
  afterEnd: "repeat-last",
});

// 5. Inspect active scenario context
app.get("/scenario/info", ({ scenario }) => ({
  status: 200,
  body: {
    activeScenario: scenario.id,
    name: scenario.name,
    description: scenario.description,
  },
}));

await app.listen({ port: 3003 });
console.log("Wiremint Scenario Server running on http://127.0.0.1:3003/api");
console.log("\nTry these commands in another terminal:");
console.log("1. Default scenario:");
console.log("   curl http://127.0.0.1:3003/api/products");
console.log("2. HTTP Header selection:");
console.log('   curl -H "x-wiremint-scenario: empty-state" http://127.0.0.1:3003/api/products');
console.log("3. Query param selection:");
console.log("   curl http://127.0.0.1:3003/api/products?__scenario=server-outage");
console.log("4. Stateful cart:");
console.log('   curl -H "x-wiremint-scenario: authenticated" http://127.0.0.1:3003/api/cart');
console.log("5. Sequential responses (run multiple times):");
console.log("   curl http://127.0.0.1:3003/api/deploy-status");

