import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { CopilotProvider } from "../components/Copilot";
import { Sidebar } from "../components/Sidebar";

export const metadata: Metadata = {
  title: "Insight — Solana Intelligence Terminal",
  description:
    "Real-time intelligence for the Solana ecosystem. Evidence-backed analytics, breaking alerts, and grounded AI.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{const t=localStorage.getItem('insight-theme')||'dark';document.documentElement.setAttribute('data-theme',t)}catch(e){}`,
          }}
        />
      </head>
      <body>
        <CopilotProvider>
          <div className="app-shell">
            <Sidebar />
            <div className="main-content">{children}</div>
          </div>
        </CopilotProvider>
      </body>
    </html>
  );
}
