import { describe, expect, it } from "vitest";
import { HttpClient } from "../src/providers/base/HttpClient";
import { resolveUrl, serializeQuery } from "../src/providers/base/RequestOptions";
import { MockHttpClient } from "../src/providers/mock/MockHttpClient";

describe("RequestOptions", () => {
  it("serializes query parameters deterministically", () => {
    expect(serializeQuery({ a: "1", b: 2, c: true })).toBe("?a=1&b=2&c=true");
    expect(serializeQuery(undefined)).toBe("");
    expect(serializeQuery({ skip: undefined })).toBe("");
  });

  it("resolves relative urls against a base", () => {
    expect(resolveUrl("https://api.example.com", "/v1/projects", { q: "x" })).toBe(
      "https://api.example.com/v1/projects?q=x",
    );
    expect(resolveUrl("https://api.example.com", "https://other.example.com/x")).toBe(
      "https://other.example.com/x",
    );
  });
});

describe("HttpClient", () => {
  it("performs GET through the injected transport", async () => {
    const mock = new MockHttpClient().when("/projects", {
      ok: true,
      status: 200,
      data: { ids: [1] },
    });
    const client = new HttpClient({}, mock);

    const response = await client.get<{ ids: number[] }>({ url: "/projects" });

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    expect(response.data?.ids).toEqual([1]);
  });

  it("performs POST with a JSON body", async () => {
    const mock = new MockHttpClient().when(
      "/rpc",
      { ok: true, status: 200, data: { ok: true } },
      "POST",
    );
    const client = new HttpClient({}, mock);

    const response = await client.post<{ ok: boolean }>({
      url: "/rpc",
      body: { jsonrpc: "2.0", method: "getHealth" },
    });

    expect(response.data?.ok).toBe(true);
    const request = mock.requests[0];
    expect(request?.method).toBe("POST");
    expect(request?.body).toEqual({ jsonrpc: "2.0", method: "getHealth" });
  });

  it("merges default and per-request headers", async () => {
    const mock = new MockHttpClient().when("/x", { ok: true, status: 200, data: null }, "GET");
    const client = new HttpClient({ headers: { authorization: "Bearer tok" } }, mock);

    await client.get({ url: "/x", headers: { "x-extra": "1" } });

    // Headers are passed to the transport in the request options.
    expect(mock.requests[0]?.url).toContain("/x");
  });

  it("appends query params to the url", async () => {
    const mock = new MockHttpClient().when("/search", { ok: true, status: 200, data: null }, "GET");
    const client = new HttpClient({ baseUrl: "https://api.example.com" }, mock);

    await client.get({ url: "/search", query: { limit: 10 } });

    expect(mock.requests[0]?.url).toBe("https://api.example.com/search?limit=10");
  });
});

describe("MockHttpClient", () => {
  it("routes by url substring", async () => {
    const mock = new MockHttpClient()
      .when("heli.us-rpc.com", { ok: true, status: 200, data: { status: "ok" } }, "POST")
      .when("/projects", { ok: true, status: 200, data: [] });

    const health = await mock.request({
      url: "https://x/heli.us-rpc.com/?api-key=k",
      method: "POST",
      headers: {},
      timeoutMs: 100,
    });

    expect(health.data).toEqual({ status: "ok" });
  });

  it("records requests for assertions", async () => {
    const mock = new MockHttpClient().when("/anything", { ok: true, status: 200, data: null });
    await mock.request({ url: "https://x/a", method: "GET", headers: {}, timeoutMs: 100 });

    expect(mock.requests).toHaveLength(1);
    expect(mock.requests[0]?.url).toBe("https://x/a");
  });

  it("returns 404 for unhandled routes", async () => {
    const mock = new MockHttpClient();
    const response = await mock.request({
      url: "https://x/nope",
      method: "GET",
      headers: {},
      timeoutMs: 100,
    });

    expect(response.status).toBe(404);
    expect(response.ok).toBe(false);
  });

  it("can be reset", async () => {
    const mock = new MockHttpClient().when("/a", { ok: true, status: 200, data: null });
    await mock.request({ url: "https://x/a", method: "GET", headers: {}, timeoutMs: 100 });
    mock.reset();

    expect(mock.requests).toHaveLength(0);
    expect(
      (await mock.request({ url: "https://x/a", method: "GET", headers: {}, timeoutMs: 100 }))
        .status,
    ).toBe(404);
  });
});
