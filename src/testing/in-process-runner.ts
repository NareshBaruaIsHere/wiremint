import { Readable, Writable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { WiremintInstance } from "../core/engine.js";
import type { TestRequestOptions, TestResponse } from "./types.js";
import { setRequestMetadata } from "../server/request-metadata.js";

/**
 * In-process simulated Readable stream simulating an IncomingMessage.
 */
export class InProcessRequest extends Readable {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  socket: { writable: boolean; destroyed: boolean };

  constructor(options: {
    method: string;
    url: string;
    headers?: Record<string, string | string[] | undefined>;
    bodyBuffer?: Buffer | null;
  }) {
    super();
    this.method = options.method.toUpperCase();
    this.url = options.url;
    this.headers = options.headers ?? {};
    this.socket = { writable: true, destroyed: false };

    if (options.bodyBuffer && options.bodyBuffer.length > 0) {
      this.push(options.bodyBuffer);
    }
    this.push(null); // End of stream
  }

  override _read(): void {
    // No-op for pre-buffered streams
  }

  override destroy(error?: Error | null): this {
    this.socket.destroyed = true;
    return super.destroy(error ?? undefined);
  }
}

/**
 * In-process simulated Writable stream simulating a ServerResponse.
 */
export class InProcessResponse extends Writable {
  statusCode: number = 200;
  headers: Record<string, string | string[]> = {};
  chunks: Buffer[] = [];
  socket: { writable: boolean; destroyed: boolean } = { writable: true, destroyed: false };

  writeHead(statusCode: number, headers?: Record<string, string | string[]> | string): this {
    this.statusCode = statusCode;
    if (headers && typeof headers === "object") {
      for (const [k, v] of Object.entries(headers)) {
        this.setHeader(k, v);
      }
    }
    return this;
  }

  setHeader(name: string, value: string | string[]): this {
    this.headers[name.toLowerCase()] = value;
    return this;
  }

  getHeader(name: string): string | string[] | undefined {
    return this.headers[name.toLowerCase()];
  }

  getHeaders(): Record<string, string | string[]> {
    return { ...this.headers };
  }

  hasHeader(name: string): boolean {
    return this.headers[name.toLowerCase()] !== undefined;
  }

  removeHeader(name: string): void {
    delete this.headers[name.toLowerCase()];
  }

  override _write(
    chunk: any,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    if (this.destroyed) {
      callback(new Error("Cannot write to destroyed stream"));
      return;
    }
    const buf = Buffer.isBuffer(chunk)
      ? chunk
      : typeof chunk === "string"
        ? Buffer.from(chunk, encoding || "utf-8")
        : Buffer.from(String(chunk));
    this.chunks.push(buf);
    callback();
  }

  override destroy(error?: Error | null): this {
    this.socket.destroyed = true;
    this.socket.writable = false;
    return super.destroy(error ?? undefined);
  }
}

/**
 * Dispatches an in-process request directly through the Wiremint application pipeline.
 */
export async function dispatchInProcessRequest(
  app: WiremintInstance,
  method: string,
  path: string,
  options: TestRequestOptions = {},
): Promise<TestResponse> {
  const startTime = performance.now();

  // 1. Construct URL with query parameters
  const [pathname, existingQueryStr] = path.split("?");
  const urlObj = new URL(`http://localhost${pathname}`);

  if (existingQueryStr) {
    const existingParams = new URLSearchParams(existingQueryStr);
    existingParams.forEach((val, key) => urlObj.searchParams.append(key, val));
  }

  if (options.query) {
    for (const [key, val] of Object.entries(options.query)) {
      if (val === undefined) continue;
      if (Array.isArray(val)) {
        for (const item of val) {
          urlObj.searchParams.append(key, String(item));
        }
      } else {
        urlObj.searchParams.append(key, String(val));
      }
    }
  }

  const effectiveUrl = `${urlObj.pathname}${urlObj.search}`;

  // 2. Prepare headers
  const headers: Record<string, string | string[] | undefined> = {};
  if (options.headers) {
    for (const [k, v] of Object.entries(options.headers)) {
      if (v !== undefined) {
        headers[k.toLowerCase()] = v;
      }
    }
  }

  // Request-level scenario override
  if (options.scenario) {
    headers["x-wiremint-scenario"] = options.scenario;
  }

  // Deterministic request ID override
  if (options.requestId) {
    headers["x-wiremint-request-id"] = options.requestId;
  }

  // 3. Serialize body
  let bodyBuffer: Buffer | null = null;
  if (options.textBody !== undefined) {
    // Explicit plain-text body
    bodyBuffer = Buffer.from(options.textBody, "utf-8");
    if (!headers["content-type"]) {
      headers["content-type"] = "text/plain; charset=utf-8";
    }
    headers["content-length"] = String(bodyBuffer.length);
  } else if (options.body !== undefined && options.body !== null) {
    if (Buffer.isBuffer(options.body)) {
      bodyBuffer = options.body;
      if (!headers["content-type"]) {
        headers["content-type"] = "application/octet-stream";
      }
      headers["content-length"] = String(bodyBuffer.length);
    } else if (typeof options.body === "string") {
      const explicitContentType = (headers["content-type"] as string | undefined)?.toLowerCase() ?? "";
      if (explicitContentType.startsWith("text/")) {
        // Plain text string without JSON quoting
        bodyBuffer = Buffer.from(options.body, "utf-8");
        headers["content-length"] = String(bodyBuffer.length);
      } else {
        let isJson = false;
        try {
          JSON.parse(options.body);
          isJson = true;
        } catch {
          isJson = false;
        }
        const raw = isJson ? options.body : JSON.stringify(options.body);
        bodyBuffer = Buffer.from(raw, "utf-8");
        if (!headers["content-type"]) {
          headers["content-type"] = "application/json";
        }
        headers["content-length"] = String(bodyBuffer.length);
      }
    } else {
      // JSON object or array
      const jsonStr = JSON.stringify(options.body);
      bodyBuffer = Buffer.from(jsonStr, "utf-8");
      if (!headers["content-type"]) {
        headers["content-type"] = "application/json";
      }
      headers["content-length"] = String(bodyBuffer.length);
    }
  }

  // 4. Create in-process request and response streams
  const req = new InProcessRequest({
    method,
    url: effectiveUrl,
    headers,
    bodyBuffer,
  });

  if (
    options.simulation !== undefined ||
    options.clientId !== undefined ||
    options.uniqueCallId !== undefined
  ) {
    setRequestMetadata(req, {
      simulationOverride: options.simulation,
      clientId: options.clientId,
      uniqueCallId: options.uniqueCallId,
    });
  }

  const res = new InProcessResponse();

  // 5. Execute request pipeline
  await new Promise<void>((resolve, reject) => {
    let resolved = false;

    const cleanup = () => {
      res.removeListener("finish", onFinish);
      res.removeListener("close", onClose);
      res.removeListener("error", onError);
    };

    const onFinish = () => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve();
      }
    };

    const onClose = () => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve();
      }
    };

    const onError = (err: Error) => {
      if (!resolved) {
        resolved = true;
        cleanup();
        reject(err);
      }
    };

    res.once("finish", onFinish);
    res.once("close", onClose);
    res.once("error", onError);

    app.handleRequest(
      req as unknown as IncomingMessage,
      res as unknown as ServerResponse,
    ).then(() => {
      if (!res.writableEnded && !res.destroyed) {
        res.end();
      }
    }).catch((err) => {
      if (!resolved) {
        resolved = true;
        cleanup();
        reject(err);
      }
    });
  });

  const duration = Math.round((performance.now() - startTime) * 100) / 100;
  const rawText = Buffer.concat(res.chunks).toString("utf-8");

  // 6. Parse response body according to Content-Type
  const rawContentType = res.getHeader("content-type");
  const contentType = typeof rawContentType === "string" ? rawContentType.toLowerCase() : "";

  const isJson =
    contentType.includes("application/json") ||
    /\+[a-z0-9.-]*json\b/i.test(contentType) ||
    contentType.endsWith("+json");
  const isTextPlain = contentType.startsWith("text/plain");

  let parsedBody: unknown;
  if (rawText.length === 0) {
    parsedBody = undefined;
  } else if (isTextPlain) {
    // text/plain responses always remain strings, even if they contain numbers, booleans, or JSON
    parsedBody = rawText;
  } else if (isJson) {
    try {
      parsedBody = JSON.parse(rawText);
    } catch {
      // Invalid JSON responses do not crash the client; falls back to raw text
      parsedBody = rawText;
    }
  } else if (!contentType) {
    // No content-type specified: try parsing as JSON if it looks like JSON structure
    const trimmed = rawText.trim();
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        parsedBody = JSON.parse(rawText);
      } catch {
        parsedBody = rawText;
      }
    } else {
      parsedBody = rawText;
    }
  } else {
    // Non-JSON types (HTML, binary, custom)
    parsedBody = rawText;
  }

  const assignedReqId =
    (res.getHeader("x-wiremint-request-id") as string | undefined) ??
    options.requestId ??
    (res.getHeader("x-request-id") as string | undefined) ??
    "";
  const internalCallId =
    options.uniqueCallId ??
    (res.getHeader("x-wiremint-call-id") as string | undefined);

  return {
    status: res.statusCode,
    statusCode: res.statusCode,
    headers: res.getHeaders(),
    body: parsedBody,
    text: rawText,
    json<T = unknown>(): T {
      if (parsedBody !== undefined && typeof parsedBody === "object" && parsedBody !== null) {
        return parsedBody as T;
      }
      try {
        return JSON.parse(rawText) as T;
      } catch {
        throw new Error(
          `Cannot parse response body as JSON. Content-Type: "${rawContentType ?? "none"}", Body: "${rawText}"`,
        );
      }
    },
    requestId: assignedReqId,
    internalId: internalCallId,
    callId: internalCallId,
    duration,
    ok: res.statusCode >= 200 && res.statusCode < 300,
    scenario: options.scenario,
  };
}
