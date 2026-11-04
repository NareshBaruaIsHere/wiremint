# Routing Engine

Wiremint includes a lightweight, fast internal routing engine that supports dynamic route parameters, query strings, and custom HTTP methods.

## Standard HTTP Methods

Register handlers for standard HTTP methods:

```typescript
app.get("/items", handler);
app.post("/items", handler);
app.put("/items/:id", handler);
app.patch("/items/:id", handler);
app.delete("/items/:id", handler);
app.options("/items", handler);
app.head("/items", handler);
```

## Route Parameters

Define dynamic segments with a colon prefix (`:paramName`):

```typescript
app.get("/users/:userId/orders/:orderId", ({ params }) => {
  return {
    status: 200,
    body: {
      userId: params.userId,
      orderId: params.orderId,
    },
  };
});
```

## Query Parameters

Query strings are automatically parsed and passed to the handler:

```typescript
app.get("/search", ({ query }) => {
  // GET /search?q=typescript&limit=10
  return {
    status: 200,
    body: {
      queryText: query.q,
      limit: query.limit,
    },
  };
});
```

Repeated query parameters (e.g. `?tag=ts&tag=node`) are parsed into arrays (`['ts', 'node']`).

## Request Body Handling

Incoming request bodies on `POST`, `PUT`, and `PATCH` are automatically streamed and parsed:

- **JSON Requests**: Validated and parsed into JavaScript objects.
- **Plain Text Requests**: Provided as raw strings.
- **Oversized Requests**: Requests exceeding `maxBodySize` (default: 1 MB) are rejected with `413 Payload Too Large`.

```typescript
app.post("/api/login", ({ body, headers }) => {
  const credentials = body as { email?: string; password?: string };
  if (!credentials.email) {
    return { status: 400, body: { error: "Email required" } };
  }
  return { status: 200, body: { token: "jwt-token-xyz" } };
});
```

## Base Path Support

Prefix all registered routes with a common base path:

```typescript
const app = createWiremint({ basePath: "/api/v1" });
app.get("/users", handler); // Matches /api/v1/users
```
