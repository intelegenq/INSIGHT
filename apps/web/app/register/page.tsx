"use client";

import Link from "next/link";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, displayName: displayName || undefined }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error?.message ?? "Registration failed");
        }
        router.push("/saved");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    },
    [email, password, displayName, router],
  );

  return (
    <div className="page">
      <nav className="nav" aria-label="Primary navigation">
        <Link href="/" className="nav-brand">
          Insight
        </Link>
        <div className="nav-links">
          <Link href="/projects">Projects</Link>
          <Link href="/narratives">Narratives</Link>
          <Link href="/reports">Reports</Link>
          <Link href="/assistant">Assistant</Link>
        </div>
      </nav>

      <main className="auth-container">
        <div className="auth-card">
          <h1>Create account</h1>
          <p className="auth-subtitle">Save research, track sessions, and build briefs.</p>

          <form onSubmit={handleSubmit} className="auth-form">
            <label className="form-label">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="form-input"
                placeholder="you@example.com"
              />
            </label>
            <label className="form-label">
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="form-input"
                placeholder="••••••••"
                minLength={8}
              />
            </label>
            <label className="form-label">
              Display name <span className="optional">(optional)</span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={loading}
                className="form-input"
                placeholder="Your name"
              />
            </label>
            {error && <div className="auth-error">{error}</div>}
            <button type="submit" className="primary-button" disabled={loading}>
              {loading ? "Creating..." : "Create account"}
            </button>
          </form>

          <p className="auth-switch">
            Already have an account? <Link href="/login">Sign in</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
