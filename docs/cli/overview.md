# Developer CLI Overview

Wiremint includes a developer-focused command line interface (`wiremint`) for running mock servers, inspecting routes, switching scenarios live, and verifying environment configurations.

## Running the CLI

Run the CLI using your package manager:

```bash
# Using pnpm
pnpm exec wiremint [command]

# Using npx
npx wiremint [command]
```

## Quick Reference

| Command | Description |
|---|---|
| `wiremint dev` | Start development mock server with live control plane |
| `wiremint init` | Scaffold `wiremint.config.ts` or `wiremint.config.json` |
| `wiremint routes` | List registered endpoints and active scenario mappings |
| `wiremint scenarios` | List registered mock application scenarios |
| `wiremint scenario set <id>` | Switch the active scenario on a running server |
| `wiremint scenario reset [id]` | Reset state store and sequence counters |
| `wiremint inspect` | View recent recorded HTTP requests and metrics |
| `wiremint doctor` | Run diagnostic checks on Node.js and configuration |
