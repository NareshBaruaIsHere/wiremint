/**
 * Result of a route matching attempt.
 */
export interface RouteMatch {
  matched: boolean;
  params: Record<string, string>;
}

/**
 * Normalise a path by stripping trailing slashes (preserving root "/")
 * and collapsing empty segments.
 */
export function normalizePath(path: string): string {
  if (!path || path === "/") return "/";
  // Remove trailing slashes, ensure leading slash.
  const cleaned = "/" + path.split("/").filter(Boolean).join("/");
  return cleaned;
}

/**
 * Match a `requestPath` against a route pattern (`routePath`).
 * Supports dynamic segments prefixed with `:`.
 * Both paths are normalised before comparison.
 */
export function matchRoute(
  routePath: string,
  requestPath: string,
): RouteMatch {
  const routeParts = normalizePath(routePath).split("/").filter(Boolean);
  const requestParts = normalizePath(requestPath).split("/").filter(Boolean);

  if (routeParts.length !== requestParts.length) {
    return { matched: false, params: {} };
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < routeParts.length; i++) {
    const routePart = routeParts[i]!;
    const requestPart = requestParts[i]!;

    if (routePart.startsWith(":")) {
      const key = routePart.slice(1);
      try {
        params[key] = decodeURIComponent(requestPart);
      } catch {
        return { matched: false, params: {} };
      }
    } else if (routePart !== requestPart) {
      return { matched: false, params: {} };
    }
  }

  return { matched: true, params };
}
