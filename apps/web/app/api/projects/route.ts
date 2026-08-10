import { getInsightService } from "../../../lib/insight-service";
import { errorFromUnknown, ok, requestIdFromRequest } from "../../../lib/api";
import type { EntityClassification } from "@insight/core";

export function GET(): Promise<Response>;
export function GET(request: Request): Promise<Response>;
export async function GET(request?: Request): Promise<Response> {
  const requestId = requestIdFromRequest(request);
  try {
    const service = getInsightService();
    const allProjects = await service.listProjects();

    // Parse ?classification= query param (default: solana_ecosystem)
    const url = request ? new URL(request.url) : undefined;
    const classification = url?.searchParams.get("classification") ?? "solana_ecosystem";

    let projects: typeof allProjects;

    if (classification === "all") {
      // Return everything
      projects = allProjects;
    } else if (classification === "market_context" || classification === "network") {
      // Return only the specified classification
      projects = allProjects.filter(
        (p) => p.classification === (classification as EntityClassification),
      );
    } else {
      // Default: solana_ecosystem — return projects where classification is
      // undefined (legacy, treated as solana_ecosystem) or explicitly "solana_ecosystem".
      projects = allProjects.filter(
        (p) => p.classification === undefined || p.classification === "solana_ecosystem",
      );
    }

    return ok({ projects, count: projects.length });
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}
