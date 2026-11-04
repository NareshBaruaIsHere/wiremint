import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync, spawn } from "node:child_process";

const rootDir = process.cwd();
const tgzPath = path.resolve(rootDir, "wiremint-0.1.0.tgz");

// Ensure tarball exists
if (!fs.existsSync(tgzPath)) {
  console.log("Packaging tarball with pnpm pack...");
  execSync("pnpm pack", { cwd: rootDir, stdio: "inherit" });
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiremint-consumer-test-"));
console.log("Consumer test directory:", tmpDir);

try {
  fs.writeFileSync(
    path.join(tmpDir, "package.json"),
    JSON.stringify(
      {
        name: "consumer-e2e-test",
        type: "module",
        dependencies: {},
      },
      null,
      2,
    ),
  );

  console.log("Installing packed tarball:", tgzPath);
  execSync(`npm install "${tgzPath}"`, { cwd: tmpDir, stdio: "inherit" });

  const cliBin = path.join(tmpDir, "node_modules", "wiremint", "dist", "cli", "index.js");

  // 1. Test SDK, Config, Testing & Vitest matchers imports
  console.log("\n--- Testing SDK, Config, Testing, and Vitest Matchers ---");
  const testScript = `
import { createWiremint } from 'wiremint';
import { defineConfig } from 'wiremint/config';
import { createWiremintTestClient, expectStatus, expectJson, presets } from 'wiremint/testing';
import { wiremintMatchers } from 'wiremint/testing/vitest';

console.log('✔ Successfully imported wiremint, wiremint/config, wiremint/testing, wiremint/testing/vitest');

const app = createWiremint();
app.get('/consumer-test', () => presets.ok({ status: 'verified', source: 'tarball' }));

const client = createWiremintTestClient(app);
const res = await client.get('/consumer-test');

expectStatus(res, 200);
expectJson(res, { status: 'verified', source: 'tarball' });

const matcherRes = wiremintMatchers.toHaveStatus(res, 200);
if (!matcherRes.pass) {
  throw new Error('Matcher failed!');
}

console.log('✔ In-process test executed with zero network ports!');
console.log('✔ TestResponse status:', res.status);
console.log('✔ TestResponse body:', JSON.stringify(res.body));
`;
  fs.writeFileSync(path.join(tmpDir, "sdk-test.mjs"), testScript);
  execSync("node sdk-test.mjs", { cwd: tmpDir, stdio: "inherit" });

  // 2. Test CLI init command
  console.log("\n--- Testing CLI Initialization ---");
  const initDir = fs.mkdtempSync(path.join(tmpDir, "init-project-"));
  execSync(`node "${cliBin}" init --format json`, { cwd: initDir, stdio: "inherit" });
  if (!fs.existsSync(path.join(initDir, "wiremint.config.json"))) {
    throw new Error("CLI init failed: wiremint.config.json not generated");
  }
  console.log("✔ CLI init successfully generated wiremint.config.json");

  // 3. Configure mock API for CLI dev server testing
  const serverPort = 39480 + Math.floor(Math.random() * 200);
  const config = {
    server: { port: serverPort },
    scenarios: [
      { id: "beta", name: "Beta Scenario" },
    ],
    routes: [
      {
        method: "GET",
        path: "/api/users",
        response: { status: 200, body: [{ id: 1, name: "Alice" }] },
        scenarios: {
          beta: { status: 200, body: [{ id: 99, name: "Beta Alice" }] },
        },
      },
    ],
  };
  fs.writeFileSync(path.join(tmpDir, "wiremint.config.json"), JSON.stringify(config, null, 2));

  // 4. Test CLI routes command
  console.log("\n--- Testing CLI Route Listing ---");
  const routesOutput = execSync(`node "${cliBin}" routes --json`, { cwd: tmpDir, encoding: "utf-8" });
  const parsedRoutes = JSON.parse(routesOutput);
  if (!Array.isArray(parsedRoutes) || parsedRoutes.length === 0 || parsedRoutes[0].path !== "/api/users") {
    throw new Error(`CLI routes output unexpected: ${routesOutput}`);
  }
  console.log("✔ CLI routes listed configured routes correctly");

  // 5. Test CLI development server & control plane
  console.log("\n--- Testing CLI Development Server & Live Control Plane ---");
  const devProcess = spawn("node", [cliBin, "dev", "--port", String(serverPort)], {
    cwd: tmpDir,
    stdio: ["pipe", "pipe", "pipe"],
  });

  let serverStarted = false;
  const runtimePath = path.join(tmpDir, ".wiremint", "runtime.json");

  // Wait up to 10 seconds for dev server to write runtime.json and be ready
  const startTime = Date.now();
  while (Date.now() - startTime < 10000) {
    if (fs.existsSync(runtimePath)) {
      try {
        const info = JSON.parse(fs.readFileSync(runtimePath, "utf-8"));
        if (info && info.controlPort && info.token) {
          serverStarted = true;
          break;
        }
      } catch {
        // file being written, wait
      }
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  if (!serverStarted) {
    devProcess.kill();
    throw new Error("Dev server did not start within 10 seconds");
  }
  console.log("✔ Dev server and authenticated control plane running");

  // 6. Send live HTTP request to dev server
  const initialRes = await fetch(`http://127.0.0.1:${serverPort}/api/users`);
  const initialBody = await initialRes.json();
  if (initialRes.status !== 200 || initialBody[0]?.name !== "Alice") {
    throw new Error(`Unexpected response from live dev server: ${JSON.stringify(initialBody)}`);
  }
  console.log("✔ Live HTTP request succeeded: 200 OK ->", JSON.stringify(initialBody));

  // 7. Test CLI request inspection
  const inspectOutput = execSync(`node "${cliBin}" inspect --json`, { cwd: tmpDir, encoding: "utf-8" });
  const parsedInspect = JSON.parse(inspectOutput);
  if (parsedInspect.total < 1 || parsedInspect.requests[0]?.path !== "/api/users") {
    throw new Error(`Unexpected inspect output: ${inspectOutput}`);
  }
  console.log("✔ CLI inspect retrieved live captured request history (total:", parsedInspect.total, ")");

  // 8. Test live scenario switching via CLI
  execSync(`node "${cliBin}" scenario set beta`, { cwd: tmpDir, stdio: "inherit" });
  const scenarioRes = await fetch(`http://127.0.0.1:${serverPort}/api/users`);
  const scenarioBody = await scenarioRes.json();
  if (scenarioRes.status !== 200 || scenarioBody[0]?.name !== "Beta Alice") {
    throw new Error(`Scenario switch failed: expected Beta Alice, received ${JSON.stringify(scenarioBody)}`);
  }
  console.log("✔ Live scenario switch verified: response updated to Beta Alice");

  // 9. Test graceful shutdown
  console.log("\n--- Testing Graceful Server Shutdown ---");
  const exitPromise = new Promise((resolve) => {
    devProcess.on("exit", () => resolve(true));
  });

  devProcess.kill("SIGTERM");
  await Promise.race([
    exitPromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Shutdown timed out")), 5000)),
  ]);

  if (fs.existsSync(runtimePath)) {
    console.log("Cleaning up remaining runtime file if any...");
    fs.rmSync(runtimePath, { force: true });
  }
  console.log("✔ Dev server shut down cleanly");

  console.log("\n=======================================================");
  console.log("✔ ALL REAL CONSUMER VALIDATION TESTS PASSED!");
  console.log("=======================================================");
} finally {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.log("Cleaned up temporary consumer test directory.");
  } catch {
    // Ignore cleanup errors
  }
}
