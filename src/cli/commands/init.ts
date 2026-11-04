import { existsSync, writeFileSync, appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pc from "picocolors";
import { findConfigFile } from "../../config/config-discovery.js";
import { formatBanner } from "../utils/output.js";

export interface InitOptions {
  format?: "ts" | "json";
  force?: boolean;
  cwd?: string;
}

const TS_TEMPLATE = `import { defineConfig } from "wiremint/config";

export default defineConfig({
  server: {
    port: 3001,
    host: "127.0.0.1",
    basePath: "/api",
  },
  simulation: {
    latency: { min: 50, max: 150, jitter: 20 },
  },
  scenarios: [
    {
      id: "offline",
      name: "Offline Simulation",
      description: "Returns 503 for all endpoints",
    },
  ],
  routes: [
    {
      method: "GET",
      path: "/health",
      response: {
        status: 200,
        body: { status: "ok", timestamp: new Date().toISOString() },
      },
    },
    {
      method: "GET",
      path: "/users/:id",
      response: {
        status: 200,
        body: {
          id: "{{params.id}}",
          name: "Sample User",
          role: "developer",
        },
      },
      scenarios: {
        offline: {
          status: 503,
          body: { error: "Service temporarily offline" },
        },
      },
    },
  ],
});
`;

const JSON_TEMPLATE = `{
  "server": {
    "port": 3001,
    "host": "127.0.0.1",
    "basePath": "/api"
  },
  "simulation": {
    "latency": {
      "min": 50,
      "max": 150,
      "jitter": 20
    }
  },
  "scenarios": [
    {
      "id": "offline",
      "name": "Offline Simulation",
      "description": "Returns 503 for all endpoints"
    }
  ],
  "routes": [
    {
      "method": "GET",
      "path": "/health",
      "response": {
        "status": 200,
        "body": {
          "status": "ok"
        }
      }
    },
    {
      "method": "GET",
      "path": "/users/:id",
      "response": {
        "status": 200,
        "body": {
          "id": "{{params.id}}",
          "name": "Sample User"
        }
      },
      "scenarios": {
        "offline": {
          "status": 503,
          "body": {
            "error": "Service temporarily offline"
          }
        }
      }
    }
  ]
}
`;

const README_TEMPLATE = `# Mock API (Wiremint)

This project contains a mock API server managed by **Wiremint**.

## Getting Started

1. Start the mock development server:
   \`\`\`bash
   wiremint dev
   \`\`\`

2. View registered endpoints:
   \`\`\`bash
   wiremint routes
   \`\`\`

3. Switch scenarios while the server is running:
   \`\`\`bash
   wiremint scenario list
   wiremint scenario set offline
   \`\`\`

4. Inspect captured requests in real-time:
   \`\`\`bash
   wiremint inspect
   \`\`\`
`;

export async function runInit(options: InitOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const format = options.format?.toLowerCase() === "json" ? "json" : "ts";
  const force = Boolean(options.force);

  console.log(formatBanner());
  console.log(pc.bold("\nInitializing Wiremint project...\n"));

  // 1. Check for existing configuration
  let existingConfig: string | null = null;
  try {
    existingConfig = findConfigFile(cwd);
  } catch {
    // Ambiguous files already exist
    existingConfig = "multiple config files detected";
  }

  const targetFilename = format === "json" ? "wiremint.config.json" : "wiremint.config.ts";
  const targetPath = join(cwd, targetFilename);

  if (existingConfig && !force) {
    console.log(
      pc.yellow(`Configuration file already exists in this directory (${existingConfig}).`),
    );
    console.log(pc.gray("Use --force to overwrite."));
    return;
  }

  // 2. Write configuration file
  const template = format === "json" ? JSON_TEMPLATE : TS_TEMPLATE;
  writeFileSync(targetPath, template, "utf-8");
  console.log(pc.green(`✔ Created ${pc.bold(targetFilename)}`));

  // 3. Update or create .gitignore
  const gitignorePath = join(cwd, ".gitignore");
  if (existsSync(gitignorePath)) {
    const gitignoreContent = readFileSync(gitignorePath, "utf-8");
    if (!gitignoreContent.includes(".wiremint")) {
      appendFileSync(gitignorePath, "\n# Wiremint runtime cache\n.wiremint\n", "utf-8");
      console.log(pc.green("✔ Added .wiremint to .gitignore"));
    }
  } else {
    writeFileSync(gitignorePath, "# Wiremint runtime cache\n.wiremint\n", "utf-8");
    console.log(pc.green("✔ Created .gitignore with .wiremint"));
  }

  // 4. Create README.md if not present
  const readmePath = join(cwd, "README.md");
  if (!existsSync(readmePath)) {
    writeFileSync(readmePath, README_TEMPLATE, "utf-8");
    console.log(pc.green(`✔ Created ${pc.bold("README.md")}`));
  }

  // 5. Output next steps
  console.log(pc.bold("\nNext steps:\n"));
  console.log(`  ${pc.cyan("wiremint dev")}       Start the mock API server`);
  console.log(`  ${pc.cyan("wiremint routes")}    View registered endpoints`);
  console.log(`  ${pc.cyan("wiremint doctor")}    Verify environment and configuration\n`);
}

