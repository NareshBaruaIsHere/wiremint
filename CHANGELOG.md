# Changelog

All notable changes to the **Wiremint** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] - 2026-11-05

### Added
- **Core HTTP Foundation (Milestone 01)**
  - Native Node.js HTTP mock server (`createWiremint()`) with zero runtime HTTP dependencies.
  - Express-like route registration (`app.get`, `app.post`, `app.put`, `app.patch`, `app.delete`, `app.options`, `app.head`).
  - Dynamic route parameters (`/users/:id`), automatic query parameter parsing, and JSON request/response streaming.
  - Clean error handling with typed `WiremintError`, `RouteError`, and `ServerError` classes.

- **Network Simulation Engine (Milestone 02)**
  - Realistic latency and jitter simulation (`fixed`, `min`, `max`, `jitter`).
  - Random HTTP failure injection (`rate`, `statusCode`, `body`, `headers`).
  - Connection drop simulation (`dropRate`) and timeout simulation (`after`, `statusCode`).
  - Global and per-route simulation overrides with injectable deterministic random number generators (`MathRandomGenerator`, `SequenceRandomGenerator`, `SeededRandomGenerator`).

- **Scenario Engine & Stateful Mocking (Milestone 03)**
  - Named mock application scenarios (`app.scenario(id, definition)`).
  - Dynamic scenario resolution via headers (`x-wiremint-scenario`), query parameters (`__scenario`), and programmatic API.
  - Isolated in-memory `StateStore` per scenario for stateful cart, session, and profile testing.
  - Sequential response queues (`sequence`, `afterEnd: "repeat-last" | "cycle"`).

- **Middleware Pipeline, Request Inspector & Event System (Milestone 04 / 04.1)**
  - Onion-style middleware pipeline with pre- and post-`next()` response header and body transformation.
  - Path-scoped middleware (`app.use("/api/v1", ...)`) with prefix isolation.
  - Request Inspector with bounded FIFO history store, statistical aggregation (`stats()`), and query filtering.
  - Automated credential redaction for sensitive headers, URL query parameters, and nested JSON request/response bodies.
  - Strongly typed request lifecycle event system (`request:start`, `request:match`, `request:success`, `request:error`, `request:complete`).

- **Configuration Engine (Milestone 05 / 05.1)**
  - Declarative configuration loader (`defineConfig`, `loadConfig`) supporting TypeScript (`.ts`), JavaScript (`.js`, `.mjs`), and JSON (`.json`) files.
  - Strict Zod schema validation with actionable error formatting.
  - Four-level configuration precedence: CLI flags > Environment variables (`WIREMINT_*`) > Config file > Defaults.
  - Reusable package subpath export: `wiremint/config`.

- **Developer CLI & Local Control Plane (Milestone 06)**
  - Executable CLI (`wiremint`) with commands: `dev`, `init`, `routes`, `scenarios`, `scenario set`, `scenario reset`, `inspect`, `doctor`.
  - Authenticated Local Control Plane with strict `127.0.0.1` binding, ephemeral 32-byte cryptographically secure tokens, and constant-time bearer authentication (`crypto.timingSafeEqual`).
  - Ephemeral `.wiremint/runtime.json` lifecycle management.

- **Testing & Integration Toolkit (Milestone 07 / 07.1)**
  - Zero-port in-process test client (`createWiremintTestClient`) under `wiremint/testing`.
  - Full request pipeline execution (middleware, simulation, inspector, scenarios) without binding network sockets.
  - Client-level request history isolation (`client.history()`, `client.lastRequest()`, `client.clearHistory()`).
  - Request body helpers supporting JSON, plain text (`textBody`), and raw Buffers.
  - Response parsing handling `application/json`, structured `+json`, and `text/plain`.
  - Built-in framework-independent assertions (`expectStatus`, `expectJson`, `expectHeader`, `expectSuccessful`, `expectClientError`, `expectServerError`).
  - Common mock response presets (`presets.ok`, `presets.notFound`, `presets.unauthorized`, `presets.slow`, etc.).
  - Vitest matchers adapter under `wiremint/testing/vitest` (`toHaveStatus`, `toBeSuccessful`, `toHaveHeader`, `toHaveJson`, `toMatchJson`).

- **Release Infrastructure & Security Hardening (Milestone 08 / 08.1)**
  - Comprehensive VitePress documentation website with API references, guides, and architectural diagrams.
  - Automated GitHub Pages documentation deployment workflow.
  - Cross-platform CI matrix testing on Node.js 22, 24, and 26 across Linux and Windows.
  - GitHub Actions OIDC trusted publishing with cryptographically verifiable SLSA build provenance (`--provenance`).
  - Strict security boundary separating external TCP HTTP requests from internal testing simulation overrides using in-memory `WeakMap` metadata.
  - Application ownership semantics (`ApplicationOwnership = "shared" | "owned"`) preventing test client scenario state bleed.
  - Collision-free Request Inspector store retaining distinct entries for duplicate user-specified request IDs.


