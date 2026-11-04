import type { Middleware, MiddlewareRegistration } from "./types.js";

/**
 * Normalizes a path prefix for middleware scoping.
 */
function normalizePrefix(prefix: string): string {
  let cleaned = prefix.trim();
  if (!cleaned.startsWith("/")) {
    cleaned = `/${cleaned}`;
  }
  // Strip trailing slashes unless it's root "/"
  if (cleaned.length > 1 && cleaned.endsWith("/")) {
    cleaned = cleaned.slice(0, -1);
  }
  return cleaned;
}

/**
 * Check if a registered path prefix matches the incoming request path.
 */
export function matchesMiddlewarePath(prefix: string | undefined, requestPath: string): boolean {
  if (!prefix || prefix === "/") {
    return true;
  }
  const normalized = normalizePrefix(prefix);
  if (requestPath === normalized) {
    return true;
  }
  return requestPath.startsWith(`${normalized}/`);
}

/**
 * Manages the registration and matching of global and path-scoped middleware.
 */
export class MiddlewareManager {
  private readonly registrations: MiddlewareRegistration[] = [];

  /**
   * Register middleware globally or scoped to a specific path prefix.
   */
  use(middleware: Middleware): void;
  use(path: string, middleware: Middleware): void;
  use(pathOrMiddleware: string | Middleware, maybeMiddleware?: Middleware): void {
    if (typeof pathOrMiddleware === "string") {
      if (typeof maybeMiddleware !== "function") {
        throw new TypeError("Middleware must be a function");
      }
      this.registrations.push({
        path: normalizePrefix(pathOrMiddleware),
        middleware: maybeMiddleware,
      });
    } else if (typeof pathOrMiddleware === "function") {
      this.registrations.push({
        middleware: pathOrMiddleware,
      });
    } else {
      throw new TypeError("Invalid arguments passed to app.use()");
    }
  }

  /**
   * Get all registered middlewares that match the given request path in registration order.
   */
  getMatching(requestPath: string): Middleware[] {
    const matching: Middleware[] = [];
    for (const reg of this.registrations) {
      if (matchesMiddlewarePath(reg.path, requestPath)) {
        matching.push(reg.middleware);
      }
    }
    return matching;
  }

  /**
   * Number of registered middleware.
   */
  get size(): number {
    return this.registrations.length;
  }

  /**
   * Clear all registered middleware.
   */
  clear(): void {
    this.registrations.length = 0;
  }
}

