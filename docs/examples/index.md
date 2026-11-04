# Runnable Examples

Wiremint provides 12 minimal, fully functional examples in the `examples/` directory.

## Core HTTP & Routing

- **Basic Mock Server** ([`examples/basic/server.ts`](https://github.com/NareshBaruaIsHere/wiremint/tree/main/examples/basic/server.ts)): Demonstrates route registration, parameter extraction, and JSON body handling.
- **Middleware Pipeline** ([`examples/middleware/server.ts`](https://github.com/NareshBaruaIsHere/wiremint/tree/main/examples/middleware/server.ts)): Demonstrates onion-style middleware, timing headers, and request mutation.
- **Request Inspector** ([`examples/inspector/server.ts`](https://github.com/NareshBaruaIsHere/wiremint/tree/main/examples/inspector/server.ts)): Demonstrates querying request history, metrics calculation, and credential redaction.
- **Typed Event System** ([`examples/events/server.ts`](https://github.com/NareshBaruaIsHere/wiremint/tree/main/examples/events/server.ts)): Demonstrates listening to `request:start`, `request:complete`, and `listener:error`.

## Network Simulation & Scenarios

- **Network Simulation** ([`examples/simulation/server.ts`](https://github.com/NareshBaruaIsHere/wiremint/tree/main/examples/simulation/server.ts)): Demonstrates latency injection, jitter, failure rates, connection drops, and timeouts.
- **Scenario Engine & Stateful Mocking** ([`examples/scenarios/server.ts`](https://github.com/NareshBaruaIsHere/wiremint/tree/main/examples/scenarios/server.ts)): Demonstrates named scenarios, stateful shopping cart, and sequential polling responses.

## Configuration Files

- **TypeScript Config** ([`examples/config-typescript/`](https://github.com/NareshBaruaIsHere/wiremint/tree/main/examples/config-typescript)): Declarative server using `wiremint.config.ts`.
- **JSON Config** ([`examples/config-json/`](https://github.com/NareshBaruaIsHere/wiremint/tree/main/examples/config-json)): Declarative server using `wiremint.config.json`.
- **Advanced Precedence** ([`examples/config-advanced/`](https://github.com/NareshBaruaIsHere/wiremint/tree/main/examples/config-advanced)): Demonstrates environment variable overrides and CLI flags.

## Testing Toolkit

- **Basic Testing Client** ([`examples/testing-basic/`](https://github.com/NareshBaruaIsHere/wiremint/tree/main/examples/testing-basic)): In-process test client with built-in assertions and presets.
- **Testing Scenarios & Sequences** ([`examples/testing-scenarios/`](https://github.com/NareshBaruaIsHere/wiremint/tree/main/examples/testing-scenarios)): Testing stateful flows and resets in-process.
- **Vitest Integration** ([`examples/testing-vitest/`](https://github.com/NareshBaruaIsHere/wiremint/tree/main/examples/testing-vitest)): Using custom Vitest matchers with `expect.extend(wiremintMatchers)`.

## Running an Example

```bash
pnpm exec tsx examples/testing-basic/index.ts
```

