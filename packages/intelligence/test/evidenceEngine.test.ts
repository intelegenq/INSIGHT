import { describe, expect, it } from "vitest";
import type { Evidence } from "@insight/core";
import {
  bestEvidence,
  deduplicateContent,
  deduplicateEvidence,
  normalizeEvidence,
  weightEvidence,
} from "../src/engines/evidenceEngine";

const REFERENCE_DATE = "2026-08-07T00:00:00.000Z";

type EvidenceFixture = Pick<Evidence, "id" | "source"> & Partial<Omit<Evidence, "id" | "source">>;

/** Helper to type test fixtures as Evidence so status stays a literal union. */
function evidenceList(items: EvidenceFixture[]): Evidence[] {
  return items.map((item) => ({
    note: "",
    status: "demo" as Evidence["status"],
    observedAt: "1970-01-01T00:00:00.000Z",
    ...item,
  }));
}

describe("EvidenceEngine", () => {
  describe("normalizeEvidence", () => {
    it("applies deterministic defaults for missing fields", () => {
      const result = normalizeEvidence([{ note: "signal A" }]);

      expect(result).toHaveLength(1);
      const item = result[0];
      expect(item).toBeDefined();
      expect(item?.id).toBe("evidence-0");
      expect(item?.status).toBe("demo");
      expect(item?.observedAt).toBe("1970-01-01T00:00:00.000Z");
      expect(item?.source).toEqual({ id: "unknown-source", name: "Unknown source" });
    });

    it("normalizes string sources into typed source objects", () => {
      const result = normalizeEvidence([
        { id: "e1", source: "Protocol Telemetry", status: "verified" },
      ]);

      expect(result[0]?.source).toEqual({ id: "protocol-telemetry", name: "Protocol Telemetry" });
      expect(result[0]?.status).toBe("verified");
    });

    it("accepts partial source objects", () => {
      const result = normalizeEvidence([{ id: "e1", source: { name: "Chain monitor" } }]);

      expect(result[0]?.source).toEqual({ id: "chain-monitor", name: "Chain monitor" });
    });
  });

  describe("deduplicateEvidence", () => {
    it("keeps the highest-status record for duplicate ids", () => {
      const evidence = evidenceList([
        {
          id: "e1",
          source: { id: "s1", name: "S1" },
          note: "draft",
          status: "draft",
          observedAt: "2026-08-01T00:00:00.000Z",
        },
        {
          id: "e1",
          source: { id: "s1", name: "S1" },
          note: "verified",
          status: "verified",
          observedAt: "2026-08-05T00:00:00.000Z",
        },
      ]);

      const result = deduplicateEvidence(evidence);

      expect(result).toHaveLength(1);
      expect(result[0]?.status).toBe("verified");
    });

    it("prefers the freshest record on equal status", () => {
      const evidence = evidenceList([
        {
          id: "e1",
          source: { id: "s1", name: "S1" },
          note: "old",
          status: "pending",
          observedAt: "2026-08-01T00:00:00.000Z",
        },
        {
          id: "e1",
          source: { id: "s1", name: "S1" },
          note: "new",
          status: "pending",
          observedAt: "2026-08-06T00:00:00.000Z",
        },
      ]);

      const result = deduplicateEvidence(evidence);

      expect(result[0]?.note).toBe("new");
    });
  });

  describe("deduplicateContent", () => {
    it("removes duplicates with identical source and note", () => {
      const evidence = evidenceList([
        {
          id: "e1",
          source: { id: "s1", name: "S1" },
          note: "same",
          status: "verified",
          observedAt: "2026-08-01T00:00:00.000Z",
        },
        {
          id: "e2",
          source: { id: "s1", name: "S1" },
          note: "same",
          status: "verified",
          observedAt: "2026-08-01T00:00:00.000Z",
        },
        {
          id: "e3",
          source: { id: "s2", name: "S2" },
          note: "different",
          status: "verified",
          observedAt: "2026-08-01T00:00:00.000Z",
        },
      ]);

      const result = deduplicateContent(evidence);

      expect(result).toHaveLength(2);
    });
  });

  describe("weightEvidence", () => {
    it("gives verified evidence more weight than demo evidence", () => {
      const verified = evidenceList([
        {
          id: "e1",
          source: { id: "s1", name: "S1" },
          note: "v",
          status: "verified",
          observedAt: "2026-08-06T00:00:00.000Z",
        },
      ]);
      const demo = evidenceList([
        {
          id: "e1",
          source: { id: "s1", name: "S1" },
          note: "d",
          status: "demo",
          observedAt: "2026-08-06T00:00:00.000Z",
        },
      ]);

      expect(weightEvidence(verified, REFERENCE_DATE)).toBeGreaterThan(
        weightEvidence(demo, REFERENCE_DATE),
      );
    });

    it("decays stale evidence toward zero", () => {
      const fresh = evidenceList([
        {
          id: "e1",
          source: { id: "s1", name: "S1" },
          note: "f",
          status: "verified",
          observedAt: "2026-08-06T00:00:00.000Z",
        },
      ]);
      const stale = evidenceList([
        {
          id: "e1",
          source: { id: "s1", name: "S1" },
          note: "s",
          status: "verified",
          observedAt: "2020-01-01T00:00:00.000Z",
        },
      ]);

      expect(weightEvidence(fresh, REFERENCE_DATE)).toBeGreaterThan(
        weightEvidence(stale, REFERENCE_DATE),
      );
    });

    it("is deterministic for identical inputs", () => {
      const evidence = evidenceList([
        {
          id: "e1",
          source: { id: "s1", name: "S1" },
          note: "a",
          status: "pending",
          observedAt: "2026-07-01T00:00:00.000Z",
        },
        {
          id: "e2",
          source: { id: "s2", name: "S2" },
          note: "b",
          status: "draft",
          observedAt: "2026-07-15T00:00:00.000Z",
        },
      ]);

      expect(weightEvidence(evidence, REFERENCE_DATE)).toBe(
        weightEvidence(evidence, REFERENCE_DATE),
      );
    });
  });

  describe("bestEvidence", () => {
    it("returns undefined for an empty set", () => {
      expect(bestEvidence([])).toBeUndefined();
    });

    it("returns the highest-trust record", () => {
      const evidence = evidenceList([
        {
          id: "e1",
          source: { id: "s1", name: "S1" },
          note: "d",
          status: "demo",
          observedAt: "2026-08-06T00:00:00.000Z",
        },
        {
          id: "e2",
          source: { id: "s2", name: "S2" },
          note: "v",
          status: "verified",
          observedAt: "2026-08-06T00:00:00.000Z",
        },
      ]);

      expect(bestEvidence(evidence)?.id).toBe("e2");
    });
  });
});
