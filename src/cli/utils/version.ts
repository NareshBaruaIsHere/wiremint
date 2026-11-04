import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

let cachedVersion: string | null = null;

/**
 * Reads the package version dynamically from package.json without hardcoding.
 */
export function getPackageVersion(): string {
  if (cachedVersion) {
    return cachedVersion;
  }

  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    // Traverse upwards to locate package.json from either src/cli/utils or dist/cli/utils
    let current = __dirname;
    for (let i = 0; i < 5; i++) {
      const candidate = join(current, "package.json");
      try {
        const raw = readFileSync(candidate, "utf-8");
        const parsed = JSON.parse(raw) as { version?: string };
        if (parsed.version) {
          cachedVersion = parsed.version;
          return cachedVersion;
        }
      } catch {
        current = dirname(current);
      }
    }
  } catch {
    // fallback
  }

  cachedVersion = "0.1.0";
  return cachedVersion;
}

