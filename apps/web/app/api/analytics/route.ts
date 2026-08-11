import { getInsightService } from "../../../lib/insight-service";
import { errorFromUnknown, ok, requestIdFromRequest } from "../../../lib/api";

/**
 * GET /api/analytics — returns time-series data for charts.
 * Aggregates metrics across available snapshots.
 *
 * All analytics calculations (totalTvl, categoryDistribution, topByTvl)
 * are restricted to solana_ecosystem projects — market_context (CEXs)
 * and network entries are excluded.
 */
export async function GET(request: Request): Promise<Response> {
  const requestId = requestIdFromRequest(request);
  try {
    const service = getInsightService();
    await service.ready();

    const snapshots = await service.listSnapshots();
    const allProjects = await service.listProjects();
    const pulse = await service.getPulse();

    // Filter to solana_ecosystem only — exclude market_context, network, and chain-level entries
    const projects = allProjects.filter(
      (p) =>
        (p.classification === undefined || p.classification === "solana_ecosystem") &&
        p.name.toLowerCase() !== "solana" &&
        !p.id.toLowerCase().startsWith("solana-"),
    );

    const sorted = [...snapshots].sort(
      (a, b) => new Date(a.referenceDate).getTime() - new Date(b.referenceDate).getTime(),
    );

    const timeSeries = sorted.map((s) => ({
      label: new Date(s.referenceDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      projectCount: s.projects.length,
      narrativeCount: s.narratives.length,
      evidenceCount: s.evidence.length,
    }));

    const categoryMap = new Map<string, number>();
    for (const p of projects) {
      const cat = p.category;
      categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + 1);
    }
    const categoryDistribution = Array.from(categoryMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    const topByTvl = [...projects]
      .sort((a, b) => (b.metrics?.tvl ?? 0) - (a.metrics?.tvl ?? 0))
      .slice(0, 10)
      .map((p) => ({
        name: p.name,
        tvl: p.metrics?.tvl ?? 0,
        volume24h: p.metrics?.volume24h ?? 0,
        category: p.category,
        id: p.id,
      }));

    const totalTvl = projects.reduce((s, p) => s + (p.metrics?.tvl ?? 0), 0);
    const totalVolume = projects.reduce((s, p) => s + (p.metrics?.volume24h ?? 0), 0);

    const getMetric = (id: string) => pulse.metrics.find((m) => m.id === id)?.value ?? "—";

    return ok({
      timeSeries,
      categoryDistribution,
      topByTvl,
      totalTvl,
      totalVolume,
      projectCount: projects.length,
      categoryCount: categoryMap.size,
      snapshotCount: snapshots.length,
      pulse: {
        projects: getMetric("projects"),
        narratives: getMetric("narratives"),
        evidence: getMetric("evidence"),
        graph: getMetric("graph"),
      },
    });
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}
