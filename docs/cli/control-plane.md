# Local Control Plane Security

When you execute commands like `wiremint scenario set` or `wiremint inspect`, the CLI communicates with the active mock server via an internal **Local Control Plane**.

## Security Model

The Local Control Plane is built with strict security controls:

1. **Strict Localhost Binding**: The internal administration server binds strictly to `127.0.0.1` on an ephemeral OS-assigned port. It never binds to public interfaces (`0.0.0.0`).
2. **Cryptographic Authentication**: Every server run generates an ephemeral 32-byte cryptographically secure random token (`crypto.randomBytes(32)`).
3. **Constant-Time Comparison**: Every control request requires `Authorization: Bearer <token>`, validated using constant-time comparison (`crypto.timingSafeEqual`) to prevent timing side-channel attacks.
4. **Runtime Connection File**: Connection parameters are stored in `.wiremint/runtime.json` with restricted file permissions (`0o600`).
5. **Automatic Cleanup**: When the server shuts down (or on `SIGINT`/`SIGTERM`), `.wiremint/runtime.json` is automatically deleted.

## File Exclusion

Always ensure `.wiremint/` is included in your `.gitignore` file:

```gitignore
.wiremint/
```

