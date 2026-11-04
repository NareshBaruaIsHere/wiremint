# Security Considerations

Wiremint is built with security-first defaults for development and testing environments.

## 1. Localhost Isolation

By default, Wiremint binds strictly to `127.0.0.1` (IPv4 loopback). It never binds to `0.0.0.0` unless explicitly passed via the `--host` flag. This prevents external devices on the local network from accessing mock endpoints or control planes.

## 2. Local Control Plane Cryptography

The Local Control Plane used by the CLI features:
- **Ephemeral Port**: Operating system dynamically assigns a port on `127.0.0.1`.
- **Random Bearer Token**: A 32-byte cryptographically secure token generated per session (`crypto.randomBytes(32)`).
- **Constant-Time Verification**: Uses `crypto.timingSafeEqual` for header validation to prevent timing side-channel attacks.
- **Strict File Permissions**: Connection parameters in `.wiremint/runtime.json` are written with `0o600` permissions (read/write by file owner only).

## 3. Credential Redaction

The Request Inspector sanitizes sensitive fields before recording requests into memory:
- **Headers**: Authorization tokens, cookies, API keys.
- **URL Query Parameters**: Secrets in query strings are redacted while preserving other query parameters.
- **Nested Request & Response Bodies**: Recursively scrubs passwords, client secrets, and access tokens.

## 4. Bounded Memory Limits

- Request inspector history is strictly bounded (default: 1,000 entries) with oldest-entry FIFO eviction.
- Request payload streaming enforces a `maxBodySize` limit (default: 1 MB) to prevent denial-of-service memory exhaustion.

## 5. Supply Chain Security & OIDC Trusted Publishing

Wiremint releases are published using npm's OIDC Trusted Publishing (via GitHub Actions) rather than persistent long-lived API tokens:
- **Zero Static Secrets**: Releases use short-lived cryptographic OIDC tokens issued directly by GitHub Actions (`id-token: write`). No static `NPM_TOKEN` secret is stored in repository settings.
- **Verifiable Build Provenance**: Every release is published with `--provenance`, generating cryptographic SLSA provenance attestations linking published tarballs back to the exact source commit and GitHub Actions workflow run.
- **Guarded Manual Trigger**: The release workflow (`.github/workflows/release.yml`) is triggered via manual `workflow_dispatch` and defaults to `publish: false` (running validation and dry-run only). Publication to npm is strictly opt-in requiring `publish: true`.

## 6. Network Simulation Boundary & Request Metadata Isolation

Network simulation settings can be overridden dynamically during in-process testing (`WiremintTestClient`), but these overrides are passed exclusively through internal Node.js in-memory `WeakMap` references (`src/server/request-metadata.ts`):
- **No Header Bypasses**: Normal HTTP requests arriving over TCP network interfaces cannot override or disable simulation via public request headers (such as `x-wiremint-simulation`) or query parameters.
- **Isolated Per-Client State**: Simulation overrides applied to an in-process test client affect only requests originated by that client instance, preventing cross-test pollution.

