import { Readable, Writable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { WiremintInstance } from "../core/engine.js";
import type { TestRequestOptions, TestResponse } from "./types.js";

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
  writableEnded: boolean = false;
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
    chunk: Buffer | string,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
    callback();
  }

  override end(chunk?: unknown, encoding?: unknown, callback?: unknown): this {
    if (chunk) {
      this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    }
    this.writableEnded = true;
    super.end(callback as any);
    this.emit("finish");
    this.emit("close");
    return this;
  }

  override destroy(error?: Error | null): this {
    this.socket.destroyed = true;
    this.socket.writable = false;
    this.emit("close");
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
  if (options.body !== undefined && options.body !== null) {
    if (Buffer.isBuffer(options.body)) {
      bodyBuffer = options.body;
    } else if (typeof options.body === "string") {
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
    } else {
      // JSON object or array
      const jsonStr = JSON.stringify(options.body);
      bodyBuffer = Buffer.from(jsonStr, "utf-8");
      if (!headers["content-type"]) {
        headers["content-type"] = "application/json";
      }
    }

    if (bodyBuffer && !headers["content-length"]) {
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

  const res = new InProcessResponse();

  // 5. Execute request pipeline
  await new Promise<void>((resolve, reject) => {
    res.on("close", () => resolve());
    res.on("error", (err) => reject(err));

    app.handleRequest(
      req as unknown as IncomingMessage,
      res as unknown as ServerResponse,
    ).catch(reject);
  });

  const duration = Math.round((performance.now() - startTime) * 100) / 100;
  const rawText = Buffer.concat(res.chunks).toString("utf-8");

  // 6. Parse response body if JSON
  let parsedBody: unknown = rawText;
  const contentType = res.getHeader("content-type");
  const isJson =
    typeof contentType === "string" && contentType.toLowerCase().includes("application/json");

  if (rawText.length > 0) {
    if (isJson) {
      try {
        parsedBody = JSON.parse(rawText);
      } catch {
        parsedBody = rawText;
      }
    } else {
      try {
        parsedBody = JSON.parse(rawText);
      } catch {
        parsedBody = rawText;
      }
    }
  } else {
    parsedBody = undefined;
  }

  const assignedReqId =
    options.requestId ??
    (res.getHeader("x-request-id") as string | undefined) ??
    "";

  return {
    status: res.statusCode,
    statusCode: res.statusCode,
    headers: res.getHeaders(),
    body: parsedBody,
    text: rawText,
    json<T = unknown>(): T {
      if (typeof parsedBody === "object" && parsedBody !== null) {
        return parsedBody as T;
      }
      return JSON.parse(rawText) as T;
    },
    requestId: assignedReqId,
    duration,
    ok: res.statusCode >= 200 && res.statusCode < 300,
    scenario: options.scenario,
  };
}
