# @orpheus/argus-contract

Shared ARGUS platform contract for ORPHEUS companions — one JSON Schema, one
Zod validator, one envelope shape. Source of truth: `ORPHEUS_PLATFORM_SPEC_v2.0.md`
Section 3 ("The ARGUS Platform Contract").

This package does **one thing**: define and validate the 15-field envelope
every companion emits to report quality/status flags. It does not decide
*what* a companion should report, does not implement suppression, the
control centre, or the job record — those are separate, later builds
(spec Sections 5, 8, 10). Schema and validator only.

---

## Why this exists

> "One reporting standard for all thirteen companions. ORPHEUS consumes
> thirteen ARGUS streams identically, with zero special-casing."
> — Spec Section 3

If each companion invents its own status-reporting shape, ORPHEUS's
aggregation pipeline needs special-case code per companion, and every new
companion is a new integration, not a new enum value. This package is the
thing that makes "zero special-casing" true: import it, call
`validateArgusEnvelope()` before every emit, done.

## Placement decision (read this before wiring a companion)

**This is a standalone package, not duplicated per companion.** Each
companion repo (VIGIL, SENTINEL, CERTATION, OPS, …) is its own separate
GitHub repo with its own Vercel deployment — there is no monorepo tooling
across ORPHEUS, so "shared" here means "one repo, imported as a dependency,"
not "one folder copy-pasted N times."

- **This session:** package lives at `ORPHEUS/argus-contract/` (this
  folder), git-initialised, not yet pushed — no `gh` CLI / GitHub
  credentials were available in this build environment. **Jim's action:**
  create a new GitHub repo (suggested: `JKits123/orpheus-argus-contract`,
  private — same visibility as the other companion repos) and push this
  folder's git history to it, following the exact pattern already used for
  BLOODHOUND (`git init` in the tool's own folder → `.gitignore` → push to
  a new `JKits123/*` repo). No IONOS/Vercel step needed — this is a library,
  not a deployed app.
- **Each companion session (VIGIL/SENTINEL/CERTATION/OPS) then adds it as a
  dependency:**
  ```bash
  npm install github:JKits123/orpheus-argus-contract#v1.0.0
  ```
  Pin to a tag (`#v1.0.0`), not `#main` — a silent contract change should
  never reach a companion without an explicit version bump on both sides.
  When the contract's version changes (see **Versioning** below), each
  companion updates its pinned tag deliberately, in its own session.
- **Why not npm-publish to a public/private registry?** No npm registry
  account exists for this project yet, and setting one up is out of scope
  for a schema-only session. A git dependency gets 90% of the benefit
  (versioned, single source, real `npm install`) with zero new
  infrastructure — consistent with the platform spec's own "Architect's
  Substrate Notes" principle of binding intent to the simplest available
  primitive rather than adding infra (see spec's Kafka/Debezium →
  outbox-table substitution for the same reasoning applied elsewhere).
  If ORPHEUS ever needs a real npm registry for other reasons, revisit then
  — don't build one just for this.

## A known deviation from the literal spec — read before using `companion_id`

The spec (written 2026-06-18) says `companion_id` is `enum(13)` and lists
exactly 13 values in Section 9's companion map. Three companions have gone
live since and are **not** in that 13: **OPS** (2026-07-12), **CERTATION**
(2026-07-05), **PANEL** (2026-07-14). Two of those three — OPS and
CERTATION — are named as consumers of this exact contract in the brief that
commissioned this package.

Shipping the literal spec-era 13 would make it impossible for two of this
contract's first four intended consumers to emit a valid envelope at all.
`src/companions.ts` therefore builds `COMPANION_IDS` from the **current**
16-companion roster (`CLAUDE.md`, 2026-07-26), not the spec's frozen 13.
This is purely additive — every spec-era value is preserved — and is
licensed by the spec's own stated design goal: *"Adding the 14th companion
later requires zero change to the ORPHEUS consumption side — only a new
`companion_id` enum value."* Treat this file, not the spec's table, as the
current source of truth for valid `companion_id` values; the spec's Section
9 table should be corrected to match on its next revision.

## The envelope (15 fields, verbatim from spec Section 3)

| Field | Type | Notes |
|---|---|---|
| `tenant_id` | string (uuid) | mandatory scope |
| `companion_id` | enum | see roster note above — 16 values, not the spec's 13 |
| `job_id` | string \| null | null for non-job events |
| `entity_ref` | string | the asset/quote/message/etc. the event concerns |
| `event_type` | string | namespaced, e.g. `hermes.quote.chase_attempted` |
| `severity` | enum | `TRACE` \| `METRIC` \| `ANOMALY` \| `BREACH` |
| `health_status` | enum | `GREEN` \| `AMBER` \| `RED` |
| `state_before` | string \| null | state machine prior state |
| `state_after` | string \| null | state machine resulting state |
| `decision` | string | what the companion decided, in business terms |
| `confidence` | number 0–1 | companion's confidence in the decision |
| `policy_reason` | string | business-readable justification |
| `timestamp` | string (ISO 8601) | emit time |
| `correlation_id` | string | ties events across companions for one causal chain |
| `version` | string (semver) | envelope schema version — currently `1.0.0` |

The schema is **strict**: an envelope with an extra field, a missing field,
or a wrong type is rejected, not silently coerced or stripped. This is
deliberate — see `src/schema.ts`'s `.strict()` call.

### Business-risk framing — a contract requirement, not decoration

> ✗ `"Email sent 10:32"`
> ✓ `"£47k quote at risk of expiry — no client response after two chase
> attempts — recommend MD review"`

`decision` and `policy_reason` must read as business consequence once
`severity` is `ANOMALY` or `BREACH` — the spec is explicit that this is a
contract requirement, not a style preference. **This package does not, and
cannot, enforce this mechanically** — "is this sentence business-readable"
is a judgement call, not a regex, and a heuristic wording-checker would give
false confidence while catching nothing real. Enforce it in code review:
when a companion session wires ARGUS emission, the emitted `decision` /
`policy_reason` strings are exactly what should be checked by hand against
the good/bad example above before merging. `TRACE`-severity events are
exempt — the spec explicitly allows system-level detail there, for audit.

## Enforcement levels (spec Section 3 + 10)

`severity` maps to an enforcement action. `src/enforcement.ts` encodes this
mapping as part of the contract (every companion must agree on what a
severity level *means*), separately from `isReportableToControlCentre()`,
which is what Section 10's control centre uses to decide what reaches the
MD:

| Severity | Enforcement | Reaches control centre? |
|---|---|---|
| `TRACE` | none | no |
| `METRIC` | none | no |
| `ANOMALY` | soft alert (MD may act; companion may auto-correct within its own authority — logged either way) | yes, unless auto-corrected |
| `BREACH` | hard escalation — companion action halted | yes, always |

What this package does **not** do: decide whether a given event is
correctable, or perform the correction. That's real companion-specific
quality-gate logic — see **Reference implementation** below.

## Reference implementation — GENESIS's ARGUS (read for the pattern, not the schema)

GENESIS (`GENESIS_ASSESSMENT/server/argusService.ts`) has the only working
ARGUS-style quality gate in the ecosystem today. It is **not** built to this
envelope — it predates this contract and uses its own RAMS-specific
vocabulary (`Gap`, `auto_fillable`, `overall_assessment`). Do not copy its
schema. Do copy its actual quality-gate *behaviour*, which is a good model
for what a companion's inward gatekeeper should look like once wired to
this envelope:

- **Severity-driven branching**, not a flat pass/fail: `CRITICAL`/`MAJOR`/
  `MINOR` gaps get different handling (`autoFillGaps()` vs
  `requiresJimReview`). Maps naturally onto this contract's
  `ANOMALY`-auto-correctable vs `BREACH`-halt distinction.
- **Auto-fill only when the fix is real content, not an instruction verb**
  (`isInstructionText()` guards against inserting "Add BS EN 397…" literally
  into a document). The general lesson: an auto-correct path needs its own
  guard against correcting with garbage, not just a `correctable: true` flag.
- **Occurrence-based learning** (`times_seen` counters, promotion to
  `ontology_partnerships` after 3 occurrences of the same gap in the same
  job context) — an example of a companion using its *own* internal event
  history to get smarter over time, entirely separate from what it reports
  outward via ARGUS. This contract has no equivalent concept and doesn't
  need one; it's mentioned here so a future session doesn't try to cram
  companion-internal learning state into the shared envelope.
- **Business-readable verdict as a first-class output field**
  (`verdict: "one sentence — overall quality assessment"`) — structurally
  the same idea as this contract's `policy_reason`, just in GENESIS's own
  format. When GENESIS is wired to this envelope (a future session, not
  this one), `verdict` is a natural source for `policy_reason` and
  `overall_assessment` maps onto `severity`/`health_status`.

## Usage

```ts
import { validateArgusEnvelope, createArgusEnvelope } from "@orpheus/argus-contract";

// Full control — you supply every field, including timestamp/version:
const envelope = validateArgusEnvelope({
  tenant_id: tenantId,
  companion_id: "HERMES",
  job_id: job.id,
  entity_ref: `quote:${quote.ref}`,
  event_type: "hermes.quote.chase_attempted",
  severity: "ANOMALY",
  health_status: "AMBER",
  state_before: "dispatched",
  state_after: "chased_d21",
  decision: "Sent D+21 soft chaser — no client response since dispatch",
  confidence: 0.9,
  policy_reason: `£${quote.value} quote at risk of expiry — no response after one chase — recommend MD review`,
  timestamp: new Date().toISOString(),
  correlation_id: quote.correlationId,
  version: "1.0.0",
});

// Convenience — timestamp/version filled in for you:
const envelope2 = createArgusEnvelope({
  tenant_id: tenantId,
  companion_id: "OPS",
  job_id: job.id,
  entity_ref: `job:${job.id}`,
  event_type: "ops.job.completion_gate_flag_raised",
  severity: "BREACH",
  health_status: "RED",
  state_before: "in_progress",
  state_after: "in_progress",
  decision: "Halted handover pack generation — outdoor unit serial missing",
  confidence: 1.0,
  policy_reason: "Cannot issue F-Gas compliance documentation without outdoor serial — legal exposure if shipped",
  correlation_id: job.correlationId,
});

// Non-throwing form, if a caller wants to handle invalid input explicitly:
const result = safeParseArgusEnvelope(candidate);
if (!result.success) {
  console.error(result.issues);
}
```

Both `validateArgusEnvelope` and `createArgusEnvelope` throw
`ArgusEnvelopeValidationError` (with one line per failing field) on invalid
input. **Do not catch and swallow this at the emit call site** — an invalid
envelope reaching ORPHEUS breaks the "identical consumption" guarantee for
every other companion's stream.

### JSON Schema

`schema/argus-envelope.schema.json` is **generated from `src/schema.ts`** by
`npm run build` (via `zod-to-json-schema`) — it is not hand-maintained, so
the two representations cannot drift apart. Use it for non-TS consumers,
a Postgres `jsonb` `CHECK` constraint via a schema-validation extension, or
plain documentation. If you ever need to hand-edit it, you're doing it
wrong — edit `src/schema.ts` and rebuild instead.

## Versioning

`ARGUS_ENVELOPE_VERSION` in `src/schema.ts` (currently `1.0.0`) is the
envelope schema version — **not** any individual companion's own version,
and not this npm package's `package.json` version (though today they happen
to match at 1.0.0; don't assume they'll stay in lockstep).

- **Additive, backward-compatible change** (e.g. widening `companion_id`'s
  enum with a new companion): bump the **minor** version. Existing emitters
  keep validating.
- **Breaking change** (new required field, field removal, a type change,
  narrowing an enum): bump the **major** version. This is a Tier-1
  platform decision (spec Section 12), not something to do inside a single
  companion's session — it needs a dedicated review, since every already-
  wired companion's emitted envelopes are affected at once.
- Every published version gets a git tag (`v1.0.0`, `v1.1.0`, …). Companions
  pin to a tag, never to `#main` (see **Placement decision** above).

## What this session did NOT build

Per the brief: schema and validator only. Not built (deliberately, for a
later Tier-1/Tier-3 session per spec Section 12):
- No companion is wired to emit this envelope yet.
- No ORPHEUS-side consumption/aggregation pipeline.
- No persistence layer (spec says "persisted as JSONB" — which table, which
  Supabase project, is an integration decision for the wiring sessions).
- No sidecar/interception layer (spec Section 3's "ARGUS is not post-hoc
  reporting … an in-process interception layer wrapping each companion's
  emit/dispatch path") — that's companion-side plumbing each of the next
  four sessions builds for itself, using this package as the payload shape.

## Local development

```bash
npm install
npm run build   # tsc -> dist/, then generates schema/argus-envelope.schema.json
npm test        # vitest — 18 tests: valid envelope, 11 rejection cases, enforcement mapping
```
