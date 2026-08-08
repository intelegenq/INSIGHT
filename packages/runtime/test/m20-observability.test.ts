import { describe, expect, it } from "vitest";
import { InsightErrors } from "../src/errors";
import { Scheduler } from "../src/scheduler/Scheduler";
import type { RuntimeJob } from "../src/scheduler/types";
import type { RuntimeResult } from "../src/types";
import { validateSnapshotId } from "../src/validation";

const result = {} as RuntimeResult;

function job(id: string, execute: RuntimeJob["execute"]): RuntimeJob & { enabled: boolean } {
  return {
    id,
    name: id,
    options: { referenceDate: "2026-01-01T00:00:00.000Z" },
    execute,
    enabled: true,
  };
}

describe("M20 observability and error model", () => {
  it("accepts the canonical snapshot id format", () => {
    expect(validateSnapshotId("snapshot-2026-01-01T00:00:00.000Z-abcdef12")).toEqual({
      ok: true,
      value: "snapshot-2026-01-01T00:00:00.000Z-abcdef12",
    });
    expect(validateSnapshotId("snap-exec-000001-deadbeef").ok).toBe(false);
  });

  it("records normalized failure metadata and emits observer events", async () => {
    const events: string[] = [];
    let tick = 0;
    const scheduler = new Scheduler({
      clock: () => "2026-01-01T00:00:0" + tick++ + ".000Z",
      observer: { onEvent: (event) => events.push(event.type) },
    });
    scheduler.register(
      job("provider-job", async () => {
        throw InsightErrors.providerTimeout("provider timed out");
      }),
    );

    await expect(scheduler.execute("provider-job")).rejects.toThrow("provider timed out");
    const execution = scheduler.listExecutions()[0];
    expect(execution?.status).toBe("failed");
    expect(execution?.errorCode).toBe("PROVIDER_TIMEOUT");
    expect(execution?.durationMs).toBe(1000);
    expect(events).toEqual(["execution.started", "execution.failed"]);
  });

  it("emits completion metadata without changing the result", async () => {
    const events: string[] = [];
    const scheduler = new Scheduler({
      clock: (() => {
        let tick = 0;
        return () => "2026-01-01T00:00:0" + tick++ + ".000Z";
      })(),
      observer: { onEvent: (event) => events.push(event.type) },
    });
    scheduler.register(job("success-job", async () => result));

    await expect(scheduler.execute("success-job")).resolves.toBe(result);
    expect(scheduler.listExecutions()[0]?.status).toBe("completed");
    expect(events).toEqual(["execution.started", "execution.completed"]);
  });
});
