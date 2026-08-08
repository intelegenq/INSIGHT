import type { DataProvider, ProviderHealth } from "../interfaces/DataProvider";

export interface ProviderHealthRecord extends ProviderHealth {
  checkedAt: string;
  durationMs: number;
}

export interface HealthCheckResult {
  providers: ProviderHealthRecord[];
  summary: {
    total: number;
    healthy: number;
    unhealthy: number;
    checkedAt: string;
    durationMs: number;
  };
}

export interface SourceHealthMonitorConfig {
  timeoutMs?: number;
}

export class SourceHealthMonitor {
  private readonly providers: Map<string, DataProvider>;
  private readonly config: Required<SourceHealthMonitorConfig>;
  private healthHistory: ProviderHealthRecord[] = [];

  constructor(
    providers: Map<string, DataProvider> = new Map(),
    config: SourceHealthMonitorConfig = {},
  ) {
    this.providers = providers;
    this.config = {
      timeoutMs: config.timeoutMs ?? 10_000,
    };
  }

  addProvider(name: string, provider: DataProvider): this {
    this.providers.set(name, provider);
    return this;
  }

  removeProvider(name: string): this {
    this.providers.delete(name);
    return this;
  }

  getProviderNames(): string[] {
    return Array.from(this.providers.keys());
  }

  async checkAll(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const checkedAt = new Date().toISOString();
    const records: ProviderHealthRecord[] = [];

    const checkPromises = Array.from(this.providers.entries()).map(
      async ([providerName, provider]) => {
        const providerStart = Date.now();
        try {
          const healthPromise = provider.health();
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`health check timeout after ${this.config.timeoutMs}ms`)), this.config.timeoutMs)
          );
          const health = await Promise.race([healthPromise, timeoutPromise]);
          const durationMs = Date.now() - providerStart;
          const record: ProviderHealthRecord = {
            ...health,
            checkedAt,
            durationMs,
          };
          records.push(record);
          this.healthHistory.push(record);
        } catch (error) {
          const durationMs = Date.now() - providerStart;
          const record: ProviderHealthRecord = {
            id: providerName,
            name: providerName,
            available: false,
            note: error instanceof Error ? error.message : "health check failed",
            checkedAt,
            durationMs,
          };
          records.push(record);
          this.healthHistory.push(record);
        }
      }
    );

    await Promise.all(checkPromises);

    const durationMs = Date.now() - startTime;
    const healthy = records.filter(r => r.available).length;
    const unhealthy = records.filter(r => !r.available).length;

    return {
      providers: records,
      summary: {
        total: records.length,
        healthy,
        unhealthy,
        checkedAt,
        durationMs,
      },
    };
  }

  async checkProvider(name: string): Promise<ProviderHealthRecord | undefined> {
    const provider = this.providers.get(name);
    if (!provider) return undefined;

    const checkedAt = new Date().toISOString();
    const providerStart = Date.now();

    try {
      const healthPromise = provider.health();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`health check timeout after ${this.config.timeoutMs}ms`)), this.config.timeoutMs)
      );
      const health = await Promise.race([healthPromise, timeoutPromise]);
      const durationMs = Date.now() - providerStart;
      const record: ProviderHealthRecord = {
        ...health,
        checkedAt,
        durationMs,
      };
      this.healthHistory.push(record);
      return record;
    } catch (error) {
      const durationMs = Date.now() - providerStart;
      const record: ProviderHealthRecord = {
        id: name,
        name: name,
        available: false,
        note: error instanceof Error ? error.message : "health check failed",
        checkedAt,
        durationMs,
      };
      this.healthHistory.push(record);
      return record;
    }
  }

  getHealthHistory(providerId?: string): ProviderHealthRecord[] {
    if (providerId) {
      return this.healthHistory.filter(r => r.id === providerId);
    }
    return [...this.healthHistory];
  }

  clearHistory(): this {
    this.healthHistory = [];
    return this;
  }

  getLatestHealth(providerId: string): ProviderHealthRecord | undefined {
    const history = this.healthHistory.filter(r => r.id === providerId);
    return history.length > 0 ? history[history.length - 1] : undefined;
  }
}