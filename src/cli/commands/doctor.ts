import pc from "picocolors";
import { existsSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";
import { findConfigFile } from "../../config/config-discovery.js";
import { loadConfigFile } from "../../config/config-loader.js";
import { validateConfig } from "../../config/validate-config.js";
import { isPortAvailable } from "../utils/ports.js";
import { formatBadge, formatBanner } from "../utils/output.js";
import { getPackageVersion } from "../utils/version.js";

export interface DoctorOptions {
  cwd?: string;
}

interface CheckResult {
  title: string;
  status: "PASS" | "WARN" | "FAIL";
  message: string;
  detail?: string;
}

export async function runDoctor(options: DoctorOptions = {}): Promise<boolean> {
  const cwd = options.cwd ?? process.cwd();
  console.log(formatBanner() + "\n");
  console.log(pc.bold("Running Wiremint environment & configuration health checks...\n"));

  const results: CheckResult[] = [];

  // Check 1: Node.js version
  const nodeVersion = process.versions.node;
  const major = parseInt(nodeVersion.split(".")[0] ?? "0", 10);
  if (major >= 22) {
    results.push({
      title: "Node.js Version",
      status: "PASS",
      message: `v${nodeVersion} (compatible with required >=22.0.0)`,
    });
  } else {
    results.push({
      title: "Node.js Version",
      status: "FAIL",
      message: `v${nodeVersion} is unsupported. Wiremint requires Node.js >= 22.0.0.`,
    });
  }

  // Check 2: Package version
  const version = getPackageVersion();
  results.push({
    title: "Wiremint Package Version",
    status: "PASS",
    message: `v${version}`,
  });

  // Check 3: Configuration discovery & ambiguity
  let configPath: string | null = null;
  try {
    configPath = findConfigFile(cwd);
    if (configPath) {
      results.push({
        title: "Configuration File Discovery",
        status: "PASS",
        message: `Found "${basename(configPath)}"`,
      });
    } else {
      results.push({
        title: "Configuration File Discovery",
        status: "WARN",
        message: "No configuration file found in current directory.",
        detail: "Run 'wiremint init' to generate a wiremint.config.ts file.",
      });
    }
  } catch (err) {
    results.push({
      title: "Configuration File Discovery",
      status: "FAIL",
      message: "Ambiguous configuration files detected.",
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  // Check 4: Configuration validity & port availability
  if (configPath) {
    try {
      const rawConfig = await loadConfigFile(configPath);
      const validation = validateConfig(rawConfig);
      if (validation.success) {
        results.push({
          title: "Configuration Schema Validation",
          status: "PASS",
          message: "Configuration matches schema cleanly.",
        });

        // Port check
        const port = rawConfig.server?.port ?? 3001;
        const host = rawConfig.server?.host ?? "127.0.0.1";
        const available = await isPortAvailable(port, host);
        if (available) {
          results.push({
            title: `Port Availability (${host}:${port})`,
            status: "PASS",
            message: `Port ${port} is available to bind.`,
          });
        } else {
          results.push({
            title: `Port Availability (${host}:${port})`,
            status: "WARN",
            message: `Port ${port} is currently in use by another process.`,
            detail: "Stop the existing process or specify a different port with --port.",
          });
        }
      } else {
        results.push({
          title: "Configuration Schema Validation",
          status: "FAIL",
          message: "Configuration schema errors detected.",
          detail: validation.errors?.map((e) => `  - ${e.path}: ${e.message}`).join("\n"),
        });
      }
    } catch (err) {
      results.push({
        title: "Configuration File Syntax",
        status: "FAIL",
        message: "Failed to read or parse configuration file.",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Check 5: Project Structure / package.json
  const pkgPath = join(cwd, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const rawPkg = readFileSync(pkgPath, "utf-8");
      const parsedPkg = JSON.parse(rawPkg) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
      const hasWiremint =
        parsedPkg.dependencies?.wiremint !== undefined ||
        parsedPkg.devDependencies?.wiremint !== undefined;

      results.push({
        title: "Project package.json",
        status: "PASS",
        message: hasWiremint
          ? "Wiremint is declared in project dependencies."
          : "package.json detected.",
      });
    } catch {
      results.push({
        title: "Project package.json",
        status: "WARN",
        message: "package.json exists but could not be parsed.",
      });
    }
  } else {
    results.push({
      title: "Project package.json",
      status: "WARN",
      message: "No package.json detected in the current working directory.",
    });
  }

  // Print results
  let hasFailures = false;
  for (const r of results) {
    const badge = formatBadge(r.status);
    console.log(`  ${badge}  ${pc.bold(r.title)}: ${r.message}`);
    if (r.detail) {
      console.log(pc.gray(`           ${r.detail}`));
    }
    if (r.status === "FAIL") {
      hasFailures = true;
    }
  }

  console.log("\n" + pc.gray("─".repeat(70)));
  if (hasFailures) {
    console.log(pc.red(pc.bold("\nDoctor check completed with errors. Please address failures above.\n")));
    return false;
  } else {
    console.log(pc.green(pc.bold("\nDoctor check passed successfully! All systems operational.\n")));
    return true;
  }
}

