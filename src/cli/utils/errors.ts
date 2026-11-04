import pc from "picocolors";

export function handleCliError(err: unknown, debug = false): void {
  const isDebug = debug || process.env.WIREMINT_DEBUG === "1" || process.env.WIREMINT_DEBUG === "true";

  if (err instanceof Error) {
    console.error(pc.red(pc.bold("\nError: ") + err.message));
    if (isDebug && err.stack) {
      console.error(pc.gray(err.stack));
    }
  } else {
    console.error(pc.red(pc.bold("\nError: ") + String(err)));
  }

  process.exit(1);
}

