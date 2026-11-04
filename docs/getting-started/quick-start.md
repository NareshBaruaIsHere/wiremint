# Quick Start

Get up and running with Wiremint in under two minutes.

## 1. Create a Wiremint Server

Create a file named `server.ts`:

```typescript
import { createWiremint } from "wiremint";

const app = createWiremint({
  basePath: "/api",
});

// Define endpoints
app.get("/users", () => ({
  status: 200,
  body: [
    { id: 1, name: "Naresh", role: "admin" },
    { id: 2, name: "Rahim", role: "developer" },
  ],
}));

app.get("/users/:id", ({ params }) => ({
  status: 200,
  body: { id: params.id, name: "Naresh" },
}));

app.post("/users", ({ body }) => ({
  status: 201,
  body: { created: true, data: body },
}));

// Start HTTP server
await app.listen({ port: 3001 });
console.log("Wiremint running at http://127.0.0.1:3001/api");
```

## 2. Run the Mock Server

Run your server using `tsx`:

```bash
pnpm exec tsx server.ts
```

## 3. Test with curl or browser

In another terminal:

```bash
# Fetch user list
curl http://127.0.0.1:3001/api/users

# Fetch dynamic user parameter
curl http://127.0.0.1:3001/api/users/42

# Create a user with JSON body
curl -X POST http://127.0.0.1:3001/api/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Sara"}'
```

Next, read [Your First Mock API](/getting-started/first-mock-api) to add network simulation and named scenarios!

