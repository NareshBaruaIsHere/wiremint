import type { RouteSimulationConfig } from "../simulation/types.js";

/**
 * Internal private metadata associated with an in-process simulated request.
 * Not exported from the public Wiremint SDK.
 */
export interface RequestInternalMetadata {
  simulationOverride?: RouteSimulationConfig | boolean | null;
  clientId?: string;
  uniqueCallId?: string;
}

const requestMetadataMap = new WeakMap<object, RequestInternalMetadata>();

/**
 * Associates private internal metadata with a request instance.
 */
export function setRequestMetadata(
  req: object,
  metadata: RequestInternalMetadata,
): void {
  if (req && typeof req === "object") {
    const existing = requestMetadataMap.get(req) ?? {};
    requestMetadataMap.set(req, { ...existing, ...metadata });
  }
}

/**
 * Retrieves private internal metadata for a request instance.
 */
export function getRequestMetadata(
  req: object,
): RequestInternalMetadata | undefined {
  if (req && typeof req === "object") {
    return requestMetadataMap.get(req);
  }
  return undefined;
}

/**
 * Removes private internal metadata for a request instance.
 */
export function clearRequestMetadata(req: object): void {
  if (req && typeof req === "object") {
    requestMetadataMap.delete(req);
  }
}
