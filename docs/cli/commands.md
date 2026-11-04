# CLI Commands Reference

Detailed reference for all `wiremint` CLI commands and options.

## `wiremint dev`

Start the mock API server in development mode.

```bash
wiremint dev [options]
```

### Options

- `-p, --port <number>`: Override port (e.g. `--port 8080`)
- `-h, --host <string>`: Override host (e.g. `--host 0.0.0.0`)
- `-c, --config <path>`: Explicit path to configuration file
- `--base-path <path>`: Prefix for all endpoints (e.g. `--base-path /api`)
- `--no-simulation`: Disable network simulation completely
- `--verbose`: Enable debug logging

---

## `wiremint init`

Scaffold a fresh Wiremint configuration file in the current directory.

```bash
wiremint init [options]
```

### Options

- `-f, --format <ts|json>`: Choose configuration format (default: `ts`)
- `--force`: Overwrite existing configuration file if present

---

## `wiremint routes`

Display all registered routes and their associated scenario configurations.

```bash
wiremint routes [options]
```

### Options

- `-c, --config <path>`: Path to configuration file
- `--json`: Output route list as JSON

---

## `wiremint scenarios`

List all available scenarios declared in the configuration or on the running server.

```bash
wiremint scenarios [options]
```

---

## `wiremint scenario set`

Switch the globally active scenario on a running Wiremint server.

```bash
wiremint scenario set <scenario-id>
```

Example:

```bash
wiremint scenario set maintenance
```

---

## `wiremint scenario reset`

Reset in-memory state and sequential response counters.

```bash
# Reset specific scenario
wiremint scenario reset cart-session

# Reset currently active scenario
wiremint scenario reset
```

---

## `wiremint inspect`

Display recorded HTTP requests, status codes, durations, and aggregate analytics.

```bash
wiremint inspect [options]
```

### Options

- `-n, --limit <number>`: Maximum number of recent requests to display (default: 20)
- `-m, --method <string>`: Filter by HTTP method (e.g. `POST`)
- `-s, --status <number>`: Filter by HTTP status code (e.g. `404`)
- `--json`: Output raw inspection data as JSON

---

## `wiremint doctor`

Verify your development environment, Node.js version, project structure, and configuration validity.

```bash
wiremint doctor
```

