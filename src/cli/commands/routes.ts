import pc from "picocolors";
import { loadConfig } from "../../config/config-resolver.js";
import { formatBanner, formatMethod } from "../utils/output.js";

export interface RoutesOptions {
  config?: string;
  json?: boolean;
  cwd?: string;
}

export async function runRoutes(options: RoutesOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();

  const resolved = await loadConfig({
    cwd,
    configFile: options.config,
  });

  const routes = resolved.routes;
  const basePath = resolved.server.basePath === "/" ? "" : resolved.server.basePath;

  if (options.json) {
    console.log(JSON.stringify(routes, null, 2));
    return;
  }

  console.log(formatBanner() + "\n");
  console.log(pc.bold(`Configured routes for ${pc.cyan(resolved.configFile ?? "default configuration")}:\n`));

  if (routes.length === 0) {
    console.log(pc.yellow("  No routes configured. Add routes in your wiremint.config.ts."));
    return;
  }

  console.log(
    pc.gray(
      `  ${"METHOD".padEnd(8, " ")} ${"PATH".padEnd(30, " ")} ${"RESPONSE".padEnd(12, " ")} SCENARIOS`,
    ),
  );
  console.log(pc.gray("  " + "─".repeat(70)));

  for (const r of routes) {
    const fullPath = `${basePath}${r.path}`;
    const methodStr = formatMethod(r.method);

    let responseInfo = "handler";
    if (r.sequence) {
      responseInfo = `sequence (${r.sequence.length})`;
    } else if (r.response && typeof r.response === "object" && "status" in r.response) {
      responseInfo = `${r.response.status ?? 200}`;
    }

    let scenarioInfo = pc.gray("-");
    if (r.scenarios) {
      const names = Object.keys(r.scenarios).join(", ");
      scenarioInfo = pc.cyan(names);
    }

    console.log(
      `  ${methodStr} ${pc.bold(fullPath.padEnd(30, " "))} ${pc.gray(responseInfo.padEnd(12, " "))} ${scenarioInfo}`,
    );
  }

  console.log();
}

