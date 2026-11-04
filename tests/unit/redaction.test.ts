import { describe, it, expect } from "vitest";
import {
  buildSensitiveKeySet,
  redactHeaders,
  redactBodyValue,
  sanitizeBody,
  redactQueryParams,
  redactUrl,
  sanitizeErrorMessage,
  sanitizeErrorDetails,
  REDACTED_PLACEHOLDER,
} from "../../src/inspector/redaction.js";

describe("Inspector Redaction", () => {
  const sensitiveKeys = buildSensitiveKeySet(["custom-token", "x-secret-flag"]);

  it("redacts sensitive headers case-insensitively without mutating input", () => {
    const rawHeaders = {
      Authorization: "Bearer top-secret-jwt",
      "x-api-key": "secret-12345",
      "Content-Type": "application/json",
      Cookie: "session_id=xyz987",
      "CUSTOM-TOKEN": "my-token",
    };

    const redacted = redactHeaders(rawHeaders, sensitiveKeys);

    expect(redacted["Authorization"]).toBe(REDACTED_PLACEHOLDER);
    expect(redacted["x-api-key"]).toBe(REDACTED_PLACEHOLDER);
    expect(redacted["Cookie"]).toBe(REDACTED_PLACEHOLDER);
    expect(redacted["CUSTOM-TOKEN"]).toBe(REDACTED_PLACEHOLDER);
    expect(redacted["Content-Type"]).toBe("application/json");

    // Verify input was not mutated
    expect(rawHeaders.Authorization).toBe("Bearer top-secret-jwt");
  });

  it("redacts nested sensitive properties in JSON objects and arrays", () => {
    const body = {
      user: {
        id: "u-123",
        username: "naresh",
        password: "SuperSecretPassword123!",
        tokens: {
          access_token: "jwt.access.123",
          refresh_token: "jwt.refresh.456",
        },
      },
      accounts: [
        { accountId: "acc-1", secret: "acc-secret-1" },
        { accountId: "acc-2", secret: "acc-secret-2" },
      ],
    };

    const redacted = redactBodyValue(body, sensitiveKeys) as any;

    expect(redacted.user.id).toBe("u-123");
    expect(redacted.user.username).toBe("naresh");
    expect(redacted.user.password).toBe(REDACTED_PLACEHOLDER);
    expect(redacted.user.tokens.access_token).toBe(REDACTED_PLACEHOLDER);
    expect(redacted.user.tokens.refresh_token).toBe(REDACTED_PLACEHOLDER);
    expect(redacted.accounts[0].secret).toBe(REDACTED_PLACEHOLDER);
    expect(redacted.accounts[1].secret).toBe(REDACTED_PLACEHOLDER);

    // Verify input was not mutated
    expect(body.user.password).toBe("SuperSecretPassword123!");
  });

  it("safely handles non-JSON, binary, and oversized payloads", () => {
    // 1. Disabled capture
    const disabled = sanitizeBody({ key: "val" }, {
      enabled: false,
      maxBodySize: 1000,
      sensitiveKeys,
    });
    expect(disabled).toBeUndefined();

    // 2. Buffer / binary data
    const buf = Buffer.from("hello world binary");
    const binaryRes = sanitizeBody(buf, {
      enabled: true,
      maxBodySize: 1000,
      sensitiveKeys,
    });
    expect(binaryRes).toBe("[Binary data: 18 bytes]");

    // 3. Oversized string payload
    const bigString = "x".repeat(200);
    const oversizedRes = sanitizeBody(bigString, {
      enabled: true,
      maxBodySize: 100,
      sensitiveKeys,
    });
    expect(oversizedRes).toMatch(/exceeds 100 bytes/i);

    // 4. Stringified JSON with sensitive keys
    const jsonString = JSON.stringify({ password: "abc", name: "test" });
    const parsedAndRedacted = sanitizeBody(jsonString, {
      enabled: true,
      maxBodySize: 1000,
      sensitiveKeys,
    }) as any;
    expect(parsedAndRedacted.password).toBe(REDACTED_PLACEHOLDER);
    expect(parsedAndRedacted.name).toBe("test");
  });

  describe("Query Parameter and URL Redaction", () => {
    it("redacts sensitive query parameter objects without mutating input", () => {
      const rawQuery: Record<string, string | string[]> = {
        access_token: "secret123",
        api_key: "secret123",
        Access_Token: "secret123",
        user_id: "42",
        token: ["first", "second"],
        "%61ccess_token": "secret123",
        token_count: "5",
        page: "1",
      };

      const redacted = redactQueryParams(rawQuery, sensitiveKeys);

      expect(redacted["access_token"]).toBe(REDACTED_PLACEHOLDER);
      expect(redacted["api_key"]).toBe(REDACTED_PLACEHOLDER);
      expect(redacted["Access_Token"]).toBe(REDACTED_PLACEHOLDER);
      expect(redacted["user_id"]).toBe("42");
      expect(redacted["token"]).toEqual([REDACTED_PLACEHOLDER, REDACTED_PLACEHOLDER]);
      expect(redacted["%61ccess_token"]).toBe(REDACTED_PLACEHOLDER);
      expect(redacted["token_count"]).toBe("5");
      expect(redacted["page"]).toBe("1");

      // Verify original object was not mutated
      expect(rawQuery["access_token"]).toBe("secret123");
      expect(rawQuery["token"]).toEqual(["first", "second"]);
    });

    it("redacts sensitive query parameters embedded in URL strings", () => {
      // 1. ?access_token=secret123
      expect(redactUrl("/api/items?access_token=secret123", sensitiveKeys)).toBe(
        "/api/items?access_token=[REDACTED]",
      );

      // 2. ?api_key=secret123
      expect(redactUrl("/api/items?api_key=secret123", sensitiveKeys)).toBe(
        "/api/items?api_key=[REDACTED]",
      );

      // 3. ?Access_Token=secret123 (mixed case)
      expect(redactUrl("/api/items?Access_Token=secret123", sensitiveKeys)).toBe(
        "/api/items?Access_Token=[REDACTED]",
      );

      // 4. ?user_id=42&token=secret123 (preserves non-sensitive parameter)
      expect(redactUrl("/api/items?user_id=42&token=secret123", sensitiveKeys)).toBe(
        "/api/items?user_id=42&token=[REDACTED]",
      );

      // 5. ?token=first&token=second (repeated query parameter)
      expect(redactUrl("/api/items?token=first&token=second", sensitiveKeys)).toBe(
        "/api/items?token=[REDACTED]&token=[REDACTED]",
      );

      // 6. ?%61ccess_token=secret123 (URL-encoded parameter name)
      expect(redactUrl("/api/items?%61ccess_token=secret123", sensitiveKeys)).toBe(
        "/api/items?%61ccess_token=[REDACTED]",
      );

      // 7. Substring safety: token_count is not redacted
      expect(redactUrl("/api/items?token_count=10&page=2", sensitiveKeys)).toBe(
        "/api/items?token_count=10&page=2",
      );

      // 8. URL without query parameters
      expect(redactUrl("/api/items", sensitiveKeys)).toBe("/api/items");

      // 9. URL with empty query
      expect(redactUrl("/api/items?", sensitiveKeys)).toBe("/api/items?");

      // 10. URL with fragment hash
      expect(redactUrl("/api/items?token=secret123#details", sensitiveKeys)).toBe(
        "/api/items?token=[REDACTED]#details",
      );

      // 11. Malformed URL encoding in query key does not crash
      expect(redactUrl("/api/items?%E0%A4%A=value", sensitiveKeys)).toBe(
        "/api/items?%E0%A4%A=value",
      );
    });
  });

  describe("Error Message Sanitization", () => {
    it("sanitizes Bearer tokens from error messages", () => {
      const msg = "Auth failed: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz";
      expect(sanitizeErrorMessage(msg)).toBe("Auth failed: Bearer [REDACTED]");
    });

    it("sanitizes api_key and password assignments from error messages", () => {
      const msg1 = "Database failed with api_key=secret-key-12345 in query";
      expect(sanitizeErrorMessage(msg1)).toBe(
        "Database failed with api_key=[REDACTED] in query",
      );

      const msg2 = "Authentication failed: password: 'my-super-secret-pwd'";
      expect(sanitizeErrorMessage(msg2)).toBe(
        "Authentication failed: password: [REDACTED]",
      );
    });

    it("sanitizes credentials from database connection strings", () => {
      const msg = "Failed to connect to postgres://app_user:mypassword999@localhost:5432/mydb";
      expect(sanitizeErrorMessage(msg)).toBe(
        "Failed to connect to postgres://app_user:[REDACTED]@localhost:5432/mydb",
      );
    });

    it("preserves useful diagnostic information for ordinary error messages without credentials", () => {
      const ordinaryMsg = "connect ECONNREFUSED 127.0.0.1:5432";
      expect(sanitizeErrorMessage(ordinaryMsg)).toBe(ordinaryMsg);

      const notFoundMsg = 'User with ID "u-123" not found in collection';
      expect(sanitizeErrorMessage(notFoundMsg)).toBe(notFoundMsg);
    });

    it("sanitizes error details without mutating source error object", () => {
      const originalErr = {
        name: "DatabaseAuthError",
        message: "Invalid token: token=secret-xyz987",
        code: "ERR_DB_AUTH",
      };

      const sanitized = sanitizeErrorDetails(originalErr);
      expect(sanitized?.name).toBe("DatabaseAuthError");
      expect(sanitized?.code).toBe("ERR_DB_AUTH");
      expect(sanitized?.message).toBe("Invalid token: token=[REDACTED]");

      // Original remains unchanged
      expect(originalErr.message).toBe("Invalid token: token=secret-xyz987");
    });

    it("safely handles circular references in object bodies without stack overflow", () => {
      const circularObj: any = {
        name: "Test Entity",
        password: "secret-value",
      };
      circularObj.self = circularObj;
      circularObj.nested = { parent: circularObj };

      const sanitized = redactBodyValue(circularObj, sensitiveKeys) as any;
      expect(sanitized.name).toBe("Test Entity");
      expect(sanitized.password).toBe(REDACTED_PLACEHOLDER);
      expect(sanitized.self).toBe("[Circular]");
      expect(sanitized.nested.parent).toBe("[Circular]");
    });
  });
});

