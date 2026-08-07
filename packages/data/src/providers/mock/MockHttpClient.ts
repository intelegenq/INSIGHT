import type { HttpTransport, HttpResponse } from "../base/HttpClient";

/**
 * MockHttpClient — a no-network HTTP transport for tests.
 *
 * Routes requests by URL pattern (and optional method) to canned responses.
 * Deterministic: the same request always returns the same response.
 */

/** A canned response definition. */
export interface MockResponse<T = unknown> {
  ok: boolean;
  status: number;
  headers?: Record<string, string>;
  data: T;
  /** Optional: if set, this handler is sticky for a fixed number of calls. */
  calls?: number;
}

/** Per-route handler: returns a canned response or undefined to fall through. */
export type MockHandler = (options: {
  url: string;
  method: string;
  body?: unknown;
}) => HttpResponse<unknown> | Promise<HttpResponse<unknown>> | undefined;

/** MockHttpClient — in-memory transport for deterministic tests. */
export class MockHttpClient implements HttpTransport {
  private readonly handlers = new Map<string, MockHandler[]>();
  /** Recorded request log for assertions. */
  readonly requests: Array<{ url: string; method: string; body?: unknown }> = [];

  /** Register a canned response for a URL substring. */
  when(urlContaining: string, response: MockResponse, method: string = "GET"): this {
    const handler: MockHandler = ({ url, method: requestMethod }) => {
      if (!url.includes(urlContaining)) {
        return undefined;
      }
      if (method !== "*" && method !== requestMethod) {
        return undefined;
      }
      return {
        ok: response.ok,
        status: response.status,
        headers: response.headers ?? {},
        data: response.data,
      };
    };
    return this.addHandler(method, handler);
  }

  /** Register a function handler. */
  on(handler: MockHandler): this {
    this.handlers.set("*", [...(this.handlers.get("*") ?? []), handler]);
    return this;
  }

  private addHandler(method: string, handler: MockHandler): this {
    const key = method;
    this.handlers.set(key, [...(this.handlers.get(key) ?? []), handler]);
    return this;
  }

  async request(options: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: unknown;
    timeoutMs: number;
  }): Promise<HttpResponse<unknown>> {
    this.requests.push({ url: options.url, method: options.method, body: options.body });

    const candidates = [
      ...(this.handlers.get(options.method) ?? []),
      ...(this.handlers.get("*") ?? []),
    ];
    for (const handler of candidates) {
      const result = await handler({
        url: options.url,
        method: options.method,
        body: options.body,
      });
      if (result !== undefined) {
        return result;
      }
    }

    return {
      ok: false,
      status: 404,
      headers: {},
      data: null,
    };
  }

  /** Reset all handlers and the request log. */
  reset(): void {
    this.handlers.clear();
    this.requests.length = 0;
  }
}
