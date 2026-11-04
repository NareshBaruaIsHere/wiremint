import { createWiremint } from "../../src/index.js";

const app = createWiremint({ basePath: "/api" });

// Simple GET endpoint
app.get("/users", () => ({
  status: 200,
  body: [
    { id: 1, name: "Naresh" },
    { id: 2, name: "Rahim" },
  ],
}));

// Dynamic route with parameters
app.get("/users/:id", ({ params }) => ({
  status: 200,
  body: { id: params.id, name: "Naresh" },
}));

// POST endpoint with body parsing
app.post("/users", ({ body }) => ({
  status: 201,
  body: { created: true, data: body },
}));

// Query parameter support
app.get("/search", ({ query }) => ({
  status: 200,
  body: { results: [], query },
}));

await app.listen({ port: 3001 });
console.log("Wiremint mock server running at http://127.0.0.1:3001/api");
console.log("Try: curl http://127.0.0.1:3001/api/users");

