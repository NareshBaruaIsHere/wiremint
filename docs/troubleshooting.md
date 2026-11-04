# Troubleshooting

Common issues and solutions when working with Wiremint.

## Port Already in Use (`EADDRINUSE`)

If port 3000 is occupied by another process:

```bash
# Override the port via CLI:
wiremint dev --port 4000

# Or set an environment variable:
export WIREMINT_PORT=4000
```

Alternatively, use the testing toolkit (`createWiremintTestClient`), which requires **zero network ports** and executes entirely in-process.

## Configuration File Not Loaded

Run `wiremint doctor` to inspect configuration discovery:

```bash
wiremint doctor
```

Verify that your configuration file is located in the project root and matches one of:
- `wiremint.config.ts`
- `wiremint.config.js`
- `wiremint.config.mjs`
- `wiremint.config.json`

## TypeScript Declaration Errors with Vitest Matchers

If TypeScript does not recognize `expect(res).toHaveStatus(...)`:

Ensure your `vitest.setup.ts` imports `wiremint/testing/vitest`:

```typescript
import { expect } from "vitest";
import { wiremintMatchers } from "wiremint/testing/vitest";

expect.extend(wiremintMatchers);
```

And verify your `tsconfig.json` includes your test setup files in `include`.

## Node.js Version Incompatibility

Wiremint requires **Node.js 22.0.0** or later. If you see syntax errors or missing Node APIs:

```bash
node -v
# Ensure output is >= 22.0.0
```
