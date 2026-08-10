import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";
import { CopilotProvider } from "../components/Copilot";

export const metadata: Metadata = {
  title: "Insight — Solana Intelligence Terminal",
  description:
    "Real-time intelligence for the Solana ecosystem. Evidence-backed analytics, breaking alerts, and grounded AI.",
};

const navLinks = [
  { href: "/", label: "Overview" },
  { href: "/markets", label: "Markets" },
  { href: "/analytics", label: "Analytics" },
  { href: "/ecosystem", label: "Ecosystem" },
  { href: "/network", label: "Network" },
  { href: "/solana-now", label: "Solana Now" },
  { href: "/research", label: "Research" },
  { href: "/alerts", label: "Alerts" },
  { href: "/assistant", label: "Ask Insight" },
];

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <CopilotProvider>
          <nav className="terminal-nav">
            <Link href="/" className="terminal-brand">
              <span className="terminal-brand-icon">◎</span>
              Insight
            </Link>
            <div className="terminal-nav-links">
              {navLinks.map((l) => (
                <Link key={l.href} href={l.href} className="terminal-nav-link">
                  {l.label}
                </Link>
              ))}
            </div>
            <div className="terminal-nav-right">
              <span className="terminal-status">
                <span className="terminal-status-dot" />
                LIVE
              </span>
            </div>
          </nav>
          {children}
        </CopilotProvider>
      </body>
    </html>
  );
}
