import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createWiremint } from "../../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, "wiremint.config.ts");

// Boot Wiremint using createWiremint.fromConfig()
const app = await createWiremint.fromConfig(configPath);

await app.listen();

console.log(`Wiremint server loaded from TypeScript configuration!`);
console.log(`Running at: http://${app.config.server.host}:${app.config.server.port}${app.config.server.basePath}`);
console.log(`Try: curl http://127.0.0.1:3005/api/users/42`);

