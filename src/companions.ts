/**
 * companion_id enum values.
 *
 * ORPHEUS_PLATFORM_SPEC_v2.0 Section 3/5 specifies "enum(13)" and Section 9's
 * companion map lists exactly 13 rows (12 companions + ARGUS itself, which the
 * spec lists separately for platform-level self-emitted events). That spec was
 * published 2026-06-18. Three companions have gone live since and are absent
 * from the spec's 13: OPS (2026-07-12), CERTATION (2026-07-05), PANEL
 * (2026-07-14). Two of those three — OPS and CERTATION — are named as
 * consumers of this exact contract in the brief that commissioned this
 * package (VIGIL/SENTINEL/CERTATION/OPS are the next four wiring sessions).
 *
 * Shipping the literal spec-era 13 would make it impossible for two of this
 * contract's first four intended consumers to emit a valid envelope. This
 * enum is therefore built against the CURRENT companion roster (CLAUDE.md,
 * 2026-07-26) — 16 values — not the spec's frozen 13. This is a deliberate,
 * flagged deviation, not a silent rewrite of the spec: the enum is exactly
 * additive (every spec-era value is preserved), and the spec's own design
 * goal — "adding the Nth companion later requires zero change to the ORPHEUS
 * consumption side, only a new companion_id enum value" — is what licenses
 * this addition.
 */
export const COMPANION_IDS = [
  "ZEUS",
  "THERMIS",
  "AEGIS",
  "BLOODHOUND",
  "ORCHID",
  "HERMES",
  "PLATO",
  "GENESIS",
  "OTTO",
  "OPS",
  "KRONOS",
  "PANEL",
  "SENTINEL",
  "CERTATION",
  "VIGIL",
  "ARGUS",
] as const;

export type CompanionId = (typeof COMPANION_IDS)[number];
