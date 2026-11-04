import { createWiremint } from "../../src/index.js";

const app = createWiremint({
  basePath: "/api",
  inspector: {
    enabled: true,
    maxEntries: 100,
    captureRequestBody: true,
    captureResponseBody: true,
    sensitiveKeys: ["api_secret"],
  },
});

app.get("/users", () => ({
  status: 200,
  body: [
    { id: 1, name: "Naresh" },
    { id: 2, name: "Alex" },
  ],
}));

app.post("/auth/login", ({ body }) => ({
  status: 200,
  body: { token: "jwt.fake.session", user: body },
}));

// Route to query inspector history over HTTP
app.get("/__inspector/requests", ({ query }) => {
  const inspector = app.inspect();
  const filter: any = {};

  if (query.method && typeof query.method === "string") {
    filter.method = query.method;
  }
  if (query.outcome && typeof query.outcome === "string") {
    filter.outcome = query.outcome;
  }
  if (query.statusCode && typeof query.statusCode === "string") {
    filter.statusCode = parseInt(query.statusCode, 10);
  }

  return {
    status: 200,
    body: {
      stats: inspector.stats(),
      requests: inspector.getRequests(filter),
    },
  };
});

// Route to clear history
app.post("/__inspector/clear", () => {
  app.inspect().clear();
  return { status: 200, body: { cleared: true } };
});

await app.listen({ port: 3005 });
console.log("Inspector Example running at http://127.0.0.1:3005/api");
console.log("Try:");
console.log("  curl http://127.0.0.1:3005/api/users");
console.log("  curl -X POST -H 'Content-Type: application/json' -H 'Authorization: Bearer secret' -d '{\"password\":\"secret123\"}' http://127.0.0.1:3005/api/auth/login");
console.log("  curl http://127.0.0.1:3005/api/__inspector/requests");

