/**
 * Default set of sensitive keys to redact from headers and request/response bodies.
 * Compared case-insensitively.
 */
export const DEFAULT_SENSITIVE_KEYS: ReadonlySet<string> = new Set([
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x_api_key",
  "api-key",
  "api_key",
  "apikey",
  "password",
  "secret",
  "token",
  "access_token",
  "access-token",
  "refresh_token",
  "refresh-token",
  "client_secret",
  "client-secret",
]);

export const REDACTED_PLACEHOLDER = "[REDACTED]";

/**
 * Build a lookup Set of lowercased sensitive keys combining defaults and custom keys.
 */
export function buildSensitiveKeySet(customKeys?: string[]): Set<string> {
  const set = new Set<string>(DEFAULT_SENSITIVE_KEYS);
  if (customKeys) {
    for (const key of customKeys) {
      if (typeof key === "string" && key.trim().length > 0) {
        set.add(key.trim().toLowerCase());
      }
    }
  }
  return set;
}

/**
 * Redact sensitive headers case-insensitively, returning a new safe record.
 * Does not mutate the source headers.
 */
export function redactHeaders(
  headers: Record<string, unknown> | undefined,
  sensitiveKeys: Set<string>,
): Record<string, unknown> {
  if (!headers || typeof headers !== "object") {
    return {};
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.has(lowerKey)) {
      result[key] = REDACTED_PLACEHOLDER;
    } else if (Array.isArray(value)) {
      result[key] = [...value];
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Deep-clone and redact sensitive keys from a JSON body or JavaScript object/array.
 * Does not mutate the input value.
 */
export function redactBodyValue(
  value: unknown,
  sensitiveKeys: Set<string>,
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  // Primitive types
  if (typeof value !== "object") {
    return value;
  }

  // Arrays
  if (Array.isArray(value)) {
    return value.map((item) => redactBodyValue(item, sensitiveKeys));
  }

  // Buffers or Uint8Array
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return `[Binary data: ${value.byteLength} bytes]`;
  }

  // Dates
  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  // Plain objects
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.has(lowerKey)) {
      result[key] = REDACTED_PLACEHOLDER;
    } else {
      result[key] = redactBodyValue(val, sensitiveKeys);
    }
  }

  return result;
}

/**
 * Safely format and redact a request or response body for inspection recording,
 * respecting capture enablement, size bounds, and non-JSON/binary data.
 */
export function sanitizeBody(
  body: unknown,
  options: {
    enabled: boolean;
    maxBodySize: number;
    sensitiveKeys: Set<string>;
  },
): unknown {
  if (!options.enabled || body === undefined) {
    return undefined;
  }

  if (body === null) {
    return null;
  }

  // Check if body is a Buffer
  if (Buffer.isBuffer(body)) {
    if (body.length > options.maxBodySize) {
      return `[Binary data: ${body.length} bytes (exceeds ${options.maxBodySize} bytes limit)]`;
    }
    return `[Binary data: ${body.length} bytes]`;
  }

  // If string, handle size and JSON parsing if applicable
  if (typeof body === "string") {
    if (Buffer.byteLength(body, "utf-8") > options.maxBodySize) {
      return `[Payload truncated: exceeds ${options.maxBodySize} bytes]`;
    }

    try {
      const parsed = JSON.parse(body);
      return redactBodyValue(parsed, options.sensitiveKeys);
    } catch {
      // Non-JSON string: check if any sensitive key appears in string or return as-is safely
      return body;
    }
  }

  // Standard objects/arrays
  return redactBodyValue(body, options.sensitiveKeys);
}

/**
 * Safely decodes a URI component, returning the raw string if decoding fails due to malformed encoding.
 */
function safeDecode(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

/**
 * Check whether a parameter key (even if URL-encoded or mixed-case) matches a sensitive key.
 * Only exact matches against the sensitive key set are matched to avoid false positives.
 */
function isSensitiveKey(key: string, sensitiveKeys: Set<string>): boolean {
  const decoded = safeDecode(key).trim().toLowerCase();
  if (sensitiveKeys.has(decoded)) return true;
  const normalized = decoded.replace(/-/g, "_");
  const hyphenated = decoded.replace(/_/g, "-");
  return sensitiveKeys.has(normalized) || sensitiveKeys.has(hyphenated);
}

/**
 * Redact sensitive query parameters, returning a new sanitized record.
 * Supports repeated parameters (arrays) and preserves non-sensitive parameters.
 * Does not mutate the source query object.
 */
export function redactQueryParams(
  query: Record<string, string | string[]> | undefined,
  sensitiveKeys: Set<string>,
): Record<string, string | string[]> {
  if (!query || typeof query !== "object") {
    return {};
  }

  const result: Record<string, string | string[]> = {};

  for (const [key, value] of Object.entries(query)) {
    if (isSensitiveKey(key, sensitiveKeys)) {
      if (Array.isArray(value)) {
        result[key] = value.map(() => REDACTED_PLACEHOLDER);
      } else {
        result[key] = REDACTED_PLACEHOLDER;
      }
    } else {
      if (Array.isArray(value)) {
        result[key] = [...value];
      } else {
        result[key] = value;
      }
    }
  }

  return result;
}

/**
 * Redact sensitive query parameters embedded in a URL string.
 * Preserves the base path, fragment hash, non-sensitive parameters, and parameter ordering.
 * Returns a new sanitized URL string.
 */
export function redactUrl(url: string, sensitiveKeys: Set<string>): string {
  if (!url || !url.includes("?")) {
    return url;
  }

  const qIndex = url.indexOf("?");
  const base = url.slice(0, qIndex);
  const rest = url.slice(qIndex + 1);

  // Preserve fragment hash if present
  const hashIndex = rest.indexOf("#");
  const queryPart = hashIndex !== -1 ? rest.slice(0, hashIndex) : rest;
  const hashPart = hashIndex !== -1 ? rest.slice(hashIndex) : "";

  if (queryPart.length === 0) {
    return url;
  }

  // Split pairs preserving ordering and repeated keys
  const pairs = queryPart.split("&");
  const sanitizedPairs = pairs.map((pair) => {
    if (!pair) return pair;
    const eqIndex = pair.indexOf("=");
    if (eqIndex === -1) {
      // Key with no value, e.g. "?flag"
      return isSensitiveKey(pair, sensitiveKeys) ? `${pair}=${REDACTED_PLACEHOLDER}` : pair;
    }
    const rawKey = pair.slice(0, eqIndex);
    if (isSensitiveKey(rawKey, sensitiveKeys)) {
      return `${rawKey}=${REDACTED_PLACEHOLDER}`;
    }
    return pair;
  });

  return `${base}?${sanitizedPairs.join("&")}${hashPart}`;
}

/**
 * Conservative regex patterns to sanitize common credentials from error messages.
 */
const SENSITIVE_ERROR_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // Bearer tokens: Bearer <token>
  {
    pattern: /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi,
    replacement: `Bearer ${REDACTED_PLACEHOLDER}`,
  },
  // Key-value assignments with '=': key=value
  {
    pattern: /\b(api[_-]?key|apikey|secret|token|password|client_secret)(\s*=\s*)['"]?([^\s,'"&;]+)['"]?/gi,
    replacement: `$1$2${REDACTED_PLACEHOLDER}`,
  },
  // Key-value assignments with ':' and quotes: key: 'value' or "key": "value"
  {
    pattern: /\b(api[_-]?key|apikey|secret|token|password|client_secret)(\s*:\s*)['"]([^'"]+)['"]/gi,
    replacement: `$1$2${REDACTED_PLACEHOLDER}`,
  },
  // Key-value assignments with ':' unquoted (restricted to unambiguous credential keys): api_key: value
  {
    pattern: /\b(api[_-]?key|apikey|client_secret)(\s*:\s*)([^\s,'"&;:=]+)/gi,
    replacement: `$1$2${REDACTED_PLACEHOLDER}`,
  },
  // Connection strings: protocol://user:password@host
  {
    pattern: /\b((?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp[s]?):\/\/[^:\s\/]+):([^@\s]+)@/gi,
    replacement: `$1:${REDACTED_PLACEHOLDER}@`,
  },
];

/**
 * Sanitize sensitive credentials from an error message while preserving diagnostic details.
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message || typeof message !== "string") {
    return message;
  }

  let sanitized = message;
  for (const { pattern, replacement } of SENSITIVE_ERROR_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  return sanitized;
}

/**
 * Sanitize an error details object for storage in RequestRecord.error.
 * Never modifies the source object.
 */
export function sanitizeErrorDetails(err?: {
  name: string;
  message: string;
  code?: string;
}): { name: string; message: string; code?: string } | undefined {
  if (!err) return undefined;
  return {
    name: err.name,
    message: sanitizeErrorMessage(err.message),
    code: err.code,
  };
}


