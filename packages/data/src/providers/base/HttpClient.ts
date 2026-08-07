import { resolveUrl } from "./RequestOptions";
import type { HttpClientConfig, HttpMethod, RequestOptions } from "./RequestOptions";

/**
 * HttpClient — internal HTTP wrapper.
 *
 * Providers never call fetch() directly; every request goes through this
 * client. It centralizes timeout, headers, query serialization, and method
 * handling. The actual transport is injectable (real fetch or a mock), so
 * integration tests run without network.
 */

/** A JSON-ish response envelope used across the SDK. */
export interface HttpResponse<T = unknown> {
  ok: boolean;
  status: number;
  headers: Record<string, string>;
  data: T | null;
}

/** Transport that performs the raw request (real fetch or mock). */
export interface HttpTransport {
  request(options: {
    url: string;
    method: HttpMethod;
    headers: Record<string, string>;
    body?: unknown;
    timeoutMs: number;
  }): Promise<HttpResponse<unknown>>;
}

const DEFAULT_TIMEOUT_MS = 10_000;

/** Abortable fetch transport using the global fetch API. */
export function fetchTransport(): HttpTransport {
  return {
    async request({ url, method, headers, body, timeoutMs }) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        });
        const text = await response.text();
        let data: unknown = null;
        if (text.length > 0) {
          try {
            data = JSON.parse(text);
          } catch {
            data = text;
          }
        }
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });
        return {
          ok: response.ok,
          status: response.status,
          headers: responseHeaders,
          data,
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

/** HttpClient — request orchestration with deterministic defaults. */
export class HttpClient {
  private readonly config: Required<Pick<HttpClientConfig, "timeoutMs">> &
    Pick<HttpClientConfig, "baseUrl" | "headers">;
  private readonly transport: HttpTransport;

  constructor(config: HttpClientConfig = {}, transport: HttpTransport = fetchTransport()) {
    this.config = {
      baseUrl: config.baseUrl,
      headers: config.headers,
      timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    };
    this.transport = transport;
  }

  /** Perform a GET request. */
  get<T>(options: RequestOptions): Promise<HttpResponse<T>> {
    return this.request<T>({ ...options, method: "GET" });
  }

  /** Perform a POST request. */
  post<T>(options: RequestOptions): Promise<HttpResponse<T>> {
    return this.request<T>({ ...options, method: "POST" });
  }

  /** Perform a request with the given options. */
  async request<T>(options: RequestOptions): Promise<HttpResponse<T>> {
    const method = options.method ?? "GET";
    const url = resolveUrl(this.config.baseUrl, options.url, options.query);
    const headers = {
      "content-type": "application/json",
      ...this.config.headers,
      ...options.headers,
    };
    const timeoutMs = options.timeoutMs ?? this.config.timeoutMs;

    return this.transport.request({
      url,
      method,
      headers,
      body: options.body,
      timeoutMs,
    }) as Promise<HttpResponse<T>>;
  }
}
