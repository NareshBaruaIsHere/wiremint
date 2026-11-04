import { defineConfig } from "../../src/config/index.js";

export default defineConfig({
  server: {
    port: 3005,
    host: "127.0.0.1",
    basePath: "/api",
  },
  routes: [
    {
      method: "GET",
      path: "/users/:id",
      response: {
        status: 200,
        headers: { "content-type": "application/json" },
        body: {
          id: "{{params.id}}",
          name: "Alice",
          status: "active",
        },
      },
    },
    {
      method: "GET",
      path: "/search",
      response: {
        status: 200,
        body: {
          query: "{{query.q}}",
          results: [],
        },
      },
    },
  ],
});

