# Wiremint Examples

This directory contains standalone, runnable examples demonstrating the capabilities of Wiremint from basic HTTP mocking to advanced simulation, stateful scenarios, and in-process testing.

---

## Example Directory Index

| Directory | Topic | Description | Run Command |
|---|---|---|---|
| [`basic/`](./basic) | Core HTTP | Route registration, URL params, JSON body parsing, and query strings | `pnpm exec tsx examples/basic/server.ts` |
| [`simulation/`](./simulation) | Network Simulation | Latency, jitter, failure injection, connection drops, and timeouts | `pnpm exec tsx examples/simulation/server.ts` |
| [`scenarios/`](./scenarios) | Scenario Engine | Named scenarios, stateful stores, sequential responses (`repeat-last`) | `pnpm exec tsx examples/scenarios/server.ts` |
| [`middleware/`](./middleware) | Pipeline | Onion-style middleware, authentication guards, and response mutation | `pnpm exec tsx examples/middleware/server.ts` |
| [`inspector/`](./inspector) | Request Inspector | Querying request history, credential redaction, and aggregate statistics | `pnpm exec tsx examples/inspector/server.ts` |
| [`events/`](./events) | Event System | Typed lifecycle events (`request:start`, `request:complete`, etc.) | `pnpm exec tsx examples/events/server.ts` |
| [`config-typescript/`](./config-typescript) | TS Configuration | Declarative mock server using `wiremint.config.ts` | `pnpm exec tsx examples/config-typescript/server.ts` |
| [`config-json/`](./config-json) | JSON Configuration | Declarative mock server using `wiremint.config.json` | `pnpm exec tsx examples/config-json/server.ts` |
| [`config-advanced/`](./config-advanced) | Config Precedence | Environment overrides, CLI flags, and route merging | `pnpm exec tsx examples/config-advanced/server.ts` |
| [`testing-basic/`](./testing-basic) | Testing Client | Zero-port in-process test client with built-in assertions and presets | `pnpm exec tsx examples/testing-basic/index.ts` |
| [`testing-scenarios/`](./testing-scenarios) | Scenario Testing | Testing stateful scenarios, sequences, and resets with test client | `pnpm exec tsx examples/testing-scenarios/index.ts` |
| [`testing-vitest/`](./testing-vitest) | Vitest Matchers | Using custom Vitest matchers (`toHaveStatus`, `toHaveJson`, etc.) | `pnpm exec tsx examples/testing-vitest/index.ts` |

---

## How to Run Any Example

From the root repository directory:

```bash
# Example: Run the in-process testing example
pnpm exec tsx examples/testing-basic/index.ts

# Example: Run the scenarios example server
pnpm exec tsx examples/scenarios/server.ts
```

