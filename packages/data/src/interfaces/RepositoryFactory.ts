import type { DataProvider } from "./DataProvider";
import { DemoProvider } from "../providers/DemoProvider";
import { MockProvider } from "../providers/MockProvider";
import type { ProjectRepository } from "../repositories/projectRepository";
import { CompositeRepository } from "../repositories/CompositeRepository";
import type { CompositeRepositoryOptions } from "../repositories/CompositeRepository";

/**
 * RepositoryFactory — the single place providers are swapped in.
 *
 * Consumers depend on {@link ProjectRepository}; this factory decides which
 * provider(s) back it. To switch data sources, change the `provider` key —
 * nothing else in the codebase needs to know.
 */

export type ProviderKey = "demo" | "mock" | DataProvider;

/** Options accepted when creating a repository. */
export interface RepositoryFactoryOptions {
  provider: ProviderKey;
  /** Extra repository options (pulse/timeline/reports seeds). */
  repository?: Omit<CompositeRepositoryOptions, "providers">;
}

const registry: Record<string, () => DataProvider> = {
  demo: () => new DemoProvider(),
  mock: () => new MockProvider(),
};

function isProviderObject(value: ProviderKey): value is DataProvider {
  return typeof value === "object" && value !== null;
}

function resolveProvider(provider: ProviderKey): DataProvider {
  if (isProviderObject(provider)) {
    return provider;
  }
  const factory = registry[provider];
  if (factory === undefined) {
    throw new Error(`Unknown data provider: ${provider}`);
  }
  return factory();
}

/**
 * Create a repository synchronously from a static provider.
 * Static providers (demo/mock) expose payloads synchronously, so the
 * returned repository is immediately ready — this keeps the runtime
 * pipeline synchronous and unchanged.
 */
export function createStaticRepository(options: RepositoryFactoryOptions): ProjectRepository {
  const provider = resolveProvider(options.provider);
  return CompositeRepository.fromStatic(provider, options.repository);
}

/**
 * Create a repository asynchronously from any provider.
 * Required for non-static providers (real ingestion sources) whose
 * payloads are only available after an awaited fetch.
 */
export async function createRepository(
  options: RepositoryFactoryOptions,
): Promise<ProjectRepository> {
  const provider = resolveProvider(options.provider);
  const repository = new CompositeRepository({
    ...options.repository,
    providers: [provider],
  });
  await repository.load();
  return repository;
}

/** Namespaced factory matching the milestone API. */
export const RepositoryFactory = {
  create: createRepository,
  createStatic: createStaticRepository,
};
