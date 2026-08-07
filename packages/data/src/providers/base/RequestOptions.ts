/**
 * RequestOptions — centralized request configuration shared by all HTTP
 * requests. Keeps provider code free of inline fetch plumbing.
 */

export type HttpMethod = "GET" | "POST";

/** Query parameter values coerced to strings. */
export interface RequestQuery {
  [key: string]: string | number | boolean | undefined;
}

/** HTTP request options for {@link import("./HttpClient").HttpClient}. */
export interface RequestOptions {
  /** Fully-qualified request URL (base URL already resolved by the caller). */
  url: string;
  /** HTTP method. Defaults to GET. */
  method?: HttpMethod;
  /** Headers to merge over the client defaults. */
  headers?: Record<string, string>;
  /** Query parameters appended to the URL. */
  query?: RequestQuery;
  /** Request body (JSON-serialized) for POST requests. */
  body?: unknown;
  /** Timeout in milliseconds. */
  timeoutMs?: number;
}

/** Immutable request defaults applied to every request. */
export interface HttpClientConfig {
  /** Base URL for relative paths (may be empty for absolute callers). */
  baseUrl?: string;
  /** Headers sent on every request (e.g. Authorization). */
  headers?: Record<string, string>;
  /** Default timeout in milliseconds. */
  timeoutMs?: number;
}

/** Serialize a query map into a URI string (empty when no params). */
export function serializeQuery(query: RequestQuery | undefined): string {
  if (query === undefined) {
    return "";
  }
  const pairs: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) {
      continue;
    }
    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return pairs.length === 0 ? "" : `?${pairs.join("&")}`;
}

/** Merge an absolute/relative URL with a base URL and a query string. */
export function resolveUrl(baseUrl: string | undefined, url: string, query?: RequestQuery): string {
  const full = url.startsWith("http") ? url : `${baseUrl ?? ""}${url}`;
  return `${full}${serializeQuery(query)}`;
}
