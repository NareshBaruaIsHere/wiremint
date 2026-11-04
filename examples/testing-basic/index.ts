import { createWiremint } from "../../src/index.js";
import {
  createWiremintTestClient,
  expectStatus,
  expectJson,
  presets,
} from "../../src/testing/index.js";

// 1. Create a Wiremint application
const app = createWiremint();

app.get("/api/products", () => ({
  status: 200,
  body: [
    { id: 1, name: "Keyboard", price: 79 },
    { id: 2, name: "Mouse", price: 49 },
  ],
}));

app.post("/api/products", ({ body }) => ({
  status: 201,
  body: { id: 3, ...((body as Record<string, unknown>) ?? {}) },
}));

app.get("/api/products/:id", ({ params }) => {
  if (params.id === "999") {
    return presets.notFound("Product not found");
  }
  return { status: 200, body: { id: Number(params.id), name: "Keyboard" } };
});

// 2. Create in-process test client — zero network ports opened!
const client = createWiremintTestClient(app);

console.log("Wiremint Testing Toolkit — Basic Example");

// Test GET
const listRes = await client.get("/api/products");
expectStatus(listRes, 200);
console.log("✔ GET /api/products:", listRes.body);

// Test POST
const createRes = await client.post("/api/products", {
  body: { name: "Monitor", price: 299 },
});
expectStatus(createRes, 201);
expectJson(createRes, { id: 3, name: "Monitor", price: 299 });
console.log("✔ POST /api/products:", createRes.body);

// Test Preset Not Found
const notFoundRes = await client.get("/api/products/999");
expectStatus(notFoundRes, 404);
console.log("✔ GET /api/products/999 (preset):", notFoundRes.body);

// Test Inspector History
console.log("✔ Recorded requests count:", client.requestCount());
console.log("✔ Last recorded method:", client.lastRequest()?.method);
console.log("All assertions passed in-process!");

