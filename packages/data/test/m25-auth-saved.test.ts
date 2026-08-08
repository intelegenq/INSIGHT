import { mkdtempSync, existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  AuthenticationService,
  AuthValidationError,
} from "../src/auth/index";
import { SavedResearchClient, summarize } from "../src/saved/index";

let dataDir: string;
beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), "insight-m25-"));
});
afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

describe("AuthenticationService", () => {
  it("registers a user and returns a session", () => {
    const auth = new AuthenticationService({ dataDir });
    const { user, session } = auth.register("alice@example.com", "password123", "Alice");
    expect(user.email).toBe("alice@example.com");
    expect(user.displayName).toBe("Alice");
    expect(session.token).toBeTruthy();
  });

  it("rejects invalid email and short password", () => {
    const auth = new AuthenticationService({ dataDir });
    expect(() => auth.register("nope", "password123")).toThrow(AuthValidationError);
    expect(() => auth.register("bob@example.com", "short")).toThrow(AuthValidationError);
  });

  it("rejects duplicate registration", () => {
    const auth = new AuthenticationService({ dataDir });
    auth.register("alice@example.com", "password123");
    expect(() => auth.register("ALICE@example.com", "password123")).toThrow(AuthValidationError);
  });

  it("logs in with correct credentials and rejects bad ones", () => {
    const auth = new AuthenticationService({ dataDir });
    auth.register("alice@example.com", "password123");
    const { session } = auth.login("alice@example.com", "password123");
    expect(session.token).toBeTruthy();
    expect(() => auth.login("alice@example.com", "wrongpassword")).toThrow(AuthValidationError);
  });

  it("resolves user for active session and undefined after logout", () => {
    const auth = new AuthenticationService({ dataDir });
    const { user, session } = auth.register("alice@example.com", "password123");
    const resolved = auth.getUserForSession(session.token);
    expect(resolved?.id).toBe(user.id);
    auth.logout(session.token);
    expect(auth.getUserForSession(session.token)).toBeUndefined();
  });

  it("persists users and sessions to disk", () => {
    const auth = new AuthenticationService({ dataDir });
    const { session } = auth.register("alice@example.com", "password123");
    const storeFile = join(dataDir, "store.json");
    expect(existsSync(storeFile)).toBe(true);

    // New instance loads persisted store.
    const reloaded = new AuthenticationService({ dataDir });
    expect(reloaded.getUserForSession(session.token)).toBeTruthy();
  });

  it("never exposes the password hash publicly", () => {
    const auth = new AuthenticationService({ dataDir });
    const { user } = auth.register("alice@example.com", "password123");
    expect(user).not.toHaveProperty("passwordHash");
  });
});

describe("SavedResearchClient", () => {
  it("saves and lists reports, narratives, projects", () => {
    const c = new SavedResearchClient({ dataDir, userId: "user_1" });
    c.saveReport("rep_1", "defi", "DeFi Brief");
    c.saveNarrative("nar_1", "Liquid Staking");
    c.saveProject("proj_1", "Jupiter");

    expect(c.listReports()[0]?.title).toBe("DeFi Brief");
    expect(c.listNarratives()[0]?.name).toBe("Liquid Staking");
    expect(c.listProjects()[0]?.name).toBe("Jupiter");
  });

  it("dedupes repeated saves", () => {
    const c = new SavedResearchClient({ dataDir, userId: "user_1" });
    c.saveReport("rep_1", "defi", "Brief");
    c.saveReport("rep_1", "defi", "Brief");
    expect(c.listReports().length).toBe(1);
  });

  it("creates and lists research sessions", () => {
    const c = new SavedResearchClient({ dataDir, userId: "user_1" });
    c.createSession({ title: "LST roundup", lens: "defi", projectIds: ["proj_1"] });
    const sessions = c.listSessions();
    expect(sessions[0]?.title).toBe("LST roundup");
    expect(sessions[0]?.projectIds).toEqual(["proj_1"]);
  });

  it("removes saved items and sessions", () => {
    const c = new SavedResearchClient({ dataDir, userId: "user_1" });
    const project = c.saveProject("proj_1", "Jupiter");
    const session = c.createSession({ title: "Brief", lens: "ecosystem" });
    expect(c.removeProject(project.id)).toBe(true);
    expect(c.removeProject(project.id)).toBe(false);
    expect(c.removeSession(session.id)).toBe(true);
    expect(c.listProjects().length).toBe(0);
    expect(c.listSessions().length).toBe(0);
  });

  it("scopes data by user id (separate files)", () => {
    const a = new SavedResearchClient({ dataDir, userId: "user_a" });
    const b = new SavedResearchClient({ dataDir, userId: "user_b" });
    a.saveProject("proj_1", "Jupiter");
    expect(b.listProjects().length).toBe(0);
  });

  it("persists saved data across instances", () => {
    const a = new SavedResearchClient({ dataDir, userId: "user_1" });
    a.createSession({ title: "Persist me", lens: "infrastructure" });
    const b = new SavedResearchClient({ dataDir, userId: "user_1" });
    expect(b.listSessions()[0]?.title).toBe("Persist me");
  });

  it("summarizes saved research counts", () => {
    const c = new SavedResearchClient({ dataDir, userId: "user_1" });
    c.saveReport("rep_1", "defi", "Brief");
    c.createSession({ title: "S", lens: "ecosystem" });
    const summary = summarize({
      reports: c.listReports(),
      narratives: c.listNarratives(),
      projects: c.listProjects(),
      sessions: c.listSessions(),
    });
    expect(summary.reportCount).toBe(1);
    expect(summary.sessionCount).toBe(1);
  });
});