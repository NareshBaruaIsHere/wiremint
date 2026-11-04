# Contributing to Wiremint

Thank you for your interest in contributing to **Wiremint**! Wiremint is an open-source, TypeScript-first API mocking and network simulation toolkit with the tagline: *"Build without waiting for your backend."*

This document provides guidelines and instructions for setting up your development environment, creating pull requests, and adhering to our coding standards.

---

## Code of Conduct

All contributors and participants are expected to adhere to the [Code of Conduct](CODE_OF_CONDUCT.md). Please treat everyone with respect, kindness, and empathy.

---

## Prerequisites

- **Node.js**: `v22.0.0` or higher (verified with Node.js 22 LTS).
- **Package Manager**: [pnpm](https://pnpm.io/) (`>= 9.0.0` or `10.x`).
- **Operating System**: Cross-platform support (Linux, macOS, and Windows).

---

## Development Setup

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/NareshBaruaIsHere/wiremint.git
   cd wiremint
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Verify the environment:**
   ```bash
   # Typecheck TypeScript source
   pnpm typecheck

   # Run test suite
   pnpm test

   # Build distribution artifacts
   pnpm build
   ```

---

## Development Workflow & Commands

| Command | Description |
|---|---|
| `pnpm dev` | Run local development server using `tsx watch` |
| `pnpm typecheck` | Run TypeScript typecheck with `tsc --noEmit` |
| `pnpm test` | Run full test suite with Vitest |
| `pnpm test:watch` | Run Vitest in interactive watch mode |
| `pnpm build` | Compile ESM packages and TypeScript declaration files with `tsup` |
| `pnpm pack` | Build `.tgz` archive to verify packaging integrity |

---

## Architecture Principles

- **TypeScript Strict Mode**: Wiremint runs in full TypeScript strict mode. Avoid `any` types; prefer typed generics, discriminated unions, and explicit return types.
- **Zero-Port In-Process Execution**: The testing toolkit (`wiremint/testing`) executes in-process using simulated Node.js streams. It never opens TCP sockets or requires `app.listen()`.
- **ESM-First**: The library is compiled to standard ECMAScript Modules (ESM). Do not introduce CommonJS runtime dependencies.
- **Security & Redaction**: The Request Inspector sanitizes sensitive headers, query parameters, and body keys by default. Never record raw credentials.
- **Backward Compatibility**: Every milestone builds upon previous milestones. Never break working public APIs across M01–M07.

---

## Submitting Pull Requests

1. **Create a branch:**
   ```bash
   git checkout -b feat/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

2. **Commit your changes:**
   - Write clear, concise commit messages following Conventional Commits (`feat: ...`, `fix: ...`, `test: ...`, `docs: ...`).
   - Keep commits focused and atomic.

3. **Ensure checks pass locally:**
   ```bash
   pnpm typecheck
   pnpm test
   pnpm build
   ```

4. **Add tests:**
   - Include regression tests for bug fixes.
   - Include unit and integration tests for new capabilities.
   - Ensure 100% of the test suite passes.

5. **Open a Pull Request:**
   - Fill out the PR template with a clear description of the problem solved and test verification steps.

