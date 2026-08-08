import { describe, expect, it } from "vitest";
import {
  InsightError,
  InsightErrors,
  normalizeError,
  isRetryable,
  getErrorCode,
  ErrorCode,
  ErrorCodeCategory,
  DefaultRetryable,
} from "../src/errors";

describe("InsightError — structured error model", () => {
  const REFERENCE_DATE = "2026-08-07T00:00:00.000Z";

  it("creates an error with code, message, and retryable", () => {
    const error = new InsightError("INVALID_INPUT", "Test message", { retryable: false });

    expect(error.code).toBe("INVALID_INPUT");
    expect(error.message).toBe("Test message");
    expect(error.retryable).toBe(false);
    expect(error.name).toBe("InsightError");
  });

  it("includes sanitized details in serialization", () => {
    const error = new InsightError("PROVIDER_ERROR", "Provider failed", {
      details: { apiKey: "sk_secret123", endpoint: "/api/v1", statusCode: 500 },
    });

    const json = error.toJSON();
    expect(json.details).toBeDefined();
    expect(json.details!.apiKey).toBe("[REDACTED]");
    expect(json.details!.endpoint).toBe("/api/v1");
    expect(json.details!.statusCode).toBe(500);
  });

  it("excludes cause from public serialization", () => {
    const cause = new Error("Internal cause");
    const error = new InsightError("EXECUTION_FAILED", "Execution failed", { cause });

    const json = error.toJSON();
    expect(json).not.toHaveProperty("cause");
    expect(json).not.toHaveProperty("stack");
  });

  it("includes retryable in serialization", () => {
    const error = new InsightError("PROVIDER_TIMEOUT", "Timeout", { retryable: true });
    expect(error.toJSON().retryable).toBe(true);

    const error2 = new InsightError("INVALID_INPUT", "Bad input", { retryable: false });
    expect(error2.toJSON().retryable).toBe(false);
  });

  it("hasCode matches own code", () => {
    const error = new InsightError("NOT_FOUND", "Not found");
    expect(error.hasCode("NOT_FOUND")).toBe(true);
    expect(error.hasCode("INVALID_INPUT")).toBe(false);
  });

  it("hasCode traverses cause chain", () => {
    const cause = new InsightError("PROVIDER_ERROR", "Provider down");
    const error = new InsightError("EXECUTION_FAILED", "Execution failed", { cause });
    expect(error.hasCode("PROVIDER_ERROR")).toBe(true);
  });

  it("getRootCause returns root of chain", () => {
    const root = new Error("Root cause");
    const middle = new InsightError("PROVIDER_ERROR", "Provider", { cause: root });
    const error = new InsightError("EXECUTION_FAILED", "Execution", { cause: middle });

    expect(error.getRootCause()).toBe(root);
  });

  it("toString includes code prefix", () => {
    const error = new InsightError("VALIDATION_ERROR", "Invalid field");
    expect(error.toString()).toBe("[VALIDATION_ERROR] Invalid field");
  });
});

describe("InsightErrors — factory functions", () => {
  it("invalidInput creates correct error", () => {
    const error = InsightErrors.invalidInput("Field required", { field: "email" });
    expect(error.code).toBe("INVALID_INPUT");
    expect(error.retryable).toBe(false);
    expect(error.details).toEqual({ field: "email" });
  });

  it("notFound creates correct error", () => {
    const error = InsightErrors.notFound("Project", "proj-123");
    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe("Project not found: proj-123");
    expect(error.details).toEqual({ resource: "Project", identifier: "proj-123" });
  });

  it("validationError creates correct error", () => {
    const error = InsightErrors.validationError("Invalid enum", {
      field: "lens",
      allowed: ["a", "b"],
    });
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.retryable).toBe(false);
  });

  it("providerError creates retryable error", () => {
    const error = InsightErrors.providerError("Connection refused", { endpoint: "/api" });
    expect(error.code).toBe("PROVIDER_ERROR");
    expect(error.retryable).toBe(true);
  });

  it("providerTimeout creates retryable error", () => {
    const error = InsightErrors.providerTimeout("Request timeout", { timeout: 5000 });
    expect(error.code).toBe("PROVIDER_TIMEOUT");
    expect(error.retryable).toBe(true);
  });

  it("snapshotNotFound creates correct error", () => {
    const error = InsightErrors.snapshotNotFound("snap-exec-123-abcdef01");
    expect(error.code).toBe("SNAPSHOT_NOT_FOUND");
    expect(error.details?.snapshotId).toBe("snap-exec-123-abcdef01");
  });

  it("snapshotIntegrityError creates correct error", () => {
    const error = InsightErrors.snapshotIntegrityError("snap-1", "hash mismatch");
    expect(error.code).toBe("SNAPSHOT_INTEGRITY_ERROR");
    expect(error.details?.reason).toBe("hash mismatch");
  });

  it("executionFailed creates retryable error", () => {
    const cause = new Error("Pipeline crashed");
    const error = InsightErrors.executionFailed("Pipeline failed", { stage: "scoring" }, cause);
    expect(error.code).toBe("EXECUTION_FAILED");
    expect(error.retryable).toBe(true);
    expect(error.cause).toBe(cause);
  });

  it("internalError creates non-retryable error", () => {
    const error = InsightErrors.internalError("Unexpected state");
    expect(error.code).toBe("INTERNAL_ERROR");
    expect(error.retryable).toBe(false);
  });
});

describe("normalizeError — unknown error normalization", () => {
  it("passes through InsightError unchanged", () => {
    const original = new InsightError("INVALID_INPUT", "Bad input");
    const normalized = normalizeError(original);
    expect(normalized).toBe(original);
  });

  it("adds context to existing InsightError", () => {
    const original = new InsightError("INVALID_INPUT", "Bad input");
    const normalized = normalizeError(original, { operation: "validate" });
    expect(normalized).not.toBe(original);
    expect(normalized.code).toBe("INVALID_INPUT");
    expect(normalized.details?.operation).toBe("validate");
  });

  it("classifies timeout errors as PROVIDER_TIMEOUT", () => {
    const error = new Error("ETIMEDOUT: Connection timed out");
    const normalized = normalizeError(error);
    expect(normalized.code).toBe("PROVIDER_TIMEOUT");
    expect(normalized.retryable).toBe(true);
  });

  it("classifies not found errors as NOT_FOUND", () => {
    const error = new Error("Resource not found");
    const normalized = normalizeError(error);
    expect(normalized.code).toBe("NOT_FOUND");
  });

  it("classifies validation errors as VALIDATION_ERROR", () => {
    const error = new Error("Validation failed: invalid input");
    const normalized = normalizeError(error);
    expect(normalized.code).toBe("VALIDATION_ERROR");
  });

  it("classifies network errors as PROVIDER_ERROR", () => {
    const error = new Error("ECONNREFUSED: Connection refused");
    const normalized = normalizeError(error);
    expect(normalized.code).toBe("PROVIDER_ERROR");
    expect(normalized.retryable).toBe(true);
  });

  it("classifies execution errors as EXECUTION_FAILED", () => {
    const error = new Error("Pipeline execution failed");
    const normalized = normalizeError(error);
    expect(normalized.code).toBe("EXECUTION_FAILED");
    expect(normalized.retryable).toBe(true);
  });

  it("defaults to INTERNAL_ERROR for unknown errors", () => {
    const error = new Error("Something weird happened");
    const normalized = normalizeError(error);
    expect(normalized.code).toBe("INTERNAL_ERROR");
    expect(normalized.retryable).toBe(false);
  });

  it("handles non-Error values", () => {
    const normalized = normalizeError("string error");
    expect(normalized.code).toBe("INTERNAL_ERROR");
    expect(normalized.message).toBe("string error");

    const normalized2 = normalizeError(null);
    expect(normalized2.code).toBe("INTERNAL_ERROR");
  });

  it("sanitizes context in normalized errors", () => {
    const error = new Error("Failed");
    const normalized = normalizeError(error, { apiKey: "secret", url: "https://api.com" });
    expect(normalized.details?.apiKey).toBe("[REDACTED]");
    expect(normalized.details?.url).toBe("https://api.com");
  });
});

describe("isRetryable — retryable check", () => {
  it("returns true for retryable InsightError", () => {
    expect(isRetryable(new InsightError("PROVIDER_ERROR", "test", { retryable: true }))).toBe(true);
    expect(isRetryable(InsightErrors.providerError("test"))).toBe(true);
    expect(isRetryable(InsightErrors.executionFailed("test"))).toBe(true);
  });

  it("returns false for non-retryable InsightError", () => {
    expect(isRetryable(new InsightError("INVALID_INPUT", "test", { retryable: false }))).toBe(
      false,
    );
    expect(isRetryable(InsightErrors.invalidInput("test"))).toBe(false);
    expect(isRetryable(InsightErrors.internalError("test"))).toBe(false);
  });

  it("returns false for unknown errors", () => {
    expect(isRetryable(new Error("generic"))).toBe(false);
    expect(isRetryable("string")).toBe(false);
    expect(isRetryable(null)).toBe(false);
  });
});

describe("getErrorCode — code extraction", () => {
  it("returns code for InsightError", () => {
    expect(getErrorCode(new InsightError("NOT_FOUND", "test"))).toBe("NOT_FOUND");
  });

  it("returns undefined for non-InsightError", () => {
    expect(getErrorCode(new Error("test"))).toBeUndefined();
    expect(getErrorCode("string")).toBeUndefined();
  });
});

describe("ErrorCodeCategory — category grouping", () => {
  it("CLIENT errors are not retryable by default", () => {
    for (const code of ErrorCodeCategory.CLIENT) {
      expect(DefaultRetryable.get(code)).toBe(false);
    }
  });

  it("PROVIDER errors are retryable by default", () => {
    for (const code of ErrorCodeCategory.PROVIDER) {
      expect(DefaultRetryable.get(code)).toBe(true);
    }
  });

  it("EXECUTION errors are retryable by default", () => {
    for (const code of ErrorCodeCategory.EXECUTION) {
      expect(DefaultRetryable.get(code)).toBe(true);
    }
  });

  it("INTERNAL errors are not retryable", () => {
    for (const code of ErrorCodeCategory.INTERNAL) {
      expect(DefaultRetryable.get(code)).toBe(false);
    }
  });
});

describe("Safe serialization — no secrets leakage", () => {
  it("redacts API keys in details", () => {
    const error = new InsightError("PROVIDER_ERROR", "test", {
      details: { apiKey: "sk_live_abc123", auth: "Bearer token123" },
    });
    const json = error.toJSON();
    expect(json.details?.apiKey).toBe("[REDACTED]");
    expect(json.details?.auth).toBe("[REDACTED]");
  });

  it("redacts authorization headers", () => {
    const error = new InsightError("PROVIDER_ERROR", "test", {
      details: { headers: { Authorization: "Bearer secret" } },
    });
    const json = error.toJSON();
    expect(json.details?.headers).toEqual({ Authorization: "[REDACTED]" });
  });

  it("does not include stack trace in toJSON", () => {
    const error = new InsightError("INTERNAL_ERROR", "test");
    const json = error.toJSON();
    expect(json).not.toHaveProperty("stack");
  });

  it("does not include internal cause in toJSON", () => {
    const cause = new Error("internal");
    const error = new InsightError("EXECUTION_FAILED", "test", { cause });
    const json = error.toJSON();
    expect(json).not.toHaveProperty("cause");
  });
});
