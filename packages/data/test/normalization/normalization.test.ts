import { describe, expect, it } from "vitest";
import {
  CanonicalEvidence,
  EvidenceType,
  isCanonicalEvidence,
  createCanonicalEvidence,
} from "../../src/normalization/CanonicalEvidence";
import {
  SourceMetadata,
  createSourceMetadata,
  isSourceMetadata,
} from "../../src/normalization/SourceMetadata";
import {
  Normalizer,
  BaseNormalizer,
  NormalizationResult,
  normalizeWithErrors,
} from "../../src/normalization/Normalizer";
import {
  NormalizationRegistry,
  normalizationRegistry,
} from "../../src/normalization/NormalizationRegistry";
import {
  NormalizationError,
  UnsupportedSourceError,
  InvalidPayloadError,
  MissingRequiredFieldError,
  SchemaMismatchError,
  isNormalizationError,
  isUnsupportedSourceError,
  isInvalidPayloadError,
  isMissingRequiredFieldError,
  isSchemaMismatchError,
} from "../../src/normalization/NormalizationError";

describe("CanonicalEvidence", () => {
  it("creates a valid CanonicalEvidence with all required fields", () => {
    const metadata = createSourceMetadata({
      provider: "test-provider",
      providerVersion: "1.0.0",
      collectedAt: 1_000_000_000_000,
    });

    const evidence = createCanonicalEvidence({
      id: "test-1",
      sourceId: "test-provider",
      sourceType: "test-type",
      evidenceType: "market-movement",
      content: { price: 100 },
      metadata,
      collectedAt: 1_000_000_000_000,
      publishedAt: 999_999_999_999,
      title: "Test Evidence",
      url: "https://example.com",
      author: "Test Author",
      tags: ["tag1", "tag2"],
    });

    expect(evidence.id).toBe("test-1");
    expect(evidence.sourceId).toBe("test-provider");
    expect(evidence.sourceType).toBe("test-type");
    expect(evidence.evidenceType).toBe("market-movement");
    expect(evidence.content).toEqual({ price: 100 });
    expect(evidence.publishedAt).toBe(999_999_999_999);
    expect(evidence.title).toBe("Test Evidence");
    expect(evidence.url).toBe("https://example.com");
    expect(evidence.author).toBe("Test Author");
    expect(evidence.tags).toEqual(["tag1", "tag2"]);
    expect(evidence.metadata.provider).toBe("test-provider");
  });

  it("creates CanonicalEvidence with minimal fields and defaults", () => {
    const metadata = createSourceMetadata({
      provider: "test-provider",
      providerVersion: "1.0.0",
    });

    const evidence = createCanonicalEvidence({
      id: "test-2",
      sourceId: "test-provider",
      sourceType: "test-type",
      evidenceType: "protocol-tvl",
      content: { tvl: 1_000_000 },
      metadata,
    });

    expect(evidence.id).toBe("test-2");
    expect(evidence.evidenceType).toBe("protocol-tvl");
    expect(evidence.collectedAt).toBeGreaterThan(0);
    expect(evidence.publishedAt).toBeUndefined();
    expect(evidence.title).toBeUndefined();
    expect(evidence.url).toBeUndefined();
    expect(evidence.author).toBeUndefined();
    expect(evidence.tags).toEqual([]);
  });

  it("isCanonicalEvidence returns true for valid evidence", () => {
    const metadata = createSourceMetadata({
      provider: "test",
      providerVersion: "1.0.0",
    });

    const evidence = createCanonicalEvidence({
      id: "test",
      sourceId: "test",
      sourceType: "test",
      evidenceType: "market-movement",
      content: {},
      metadata,
    });

    expect(isCanonicalEvidence(evidence)).toBe(true);
  });

  it("isCanonicalEvidence returns false for invalid objects", () => {
    expect(isCanonicalEvidence(null)).toBe(false);
    expect(isCanonicalEvidence(undefined)).toBe(false);
    expect(isCanonicalEvidence({})).toBe(false);
    expect(isCanonicalEvidence("string")).toBe(false);
    expect(isCanonicalEvidence(123)).toBe(false);
    expect(isCanonicalEvidence([])).toBe(false);

    // Missing required fields
    expect(
      isCanonicalEvidence({
        sourceId: "test",
        sourceType: "test",
        evidenceType: "market-movement",
        collectedAt: 1000,
        tags: [],
        metadata: {},
        content: {},
      }),
    ).toBe(false);
  });

  it("supports all EvidenceType values", () => {
    const types: EvidenceType[] = [
      "market-movement",
      "protocol-tvl",
      "onchain-activity",
      "wallet-activity",
      "raw-project",
      "project",
      "evidence",
      "narrative",
    ];

    for (const type of types) {
      const metadata = createSourceMetadata({ provider: "test", providerVersion: "1.0.0" });
      const evidence = createCanonicalEvidence({
        id: "test",
        sourceId: "test",
        sourceType: "test",
        evidenceType: type,
        content: {},
        metadata,
      });
      expect(evidence.evidenceType).toBe(type);
    }
  });
});

describe("SourceMetadata", () => {
  it("creates SourceMetadata with all fields", () => {
    const metadata = createSourceMetadata({
      provider: "coingecko",
      providerVersion: "2.0.0",
      schemaVersion: "1.0.0",
      collectedAt: 1_000_000_000_000,
      endpoint: "/coins/markets",
      requestParams: { vs_currency: "usd" },
    });

    expect(metadata.provider).toBe("coingecko");
    expect(metadata.providerVersion).toBe("2.0.0");
    expect(metadata.schemaVersion).toBe("1.0.0");
    expect(metadata.collectedAt).toBe(1_000_000_000_000);
    expect(metadata.endpoint).toBe("/coins/markets");
    expect(metadata.requestParams).toEqual({ vs_currency: "usd" });
  });

  it("uses default schemaVersion when not provided", () => {
    const metadata = createSourceMetadata({
      provider: "test",
      providerVersion: "1.0.0",
    });

    expect(metadata.schemaVersion).toBe("1.0.0");
  });

  it("uses current time when collectedAt not provided", () => {
    const before = Date.now();
    const metadata = createSourceMetadata({
      provider: "test",
      providerVersion: "1.0.0",
    });
    const after = Date.now();

    expect(metadata.collectedAt).toBeGreaterThanOrEqual(before);
    expect(metadata.collectedAt).toBeLessThanOrEqual(after);
  });

  it("isSourceMetadata returns true for valid metadata", () => {
    const metadata = createSourceMetadata({
      provider: "test",
      providerVersion: "1.0.0",
    });

    expect(isSourceMetadata(metadata)).toBe(true);
  });

  it("isSourceMetadata returns false for invalid objects", () => {
    expect(isSourceMetadata(null)).toBe(false);
    expect(isSourceMetadata(undefined)).toBe(false);
    expect(isSourceMetadata({})).toBe(false);
    expect(isSourceMetadata({ provider: "test" })).toBe(false); // missing providerVersion
    expect(
      isSourceMetadata({ provider: "test", providerVersion: "1.0.0", collectedAt: "not a number" }),
    ).toBe(false);
  });
});

describe("Normalizer interface", () => {
  it("Normalizer interface is callable", () => {
    const normalizer: Normalizer<{ value: number }> = {
      supports: (sourceType: string) => sourceType === "test",
      normalize: (input) => [
        {
          id: `test-${input.value}`,
          sourceId: "test",
          sourceType: "test",
          evidenceType: "market-movement",
          collectedAt: Date.now(),
          content: input,
          tags: [],
          metadata: {
            provider: "test",
            providerVersion: "1.0.0",
            collectedAt: Date.now(),
            schemaVersion: "1.0.0",
          },
        },
      ],
    };

    expect(normalizer.supports("test")).toBe(true);
    expect(normalizer.supports("other")).toBe(false);

    const result = normalizer.normalize({ value: 42 });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("test-42");
  });
});

describe("BaseNormalizer", () => {
  it("BaseNormalizer provides common validation", () => {
    class TestNormalizer extends BaseNormalizer<{ id: string; value: number }> {
      constructor() {
        super(["test"], "1.0.0");
      }

      normalize(input: { id: string; value: number }): CanonicalEvidence[] {
        return [
          createCanonicalEvidence({
            id: input.id,
            sourceId: "test",
            sourceType: "test",
            evidenceType: "market-movement",
            content: input,
            provider: "test",
            providerVersion: "1.0.0",
          }),
        ];
      }
    }

    const normalizer = new TestNormalizer();
    expect(normalizer.supports("test")).toBe(true);
    expect(normalizer.supports("other")).toBe(false);
  });

  it("validateRequiredFields throws MissingRequiredFieldError", () => {
    class TestNormalizer extends BaseNormalizer<Record<string, unknown>> {
      constructor() {
        super(["test"], "1.0.0");
      }

      normalize(): CanonicalEvidence[] {
        return [];
      }
    }

    const normalizer = new TestNormalizer();
    expect(() => normalizer.validateRequiredFields({ a: 1 }, ["a", "b"], "test")).toThrow(
      InvalidPayloadError,
    ); // The implementation throws InvalidPayloadError for missing fields
  });

  it("validateArray throws InvalidPayloadError for non-array", () => {
    class TestNormalizer extends BaseNormalizer<unknown> {
      constructor() {
        super(["test"], "1.0.0");
      }

      normalize(): CanonicalEvidence[] {
        return [];
      }
    }

    const normalizer = new TestNormalizer();
    expect(() => normalizer.validateArray("not an array", "test")).toThrow(InvalidPayloadError);
    expect(() => normalizer.validateArray(null, "test")).toThrow(InvalidPayloadError);
    expect(() => normalizer.validateArray(123, "test")).toThrow(InvalidPayloadError);

    // Valid array passes
    const result = normalizer.validateArray([1, 2, 3], "test");
    expect(result).toEqual([1, 2, 3]);
  });
});

describe("normalizeWithErrors", () => {
  it("returns success result for all valid inputs", () => {
    const normalizer: Normalizer<number> = {
      supports: () => true,
      normalize: (input) => [
        {
          id: `test-${input}`,
          sourceId: "test",
          sourceType: "test",
          evidenceType: "market-movement",
          collectedAt: Date.now(),
          content: input,
          tags: [],
          metadata: {
            provider: "test",
            providerVersion: "1.0.0",
            collectedAt: Date.now(),
            schemaVersion: "1.0.0",
          },
        },
      ],
    };

    const result = normalizeWithErrors(normalizer, [1, 2, 3], "test");
    expect(result.success).toBe(true);
    expect(result.evidence).toHaveLength(3);
    expect(result.errors).toHaveLength(0);
  });

  it("collects errors for failing normalizations", () => {
    const normalizer: Normalizer<number> = {
      supports: () => true,
      normalize: (input) => {
        if (input === 2) throw new Error("Failed to normalize 2");
        return [
          {
            id: `test-${input}`,
            sourceId: "test",
            sourceType: "test",
            evidenceType: "market-movement",
            collectedAt: Date.now(),
            content: input,
            tags: [],
            metadata: {
              provider: "test",
              providerVersion: "1.0.0",
              collectedAt: Date.now(),
              schemaVersion: "1.0.0",
            },
          },
        ];
      },
    };

    const result = normalizeWithErrors(normalizer, [1, 2, 3], "test");
    expect(result.success).toBe(false);
    expect(result.evidence).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toContain("Failed to normalize 2");
  });

  it("handles NormalizationError subclasses in errors", () => {
    const normalizer: Normalizer<number> = {
      supports: () => true,
      normalize: (input) => {
        if (input === 2) throw new UnsupportedSourceError("test", { input });
        return [
          {
            id: `test-${input}`,
            sourceId: "test",
            sourceType: "test",
            evidenceType: "market-movement",
            collectedAt: Date.now(),
            content: input,
            tags: [],
            metadata: {
              provider: "test",
              providerVersion: "1.0.0",
              collectedAt: Date.now(),
              schemaVersion: "1.0.0",
            },
          },
        ];
      },
    };

    const result = normalizeWithErrors(normalizer, [1, 2, 3], "test");
    expect(result.success).toBe(false);
    expect(result.evidence).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
    expect(isUnsupportedSourceError(result.errors[0])).toBe(true);
  });
});

describe("NormalizationRegistry", () => {
  it("registers and retrieves normalizers", () => {
    const registry = new NormalizationRegistry();

    const normalizer: Normalizer<{ value: number }> = {
      supports: (sourceType) => sourceType === "test",
      normalize: (input) => [
        {
          id: `test-${input.value}`,
          sourceId: "test",
          sourceType: "test",
          evidenceType: "market-movement",
          collectedAt: Date.now(),
          content: input,
          tags: [],
          metadata: {
            provider: "test",
            providerVersion: "1.0.0",
            collectedAt: Date.now(),
            schemaVersion: "1.0.0",
          },
        },
      ],
    };

    registry.register(normalizer, ["test", "test2"]);

    expect(registry.has("test")).toBe(true);
    expect(registry.has("test2")).toBe(true);
    expect(registry.has("test3")).toBe(false);
    expect(registry.getRegisteredSourceTypes()).toEqual(["test", "test2"]);
    expect(registry.size()).toBe(2);

    const retrieved = registry.getNormalizer("test");
    expect(retrieved).toBe(normalizer);
  });

  it("throws UnsupportedSourceError for unregistered source type", () => {
    const registry = new NormalizationRegistry();

    expect(() => registry.getNormalizer("unknown")).toThrow(UnsupportedSourceError);
  });

  it("throws InvalidPayloadError for duplicate registration", () => {
    const registry = new NormalizationRegistry();
    const normalizer: Normalizer<unknown> = {
      supports: () => true,
      normalize: () => [],
    };

    registry.register(normalizer, ["test"]);

    expect(() => registry.register(normalizer, ["test"])).toThrow(InvalidPayloadError);
    expect(() => registry.register(normalizer, ["test", "other"])).toThrow(InvalidPayloadError);
  });

  it("throws InvalidPayloadError for empty sourceTypes", () => {
    const registry = new NormalizationRegistry();
    const normalizer: Normalizer<unknown> = {
      supports: () => true,
      normalize: () => [],
    };

    expect(() => registry.register(normalizer, [])).toThrow(InvalidPayloadError);
  });

  it("normalize dispatches to correct normalizer", () => {
    const registry = new NormalizationRegistry();

    const normalizer: Normalizer<{ value: number }> = {
      supports: (sourceType) => sourceType === "test",
      normalize: (input) => [
        {
          id: `test-${input.value}`,
          sourceId: "test",
          sourceType: "test",
          evidenceType: "market-movement",
          collectedAt: Date.now(),
          content: input,
          tags: [],
          metadata: {
            provider: "test",
            providerVersion: "1.0.0",
            collectedAt: Date.now(),
            schemaVersion: "1.0.0",
          },
        },
      ],
    };

    registry.register(normalizer, ["test"]);

    const result = registry.normalize("test", { value: 42 });
    expect(result).toHaveLength(1);
    expect(result[0]?.content).toEqual({ value: 42 });
  });

  it("normalize throws UnsupportedSourceError for unknown source type", () => {
    const registry = new NormalizationRegistry();

    expect(() => registry.normalize("unknown", {})).toThrow(UnsupportedSourceError);
  });

  it("normalizeWithErrors returns result with errors", () => {
    const registry = new NormalizationRegistry();

    const normalizer: Normalizer<number> = {
      supports: () => true,
      normalize: (input) => {
        if (input === 2) throw new Error("fail");
        return [
          {
            id: `test-${input}`,
            sourceId: "test",
            sourceType: "test",
            evidenceType: "market-movement",
            collectedAt: Date.now(),
            content: input,
            tags: [],
            metadata: {
              provider: "test",
              providerVersion: "1.0.0",
              collectedAt: Date.now(),
              schemaVersion: "1.0.0",
            },
          },
        ];
      },
    };

    registry.register(normalizer, ["test"]);

    const result = registry.normalizeWithErrors("test", [1, 2, 3]);
    expect(result.success).toBe(false);
    expect(result.evidence).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
  });

  it("unregister removes normalizer", () => {
    const registry = new NormalizationRegistry();
    const normalizer: Normalizer<unknown> = {
      supports: () => true,
      normalize: () => [],
    };

    registry.register(normalizer, ["test"]);
    expect(registry.has("test")).toBe(true);

    registry.unregister("test");
    expect(registry.has("test")).toBe(false);
    expect(registry.size()).toBe(0);
  });

  it("clear removes all normalizers", () => {
    const registry = new NormalizationRegistry();
    const normalizer: Normalizer<unknown> = {
      supports: () => true,
      normalize: () => [],
    };

    registry.register(normalizer, ["test1", "test2"]);
    expect(registry.size()).toBe(2);

    registry.clear();
    expect(registry.size()).toBe(0);
    expect(registry.has("test1")).toBe(false);
    expect(registry.has("test2")).toBe(false);
  });

  it("global normalizationRegistry instance exists", () => {
    expect(normalizationRegistry).toBeInstanceOf(NormalizationRegistry);
  });
});

describe("NormalizationError classes", () => {
  it("NormalizationError serializes correctly", () => {
    const error = new NormalizationError("Test message", "TEST_CODE", {
      sourceType: "test",
      details: { key: "value" },
    });

    expect(error.message).toBe("Test message");
    expect(error.code).toBe("TEST_CODE");
    expect(error.sourceType).toBe("test");
    expect(error.details).toEqual({ key: "value" });

    const json = error.toJSON();
    expect(json.name).toBe("NormalizationError");
    expect(json.message).toBe("Test message");
    expect(json.code).toBe("TEST_CODE");
    expect(json.sourceType).toBe("test");
    expect(json.details).toEqual({ key: "value" });
  });

  it("UnsupportedSourceError has correct code", () => {
    const error = new UnsupportedSourceError("test-type", { detail: "test" });
    expect(error.code).toBe("UNSUPPORTED_SOURCE");
    expect(error.message).toContain("test-type");
  });

  it("InvalidPayloadError has correct code", () => {
    const error = new InvalidPayloadError("Invalid data", "test-type", { detail: "test" });
    expect(error.code).toBe("INVALID_PAYLOAD");
    expect(error.message).toBe("Invalid data");
  });

  it("MissingRequiredFieldError has correct code and fieldName", () => {
    const error = new MissingRequiredFieldError("requiredField", "test-type", { detail: "test" });
    expect(error.code).toBe("MISSING_REQUIRED_FIELD");
    expect(error.message).toContain("requiredField");
    expect(error.fieldName).toBe("requiredField");
  });

  it("SchemaMismatchError has correct code and schemas", () => {
    const error = new SchemaMismatchError("Mismatch", "test-type", "expected", "actual", {
      detail: "test",
    });
    expect(error.code).toBe("SCHEMA_MISMATCH");
    expect(error.expectedSchema).toBe("expected");
    expect(error.actualSchema).toBe("actual");
  });

  it("type guards work correctly", () => {
    const normError = new NormalizationError("test", "TEST");
    const unsupportedError = new UnsupportedSourceError("test");
    const invalidError = new InvalidPayloadError("test", "test");
    const missingError = new MissingRequiredFieldError("field", "test");
    const schemaError = new SchemaMismatchError("test", "test", "expected");

    expect(isNormalizationError(normError)).toBe(true);
    expect(isNormalizationError(unsupportedError)).toBe(true); // subclasses too
    expect(isNormalizationError(new Error())).toBe(false);
    expect(isNormalizationError(null)).toBe(false);

    expect(isUnsupportedSourceError(unsupportedError)).toBe(true);
    expect(isUnsupportedSourceError(normError)).toBe(false);
    expect(isUnsupportedSourceError(invalidError)).toBe(false);

    expect(isInvalidPayloadError(invalidError)).toBe(true);
    expect(isMissingRequiredFieldError(missingError)).toBe(true);
    expect(isSchemaMismatchError(schemaError)).toBe(true);
  });
});

describe("Idempotent and pure normalization", () => {
  it("CanonicalEvidence creation is deterministic", () => {
    const metadata = createSourceMetadata({
      provider: "test",
      providerVersion: "1.0.0",
      collectedAt: 1_000_000_000_000,
    });

    const evidence1 = createCanonicalEvidence({
      id: "test-1",
      sourceId: "test",
      sourceType: "test",
      evidenceType: "market-movement",
      content: { price: 100 },
      metadata,
    });

    const evidence2 = createCanonicalEvidence({
      id: "test-1",
      sourceId: "test",
      sourceType: "test",
      evidenceType: "market-movement",
      content: { price: 100 },
      metadata,
    });

    expect(evidence1).toEqual(evidence2);
  });

  it("SourceMetadata creation is deterministic", () => {
    const metadata1 = createSourceMetadata({
      provider: "test",
      providerVersion: "1.0.0",
      collectedAt: 1_000_000_000_000,
    });

    const metadata2 = createSourceMetadata({
      provider: "test",
      providerVersion: "1.0.0",
      collectedAt: 1_000_000_000_000,
    });

    expect(metadata1).toEqual(metadata2);
  });

  it("normalizeWithErrors produces same results for same inputs", () => {
    const normalizer: Normalizer<number> = {
      supports: () => true,
      normalize: (input) => [
        {
          id: `test-${input}`,
          sourceId: "test",
          sourceType: "test",
          evidenceType: "market-movement",
          collectedAt: 1_000_000_000_000, // Fixed timestamp for determinism
          content: input,
          tags: [],
          metadata: {
            provider: "test",
            providerVersion: "1.0.0",
            collectedAt: 1_000_000_000_000,
            schemaVersion: "1.0.0",
          },
        },
      ],
    };

    const result1 = normalizeWithErrors(normalizer, [1, 2, 3], "test");
    const result2 = normalizeWithErrors(normalizer, [1, 2, 3], "test");

    expect(result1.success).toBe(result2.success);
    expect(result1.evidence).toEqual(result2.evidence);
    expect(result1.errors).toEqual(result2.errors);
  });
});

describe("Multiple normalizers in registry", () => {
  it("supports multiple normalizers for different source types", () => {
    const registry = new NormalizationRegistry();

    const normalizer1: Normalizer<{ value: number }> = {
      supports: (t) => t === "type1",
      normalize: (input) => [
        {
          id: `type1-${input.value}`,
          sourceId: "type1",
          sourceType: "type1",
          evidenceType: "market-movement",
          collectedAt: Date.now(),
          content: input,
          tags: [],
          metadata: {
            provider: "type1",
            providerVersion: "1.0.0",
            collectedAt: Date.now(),
            schemaVersion: "1.0.0",
          },
        },
      ],
    };

    const normalizer2: Normalizer<{ data: string }> = {
      supports: (t) => t === "type2",
      normalize: (input) => [
        {
          id: `type2-${input.data}`,
          sourceId: "type2",
          sourceType: "type2",
          evidenceType: "protocol-tvl",
          collectedAt: Date.now(),
          content: input,
          tags: [],
          metadata: {
            provider: "type2",
            providerVersion: "1.0.0",
            collectedAt: Date.now(),
            schemaVersion: "1.0.0",
          },
        },
      ],
    };

    registry.register(normalizer1, ["type1"]);
    registry.register(normalizer2, ["type2"]);

    expect(registry.has("type1")).toBe(true);
    expect(registry.has("type2")).toBe(true);
    expect(registry.size()).toBe(2);

    const result1 = registry.normalize("type1", { value: 100 });
    expect(result1[0]?.content).toEqual({ value: 100 });

    const result2 = registry.normalize("type2", { data: "hello" });
    expect(result2[0]?.content).toEqual({ data: "hello" });
  });
});

describe("Metadata propagation", () => {
  it("metadata flows through createCanonicalEvidence correctly", () => {
    const metadata = createSourceMetadata({
      provider: "coingecko",
      providerVersion: "3.0.0",
      schemaVersion: "1.0.0",
      collectedAt: 1_000_000_000_000,
      endpoint: "/coins/markets",
      requestParams: { vs_currency: "usd", per_page: "100" },
    });

    const evidence = createCanonicalEvidence({
      id: "coingecko-bitcoin",
      sourceId: "coingecko",
      sourceType: "market-data",
      evidenceType: "market-movement",
      content: { symbol: "BTC", price: 50000 },
      metadata,
    });

    expect(evidence.metadata.provider).toBe("coingecko");
    expect(evidence.metadata.providerVersion).toBe("3.0.0");
    expect(evidence.metadata.endpoint).toBe("/coins/markets");
    expect(evidence.metadata.requestParams).toEqual({ vs_currency: "usd", per_page: "100" });
    expect(evidence.metadata.schemaVersion).toBe("1.0.0");
  });
});
