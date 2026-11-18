# Installation

Wiremint requires **Node.js 22.0.0** or higher. It is published as an ESM-first package.

## Install as a Dependency

Install Wiremint in your project using your preferred package manager:

::: code-group

```bash [pnpm]
pnpm add @nareshbarua/wiremint
```

```bash [npm]
npm install @nareshbarua/wiremint
```

```bash [yarn]
yarn add @nareshbarua/wiremint
```

```bash [bun]
bun add @nareshbarua/wiremint
```

:::

## Verify Installation

Check that Node.js meets the version requirement:

```bash
node --version
# Should output v22.0.0 or higher
```

To use the Wiremint CLI directly:

```bash
pnpm exec wiremint --version
```

## TypeScript Configuration

Wiremint is authored in TypeScript strict mode. Ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "strict": true
  }
}
```

