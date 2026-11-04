import type { TestResponse } from "../types.js";

export class TestAssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TestAssertionError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Asserts that the response has the expected HTTP status code.
 */
export function expectStatus(response: TestResponse, expected: number): void {
  if (response.status !== expected) {
    throw new TestAssertionError(
      `Expected response status to be ${expected}, but received ${response.status}.\nBody: ${response.text}`,
    );
  }
}

/**
 * Asserts that the response is successful (2xx, 200–299).
 */
export function expectSuccessful(response: TestResponse): void {
  if (!response.ok) {
    throw new TestAssertionError(
      `Expected response to be successful (2xx), but received status ${response.status}.\nBody: ${response.text}`,
    );
  }
}

/**
 * Asserts that the response is a client error (4xx, 400–499).
 */
export function expectClientError(response: TestResponse): void {
  if (response.status < 400 || response.status >= 500) {
    throw new TestAssertionError(
      `Expected response to be a client error (4xx), but received status ${response.status}.`,
    );
  }
}

/**
 * Asserts that the response is a server error (5xx, 500–599).
 */
export function expectServerError(response: TestResponse): void {
  if (response.status < 500 || response.status >= 600) {
    throw new TestAssertionError(
      `Expected response to be a server error (5xx), but received status ${response.status}.`,
    );
  }
}
