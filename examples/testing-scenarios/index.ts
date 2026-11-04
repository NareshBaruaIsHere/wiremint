import { createWiremint } from "../../src/index.js";
import {
  createWiremintTestClient,
  expectStatus,
  expectJson,
} from "../../src/testing/index.js";

const app = createWiremint();

app.scenario("maintenance", {
  name: "Maintenance Mode",
  description: "Returns 503 service unavailable",
});

app.scenario("cart-session", {
  name: "Cart Session",
  description: "Stateful shopping cart",
  initialState: {
    items: [{ id: "sku-1", name: "Keyboard" }],
  },
});

// Route with scenario variants
app.get("/api/status", {
  default: () => ({
    status: 200,
    body: { healthy: true, status: "operational" },
  }),
  scenarios: {
    maintenance: () => ({
      status: 503,
      body: { healthy: false, error: "System under maintenance" },
    }),
  },
});

// Route with sequential responses
app.get("/api/checkout", {
  sequence: [
    { status: 500, body: { error: "Temporary gateway timeout" } },
    { status: 500, body: { error: "Temporary gateway timeout" } },
    { status: 200, body: { orderId: "ord-9981", status: "completed" } },
  ],
  afterEnd: "repeat-last",
});

// Stateful route
app.get("/api/cart", ({ scenario }) => ({
  status: 200,
  body: scenario.state.get("items") ?? [],
}));

const client = createWiremintTestClient(app);

console.log("Wiremint Testing Toolkit — Scenarios & State Example");

// 1. Initial default scenario
const defaultRes = await client.get("/api/status");
expectStatus(defaultRes, 200);
expectJson(defaultRes, { healthy: true, status: "operational" });
console.log("✔ Default scenario:", defaultRes.body);

// 2. Switch scenario to 'maintenance'
client.setScenario("maintenance");
console.log("Active scenario:", client.getScenario());

const maintRes = await client.get("/api/status");
expectStatus(maintRes, 503);
expectJson(maintRes, { healthy: false, error: "System under maintenance" });
console.log("✔ Maintenance scenario:", maintRes.body);

// 3. Test sequential responses
const attempt1 = await client.get("/api/checkout");
expectStatus(attempt1, 500);
console.log("✔ Attempt 1 (expected 500):", attempt1.status);

const attempt2 = await client.get("/api/checkout");
expectStatus(attempt2, 500);
console.log("✔ Attempt 2 (expected 500):", attempt2.status);

const attempt3 = await client.get("/api/checkout");
expectStatus(attempt3, 200);
expectJson(attempt3, { orderId: "ord-9981", status: "completed" });
console.log("✔ Attempt 3 (recovered 200):", attempt3.body);

// 4. Per-request scenario override without changing global scenario
const overrideRes = await client.get("/api/status", { scenario: "default" });
expectStatus(overrideRes, 200);
console.log("✔ Per-request scenario override:", overrideRes.body);

// 5. Test stateful scenario
client.setScenario("cart-session");
const cartRes = await client.get("/api/cart");
expectStatus(cartRes, 200);
expectJson(cartRes, [{ id: "sku-1", name: "Keyboard" }]);
console.log("✔ Stateful scenario data:", cartRes.body);

// 6. Reset all scenario state and active scenario
client.reset();
console.log("Active scenario after reset:", client.getScenario());
console.log("All scenario tests passed in-process!");
