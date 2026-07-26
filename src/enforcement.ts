import type { Severity } from "./schema.js";

/**
 * Severity → enforcement mapping — ORPHEUS_PLATFORM_SPEC_v2.0 Section 3
 * ("Three enforcement levels") and Section 10 ("Exception vs autonomous
 * handling"). This is part of the CONTRACT (every companion's ARGUS must
 * agree on what a severity level means), not application logic — hence it
 * ships here rather than being re-derived per companion.
 *
 * What this does NOT do: decide whether a given event IS correctable, or
 * perform the correction. That is real companion-specific quality-gate
 * logic (see GENESIS's argusService.ts for a working example — its
 * auto_fillable flag + autoFillGaps() is exactly this kind of decision,
 * just in GENESIS's own internal RAMS-gap vocabulary, not this envelope).
 * This module only encodes what the spec says a severity level means for
 * the control centre and for ORPHEUS.
 */

export type EnforcementAction = "none" | "soft_alert" | "hard_escalation";

export interface EnforcementRule {
  action: EnforcementAction;
  /** Whether ORPHEUS's control centre surfaces this to the MD at all (Section 10). */
  surfacedToControlCentre: boolean;
  /** Business-readable description, matching the spec table's own wording. */
  description: string;
}

export const ENFORCEMENT_BY_SEVERITY: Record<Severity, EnforcementRule> = {
  TRACE: {
    action: "none",
    surfacedToControlCentre: false,
    description: "Logged to event stream, no action.",
  },
  METRIC: {
    action: "none",
    surfacedToControlCentre: false,
    description: "Logged to event stream, no action.",
  },
  ANOMALY: {
    action: "soft_alert",
    surfacedToControlCentre: true,
    description:
      "Surfaced on the control centre; MD may act. If the companion's own quality gate " +
      "corrected the issue within its authority, log the correction and this still " +
      "appears (uncorrected ANOMALY vs auto-corrected ANOMALY is a companion-side " +
      "distinction — the control centre surfaces only the uncorrected ones, per Section 10).",
  },
  BREACH: {
    action: "hard_escalation",
    surfacedToControlCentre: true,
    description:
      "Companion action halted; ORPHEUS notified immediately; MD attention required.",
  },
};

/** Convenience: does this severity ever reach the ORPHEUS control centre? */
export function isReportableToControlCentre(severity: Severity): boolean {
  return ENFORCEMENT_BY_SEVERITY[severity].surfacedToControlCentre;
}
