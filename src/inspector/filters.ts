import type { RequestFilter, RequestRecord } from "./types.js";

/**
 * Parse a date/timestamp input into milliseconds since epoch.
 */
function toEpochMs(value: string | Date | number): number {
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Filter and sort a collection of request records according to the provided filter options.
 */
export function applyRequestFilters(
  records: RequestRecord[],
  filter?: RequestFilter,
): RequestRecord[] {
  if (!filter) {
    // Default order is newest-first
    return [...records].reverse();
  }

  const normalizedMethod = filter.method?.toUpperCase();
  const searchLower = filter.search?.toLowerCase();

  const sinceMs = filter.since !== undefined ? toEpochMs(filter.since) : undefined;
  const untilMs = filter.until !== undefined ? toEpochMs(filter.until) : undefined;

  let filtered = records.filter((rec) => {
    // 1. Method filter
    if (normalizedMethod && rec.method.toUpperCase() !== normalizedMethod) {
      return false;
    }

    // 2. Path filter (exact or prefix match)
    if (filter.path) {
      const targetPath = filter.path;
      if (rec.path !== targetPath && !rec.path.startsWith(`${targetPath}/`)) {
        return false;
      }
    }

    // 3. Exact status code
    if (filter.statusCode !== undefined && rec.statusCode !== filter.statusCode) {
      return false;
    }

    // 4. Status code range
    if (filter.statusRange) {
      const code = rec.statusCode;
      if (code === undefined) return false;
      if (filter.statusRange.min !== undefined && code < filter.statusRange.min) {
        return false;
      }
      if (filter.statusRange.max !== undefined && code > filter.statusRange.max) {
        return false;
      }
    }

    // 5. Scenario ID
    if (filter.scenarioId !== undefined && rec.scenarioId !== filter.scenarioId) {
      return false;
    }

    // 6. Outcome
    if (filter.outcome !== undefined && rec.outcome !== filter.outcome) {
      return false;
    }

    // 7. Error only
    if (filter.errorOnly) {
      const isErrorOutcome = rec.outcome === "error";
      const isErrorStatus = rec.statusCode !== undefined && rec.statusCode >= 400;
      if (!isErrorOutcome && !isErrorStatus) {
        return false;
      }
    }

    // 8. Time range
    if (sinceMs !== undefined || untilMs !== undefined) {
      const recTimeMs = Date.parse(rec.timestamp);
      if (sinceMs !== undefined && recTimeMs < sinceMs) return false;
      if (untilMs !== undefined && recTimeMs > untilMs) return false;
    }

    // 9. Free-text search
    if (searchLower) {
      const matchPath = rec.path.toLowerCase().includes(searchLower);
      const matchUrl = rec.url.toLowerCase().includes(searchLower);
      const matchError = rec.error?.message?.toLowerCase().includes(searchLower) ?? false;
      const matchReqBody =
        rec.request.body !== undefined &&
        JSON.stringify(rec.request.body).toLowerCase().includes(searchLower);
      const matchResBody =
        rec.response?.body !== undefined &&
        JSON.stringify(rec.response.body).toLowerCase().includes(searchLower);

      if (!matchPath && !matchUrl && !matchError && !matchReqBody && !matchResBody) {
        return false;
      }
    }

    return true;
  });

  // Apply ordering: default is "newest-first"
  const order = filter.order ?? "newest-first";
  if (order === "newest-first") {
    filtered.reverse();
  }

  // Apply limit
  if (filter.limit !== undefined && filter.limit >= 0) {
    filtered = filtered.slice(0, filter.limit);
  }

  return filtered;
}

