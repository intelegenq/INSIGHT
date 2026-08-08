/**
 * Framework-neutral runtime observability contracts.
 *
 * The default observer is intentionally a no-op. Applications can attach a
 * logger, metrics sink, or tracing adapter without coupling runtime to I/O.
 */
import type { ErrorCode } from "../errors";

export type RuntimeEvent =
  | { type: "execution.started"; executionId: string; jobId: string; timestamp: string }
  | {
      type: "execution.completed";
      executionId: string;
      jobId: string;
      timestamp: string;
      durationMs: number;
    }
  | {
      type: "execution.failed";
      executionId: string;
      jobId: string;
      timestamp: string;
      durationMs: number;
      errorCode: ErrorCode;
    };

export interface RuntimeObserver {
  onEvent(event: RuntimeEvent): void;
}

export const noopRuntimeObserver: RuntimeObserver = {
  onEvent: () => undefined,
};
