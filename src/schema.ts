import { z } from "zod";
import { COMPANION_IDS } from "./companions.js";

/**
 * The ARGUS envelope — ORPHEUS_PLATFORM_SPEC_v2.0 Section 3.
 *
 * One reporting standard for every companion. ORPHEUS consumes every
 * companion's ARGUS stream identically because every companion emits
 * exactly this shape — zero special-casing on the consumption side.
 *
 * Field order and field set are the spec's table verbatim (15 fields).
 * Do not add fields here without a version bump (see version field below) —
 * the whole point of the contract is that ORPHEUS's aggregation pipeline
 * never needs to change per companion.
 */

export const SEVERITY_LEVELS = ["TRACE", "METRIC", "ANOMALY", "BREACH"] as const;
export type Severity = (typeof SEVERITY_LEVELS)[number];

export const HEALTH_STATUSES = ["GREEN", "AMBER", "RED"] as const;
export type HealthStatus = (typeof HEALTH_STATUSES)[number];

const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/;

// event_type is namespaced (spec example: "hermes.quote.chase_attempted").
// Enforced here: lowercase dot-segments, at least one dot (companion.action
// at minimum). The 3-segment convention (companion.domain.action) from the
// spec's own example is documented as the recommended shape in README.md,
// but not hard-enforced at 2 vs 3 segments — the spec states the example,
// not a segment-count rule.
const EVENT_TYPE_PATTERN = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/;

export const ArgusEnvelopeSchema = z.object({
  tenant_id: z
    .string()
    .uuid({ message: "tenant_id must be a UUID — mandatory tenant scope, no exceptions" }),

  companion_id: z.enum(COMPANION_IDS, {
    errorMap: () => ({
      message: `companion_id must be one of: ${COMPANION_IDS.join(", ")}`,
    }),
  }),

  job_id: z.string().nullable(),

  entity_ref: z
    .string()
    .min(1, "entity_ref is required — the asset/quote/message/etc. the event concerns"),

  event_type: z
    .string()
    .regex(
      EVENT_TYPE_PATTERN,
      'event_type must be namespaced, lowercase, dot-separated (e.g. "hermes.quote.chase_attempted")'
    ),

  severity: z.enum(SEVERITY_LEVELS),

  health_status: z.enum(HEALTH_STATUSES),

  state_before: z.string().nullable(),

  state_after: z.string().nullable(),

  decision: z
    .string()
    .min(1, "decision is required — what the companion decided, in business terms"),

  confidence: z
    .number()
    .min(0, "confidence must be between 0 and 1")
    .max(1, "confidence must be between 0 and 1"),

  policy_reason: z
    .string()
    .min(1, "policy_reason is required — business-readable justification, never a system trace"),

  timestamp: z.string().datetime({
    offset: true,
    message: "timestamp must be ISO 8601 (e.g. 2026-07-26T14:03:00.000Z)",
  }),

  correlation_id: z
    .string()
    .min(1, "correlation_id is required — ties events across companions for one causal chain"),

  version: z
    .string()
    .regex(SEMVER_PATTERN, "version must be semver (e.g. 1.0.0) — the envelope schema version, not the companion's own version"),
})
  // Strict, not the Zod default (which silently strips unknown keys): a
  // shared contract must fail loud on an unexpected field at emit time,
  // not quietly drop it. This matches the generated JSON Schema's
  // additionalProperties: false.
  .strict();

export type ArgusEnvelope = z.infer<typeof ArgusEnvelopeSchema>;

/** Current envelope schema version. Bump on any field addition/removal/type change. */
export const ARGUS_ENVELOPE_VERSION = "1.0.0";
