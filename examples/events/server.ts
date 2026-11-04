import { createWiremint } from "../../src/index.js";

const app = createWiremint({ basePath: "/api" });

// 1. Subscribe to request start event
const unsubStart = app.on("request:start", (event) => {
  console.log(`[Event:start] ID=${event.requestId} Method=${event.method} Path=${event.path}`);
});

// 2. Subscribe to route match event
app.on("request:match", (event) => {
  console.log(`[Event:match] ID=${event.requestId} Route=${event.matchedRoute} Params=${JSON.stringify(event.params)}`);
});

// 3. Subscribe to success event
app.on("request:success", (event) => {
  console.log(`[Event:success] ID=${event.requestId} Status=${event.statusCode} Duration=${event.duration}ms`);
});

// 4. Subscribe to error event
app.on("request:error", (event) => {
  console.error(`[Event:error] ID=${event.requestId} Status=${event.statusCode} Error=${event.error.message}`);
});

// 5. Subscribe to terminal completion event (emitted exactly once)
app.on("request:complete", (event) => {
  console.log(`[Event:complete] ID=${event.requestId} Outcome=${event.outcome} Duration=${event.duration}ms`);
});

// Register routes
app.get("/orders/:id", ({ params }) => ({
  status: 200,
  body: { id: params.id, item: "Laptop", price: 1200 },
}));

app.get("/fail", () => {
  throw new Error("Deliberate failure in example handler");
});

await app.listen({ port: 3006 });
console.log("Events Example running at http://127.0.0.1:3006/api");
console.log("Try:");
console.log("  curl http://127.0.0.1:3006/api/orders/order-999");
console.log("  curl http://127.0.0.1:3006/api/fail");

