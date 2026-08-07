import { describe, expect, it } from "vitest";
import {
  validateRequiredString,
  validateEnum,
  validateReferenceDate,
  validateReportLens,
  validateHistoryRange,
  validatePositiveInteger,
  validateExecutionId,
  validateSnapshotId,
  validateJobId,
  safeJsonParse,
  validateAll,
  assertValid,
  unwrapOrThrow,
  type ValidationResult,
} from "../src/validation";
import { InsightError, InsightErrors } from "../src/errors";

describe("validateRequiredString", () => {
  it("accepts valid non-empty string", () => {
    const result = validateRequiredString("  hello  ", "field");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("hello");
  });

  it("rejects empty string", () => {
    const result = validateRequiredString("", "field");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("required");
    }
  });

  it("rejects whitespace-only string", () => {
    const result = validateRequiredString("   ", "field");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects non-string types", () => {
    const result = validateRequiredString(123, "field");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.details?.received).toBe("number");
    }
  });

  it("enforces maxLength", () => {
    const result = validateRequiredString("hello world", "field", { maxLength: 5 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.details?.maxLength).toBe(5);
  });

  it("enforces pattern", () => {
    const result = validateRequiredString("Invalid123", "field", {
      pattern: /^[a-z]+$/,
      patternName: "lowercase only",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("lowercase only");
  });

  it("accepts string matching pattern", () => {
    const result = validateRequiredString("valid", "field", {
      pattern: /^[a-z]+$/,
      patternName: "lowercase only",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("valid");
  });
});

describe("validateEnum", () => {
  const colors = ["red", "green", "blue"] as const;

  it("accepts valid enum value", () => {
    const result = validateEnum("red", colors, "color");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("red");
  });

  it("rejects invalid enum value", () => {
    const result = validateEnum("yellow", colors, "color");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("red, green, blue");
      expect(result.error.details?.allowed).toEqual(["red", "green", "blue"]);
    }
  });

  it("rejects non-string", () => {
    const result = validateEnum(123, colors, "color");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.details?.received).toBe("number");
  });
});

describe("validateReferenceDate", () => {
  it("accepts valid ISO-8601 with milliseconds", () => {
    const result = validateReferenceDate("2026-08-07T00:00:00.000Z", "referenceDate");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("2026-08-07T00:00:00.000Z");
  });

  it("accepts valid ISO-8601 without milliseconds", () => {
    const result = validateReferenceDate("2026-08-07T00:00:00Z", "referenceDate");
    expect(result.ok).toBe(true);
  });

  it("rejects invalid format", () => {
    const result = validateReferenceDate("07-08-2026", "referenceDate");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("ISO-8601");
    }
  });

  it("rejects unparseable date", () => {
    const result = validateReferenceDate("2026-13-45T00:00:00.000Z", "referenceDate");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("valid date");
  });

  it("rejects non-string", () => {
    const result = validateReferenceDate(1234567890, "referenceDate");
    expect(result.ok).toBe(false);
  });

  it("rejects empty string", () => {
    const result = validateReferenceDate("", "referenceDate");
    expect(result.ok).toBe(false);
  });
});

describe("validateReportLens", () => {
  it("accepts valid lens values", () => {
    for (const lens of ["ecosystem", "defi", "infrastructure"]) {
      const result = validateReportLens(lens);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(lens);
    }
  });

  it("rejects invalid lens", () => {
    const result = validateReportLens("invalid");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.details?.allowed).toContain("ecosystem");
    }
  });

  it("rejects non-string", () => {
    const result = validateReportLens(123);
    expect(result.ok).toBe(false);
  });
});

describe("validateHistoryRange", () => {
  it("accepts valid range (from <= to)", () => {
    const result = validateHistoryRange("2026-08-01T00:00:00.000Z", "2026-08-07T00:00:00.000Z");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.from).toBe("2026-08-01T00:00:00.000Z");
      expect(result.value.to).toBe("2026-08-07T00:00:00.000Z");
    }
  });

  it("accepts equal from and to", () => {
    const result = validateHistoryRange("2026-08-07T00:00:00.000Z", "2026-08-07T00:00:00.000Z");
    expect(result.ok).toBe(true);
  });

  it("rejects from > to", () => {
    const result = validateHistoryRange("2026-08-07T00:00:00.000Z", "2026-08-01T00:00:00.000Z");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("before or equal");
  });

  it("rejects invalid from date", () => {
    const result = validateHistoryRange("invalid", "2026-08-07T00:00:00.000Z");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.details?.field).toBe("from");
  });

  it("rejects invalid to date", () => {
    const result = validateHistoryRange("2026-08-01T00:00:00.000Z", "invalid");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.details?.field).toBe("to");
  });
});

describe("validatePositiveInteger", () => {
  it("accepts positive integer", () => {
    const result = validatePositiveInteger(10, "limit");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(10);
  });

  it("accepts numeric string", () => {
    const result = validatePositiveInteger("42", "limit");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(42);
  });

  it("rejects zero", () => {
    const result = validatePositiveInteger(0, "limit");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("positive");
  });

  it("rejects negative", () => {
    const result = validatePositiveInteger(-5, "limit");
    expect(result.ok).toBe(false);
  });

  it("rejects non-integer", () => {
    const result = validatePositiveInteger(3.14, "limit");
    expect(result.ok).toBe(false);
  });

  it("rejects non-numeric string", () => {
    const result = validatePositiveInteger("abc", "limit");
    expect(result.ok).toBe(false);
  });

  it("enforces max", () => {
    const result = validatePositiveInteger(100, "limit", { max: 50 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.details?.max).toBe(50);
  });
});

describe("validateExecutionId", () => {
  it("accepts valid execution ID", () => {
    const result = validateExecutionId("exec-000001");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("exec-000001");
  });

  it("rejects invalid format", () => {
    const result = validateExecutionId("invalid-id");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("exec-<counter-in-base36>");
  });

  it("rejects non-string", () => {
    const result = validateExecutionId(123);
    expect(result.ok).toBe(false);
  });
});

describe("validateSnapshotId", () => {
  it("accepts valid snapshot ID", () => {
    const result = validateSnapshotId("snap-exec-1723032000000-1-abcdef01");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("snap-exec-1723032000000-1-abcdef01");
  });

  it("rejects invalid format", () => {
    const result = validateSnapshotId("snap-invalid");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("snap-exec-<timestamp>-<counter>-<8-char-hex>");
  });
});

describe("validateJobId", () => {
  it("accepts valid job ID", () => {
    const result = validateJobId("my-job_123");
    expect(result.ok).toBe(true);
  });

  it("rejects invalid characters", () => {
    const result = validateJobId("my job!");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("alphanumeric");
  });

  it("rejects empty string", () => {
    const result = validateJobId("");
    expect(result.ok).toBe(false);
  });

  it("enforces max length", () => {
    const longId = "a".repeat(101);
    const result = validateJobId(longId);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.details?.maxLength).toBe(100);
  });
});

describe("safeJsonParse", () => {
  it("parses valid JSON", () => {
    const result = safeJsonParse('{"key": "value", "num": 42}');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ key: "value", num: 42 });
  });

  it("rejects invalid JSON", () => {
    const result = safeJsonParse("{invalid json}");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("Invalid JSON");
    }
  });

  it("rejects non-string input", () => {
    const result = safeJsonParse({ already: "object" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.details?.receivedType).toBe("object");
  });
});

describe("validateAll", () => {
  it("returns all values when all valid", () => {
    const results = validateAll(
      validateRequiredString("hello", "a"),
      validateRequiredString("world", "b"),
      validatePositiveInteger(42, "c")
    );
    expect(results.ok).toBe(true);
    if (results.ok) expect(results.value).toEqual(["hello", "world", 42]);
  });

  it("fails fast on first error", () => {
    const results = validateAll(
      validateRequiredString("hello", "a"),
      validateRequiredString("", "b"), // invalid
      validatePositiveInteger(42, "c")
    );
    expect(results.ok).toBe(false);
    if (!results.ok) expect(results.error.details?.field).toBe("b");
  });
});

describe("assertValid", () => {
  it("returns value when valid", () => {
    const result = validateRequiredString("hello", "field");
    const value = assertValid(result);
    expect(value).toBe("hello");
  });

  it("throws InsightError when invalid", () => {
    const result = validateRequiredString("", "field");
    expect(() => assertValid(result)).toThrow(InsightError);
    expect(() => assertValid(result)).toThrow("field is required");
  });

  it("adds prefix to error message", () => {
    const result = validateRequiredString("", "field");
    expect(() => assertValid(result, "Custom prefix")).toThrow("Custom prefix: field is required");
  });
});

describe("unwrapOrThrow", () => {
  it("returns value when valid", () => {
    const result = validateRequiredString("hello", "field");
    expect(unwrapOrThrow(result)).toBe("hello");
  });

  it("throws when invalid", () => {
    const result = validateRequiredString("", "field");
    expect(() => unwrapOrThrow(result)).toThrow(InsightError);
  });
});

describe("ValidationResult type", () => {
  it("discriminates correctly on ok=true", () => {
    const result: ValidationResult<string> = { ok: true as const, value: "test" };
    if (result.ok) {
      expect(result.value).toBe("test");
    } else {
      // This branch is never reached but TypeScript narrows correctly
      const _exhaustive: never = result;
      void _exhaustive;
    }
  });

  it("discriminates correctly on ok=false", () => {
    const result: ValidationResult<string> = { ok: false as const, error: InsightErrors.invalidInput("test") };
    if (result.ok) {
      // This branch is never reached but TypeScript narrows correctly
      const _exhaustive: never = result;
      void _exhaustive;
    } else {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });
});