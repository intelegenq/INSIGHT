import { describe, expect, it } from "vitest";
import { HttpClient } from "../src/providers/base/HttpClient";
import { BaseProvider } from "../src/providers/base/BaseProvider";
import { MockHttpClient } from "../src/providers/mock/MockHttpClient";
import { SolanaRPCProvider } from "../src/providers/solana/SolanaRPCProvider";
import type {
  ProviderFetch,
  RawEvidence,
  RawNarrative,
  RawProject,
} from "../src/interfaces/DataProvider";

describe("SolanaRPCProvider", () => {
  it("extends BaseProvider with solana-rpc identity", () => {
    const provider = new SolanaRPCProvider(
      { rpcUrl: "https://api.mainnet-beta.solana.com" },
      { httpClient: new HttpClient({}, new MockHttpClient()) },
    );

    expect(provider).toBeInstanceOf(BaseProvider);
    expect(provider.id).toBe("solana-rpc");
    expect(provider.name).toBe("Solana RPC");
  });

  it("reports healthy when getHealth returns ok", async () => {
    const mock = new MockHttpClient().when(
      "api.mainnet-beta.solana.com",
      {
        ok: true,
        status: 200,
        data: { jsonrpc: "2.0", id: 1, result: { status: "ok" } },
      },
      "POST",
    );

    const provider = new SolanaRPCProvider(
      { rpcUrl: "https://api.mainnet-beta.solana.com" },
      { httpClient: new HttpClient({}, mock) },
    );

    const health = await provider.health();
    expect(health.available).toBe(true);
    expect(health.id).toBe("solana-rpc");
  });

  it("reports unhealthy when getHealth returns unhealthy", async () => {
    const mock = new MockHttpClient().when(
      "api.mainnet-beta.solana.com",
      {
        ok: true,
        status: 200,
        data: { jsonrpc: "2.0", id: 1, result: { status: "unhealthy" } },
      },
      "POST",
    );

    const provider = new SolanaRPCProvider(
      { rpcUrl: "https://api.mainnet-beta.solana.com" },
      { httpClient: new HttpClient({}, mock) },
    );

    const health = await provider.health();
    expect(health.available).toBe(false);
  });

  it("reports unhealthy when RPC call fails", async () => {
    const mock = new MockHttpClient().when(
      "api.mainnet-beta.solana.com",
      {
        ok: false,
        status: 500,
        data: null,
      },
      "POST",
    );

    const provider = new SolanaRPCProvider(
      { rpcUrl: "https://api.mainnet-beta.solana.com" },
      { httpClient: new HttpClient({}, mock) },
    );

    const health = await provider.health();
    expect(health.available).toBe(false);
  });

  it("reports unhealthy when RPC returns error", async () => {
    const mock = new MockHttpClient().when(
      "api.mainnet-beta.solana.com",
      {
        ok: true,
        status: 200,
        data: { jsonrpc: "2.0", id: 1, error: { code: -32600, message: "Invalid request" } },
      },
      "POST",
    );

    const provider = new SolanaRPCProvider(
      { rpcUrl: "https://api.mainnet-beta.solana.com" },
      { httpClient: new HttpClient({}, mock) },
    );

    const health = await provider.health();
    expect(health.available).toBe(false);
  });

  it("fetches raw projects via getProgramAccounts", async () => {
    let callCount = 0;
    const mock = new MockHttpClient().on(({ url, method, body }) => {
      if (!url.includes("api.mainnet-beta.solana.com") || method !== "POST") {
        return undefined;
      }
      callCount++;
      if (callCount === 1) {
        return {
          ok: true,
          status: 200,
          data: {
            jsonrpc: "2.0",
            id: 1,
            result: {
              context: { slot: 123 },
              value: [
                {
                  pubkey: "TestPubkey1",
                  account: {
                    address: "TestPubkey1",
                    lamports: 1000000,
                    owner: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
                    executable: false,
                    rentEpoch: 200,
                    data: "parsed-data",
                  },
                },
                {
                  pubkey: "TestPubkey2",
                  account: {
                    address: "TestPubkey2",
                    lamports: 2000000,
                    owner: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
                    executable: false,
                    rentEpoch: 200,
                    data: { parsed: {}, program: "spl-token", space: 165 },
                  },
                },
              ],
            },
          },
        };
      }
      return {
        ok: true,
        status: 200,
        data: { jsonrpc: "2.0", id: callCount, result: { context: { slot: 123 }, value: [] } },
      };
    });

    const provider = new SolanaRPCProvider(
      { rpcUrl: "https://api.mainnet-beta.solana.com" },
      { httpClient: new HttpClient({}, mock) },
    );

    const result = await provider.fetchProjects();
    console.log("result:", result);
    console.log("requests:", mock.requests);

    expect(result.data).toHaveLength(2);
    expect(result.data[0]?.id).toBe("solana-TestPubkey1");
    expect(result.data[0]?.category).toBe("solana-account");
    expect(result.data[1]?.id).toBe("solana-TestPubkey2");
  });

  it("handles empty getProgramAccounts response", async () => {
    const mock = new MockHttpClient().when(
      "api.mainnet-beta.solana.com",
      {
        ok: true,
        status: 200,
        data: {
          jsonrpc: "2.0",
          id: 1,
          result: { context: { slot: 123 }, value: [] },
        },
      },
      "POST",
    );

    const provider = new SolanaRPCProvider(
      { rpcUrl: "https://api.mainnet-beta.solana.com" },
      { httpClient: new HttpClient({}, mock) },
    );

    const result = await provider.fetchProjects();
    expect(result.data).toEqual([]);
  });

  it("returns empty stubs for evidence", async () => {
    const provider = new SolanaRPCProvider(
      { rpcUrl: "https://api.mainnet-beta.solana.com" },
      { httpClient: new HttpClient({}, new MockHttpClient()) },
    );

    const evidence = await provider.fetchEvidence();
    expect(evidence.data).toEqual([]);
  });

  it("returns empty stubs for narratives", async () => {
    const provider = new SolanaRPCProvider(
      { rpcUrl: "https://api.mainnet-beta.solana.com" },
      { httpClient: new HttpClient({}, new MockHttpClient()) },
    );

    const narratives = await provider.fetchNarratives();
    expect(narratives.data).toEqual([]);
  });

  it("enforces rate limiting when configured", async () => {
    let clock = 0;
    const mock = new MockHttpClient().when(
      "api.mainnet-beta.solana.com",
      {
        ok: true,
        status: 200,
        data: { jsonrpc: "2.0", id: 1, result: { status: "ok" } },
      },
      "POST",
    );

    const provider = new SolanaRPCProvider(
      { rpcUrl: "https://api.mainnet-beta.solana.com" },
      {
        httpClient: new HttpClient({}, mock),
        rateLimit: { capacity: 1, refillPerSecond: 0 },
        clock: () => clock,
      },
    );

    await provider.fetchProjects();
    await expect(provider.fetchProjects()).rejects.toThrow(/Rate limit/);
  });

  it("continues on individual RPC error in fetchProjects", async () => {
    const mock = new MockHttpClient()
      .when(
        "api.mainnet-beta.solana.com",
        {
          ok: true,
          status: 200,
          data: {
            jsonrpc: "2.0",
            id: 1,
            error: { code: -32000, message: "Rate limit exceeded" },
          },
        },
        "POST",
      )
      .when(
        "api.mainnet-beta.solana.com",
        {
          ok: true,
          status: 200,
          data: { jsonrpc: "2.0", id: 2, result: { context: { slot: 123 }, value: [] } },
        },
        "POST",
      )
      .when(
        "api.mainnet-beta.solana.com",
        {
          ok: true,
          status: 200,
          data: { jsonrpc: "2.0", id: 3, result: { context: { slot: 123 }, value: [] } },
        },
        "POST",
      );

    const provider = new SolanaRPCProvider(
      { rpcUrl: "https://api.mainnet-beta.solana.com" },
      { httpClient: new HttpClient({}, mock) },
    );

    // Should not throw, just return empty for that program
    const result = await provider.fetchProjects();
    expect(result.data).toEqual([]);
  });
});
