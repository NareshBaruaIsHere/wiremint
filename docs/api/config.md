# Configuration API Reference (`wiremint/config`)

Exports for declarative configuration loading, schema validation, and resolution.

```typescript
import {
  defineConfig,
  loadConfig,
  validateConfig,
  resolveConfig,
  applyConfig,
  findConfigFile,
} from "wiremint/config";
```

## `defineConfig(config)`

Type-helper providing autocomplete and validation for configuration objects:

```typescript
import { defineConfig } from "wiremint/config";

export default defineConfig({
  server: {
    port: 4000,
    basePath: "/api",
  },
});
```

## `loadConfig(options?)`

Discovers, parses, validates, and resolves configuration files from disk.

### Parameters

- `options` *(optional)*: `LoadConfigOptions`
  - `cwd` *(string)*: Working directory to search (default: `process.cwd()`).
  - `configFile` *(string)*: Explicit file path to load.
  - `overrides` *(`Partial<WiremintConfig>`)*: Explicit runtime overrides.
  - `env` *(`Record<string, string | undefined>`)*: Environment variables map (default: `process.env`).

Returns: `Promise<ResolvedWiremintConfig>`

## `validateConfig(data)`

Validates arbitrary input against the Wiremint Zod schema:

```typescript
const result = validateConfig(rawJson);
if (!result.success) {
  console.error(result.errors);
}
```

## `findConfigFile(cwd?)`

Searches `cwd` for `wiremint.config.ts`, `wiremint.config.js`, `wiremint.config.mjs`, or `wiremint.config.json`. Returns the file path or `null`.
