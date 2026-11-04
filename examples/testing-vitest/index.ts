import { createWiremint } from "../../src/index.js";
import { createWiremintTestClient } from "../../src/testing/index.js";
import { wiremintMatchers } from "../../src/testing/vitest/index.js";

/**
 * Example demonstrating how to use Wiremint with Vitest.
 *
 * To register the custom matchers in your Vitest test setup file (e.g. vitest.setup.ts):
 *
 * ```ts
 * import { expect } from "vitest";
 * import { wiremintMatchers } from "wiremint/testing/vitest";
 *
 * expect.extend(wiremintMatchers);
 * ```
 *
 * In your test files:
 *
 * ```ts
 * const client = createWiremintTestClient(app);
 * const res = await client.get("/api/users");
 *
 * expect(res).toHaveStatus(200);
 * expect(res).toBeSuccessful();
 * expect(res).toHaveHeader("content-type", "application/json");
 * expect(res).toMatchJson([{ id: 1, name: "Alice" }]);
 * ```
 */

console.log("Wiremint Vitest Matchers Example");
console.log("Registered matchers available:", Object.keys(wiremintMatchers).join(", "));

// Demonstration with an in-process client
const app = createWiremint();
app.get("/health", () => ({ status: 200, body: { status: "ok" } }));

const client = createWiremintTestClient(app);
const res = await client.get("/health");

// Manually invoking the matcher function to illustrate its output
const statusCheck = wiremintMatchers.toHaveStatus(res, 200);
console.log("✔ toHaveStatus(200) result:", statusCheck.pass, "-", statusCheck.message());

const jsonCheck = wiremintMatchers.toMatchJson(res, { status: "ok" });
console.log("✔ toMatchJson result:", jsonCheck.pass, "-", jsonCheck.message());

