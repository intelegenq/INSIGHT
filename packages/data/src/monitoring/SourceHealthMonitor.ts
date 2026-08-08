import type { DataProvider, ProviderHealth } from "../interfaces/DataProvider";

export type SourceHealthStatus = "healthy" | "degraded" | "unavailable";

export interface SourceHealthEntry extends ProviderHealth {
  status: SourceHealthStatus;
}

export interface SourceHealthReport {
  status: SourceHealthStatus;
  checkedAt: string;
  providers: SourceHealthEntry[];
  summary: {
    total: number;
    healthy: number;
    unavailable: number;
  };
}

export interface SourceHealthMonitorOptions {
  checkedAt: string;
}

function sourceStatus(health: ProviderHealth): SourceHealthStatus {
  return health.available ? "healthy" : "unavailable";
}

function reportStatus(entries: SourceHealthEntry[]): SourceHealthStatus {
  if (entries.length === 0 || entries.every((entry) => entry.status === "unavailable")) {
    return "unavailable";
  }

  return entries.every((entry) => entry.status === "healthy") ? "healthy" : "degraded";
}

function failureHealth(provider: DataProvider, error: unknown): SourceHealthEntry {
  const message = error instanceof Error ? error.message : "unknown health check failure";

  return {
    id: provider.id,
    name: provider.name,
    available: false,
    note: message,
    status: "unavailable",
  };
}

export async function checkSourceHealth(
  providers: readonly DataProvider[],
  options: SourceHealthMonitorOptions,
): Promise<SourceHealthReport> {
  const health = await Promise.all(
    providers.map(async (provider) => {
      try {
        const result = await provider.health();
        return { ...result, status: sourceStatus(result) };
      } catch (error) {
        return failureHealth(provider, error);
      }
    }),
  );

  const entries = health.sort((a, b) => a.id.localeCompare(b.id));
  const healthy = entries.filter((entry) => entry.status === "healthy").length;
  const unavailable = entries.length - healthy;

  return {
    status: reportStatus(entries),
    checkedAt: options.checkedAt,
    providers: entries,
    summary: {
      total: entries.length,
      healthy,
      unavailable,
    },
  };
}

export class SourceHealthMonitor {
  constructor(private readonly providers: readonly DataProvider[]) {}

  check(options: SourceHealthMonitorOptions): Promise<SourceHealthReport> {
    return checkSourceHealth(this.providers, options);
  }
}
