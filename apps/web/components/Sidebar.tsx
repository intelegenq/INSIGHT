"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

interface Project {
  id: string;
  name: string;
  category: string;
  metrics: { tvl?: number; volume24h?: number };
  slug?: string;
}

// Expandable analysis categories → which project categories they include.
// Keys match real categories present in the data (defi, yield, lending,
// liquid-staking, restaking, derivatives, rwa, bridge, nft, payments, …).
const CATEGORY_GROUPS: { key: string; label: string; match: string[] }[] = [
  { key: "defi", label: "DeFi / DEX", match: ["defi"] },
  { key: "lending", label: "Lending", match: ["lending"] },
  { key: "yield", label: "Yield", match: ["yield"] },
  { key: "liquid-staking", label: "Liquid Staking", match: ["liquid-staking", "restaking"] },
  { key: "derivatives", label: "Perps", match: ["derivatives"] },
  { key: "rwa", label: "RWA", match: ["rwa"] },
  { key: "bridge", label: "Bridges", match: ["bridge"] },
  { key: "stablecoins", label: "Stablecoins", match: ["stablecoins"] },
  { key: "nft", label: "NFT", match: ["nft"] },
  { key: "payments", label: "Payments", match: ["payments"] },
];

function slugify(p: Project): string {
  if (p.slug) return encodeURIComponent(p.slug.split("/")[0]);
  return encodeURIComponent(p.name.toLowerCase().replace(/\s+/g, "-"));
}

export function Sidebar() {
  const pathname = usePathname();
  const [projects, setProjects] = useState<Project[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/projects?classification=solana_ecosystem");
        const data = await res.json();
        setProjects(data.projects || []);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const grouped = useMemo(() => {
    const out: Record<string, Project[]> = {};
    for (const g of CATEGORY_GROUPS) {
      out[g.key] = projects
        .filter((p) => g.match.includes(p.category))
        .sort((a, b) => (b.metrics?.tvl ?? 0) - (a.metrics?.tvl ?? 0))
        .slice(0, 10);
    }
    return out;
  }, [projects]);

  // Global search across all projects
  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return projects
      .filter((p) => p.name.toLowerCase().includes(q))
      .sort((a, b) => (b.metrics?.tvl ?? 0) - (a.metrics?.tvl ?? 0))
      .slice(0, 12);
  }, [search, projects]);

  const toggle = (key: string) =>
    setExpanded((e) => ({ ...e, [key]: !e[key] }));

  const isActive = (href: string) => pathname === href;

  return (
    <aside className="sidebar">
      <Link href="/" className="sidebar-brand">
        <span className="sidebar-brand-icon">◎</span>
        Insight
      </Link>

      <div className="sidebar-search-wrap">
        <input
          className="sidebar-search"
          placeholder="Search protocols…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {search.trim() ? (
        <div className="sidebar-search-results">
          {searchResults.length === 0 ? (
            <div className="sidebar-empty">No matches.</div>
          ) : (
            searchResults.map((p) => (
              <Link
                key={p.id}
                href={`/analytics/${slugify(p)}`}
                className="sidebar-sublink"
                onClick={() => setSearch("")}
              >
                {p.name}
              </Link>
            ))
          )}
        </div>
      ) : (
        <>
          <div className="sidebar-section-label">Data</div>
          <Link href="/" className={`sidebar-link${isActive("/") ? " active" : ""}`}>
            Dashboard
          </Link>
          <Link
            href="/network"
            className={`sidebar-link${isActive("/network") ? " active" : ""}`}
          >
            Network
          </Link>

          <div className="sidebar-section-label">Analysis</div>
          <Link
            href="/analytics"
            className={`sidebar-link${isActive("/analytics") ? " active" : ""}`}
          >
            Overview
          </Link>

          {CATEGORY_GROUPS.map((g) => {
            const items = grouped[g.key] || [];
            if (items.length === 0) return null;
            const open = expanded[g.key];
            return (
              <div key={g.key}>
                <button
                  className="sidebar-group-toggle"
                  onClick={() => toggle(g.key)}
                  aria-expanded={open}
                >
                  {g.label}
                  <span className={`sidebar-chevron${open ? " open" : ""}`}>⌄</span>
                </button>
                {open && (
                  <div className="sidebar-sublist">
                    {items.map((p) => {
                      const href = `/analytics/${slugify(p)}`;
                      return (
                        <Link
                          key={p.id}
                          href={href}
                          className={`sidebar-sublink${isActive(href) ? " active" : ""}`}
                        >
                          {p.name}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <div className="sidebar-section-label">Insights</div>
          <Link
            href="/research"
            className={`sidebar-link${isActive("/research") ? " active" : ""}`}
          >
            Research
          </Link>
        </>
      )}

      <div className="sidebar-spacer" />
      <ThemeToggle />
    </aside>
  );
}
