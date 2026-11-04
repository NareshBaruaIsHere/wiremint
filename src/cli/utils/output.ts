import pc from "picocolors";
import { getPackageVersion } from "./version.js";

export function formatBanner(): string {
  const version = getPackageVersion();
  return `${pc.bold(pc.cyan("Wiremint"))} ${pc.gray(`v${version}`)} — ${pc.dim("Build without waiting for your backend.")}`;
}

export function formatMethod(method: string): string {
  const m = method.toUpperCase().padEnd(7, " ");
  switch (method.toUpperCase()) {
    case "GET":
      return pc.cyan(pc.bold(m));
    case "POST":
      return pc.green(pc.bold(m));
    case "PUT":
      return pc.yellow(pc.bold(m));
    case "PATCH":
      return pc.magenta(pc.bold(m));
    case "DELETE":
      return pc.red(pc.bold(m));
    case "OPTIONS":
      return pc.gray(pc.bold(m));
    default:
      return pc.white(pc.bold(m));
  }
}

export function formatStatusCode(status: number): string {
  const str = String(status).padStart(3, " ");
  if (status >= 200 && status < 300) {
    return pc.green(str);
  }
  if (status >= 300 && status < 400) {
    return pc.cyan(str);
  }
  if (status >= 400 && status < 500) {
    return pc.yellow(str);
  }
  return pc.red(pc.bold(str));
}

export function formatDuration(ms: number): string {
  const formatted = `${Math.round(ms)}ms`.padStart(6, " ");
  if (ms > 1000) return pc.red(formatted);
  if (ms > 300) return pc.yellow(formatted);
  return pc.gray(formatted);
}

export function formatBadge(status: "PASS" | "WARN" | "FAIL"): string {
  switch (status) {
    case "PASS":
      return pc.green(pc.bold("[PASS]"));
    case "WARN":
      return pc.yellow(pc.bold("[WARN]"));
    case "FAIL":
      return pc.red(pc.bold("[FAIL]"));
  }
}

