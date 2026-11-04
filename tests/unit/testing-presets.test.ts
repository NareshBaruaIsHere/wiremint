import { describe, expect, it } from "vitest";
import {
  created,
  emptyList,
  forbidden,
  noContent,
  notFound,
  ok,
  serverError,
  slow,
  unauthorized,
} from "../../src/testing/presets/index.js";

describe("Testing Presets", () => {
  it("ok preset returns 200 with JSON content-type", () => {
    const res = ok({ items: [1, 2, 3] });
    expect(res.status).toBe(200);
    expect(res.headers?.["Content-Type"]).toBe("application/json");
    expect(res.body).toEqual({ items: [1, 2, 3] });
  });

  it("created preset returns 201 with body", () => {
    const res = created({ id: 101 });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: 101 });
  });

  it("noContent preset returns 204", () => {
    const res = noContent();
    expect(res.status).toBe(204);
  });

  it("emptyList preset returns 200 with empty array", () => {
    const res = emptyList();
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("notFound preset returns 404 with error message", () => {
    const res = notFound("User missing");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "User missing" });
  });

  it("unauthorized and forbidden presets return 401 and 403", () => {
    expect(unauthorized().status).toBe(401);
    expect(forbidden().status).toBe(403);
  });

  it("serverError preset returns 500", () => {
    const res = serverError("Database down");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Database down" });
  });

  it("slow preset adds async delay to response", async () => {
    const handler = slow(30, ok({ delayed: true }));
    const startTime = Date.now();
    const res = await handler();
    const duration = Date.now() - startTime;

    expect(duration).toBeGreaterThanOrEqual(25);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ delayed: true });
  });
});

