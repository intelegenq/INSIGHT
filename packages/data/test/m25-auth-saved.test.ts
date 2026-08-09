import { mkdtempSync, existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AuthenticationService, AuthValidationError } from "../src/auth/index";
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
    c.saveSearch("jupiter", "Jupiter search");
    c.createAlert({
      targetType: "project",
      targetId: "proj-1",
      targetName: "Jupiter",
      condition: "health_drop",
      threshold: 50,
    });
    const summary = summarize({
      reports: c.listReports(),
      narratives: c.listNarratives(),
      projects: c.listProjects(),
      sessions: c.listSessions(),
      searches: c.listSearches(),
      alerts: c.listAlerts(),
    });
    expect(summary.reportCount).toBe(1);
    expect(summary.sessionCount).toBe(1);
    expect(summary.searchCount).toBe(1);
    expect(summary.alertCount).toBe(1);
  });

  it("saves and removes search queries", () => {
    const c = new SavedResearchClient({ dataDir, userId: "user_1" });
    const s1 = c.saveSearch("liquid staking", "LST search");
    expect(s1.query).toBe("liquid staking");
    expect(s1.name).toBe("LST search");
    expect(c.listSearches()).toHaveLength(1);
    // Duplicate query returns existing without creating a new entry
    const s2 = c.saveSearch("liquid staking");
    expect(s2.id).toBe(s1.id);
    expect(c.listSearches()).toHaveLength(1);
    // Remove
    expect(c.removeSearch(s1.id)).toBe(true);
    expect(c.listSearches()).toHaveLength(0);
    expect(c.removeSearch(s1.id)).toBe(false);
  });

  it("rejects empty search query", () => {
    const c = new SavedResearchClient({ dataDir, userId: "user_1" });
    expect(() => c.saveSearch("")).toThrow();
    expect(() => c.saveSearch("   ")).toThrow();
  });

  it("persists searches across instances", () => {
    const a = new SavedResearchClient({ dataDir, userId: "user_1" });
    a.saveSearch("jupiter", "Jup search");
    const b = new SavedResearchClient({ dataDir, userId: "user_1" });
    expect(b.listSearches()).toHaveLength(1);
    expect(b.listSearches()[0]!.query).toBe("jupiter");
  });

  it("adds and removes projects from a session", () => {
    const c = new SavedResearchClient({ dataDir, userId: "user_1" });
    const session = c.createSession({ title: "DeFi research", lens: "defi" });
    expect(session.projectIds).toHaveLength(0);

    const updated = c.addProjectToSession(session.id, "proj-jup");
    expect(updated!.projectIds).toContain("proj-jup");

    // Adding same project again is idempotent
    c.addProjectToSession(session.id, "proj-jup");
    expect(c.getSession(session.id)!.projectIds).toHaveLength(1);

    const removed = c.removeProjectFromSession(session.id, "proj-jup");
    expect(removed!.projectIds).not.toContain("proj-jup");
    expect(c.getSession(session.id)!.projectIds).toHaveLength(0);
  });

  it("adds and removes narratives from a session", () => {
    const c = new SavedResearchClient({ dataDir, userId: "user_1" });
    const session = c.createSession({ title: "LST research", lens: "ecosystem" });

    c.addNarrativeToSession(session.id, "nar-lst");
    expect(c.getSession(session.id)!.narrativeIds).toContain("nar-lst");

    // Idempotent
    c.addNarrativeToSession(session.id, "nar-lst");
    expect(c.getSession(session.id)!.narrativeIds).toHaveLength(1);

    c.removeNarrativeFromSession(session.id, "nar-lst");
    expect(c.getSession(session.id)!.narrativeIds).not.toContain("nar-lst");
  });

  it("getSession returns undefined for non-existent session", () => {
    const c = new SavedResearchClient({ dataDir, userId: "user_1" });
    expect(c.getSession("nonexistent")).toBeUndefined();
    expect(c.addProjectToSession("nonexistent", "proj-x")).toBeUndefined();
    expect(c.removeProjectFromSession("nonexistent", "proj-x")).toBeUndefined();
  });

  it("creates and removes alert subscriptions", () => {
    const c = new SavedResearchClient({ dataDir, userId: "user_1" });
    const alert = c.createAlert({
      targetType: "project",
      targetId: "proj-jup",
      targetName: "Jupiter",
      condition: "health_drop",
      threshold: 50,
    });
    expect(alert.id).toMatch(/^alert_/);
    expect(alert.status).toBe("active");
    expect(alert.condition).toBe("health_drop");
    expect(alert.threshold).toBe(50);
    expect(c.listAlerts()).toHaveLength(1);

    expect(c.removeAlert(alert.id)).toBe(true);
    expect(c.listAlerts()).toHaveLength(0);
    expect(c.removeAlert(alert.id)).toBe(false);
  });

  it("records trigger events on alerts", () => {
    const c = new SavedResearchClient({ dataDir, userId: "user_1" });
    const alert = c.createAlert({
      targetType: "narrative",
      targetId: "nar-lst",
      targetName: "Liquid Staking",
      condition: "trend_change",
    });
    expect(alert.triggerHistory).toHaveLength(0);

    const triggered = c.triggerAlert(alert.id, {
      oldValue: 65,
      newValue: 45,
      description: "Health dropped from 65 to 45",
    });
    expect(triggered!.status).toBe("triggered");
    expect(triggered!.triggeredAt).toBeTruthy();
    expect(triggered!.triggerHistory).toHaveLength(1);
    expect(triggered!.triggerHistory[0]!.description).toContain("Health dropped");

    // Non-existent alert returns undefined
    expect(
      c.triggerAlert("nonexistent", { oldValue: 0, newValue: 0, description: "" }),
    ).toBeUndefined();
  });

  it("persists alerts across instances", () => {
    const a = new SavedResearchClient({ dataDir, userId: "user_1" });
    a.createAlert({
      targetType: "project",
      targetId: "proj-1",
      targetName: "Test",
      condition: "tvl_change",
      threshold: 10,
    });
    const b = new SavedResearchClient({ dataDir, userId: "user_1" });
    expect(b.listAlerts()).toHaveLength(1);
    expect(b.listAlerts()[0]!.condition).toBe("tvl_change");
  });
});
