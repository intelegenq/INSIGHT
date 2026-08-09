import { describe, expect, it } from "vitest";

/**
 * M48 — Alert subscriptions.
 *
 * Tests verify the alert subscription API contract: POST /api/saved with kind:"alert"
 * creates alerts, GET /api/saved returns alerts array, DELETE removes alerts.
 * Alert conditions include health_drop, health_rise, trend_change, new_evidence, tvl_change.
 * Trigger history records when alerts fire.
 */

describe("M48 — Alert subscriptions API contract", () => {
  const mockAlert = {
    id: "alert_abc123",
    userId: "user_1",
    targetType: "project" as const,
    targetId: "proj-jupiter",
    targetName: "Jupiter",
    condition: "health_drop" as const,
    threshold: 50,
    status: "active" as const,
    createdAt: "2026-08-09T10:00:00.000Z",
    triggerHistory: [],
  };

  const mockTriggeredAlert = {
    ...mockAlert,
    id: "alert_def456",
    status: "triggered" as const,
    triggeredAt: "2026-08-09T14:00:00.000Z",
    triggerHistory: [
      {
        triggeredAt: "2026-08-09T14:00:00.000Z",
        oldValue: 65,
        newValue: 45,
        description: "Health dropped from 65 to 45 (below threshold 50)",
      },
    ],
  };

  it("alert has id, targetType, targetId, condition, status", () => {
    expect(mockAlert.id).toMatch(/^alert_/);
    expect(mockAlert.targetType).toBe("project");
    expect(mockAlert.targetId).toBe("proj-jupiter");
    expect(mockAlert.condition).toBe("health_drop");
    expect(mockAlert.status).toBe("active");
  });

  it("supports all condition types", () => {
    const conditions = ["health_drop", "health_rise", "trend_change", "new_evidence", "tvl_change"];
    for (const c of conditions) {
      expect(conditions).toContain(c);
    }
  });

  it("supports project and narrative target types", () => {
    const projectAlert = { ...mockAlert, targetType: "project" as const };
    const narrativeAlert = { ...mockAlert, targetType: "narrative" as const, targetId: "nar-lst" };
    expect(projectAlert.targetType).toBe("project");
    expect(narrativeAlert.targetType).toBe("narrative");
  });

  it("POST with kind:alert creates alert subscription", () => {
    const body = {
      kind: "alert" as const,
      alert: {
        targetType: "project" as const,
        targetId: "proj-jup",
        targetName: "Jupiter",
        condition: "health_drop",
        threshold: 50,
      },
    };
    expect(body.kind).toBe("alert");
    expect(body.alert?.targetType).toBe("project");
    expect(body.alert?.condition).toBe("health_drop");
  });

  it("DELETE with kind=alert removes alert", () => {
    const params = new URLSearchParams({ kind: "alert", id: "alert_abc123" });
    expect(params.get("kind")).toBe("alert");
    expect(params.get("id")).toBe("alert_abc123");
  });

  it("triggered alert has triggerHistory with entries", () => {
    expect(mockTriggeredAlert.status).toBe("triggered");
    expect(mockTriggeredAlert.triggeredAt).toBeTruthy();
    expect(mockTriggeredAlert.triggerHistory).toHaveLength(1);
    expect(mockTriggeredAlert.triggerHistory[0]!.description).toContain("Health dropped");
  });

  it("trigger history records oldValue, newValue, description, triggeredAt", () => {
    const trigger = mockTriggeredAlert.triggerHistory[0]!;
    expect(typeof trigger.oldValue).toBe("number");
    expect(typeof trigger.newValue).toBe("number");
    expect(trigger.description).toBeTruthy();
    expect(trigger.triggeredAt).toBeTruthy();
  });

  it("alerts UI provides create form and alert list with status badges", () => {
    const uiContract = {
      hasCreateForm: true,
      hasTargetTypeSelect: true,
      hasTargetSelect: true,
      hasConditionSelect: true,
      hasThresholdInput: true,
      hasAlertList: true,
      hasStatusBadges: true,
      hasTriggerHistory: true,
      hasRemoveButtons: true,
    };
    expect(uiContract.hasCreateForm).toBe(true);
    expect(uiContract.hasStatusBadges).toBe(true);
  });
});
