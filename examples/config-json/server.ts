import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createWiremint } from "../../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, "wiremint.config.json");

// Load Wiremint directly from JSON configuration
const app = await createWiremint.fromConfig(configPath);

await app.listen();

console.log(`Wiremint server loaded from JSON configuration!`);
console.log(`Running at: http://${app.config.server.host}:${app.config.server.port}${app.config.server.basePath}`);
console.log(`Try: curl http://127.0.0.1:3006/v1/products/p-987`);

