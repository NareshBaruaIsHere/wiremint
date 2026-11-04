import pc from "picocolors";
import { ControlClient } from "../control-client/client.js";
import { formatBanner } from "../utils/output.js";

export interface ScenarioCommandOptions {
  cwd?: string;
  json?: boolean;
}

export async function runScenarioList(options: ScenarioCommandOptions = {}): Promise<void> {
  const client = new ControlClient(options.cwd);
  const data = await client.getScenarios();

  if (options.json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  console.log(formatBanner() + "\n");
  console.log(pc.bold("Registered Scenarios on running server:\n"));

  for (const s of data.scenarios) {
    const isActive = s.id === data.active.id;
    const marker = isActive ? pc.green(pc.bold("▶ [ACTIVE]")) : pc.gray("         ");
    const id = pc.cyan(pc.bold(s.id.padEnd(18, " ")));
    const name = s.name.padEnd(22, " ");
    const desc = s.description ? pc.gray(s.description) : "";

    console.log(`  ${marker} ${id} ${pc.white(name)} ${desc}`);
  }

  console.log(
    pc.gray(
      `\n  To switch active scenario: wiremint scenario set <id>\n`,
    ),
  );
}

export async function runScenarioShow(options: ScenarioCommandOptions = {}): Promise<void> {
  const client = new ControlClient(options.cwd);
  const data = await client.getScenarios();

  if (options.json) {
    console.log(JSON.stringify(data.active, null, 2));
    return;
  }

  console.log(formatBanner() + "\n");
  console.log(pc.bold("Currently Active Scenario:\n"));
  console.log(`  ${pc.bold("ID:")}          ${pc.cyan(data.active.id)}`);
  console.log(`  ${pc.bold("Name:")}        ${pc.white(data.active.name)}`);
  if (data.active.description) {
    console.log(`  ${pc.bold("Description:")} ${pc.gray(data.active.description)}`);
  }
  console.log();
}

export async function runScenarioSet(
  scenarioId: string,
  options: ScenarioCommandOptions = {},
): Promise<void> {
  if (!scenarioId || typeof scenarioId !== "string") {
    throw new Error("Missing required scenario ID argument: wiremint scenario set <scenarioId>");
  }

  const client = new ControlClient(options.cwd);
  const res = await client.setActiveScenario(scenarioId);

  if (options.json) {
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  console.log(formatBanner() + "\n");
  console.log(pc.green(`✔ Active scenario switched to: ${pc.bold(res.active.name)} (${pc.cyan(res.active.id)})\n`));
}

export async function runScenarioReset(
  scenarioId?: string,
  options: ScenarioCommandOptions = {},
): Promise<void> {
  const client = new ControlClient(options.cwd);

  let targetId = scenarioId;
  if (!targetId) {
    const active = await client.getScenarios();
    targetId = active.active.id;
  }

  const res = await client.resetScenario(targetId);

  if (options.json) {
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  console.log(formatBanner() + "\n");
  console.log(pc.green(`✔ Scenario '${pc.cyan(targetId)}' state successfully reset.\n`));
}

