import type { TestResponse } from "../types.js";
import { TestAssertionError } from "./status.js";

/**
 * Checks if target deep-contains the subset.
 */
function isSubset(target: unknown, subset: unknown): boolean {
  if (target === subset) return true;
  if (target === null || typeof target !== "object") return false;
  if (subset === null || typeof subset !== "object") return false;

  if (Array.isArray(subset)) {
    if (!Array.isArray(target)) return false;
    if (subset.length !== target.length) return false;
    return subset.every((subItem, index) => isSubset(target[index], subItem));
  }

  const targetObj = target as Record<string, unknown>;
  const subsetObj = subset as Record<string, unknown>;

  for (const [key, value] of Object.entries(subsetObj)) {
    if (!(key in targetObj)) return false;
    if (!isSubset(targetObj[key], value)) return false;
  }

  return true;
}

/**
 * Asserts that the response body is JSON, and optionally matches expected subset or shape.
 */
export function expectJson(response: TestResponse, expectedSubset?: unknown): void {
  const contentType = response.headers["content-type"];
  const isJsonHeader =
    typeof contentType === "string" &&
    (contentType.toLowerCase().includes("application/json") ||
      contentType.toLowerCase().includes("+json"));

  if (!isJsonHeader && (typeof response.body !== "object" || response.body === null)) {
    throw new TestAssertionError(
      `Expected response body to be JSON, but received Content-Type "${contentType}" with body: ${response.text}`,
    );
  }

  if (expectedSubset !== undefined) {
    if (!isSubset(response.body, expectedSubset)) {
      throw new TestAssertionError(
        `Expected response JSON to contain:\n${JSON.stringify(expectedSubset, null, 2)}\n\nReceived:\n${JSON.stringify(response.body, null, 2)}`,
      );
    }
  }
}

/**
 * Asserts exact or deep equality of the response body.
 */
export function expectBody(response: TestResponse, expectedBody: unknown): void {
  const actualStr = JSON.stringify(response.body);
  const expectedStr = JSON.stringify(expectedBody);

  if (actualStr !== expectedStr) {
    throw new TestAssertionError(
      `Response body mismatch.\nExpected:\n${expectedStr}\nReceived:\n${actualStr}`,
    );
  }
}

/**
 * Asserts that the response raw text matches a string or regular expression.
 */
export function expectText(response: TestResponse, expected: string | RegExp): void {
  if (expected instanceof RegExp) {
    if (!expected.test(response.text)) {
      throw new TestAssertionError(
        `Expected response text to match ${expected}, but received: "${response.text}".`,
      );
    }
  } else if (!response.text.includes(expected)) {
    throw new TestAssertionError(
      `Expected response text to contain "${expected}", but received: "${response.text}".`,
    );
  }
}

/**
 * Asserts that the response is an error response matching status and optional error message.
 */
export function expectError(
  response: TestResponse,
  expectedStatus?: number,
  expectedMessage?: string | RegExp,
): void {
  if (response.ok) {
    throw new TestAssertionError(
      `Expected response to be an error, but received successful status ${response.status}.`,
    );
  }

  if (expectedStatus !== undefined && response.status !== expectedStatus) {
    throw new TestAssertionError(
      `Expected error status to be ${expectedStatus}, but received ${response.status}.\nBody: ${response.text}`,
    );
  }

  if (expectedMessage !== undefined) {
    const bodyObj = response.body as { error?: string; message?: string } | undefined;
    const msg = bodyObj?.error ?? bodyObj?.message ?? response.text;

    if (expectedMessage instanceof RegExp) {
      if (!expectedMessage.test(msg)) {
        throw new TestAssertionError(
          `Expected error message to match ${expectedMessage}, but received "${msg}".`,
        );
      }
    } else if (!msg.includes(expectedMessage)) {
      throw new TestAssertionError(
        `Expected error message to contain "${expectedMessage}", but received "${msg}".`,
      );
    }
  }
}

