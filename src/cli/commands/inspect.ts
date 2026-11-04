import pc from "picocolors";
import { ControlClient } from "../control-client/client.js";
import { formatBanner, formatDuration, formatMethod, formatStatusCode } from "../utils/output.js";

export interface InspectOptions {
  limit?: string | number;
  method?: string;
  path?: string;
  status?: string | number;
  scenario?: string;
  json?: boolean;
  cwd?: string;
}

export async function runInspect(options: InspectOptions = {}): Promise<void> {
  const client = new ControlClient(options.cwd);

  const filters = {
    limit: options.limit ? Number(options.limit) : 20,
    method: options.method?.toUpperCase(),
    path: options.path,
    status: options.status ? Number(options.status) : undefined,
    scenario: options.scenario,
  };

  const { total, requests } = await client.getRequests(filters);

  if (options.json) {
    console.log(JSON.stringify({ total, requests }, null, 2));
    return;
  }

  console.log(formatBanner() + "\n");
  console.log(
    pc.bold(`Captured requests (${requests.length} displayed of ${total} total):\n`),
  );

  if (requests.length === 0) {
    console.log(pc.yellow("  No matching requests captured yet."));
    console.log(pc.gray("  Send HTTP requests to the running mock server to view them here.\n"));
    return;
  }

  console.log(
    pc.gray(
      `  ${"TIME".padEnd(10, " ")} ${"METHOD".padEnd(8, " ")} ${"PATH / URL".padEnd(35, " ")} ${"STATUS".padEnd(8, " ")} ${"DURATION".padEnd(10, " ")} SCENARIO`,
    ),
  );
  console.log(pc.gray("  " + "─".repeat(85)));

  for (const r of requests) {
    const time = pc.gray(new Date(r.timestamp).toLocaleTimeString().padEnd(10, " "));
    const method = formatMethod(r.method);
    const urlDisplay = pc.white(r.url.padEnd(35, " "));
    const status = formatStatusCode(r.statusCode ?? 0);
    const duration = formatDuration(r.duration ?? 0).padEnd(10, " ");
    const scenario = r.scenarioId ? pc.cyan(r.scenarioId) : pc.gray("default");

    console.log(`  ${time} ${method} ${urlDisplay} ${status}   ${duration} ${scenario}`);
  }

  console.log();
}
