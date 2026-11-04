# Request Inspector

Wiremint records HTTP request history and aggregate metrics in an in-memory, bounded FIFO store.

## Accessing the Inspector

Access the inspector via `app.inspect()`:

```typescript
const inspector = app.inspect();

// Get all recorded requests
const requests = inspector.getRequests();

// Filter by method or status code
const failedPosts = inspector.getRequests({
  method: "POST",
  statusRange: { min: 400, max: 599 },
});

// Calculate metrics
const stats = inspector.stats();
console.log(`Total: ${stats.totalRequests}, Avg Duration: ${stats.averageDuration}ms`);
```

## Credential Redaction

Sensitive information is automatically replaced with `[REDACTED]` in request headers, query strings, and nested JSON request and response bodies.

### Default Redacted Keys

- `authorization`, `proxy-authorization`
- `cookie`, `set-cookie`
- `x-api-key`, `x-token`, `api_key`, `apikey`
- `secret`, `client_secret`, `password`, `token`, `access_token`

### Adding Custom Sensitive Keys

Configure custom sensitive keys when initializing Wiremint:

```typescript
const app = createWiremint({
  inspector: {
    sensitiveKeys: ["custom_credential", "internal_hash"],
  },
});
```

Query parameters containing sensitive tokens (e.g. `/api/auth?access_token=secret123&client_id=myApp`) are recorded as:

```text
/api/auth?access_token=[REDACTED]&client_id=myApp
```

## Bounded Memory Store

To prevent memory leaks during long-running tests or development sessions, the inspector defaults to retaining 1,000 requests. When capacity is reached, the oldest request is automatically evicted.

```typescript
const app = createWiremint({
  inspector: {
    maxEntries: 500, // Customize retained history limit
  },
});
```

