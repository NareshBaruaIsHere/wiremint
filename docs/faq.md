# Frequently Asked Questions (FAQ)

## What is Wiremint?

Wiremint is a TypeScript-first API mocking and network simulation toolkit. It allows frontend and fullstack developers to build and test applications against realistic mock backends without waiting for backend teams to complete production APIs.

## How is Wiremint different from tools like MSW or json-server?

| Feature | Wiremint | json-server | MSW |
|---|---|---|---|
| **Architecture** | Native Node.js HTTP server & in-process client | Express-based standalone server | Service Worker interceptor |
| **Network Simulation** | Built-in latency, failure rate, drops, timeouts | Basic fixed delay | Manual delay |
| **Scenario Engine** | Named scenarios with isolated state stores & sequences | None | Manual handlers |
| **Testing Toolkit** | Zero-port in-process runner + Vitest matchers | Requires real HTTP socket | Virtual fetch interception |
| **CLI & Control Plane** | Authenticated CLI with live scenario switching | Basic CLI | None |
| **Security Redaction** | Built-in redaction for headers, query, and bodies | None | None |

## Does Wiremint open network ports during tests?

No. When using `createWiremintTestClient(app)` from `wiremint/testing`, requests are dispatched directly in-process through simulated Node.js streams. Zero TCP sockets are opened, eliminating port contention in parallel CI test runs.

## Can I use Wiremint with Jest or Mocha?

Yes! While Wiremint includes dedicated matchers for Vitest, the test client and built-in assertion helpers (`expectStatus`, `expectJson`, `expectHeader`) are framework-independent and work with Jest, Mocha, or standalone scripts.

## Is Wiremint ESM-only?

Yes. Wiremint is published as a modern, ESM-first package targeting Node.js 22+.
