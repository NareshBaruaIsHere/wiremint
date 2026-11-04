import type { TestResponse } from "../types.js";

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

export interface MatcherResult {
  pass: boolean;
  message: () => string;
  actual?: unknown;
  expected?: unknown;
}

/**
 * Custom Vitest matchers for Wiremint test responses.
 */
export const wiremintMatchers = {
  toHaveStatus(received: TestResponse, expected: number): MatcherResult {
    const pass = received.status === expected;
    return {
      pass,
      actual: received.status,
      expected,
      message: () =>
        pass
          ? `Expected response status NOT to be ${expected}, but it was.`
          : `Expected response status to be ${expected}, but received ${received.status}.\nBody: ${received.text}`,
    };
  },

  toBeSuccessful(received: TestResponse): MatcherResult {
    const pass = received.ok;
    return {
      pass,
      actual: received.status,
      message: () =>
        pass
          ? `Expected response NOT to be successful (2xx), but received status ${received.status}.`
          : `Expected response to be successful (2xx), but received status ${received.status}.\nBody: ${received.text}`,
    };
  },

  toBeClientError(received: TestResponse): MatcherResult {
    const pass = received.status >= 400 && received.status < 500;
    return {
      pass,
      actual: received.status,
      message: () =>
        pass
          ? `Expected response NOT to be client error (4xx), but received status ${received.status}.`
          : `Expected response to be client error (4xx), but received status ${received.status}.\nBody: ${received.text}`,
    };
  },

  toBeServerError(received: TestResponse): MatcherResult {
    const pass = received.status >= 500 && received.status < 600;
    return {
      pass,
      actual: received.status,
      message: () =>
        pass
          ? `Expected response NOT to be server error (5xx), but received status ${received.status}.`
          : `Expected response to be server error (5xx), but received status ${received.status}.\nBody: ${received.text}`,
    };
  },

  toHaveHeader(received: TestResponse, name: string, expected?: string | RegExp): MatcherResult {
    const normalized = name.toLowerCase();
    const val = received.headers[normalized];
    const exists = val !== undefined;

    if (!exists) {
      return {
        pass: false,
        message: () => `Expected response to contain header "${name}", but it was not found.`,
      };
    }

    if (expected === undefined) {
      return {
        pass: true,
        message: () => `Expected response NOT to contain header "${name}", but it was found.`,
      };
    }

    const strVal = Array.isArray(val) ? val.join(", ") : String(val);
    const pass =
      expected instanceof RegExp
        ? expected.test(strVal)
        : strVal.toLowerCase() === expected.toLowerCase();

    return {
      pass,
      actual: strVal,
      expected,
      message: () =>
        pass
          ? `Expected header "${name}" NOT to match ${expected}, but it did.`
          : `Expected header "${name}" to match ${expected}, but received "${strVal}".`,
    };
  },

  toHaveJson(received: TestResponse, expectedSubset?: unknown): MatcherResult {
    const contentType = received.headers["content-type"];
    const isJsonHeader =
      typeof contentType === "string" && contentType.toLowerCase().includes("application/json");

    if (!isJsonHeader && (typeof received.body !== "object" || received.body === null)) {
      return {
        pass: false,
        message: () =>
          `Expected response to be JSON, but received Content-Type "${contentType}" with body: ${received.text}`,
      };
    }

    if (expectedSubset === undefined) {
      return {
        pass: true,
        message: () => `Expected response NOT to be JSON, but it was.`,
      };
    }

    const pass = isSubset(received.body, expectedSubset);
    return {
      pass,
      actual: received.body,
      expected: expectedSubset,
      message: () =>
        pass
          ? `Expected response JSON NOT to contain subset:\n${JSON.stringify(expectedSubset, null, 2)}`
          : `Expected response JSON to contain:\n${JSON.stringify(expectedSubset, null, 2)}\n\nReceived:\n${JSON.stringify(received.body, null, 2)}`,
    };
  },

  toHaveBody(received: TestResponse, expectedBody: unknown): MatcherResult {
    const actualStr = JSON.stringify(received.body);
    const expectedStr = JSON.stringify(expectedBody);
    const pass = actualStr === expectedStr;

    return {
      pass,
      actual: received.body,
      expected: expectedBody,
      message: () =>
        pass
          ? `Expected response body NOT to equal:\n${expectedStr}`
          : `Response body mismatch.\nExpected:\n${expectedStr}\nReceived:\n${actualStr}`,
    };
  },

  toMatchJson(received: TestResponse, expectedSubset?: unknown): MatcherResult {
    return wiremintMatchers.toHaveJson(received, expectedSubset);
  },
};

/**
 * TypeScript declaration augmentation for Vitest.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Vi {
    interface Assertion {
      toHaveStatus(expected: number): void;
      toBeSuccessful(): void;
      toBeClientError(): void;
      toBeServerError(): void;
      toHaveHeader(name: string, expected?: string | RegExp): void;
      toHaveJson(expectedSubset?: unknown): void;
      toMatchJson(expectedSubset?: unknown): void;
      toHaveBody(expectedBody: unknown): void;
    }
    interface AsymmetricMatchersContaining {
      toHaveStatus(expected: number): void;
      toBeSuccessful(): void;
      toBeClientError(): void;
      toBeServerError(): void;
      toHaveHeader(name: string, expected?: string | RegExp): void;
      toHaveJson(expectedSubset?: unknown): void;
      toMatchJson(expectedSubset?: unknown): void;
      toHaveBody(expectedBody: unknown): void;
    }
  }
}
