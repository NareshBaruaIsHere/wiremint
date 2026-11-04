import { defineConfig } from "../../src/config/index.js";

export default defineConfig({
  server: {
    port: 3007,
    host: "127.0.0.1",
    basePath: "/api",
  },
  simulation: {
    latency: { min: 50, max: 150, jitter: 20 },
    failure: { rate: 0 }, // deterministic by default
  },
  inspector: {
    enabled: true,
    maxEntries: 500,
    sensitiveKeys: ["api_key", "password", "token"],
  },
  scenarios: [
    {
      id: "maintenance",
      name: "Maintenance Mode",
      description: "Returns 503 Service Unavailable for checkout",
      initialState: { reason: "Database migration" },
    },
  ],
  routes: [
    // Dynamic path parameter interpolation
    {
      method: "GET",
      path: "/items/:id",
      response: {
        status: 200,
        body: {
          itemId: "{{params.id}}",
          category: "electronics",
          scenario: "{{scenario.name}}",
        },
      },
    },
    // Scenario-dependent endpoint
    {
      method: "POST",
      path: "/checkout",
      response: {
        status: 200,
        body: { success: true, receipt: "rcpt_12345" },
      },
      scenarios: {
        maintenance: {
          status: 503,
          body: { error: "Checkout is currently down for maintenance" },
        },
      },
    },
    // Sequential poll endpoint
    {
      method: "GET",
      path: "/export/status",
      sequence: [
        { status: 202, body: { progress: 25, status: "processing" } },
        { status: 202, body: { progress: 75, status: "processing" } },
        { status: 200, body: { progress: 100, status: "completed", url: "/downloads/export.csv" } },
      ],
      afterEnd: "repeat-last",
    },
  ],
});

