import { describe, it, expect } from "vitest";
import {
  validateArgusEnvelope,
  safeParseArgusEnvelope,
  createArgusEnvelope,
  ArgusEnvelopeValidationError,
  ENFORCEMENT_BY_SEVERITY,
  isReportableToControlCentre,
} from "../src/index.js";

const VALID: Record<string, unknown> = {
  tenant_id: "00000000-0000-0000-0000-00000000cd11",
  companion_id: "HERMES",
  job_id: "2825/1025",
  entity_ref: "quote:Q.2952",
  event_type: "hermes.quote.chase_attempted",
  severity: "ANOMALY",
  health_status: "AMBER",
  state_before: "dispatched",
  state_after: "chased_d21",
  decision: "Sent D+21 soft chaser — no client response since dispatch",
  confidence: 0.9,
  policy_reason:
    "£4,200 quote at risk of expiry — no client response after one chase attempt — recommend MD review",
  timestamp: "2026-07-26T09:15:00.000Z",
  correlation_id: "corr_q2952_lifecycle",
  version: "1.0.0",
};

describe("valid envelope", () => {
  it("accepts a fully-formed envelope unchanged", () => {
    const result = validateArgusEnvelope(VALID);
    expect(result).toEqual(VALID);
  });

  it("accepts companion_id values added since spec v2.0 (OPS, CERTATION, PANEL)", () => {
    for (const companion_id of ["OPS", "CERTATION", "PANEL"]) {
      expect(() => validateArgusEnvelope({ ...VALID, companion_id })).not.toThrow();
    }
  });

  it("accepts null job_id, state_before, state_after (non-job events)", () => {
    const result = validateArgusEnvelope({
      ...VALID,
      job_id: null,
      state_before: null,
      state_after: null,
    });
    expect(result.job_id).toBeNull();
  });

  it("createArgusEnvelope fills timestamp/version and validates the rest", () => {
    const { timestamp, version, ...rest } = VALID;
    const built = createArgusEnvelope(rest as any);
    expect(built.version).toBe("1.0.0");
    expect(() => new Date(built.timestamp)).not.toThrow();
    expect(Number.isNaN(new Date(built.timestamp).getTime())).toBe(false);
  });
});

describe("rejects invalid envelopes", () => {
  it("rejects an unknown companion_id", () => {
    expect(() => validateArgusEnvelope({ ...VALID, companion_id: "NOT_A_COMPANION" })).toThrow(
      ArgusEnvelopeValidationError
    );
  });

  it("rejects a non-uuid tenant_id", () => {
    expect(() => validateArgusEnvelope({ ...VALID, tenant_id: "cdl" })).toThrow(
      ArgusEnvelopeValidationError
    );
  });

  it("rejects severity values outside the enum", () => {
    expect(() => validateArgusEnvelope({ ...VALID, severity: "CRITICAL" })).toThrow();
  });

  it("rejects confidence outside 0-1", () => {
    expect(() => validateArgusEnvelope({ ...VALID, confidence: 1.5 })).toThrow();
    expect(() => validateArgusEnvelope({ ...VALID, confidence: -0.1 })).toThrow();
  });

  it("rejects a non-namespaced event_type", () => {
    expect(() => validateArgusEnvelope({ ...VALID, event_type: "chase_attempted" })).toThrow();
  });

  it("rejects a non-ISO8601 timestamp", () => {
    expect(() => validateArgusEnvelope({ ...VALID, timestamp: "26/07/2026" })).toThrow();
  });

  it("rejects a non-semver version", () => {
    expect(() => validateArgusEnvelope({ ...VALID, version: "v1" })).toThrow();
  });

  it("rejects an empty policy_reason (business framing must be present)", () => {
    expect(() => validateArgusEnvelope({ ...VALID, policy_reason: "" })).toThrow();
  });

  it("rejects extra fields not in the 15-field envelope", () => {
    expect(() =>
      validateArgusEnvelope({ ...VALID, extra_field: "not part of the contract" })
    ).toThrow();
  });

  it("rejects a payload missing a required field entirely", () => {
    const { decision, ...missingDecision } = VALID;
    expect(() => validateArgusEnvelope(missingDecision)).toThrow();
  });

  it("safeParseArgusEnvelope returns issues instead of throwing", () => {
    const result = safeParseArgusEnvelope({ ...VALID, severity: "OOPS" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.length).toBeGreaterThan(0);
    }
  });
});

describe("enforcement mapping (spec Section 3 + 10)", () => {
  it("TRACE and METRIC never reach the control centre", () => {
    expect(isReportableToControlCentre("TRACE")).toBe(false);
    expect(isReportableToControlCentre("METRIC")).toBe(false);
  });

  it("ANOMALY and BREACH are reportable to the control centre", () => {
    expect(isReportableToControlCentre("ANOMALY")).toBe(true);
    expect(isReportableToControlCentre("BREACH")).toBe(true);
  });

  it("BREACH maps to hard_escalation", () => {
    expect(ENFORCEMENT_BY_SEVERITY.BREACH.action).toBe("hard_escalation");
  });
});
