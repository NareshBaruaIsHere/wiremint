import { Command } from "commander";
import { getPackageVersion } from "./utils/version.js";
import { handleCliError } from "./utils/errors.js";
import { runInit, type InitOptions } from "./commands/init.js";
import { runDev, type DevOptions } from "./commands/dev.js";
import { runRoutes, type RoutesOptions } from "./commands/routes.js";
import { runDoctor } from "./commands/doctor.js";
import { runInspect, type InspectOptions } from "./commands/inspect.js";
import {
  runScenarioList,
  runScenarioReset,
  runScenarioSet,
  runScenarioShow,
  type ScenarioCommandOptions,
} from "./commands/scenario.js";

/**
 * Creates and configures the Wiremint CLI Commander program.
 */
export function createCliProgram(): Command {
  const program = new Command();
  const version = getPackageVersion();

  program
    .name("wiremint")
    .description("Wiremint — Build without waiting for your backend.")
    .version(version, "-v, --version", "Display installed Wiremint version");

  // wiremint init
  program
    .command("init")
    .description("Initialize a new Wiremint mock API configuration in the current directory")
    .option("-f, --format <format>", "Configuration format ('ts' or 'json')", "ts")
    .option("--force", "Overwrite existing configuration file")
    .action(async (opts: InitOptions) => {
      try {
        await runInit(opts);
      } catch (err) {
        handleCliError(err);
      }
    });

  // wiremint dev
  program
    .command("dev")
    .description("Start the Wiremint mock API development server")
    .option("-c, --config <path>", "Path to explicit Wiremint configuration file")
    .option("-p, --port <port>", "Port to bind HTTP server to")
    .option("-h, --host <host>", "Host to bind HTTP server to")
    .option("--no-control", "Disable local control plane")
    .action(async (opts: DevOptions) => {
      try {
        await runDev(opts);
      } catch (err) {
        handleCliError(err);
      }
    });

  // wiremint routes
  program
    .command("routes")
    .description("Display configured mock routes and endpoints")
    .option("-c, --config <path>", "Path to explicit Wiremint configuration file")
    .option("--json", "Output routes as JSON")
    .action(async (opts: RoutesOptions) => {
      try {
        await runRoutes(opts);
      } catch (err) {
        handleCliError(err);
      }
    });

  // wiremint doctor
  program
    .command("doctor")
    .description("Verify local environment and configuration health")
    .action(async () => {
      try {
        const passed = await runDoctor();
        if (!passed) {
          process.exitCode = 1;
        }
      } catch (err) {
        handleCliError(err);
      }
    });

  // wiremint inspect
  program
    .command("inspect")
    .description("Inspect requests captured by a running Wiremint server")
    .option("-l, --limit <number>", "Number of recent requests to display", "20")
    .option("-m, --method <method>", "Filter by HTTP method (GET, POST, etc.)")
    .option("-p, --path <path>", "Filter by URL path substring")
    .option("-s, --status <status>", "Filter by HTTP response status code")
    .option("--scenario <scenarioId>", "Filter by scenario ID")
    .option("--json", "Output requests as JSON")
    .action(async (opts: InspectOptions) => {
      try {
        await runInspect(opts);
      } catch (err) {
        handleCliError(err);
      }
    });

  // wiremint scenario
  const scenarioCmd = program
    .command("scenario")
    .description("Inspect and switch scenarios on a running Wiremint server");

  scenarioCmd
    .command("list")
    .description("List all registered scenarios and highlight active scenario")
    .option("--json", "Output scenarios as JSON")
    .action(async (opts: ScenarioCommandOptions) => {
      try {
        await runScenarioList(opts);
      } catch (err) {
        handleCliError(err);
      }
    });

  scenarioCmd
    .command("show")
    .description("Show metadata for currently active scenario")
    .option("--json", "Output scenario as JSON")
    .action(async (opts: ScenarioCommandOptions) => {
      try {
        await runScenarioShow(opts);
      } catch (err) {
        handleCliError(err);
      }
    });

  scenarioCmd
    .command("set <scenarioId>")
    .description("Switch the active scenario on running server")
    .option("--json", "Output response as JSON")
    .action(async (scenarioId: string, opts: ScenarioCommandOptions) => {
      try {
        await runScenarioSet(scenarioId, opts);
      } catch (err) {
        handleCliError(err);
      }
    });

  scenarioCmd
    .command("reset [scenarioId]")
    .description("Reset in-memory state and sequence counters for a scenario")
    .option("--json", "Output response as JSON")
    .action(async (scenarioId: string | undefined, opts: ScenarioCommandOptions) => {
      try {
        await runScenarioReset(scenarioId, opts);
      } catch (err) {
        handleCliError(err);
      }
    });

  return program;
}

