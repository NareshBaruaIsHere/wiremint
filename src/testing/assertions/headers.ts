import type { TestResponse } from "../types.js";
import { TestAssertionError } from "./status.js";

/**
 * Asserts that the response contains the given header, optionally matching expected value.
 */
export function expectHeader(
  response: TestResponse,
  name: string,
  expected?: string | RegExp,
): void {
  const normalized = name.toLowerCase();
  const value = response.headers[normalized];

  if (value === undefined) {
    throw new TestAssertionError(
      `Expected response to contain header "${name}", but it was missing.\nAvailable headers: ${Object.keys(response.headers).join(", ")}`,
    );
  }

  if (expected !== undefined) {
    const stringVal = Array.isArray(value) ? value.join(", ") : String(value);
    if (expected instanceof RegExp) {
      if (!expected.test(stringVal)) {
        throw new TestAssertionError(
          `Expected header "${name}" to match ${expected}, but received "${stringVal}".`,
        );
      }
    } else if (stringVal.toLowerCase() !== expected.toLowerCase()) {
      throw new TestAssertionError(
        `Expected header "${name}" to be "${expected}", but received "${stringVal}".`,
      );
    }
  }
}

/**
 * Asserts that the response does not contain the specified header.
 */
export function expectHeaderMissing(response: TestResponse, name: string): void {
  const normalized = name.toLowerCase();
  const value = response.headers[normalized];

  if (value !== undefined) {
    throw new TestAssertionError(
      `Expected response to NOT contain header "${name}", but received "${Array.isArray(value) ? value.join(", ") : value}".`,
    );
  }
}

