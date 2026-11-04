import { describe, it, expect } from "vitest";
import { Router } from "../../src/router/router.js";
import { matchRoute, normalizePath } from "../../src/router/route.js";
import { RouteError } from "../../src/core/errors.js";

describe("normalizePath", () => {
  it("preserves root path", () => {
    expect(normalizePath("/")).toBe("/");
  });

  it("strips trailing slash", () => {
    expect(normalizePath("/users/")).toBe("/users");
  });

  it("adds leading slash", () => {
    expect(normalizePath("users")).toBe("/users");
  });

  it("collapses multiple slashes", () => {
    expect(normalizePath("//users///list//")).toBe("/users/list");
  });
});

describe("matchRoute", () => {
  it("matches a static path", () => {
    const result = matchRoute("/users", "/users");
    expect(result).toEqual({ matched: true, params: {} });
  });

  it("matches a dynamic parameter", () => {
    const result = matchRoute("/users/:id", "/users/42");
    expect(result).toEqual({ matched: true, params: { id: "42" } });
  });

  it("matches multiple dynamic parameters", () => {
    const result = matchRoute(
      "/users/:userId/posts/:postId",
      "/users/1/posts/99",
    );
    expect(result).toEqual({
      matched: true,
      params: { userId: "1", postId: "99" },
    });
  });

  it("rejects paths with different segment counts", () => {
    const result = matchRoute("/users/:id", "/users/42/extra");
    expect(result.matched).toBe(false);
  });

  it("rejects non-matching static segments", () => {
    const result = matchRoute("/users", "/posts");
    expect(result.matched).toBe(false);
  });

  it("decodes URI-encoded parameters", () => {
    const result = matchRoute("/users/:name", "/users/hello%20world");
    expect(result).toEqual({
      matched: true,
      params: { name: "hello world" },
    });
  });

  it("returns no match for malformed URI encoding", () => {
    const result = matchRoute("/users/:name", "/users/%ZZ");
    expect(result.matched).toBe(false);
  });

  it("matches trailing slash consistently", () => {
    const result = matchRoute("/users", "/users/");
    expect(result).toEqual({ matched: true, params: {} });
  });
});

describe("Router", () => {
  it("registers and finds a GET route", () => {
    const router = new Router();
    const handler = () => ({ status: 200 });

    router.register("GET", "/test", handler);
    const result = router.find("GET", "/test");

    expect(result).toBeDefined();
    expect(result!.handler).toBe(handler);
  });

  it("registers and finds a POST route", () => {
    const router = new Router();
    const handler = () => ({ status: 201 });

    router.register("POST", "/items", handler);
    const result = router.find("POST", "/items");

    expect(result).toBeDefined();
    expect(result!.handler).toBe(handler);
  });

  it("extracts dynamic parameters", () => {
    const router = new Router();
    router.register("GET", "/users/:id", () => ({ status: 200 }));

    const result = router.find("GET", "/users/42");

    expect(result).toBeDefined();
    expect(result!.params).toEqual({ id: "42" });
  });

  it("throws RouteError on duplicate registration", () => {
    const router = new Router();
    router.register("GET", "/test", () => ({ status: 200 }));

    expect(() =>
      router.register("GET", "/test", () => ({ status: 200 })),
    ).toThrow(RouteError);
  });

  it("allows same path with different methods", () => {
    const router = new Router();
    router.register("GET", "/data", () => ({ status: 200 }));
    router.register("POST", "/data", () => ({ status: 201 }));

    expect(router.find("GET", "/data")).toBeDefined();
    expect(router.find("POST", "/data")).toBeDefined();
  });

  it("returns undefined for unknown routes", () => {
    const router = new Router();
    const result = router.find("GET", "/nope");
    expect(result).toBeUndefined();
  });

  it("returns undefined when method does not match", () => {
    const router = new Router();
    router.register("GET", "/test", () => ({ status: 200 }));

    expect(router.find("POST", "/test")).toBeUndefined();
  });

  it("handles encoded parameters", () => {
    const router = new Router();
    router.register("GET", "/files/:name", () => ({ status: 200 }));

    const result = router.find("GET", "/files/my%20file");
    expect(result).toBeDefined();
    expect(result!.params).toEqual({ name: "my file" });
  });

  it("handles trailing slashes consistently", () => {
    const router = new Router();
    router.register("GET", "/items/", () => ({ status: 200 }));

    // Path is normalised so "/items/" becomes "/items"
    expect(router.find("GET", "/items")).toBeDefined();
    expect(router.find("GET", "/items/")).toBeDefined();
  });

  it("detects duplicate with trailing slash variation", () => {
    const router = new Router();
    router.register("GET", "/items", () => ({ status: 200 }));

    expect(() =>
      router.register("GET", "/items/", () => ({ status: 200 })),
    ).toThrow(RouteError);
  });

  it("lists registered routes", () => {
    const router = new Router();
    router.register("GET", "/a", () => ({ status: 200 }));
    router.register("POST", "/b", () => ({ status: 201 }));

    const routes = router.getRoutes();
    expect(routes).toHaveLength(2);
    expect(routes[0]!.method).toBe("GET");
    expect(routes[1]!.method).toBe("POST");
  });
});
