import { createWiremint } from "../../src/index.js";

// Initialize Wiremint with global simulation defaults
const app = createWiremint({
  basePath: "/api",
  simulation: {
    // Global latency: random between 100ms and 300ms with +/- 25ms jitter
    latency: {
      min: 100,
      max: 300,
      jitter: 25,
    },
  },
});

// 1. Standard route inheriting global latency
app.get("/users", () => ({
  status: 200,
  body: [
    { id: 1, name: "Naresh", role: "Developer" },
    { id: 2, name: "Rahim", role: "Designer" },
  ],
}));

// 2. High-latency route: simulates slow mobile/satellite connection
app.get(
  "/reports/heavy",
  () => ({
    status: 200,
    body: { reportId: "rep-994", generatedAt: new Date().toISOString() },
  }),
  {
    simulation: {
      latency: { fixed: 1500 },
    },
  },
);

// 3. Fast route: explicitly disables latency simulation
app.get(
  "/health",
  () => ({
    status: 200,
    body: { status: "healthy", timestamp: Date.now() },
  }),
  {
    simulation: {
      latency: false,
    },
  },
);

// 4. Flaky payment route: simulates 20% random HTTP 503 service unavailable
app.post(
  "/payments/charge",
  ({ body }) => ({
    status: 201,
    body: { success: true, transactionId: "txn-abc123xyz", charge: body },
  }),
  {
    simulation: {
      failure: {
        rate: 0.2,
        statusCode: 503,
        body: { error: "Payment gateway temporarily overloaded. Please retry." },
      },
    },
  },
);

// 5. Timeout route: server handler takes 800ms, but timeout is set to 300ms (returns HTTP 504)
app.get(
  "/external-sync",
  async () => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return { status: 200, body: { synced: true } };
  },
  {
    simulation: {
      latency: false,
      timeout: {
        after: 300,
        statusCode: 504,
        body: { error: "External upstream service timed out after 300ms" },
      },
    },
  },
);

// 6. Unstable network route: 10% connection drop rate
app.get(
  "/unstable-stream",
  () => ({
    status: 200,
    body: { data: "High reliability stream" },
  }),
  {
    simulation: {
      connection: {
        dropRate: 0.1,
      },
    },
  },
);

await app.listen({ port: 3002 });
console.log("Wiremint Simulation Server running on http://127.0.0.1:3002/api");
console.log("Endpoints to explore:");
console.log("  GET  /api/users           -> Global latency (100-300ms + jitter)");
console.log("  GET  /api/reports/heavy   -> Fixed high latency (1500ms)");
console.log("  GET  /api/health          -> Latency disabled (instant response)");
console.log("  POST /api/payments/charge -> 20% failure injection (503)");
console.log("  GET  /api/external-sync   -> Timeout simulation (504)");
console.log("  GET  /api/unstable-stream -> 10% connection drop");

