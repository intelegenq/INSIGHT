import { describe, expect, it } from "vitest";
import { STATUS_WEIGHT as CORE_STATUS_WEIGHT } from "@insight/core";
import { STATUS_WEIGHT as INTELLIGENCE_STATUS_WEIGHT } from "@insight/intelligence";
import { STATUS_WEIGHT as KNOWLEDGE_STATUS_WEIGHT } from "@insight/knowledge";

/**
 * Cross-package identity check: STATUS_WEIGHT must come from a single
 * source of truth. Re-exports from intelligence and knowledge must
 * reference the same canonical object as @insight/core.
 *
 * This test lives in @insight/runtime because it is the only package
 * in the dependency graph that depends on both intelligence and
 * knowledge, so it can resolve all three imports.
 */
describe("STATUS_WEIGHT — single source of truth", () => {
  it("intelligence re-exports the same STATUS_WEIGHT object as core", () => {
    expect(INTELLIGENCE_STATUS_WEIGHT).toBe(CORE_STATUS_WEIGHT);
  });

  it("knowledge re-exports the same STATUS_WEIGHT object as core", () => {
    expect(KNOWLEDGE_STATUS_WEIGHT).toBe(CORE_STATUS_WEIGHT);
  });

  it("all three packages yield identical values for every status", () => {
    for (const status of ["verified", "pending", "draft", "demo"] as const) {
      expect(INTELLIGENCE_STATUS_WEIGHT[status]).toBe(CORE_STATUS_WEIGHT[status]);
      expect(KNOWLEDGE_STATUS_WEIGHT[status]).toBe(CORE_STATUS_WEIGHT[status]);
    }
  });

  it("the canonical weight table is in @insight/core", () => {
    expect(Object.keys(CORE_STATUS_WEIGHT).sort()).toEqual([
      "demo",
      "draft",
      "pending",
      "verified",
    ]);
  });
});
