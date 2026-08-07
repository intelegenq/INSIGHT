import { describe, expect, it } from "vitest";
import { CompositeRepository } from "../src/repositories/CompositeRepository";
import { demoProvider, demoRaw } from "../src/providers/DemoProvider";
import { mockProvider, mockRaw } from "../src/providers/MockProvider";
import { RepositoryFactory } from "../src/interfaces/RepositoryFactory";
import { MemoryCache } from "../src/cache/MemoryCache";
import { policy } from "../src/cache/CachePolicy";
import { transformEvidenceList } from "../src/transformers/evidence";
import { transformNarrativeList } from "../src/transformers/narrative";
import { transformProjectList } from "../src/transformers/project";
import { projectRepository } from "../src/repositories/defaultProjectRepository";
import { projects, evidenceByTopic } from "../src/fixtures/projects";
import { narratives } from "../src/fixtures/narratives";
import { reports } from "../src/fixtures/reports";

describe("DemoProvider", () => {
  it("implements the DataProvider contract", async () => {
    const [projectsFetch, evidenceFetch, narrativesFetch, health] = await Promise.all([
      demoProvider.fetchProjects(),
      demoProvider.fetchEvidence(),
      demoProvider.fetchNarratives(),
      demoProvider.health(),
    ]);

    expect(projectsFetch.data.length).toBeGreaterThan(0);
    expect(evidenceFetch.data.length).toBeGreaterThan(0);
    expect(narrativesFetch.data.length).toBeGreaterThan(0);
    expect(health.available).toBe(true);
    expect(health.id).toBe("demo");
  });

  it("produces output identical to the legacy fixtures after transformation", async () => {
    const projectsFetch = await demoProvider.fetchProjects();
    const evidenceFetch = await demoProvider.fetchEvidence();
    const narrativesFetch = await demoProvider.fetchNarratives();

    expect(transformProjectList(projectsFetch.data)).toEqual(projects);
    expect(transformEvidenceList(evidenceFetch.data)).toEqual(Object.values(evidenceByTopic));
    expect(transformNarrativeList(narrativesFetch.data)).toEqual(narratives);
  });

  it("is deterministic: repeated fetches return identical payloads", async () => {
    const first = await demoProvider.fetchProjects();
    const second = await demoProvider.fetchProjects();

    expect(first).toEqual(second);
  });
});

describe("MockProvider", () => {
  it("serves its own distinct dataset", async () => {
    const projectsFetch = await mockProvider.fetchProjects();

    expect(projectsFetch.data[0]?.id).toBe("mock-stable-swap");
    expect(mockProvider.id).toBe("mock");
  });

  it("reports health correctly", async () => {
    const health = await mockProvider.health();
    expect(health.available).toBe(true);
  });
});

describe("CompositeRepository", () => {
  it("merges demo and mock providers deterministically", async () => {
    const repository = new CompositeRepository({ providers: [demoProvider, mockProvider] });
    await repository.load();

    const all = repository.getProjects();
    expect(all.length).toBe(demoRaw.projects.length + mockRaw.projects.length);
    // mock-stable-swap appended after demo projects (provider order preserved)
    expect(all.at(-1)?.id).toBe("mock-stable-swap");
  });

  it("drops duplicate ids deterministically (first provider wins)", async () => {
    const repository = new CompositeRepository({ providers: [demoProvider, demoProvider] });
    await repository.load();

    expect(repository.getProjects()).toHaveLength(demoRaw.projects.length);
    expect(repository.getNarratives()).toHaveLength(demoRaw.narratives.length);
  });

  it("serves merged narratives and evidence", async () => {
    const repository = new CompositeRepository({ providers: [demoProvider, mockProvider] });
    await repository.load();

    expect(repository.getNarratives().length).toBe(
      demoRaw.narratives.length + mockRaw.narratives.length,
    );
    expect(repository.getEvidence("mock-evidence-swap")?.note).toBe(
      "Illustrative AMM volume signal for tests",
    );
  });
});

describe("MemoryCache", () => {
  it("stores and reads values", () => {
    const cache = new MemoryCache(policy({ ttlMs: 1000 }));
    cache.set("a", { value: 1 });

    expect(cache.get("a")).toEqual({ value: 1 });
    expect(cache.has("a")).toBe(true);
  });

  it("expires entries after TTL using injected clock", () => {
    let now = 1_000;
    const cache = new MemoryCache(policy({ ttlMs: 500 }), () => now);

    cache.set("a", 1);
    expect(cache.get("a")).toBe(1);

    now = 1_600;
    expect(cache.expired("a")).toBe(true);
    expect(cache.get("a")).toBeUndefined();
  });

  it("deletes and clears entries", () => {
    const cache = new MemoryCache(policy({ ttlMs: 1000 }));
    cache.set("a", 1);
    cache.set("b", 2);

    cache.delete("a");
    expect(cache.get("a")).toBeUndefined();
    expect(cache.has("b")).toBe(true);

    cache.clear();
    expect(cache.size()).toBe(0);
  });

  it("respects maxEntries", () => {
    const cache = new MemoryCache(policy({ ttlMs: 1000, maxEntries: 2 }));
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);

    expect(cache.size()).toBeLessThanOrEqual(2);
  });
});

describe("RepositoryFactory", () => {
  it("creates a demo repository synchronously", () => {
    const repository = RepositoryFactory.createStatic({ provider: "demo" });

    expect(repository.getProjects().length).toBeGreaterThan(0);
    expect(repository.getNarratives().length).toBeGreaterThan(0);
  });

  it("creates a mock repository synchronously", () => {
    const repository = RepositoryFactory.createStatic({ provider: "mock" });

    expect(repository.getProjects()[0]?.id).toBe("mock-stable-swap");
  });

  it("creates repositories asynchronously too", async () => {
    const repository = await RepositoryFactory.create({ provider: "demo" });

    expect(repository.getProjects().length).toBeGreaterThan(0);
  });

  it("rejects unknown providers", () => {
    expect(() => RepositoryFactory.createStatic({ provider: "nope" as never })).toThrow(
      /Unknown data provider/,
    );
  });
});

describe("Default project repository (compat)", () => {
  it("matches the legacy fixtures exactly", () => {
    expect(projectRepository.getProjects()).toEqual(projects);
    expect(projectRepository.getNarratives()).toEqual(narratives);
    expect(projectRepository.getReports()).toEqual(reports);
  });

  it("serves evidence and resolves evidence ids", () => {
    const evidence = projectRepository.getEvidence("evidence-telemetry");
    expect(evidence?.source.name).toBe("Protocol telemetry");

    const resolved = projectRepository.resolveEvidenceIds(["evidence-telemetry", "missing"]);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.id).toBe("evidence-telemetry");
  });

  it("serves pulse and timeline", () => {
    expect(projectRepository.getPulse().metrics.length).toBeGreaterThan(0);
    expect(projectRepository.getTimeline().length).toBeGreaterThan(0);
  });
});
