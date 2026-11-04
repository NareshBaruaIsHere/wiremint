import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  lstatSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import type { RuntimeInfo } from "./types.js";

export const RUNTIME_DIR_NAME = ".wiremint";
export const RUNTIME_FILE_NAME = "runtime.json";

/**
 * Get the path to .wiremint/runtime.json for a given directory.
 */
export function getRuntimeFilePath(cwd: string = process.cwd()): string {
  return join(cwd, RUNTIME_DIR_NAME, RUNTIME_FILE_NAME);
}

/**
 * Checks whether an operating system process is still running.
 */
export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: unknown) {
    // ESRCH means process does not exist. EPERM means exists but cannot signal.
    const code = (err as { code?: string }).code;
    return code === "EPERM";
  }
}

/**
 * Writes runtime connection info to .wiremint/runtime.json.
 */
export function writeRuntimeInfo(
  info: RuntimeInfo,
  cwd: string = process.cwd(),
): string {
  const dirPath = join(cwd, RUNTIME_DIR_NAME);

  // Prevent writing through a symlinked runtime directory
  try {
    const dirStat = lstatSync(dirPath, { throwIfNoEntry: false });
    if (dirStat?.isSymbolicLink()) {
      rmSync(dirPath, { force: true });
    }
  } catch {
    // ignore
  }

  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true, mode: 0o700 });
  }

  const filePath = join(dirPath, RUNTIME_FILE_NAME);

  // Prevent overwriting through a symlinked runtime file
  try {
    const fileStat = lstatSync(filePath, { throwIfNoEntry: false });
    if (fileStat?.isSymbolicLink()) {
      unlinkSync(filePath);
    }
  } catch {
    // ignore
  }

  const data = JSON.stringify(info, null, 2);

  writeFileSync(filePath, data, { mode: 0o600 });
  return filePath;
}

/**
 * Reads and parses the runtime connection file if present.
 */
export function readRuntimeInfo(cwd: string = process.cwd()): RuntimeInfo | null {
  const filePath = getRuntimeFilePath(cwd);

  // Reject symlinks to prevent path traversal / arbitrary file reading
  try {
    const fileStat = lstatSync(filePath, { throwIfNoEntry: false });
    if (!fileStat || fileStat.isSymbolicLink()) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const raw = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<RuntimeInfo>;

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.pid === "number" &&
      typeof parsed.controlPort === "number" &&
      typeof parsed.token === "string"
    ) {
      // Validate controlHost: must be strictly loopback to prevent SSRF / token exfiltration
      const host =
        parsed.controlHost === "127.0.0.1" || parsed.controlHost === "localhost"
          ? parsed.controlHost
          : "127.0.0.1";

      return {
        ...parsed,
        controlHost: host,
      } as RuntimeInfo;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Removes the runtime file on server shutdown.
 */
export function cleanupRuntimeFile(cwd: string = process.cwd()): void {
  const filePath = getRuntimeFilePath(cwd);
  try {
    if (existsSync(filePath)) {
      rmSync(filePath, { force: true });
    }
  } catch {
    // Ignore cleanup errors during process exit
  }
}

