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
