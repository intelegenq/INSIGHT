import Link from "next/link";
import type { Narrative, NarrativeTrend } from "@insight/core";
import { headers } from "next/headers";

function trendLabel(trend: NarrativeTrend): string {
  switch (trend) {
    case "up":
      return "↑ Up";
    case "down":
      return "↓ Down";
    case "flat":
      return "→ Flat";
    case "watch":
      return "⊙ Watch";
  }
}

function trendClass(trend: NarrativeTrend): string {
  switch (trend) {
    case "up":
      return "trend-up";
    case "down":
      return "trend-down";
    case "flat":
      return "trend-flat";
    case "watch":
      return "trend-watch";
  }
}

async function fetchNarratives(): Promise<Narrative[]> {
  const baseUrl = process.env["NEXT_PUBLIC_BASE_URL"] ?? "";
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  const apiUrl = baseUrl || (host ? `${proto}://${host}` : "http://localhost:3000");
  const res = await fetch(`${apiUrl}/api/narratives`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as { narratives: Narrative[] };
  return data.narratives;
}

export default async function NarrativesPage() {
  const narratives = await fetchNarratives();

  return (
    <main>
      <nav className="nav" aria-label="Primary navigation">
        <Link className="brand" href="/">
          <span>◎</span> insight
        </Link>
        <div className="nav-links">
          <Link href="/#pulse">Pulse</Link>
          <Link href="/narratives">Narratives</Link>
          <Link href="/reports">Reports</Link>
          <Link href="/assistant">Assistant</Link>
          <Link href="/graph">Graph</Link>
          <Link href="/health">Health</Link>
          <Link href="/history">History</Link>
          <Link href="/search">Search</Link>
          <Link href="/compare">Compare</Link>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/trends">Trends</Link>
        </div>
        <Link className="ghost-button" href="/reports">
          Research mode <span>↗</span>
        </Link>
      </nav>

      <section className="hero narratives-hero">
        <p className="eyebrow">NARRATIVE TRENDS</p>
        <h1>
          Themes shaping
          <br />
          <em>the ecosystem.</em>
        </h1>
        <p className="hero-copy">
          Narratives connect signals across projects into research starting points. Each theme links
          to representative projects and the evidence behind it.
        </p>
      </section>

      <section className="section" aria-labelledby="narratives-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">EXPLORE</p>
            <h2 id="narratives-title">Active narratives</h2>
          </div>
        </div>
        <div className="narrative-grid">
          {narratives.map((n) => (
            <Link href={`/narratives/${n.id}`} key={n.id} className="narrative-card-link">
              <article className="narrative-card">
                <div className="narrative-card-header">
                  <h3>{n.name}</h3>
                  <span className={`trend-badge ${trendClass(n.trend)}`}>
                    {trendLabel(n.trend)}
                  </span>
                </div>
                {n.change && <p className="change">{n.change}</p>}
                <p className="note">{n.note}</p>
                <div className="narrative-links">
                  {n.projectIds.length > 0 && (
                    <span className="count">{n.projectIds.length} projects</span>
                  )}
                  {n.evidenceIds.length > 0 && (
                    <span className="count">{n.evidenceIds.length} evidence</span>
                  )}
                </div>
              </article>
            </Link>
          ))}
        </div>
      </section>

      <footer>
        <Link className="brand" href="/">
          <span>◎</span> insight
        </Link>
        <p>Built for better questions about Solana.</p>
        <p>© 2026 Insight</p>
      </footer>
    </main>
  );
}
