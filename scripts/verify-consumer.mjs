import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiremint-consumer-test-"));
const tgzPath = path.resolve("wiremint-0.1.0.tgz");

console.log("Consumer test directory:", tmpDir);
fs.writeFileSync(
  path.join(tmpDir, "package.json"),
  JSON.stringify(
    {
      name: "consumer-test",
      type: "module",
      dependencies: {},
    },
    null,
    2,
  ),
);

console.log("Installing packed tarball:", tgzPath);
execSync(`npm install "${tgzPath}"`, { cwd: tmpDir, stdio: "inherit" });

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
console.log('✔ TestResponse body:', res.body);
console.log('✔ All external consumer verification checks PASSED!');
`;

fs.writeFileSync(path.join(tmpDir, "index.mjs"), testScript);
execSync("node index.mjs", { cwd: tmpDir, stdio: "inherit" });

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log("Cleaned up temporary directory.");

