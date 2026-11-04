import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createWiremint } from "../../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, "wiremint.config.ts");

// Boot Wiremint from advanced TypeScript config
const app = await createWiremint.fromConfig(configPath);

await app.listen();

console.log(`Wiremint advanced server loaded!`);
console.log(`Server URL: http://${app.config.server.host}:${app.config.server.port}${app.config.server.basePath}`);
console.log(`- Try item endpoint: curl http://127.0.0.1:3007/api/items/widget-123`);
console.log(`- Try sequence poll: curl http://127.0.0.1:3007/api/export/status`);
console.log(`- Try checkout (normal): curl -X POST http://127.0.0.1:3007/api/checkout`);
console.log(`- Try checkout (maintenance): curl -X POST -H "x-wiremint-scenario: maintenance" http://127.0.0.1:3007/api/checkout`);

