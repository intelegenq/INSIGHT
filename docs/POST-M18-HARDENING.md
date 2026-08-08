# Post-M18 Hardening Status

Repository: qwertyIQ/Insight

## M19: Persistence and execution lifecycle

- Snapshot IDs remain content-addressable and deterministic.
- Snapshot repositories keep explicit save/get/list semantics.
- Snapshot integrity is checked by canonical ID and content hash.
- Scheduler failures remain fail-loud; snapshot persistence failures are not swallowed.

## M20: Observability and error contracts

- Runtime errors use stable machine-readable codes with sanitized details.
- Scheduler execution records include duration, retry count, failure code, and optional snapshot linkage.
- Scheduler observers receive start, completion, and failure lifecycle events.
- API errors expose an error object with code, message, optional details, and optional requestId.
- API boundaries validate report lenses, snapshot IDs, and required history parameters.
- Report requests now honor the requested lens.

## M21: Production quality gate

The quality gate is configured in `.github/workflows/ci.yml` and is intended to run on pull requests and pushes to main.

- CI runs formatting, lint, typecheck, tests, determinism guard, and build.
- Turbo test tasks do not declare fabricated output directories.
- The determinism guard is limited to runtime report and snapshot identity code.

## M22: Source health monitoring

- Data providers can be checked through a deterministic source health monitor.
- Source health reports are stable, sorted by provider id, and include healthy/unavailable counts.
- Failed provider health checks are represented as unavailable entries instead of aborting the whole report.

## Verification note

Changes were applied to main through the connected GitHub repository API. A local checkout was unavailable because the environment lacks the Git HTTPS transport helper, and the fallback archive download failed during TLS negotiation. CI remains the authoritative typecheck, test, formatting, lint, and build verification.
