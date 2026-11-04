import { describe, expect, it } from "vitest";
import { createCliProgram } from "../../src/cli/program.js";
import { getPackageVersion } from "../../src/cli/utils/version.js";

describe("CLI Program Registration", () => {
  it("registers all expected commands and options", () => {
    const program = createCliProgram();

    const commandNames = program.commands.map((c) => c.name());
    expect(commandNames).toContain("init");
    expect(commandNames).toContain("dev");
    expect(commandNames).toContain("routes");
    expect(commandNames).toContain("doctor");
    expect(commandNames).toContain("inspect");
    expect(commandNames).toContain("scenario");
  });

  it("registers scenario subcommands", () => {
    const program = createCliProgram();
    const scenarioCmd = program.commands.find((c) => c.name() === "scenario");
    expect(scenarioCmd).toBeDefined();

    const subcommands = scenarioCmd?.commands.map((c) => c.name()) ?? [];
    expect(subcommands).toContain("list");
    expect(subcommands).toContain("show");
    expect(subcommands).toContain("set");
    expect(subcommands).toContain("reset");
  });

  it("reports package version correctly", () => {
    const program = createCliProgram();
    const expected = getPackageVersion();
    expect(program.version()).toBe(expected);
  });
});

