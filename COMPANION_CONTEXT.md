companion: ARGUS-CONTRACT (Platform ARGUS Contract — shared package, not a companion app)
last_updated: 2026-07-26

status: partial
  # "partial" because: contract (schema + validator) is complete and verified;
  # zero companions are wired to emit it yet. This is a Tier 1 platform
  # foundation (ORPHEUS_PLATFORM_SPEC_v2.0 Section 12) — its "done" is
  # different from a companion app's "done": there is no UI, no deploy, no
  # user-facing surface. It is done when every companion imports and emits
  # through it.

what_works:
  - 15-field ARGUS envelope, built exactly to ORPHEUS_PLATFORM_SPEC_v2.0
    Section 3's table (tenant_id, companion_id, job_id, entity_ref,
    event_type, severity, health_status, state_before, state_after,
    decision, confidence, policy_reason, timestamp, correlation_id, version).
  - Zod schema (src/schema.ts), `.strict()` — rejects unknown fields, missing
    fields, and wrong types rather than silently coercing/stripping.
  - `validateArgusEnvelope()` (throws `ArgusEnvelopeValidationError` with one
    line per failing field) and `safeParseArgusEnvelope()` (non-throwing).
  - `createArgusEnvelope()` convenience — fills `timestamp`/`version`, still
    validates everything else.
  - `ENFORCEMENT_BY_SEVERITY` + `isReportableToControlCentre()` — encodes
    spec Section 3/10's severity → enforcement mapping (TRACE/METRIC → none,
    ANOMALY → soft alert, BREACH → hard escalation) as shared contract, not
    per-companion logic.
  - `schema/argus-envelope.schema.json` — generated FROM the Zod schema via
    `zod-to-json-schema` at build time (not hand-maintained — cannot drift
    from the TS source).
  - `COMPANION_IDS` (src/companions.ts) — 16 values, built against the
    current roster, not the spec's frozen 13. See "known deviation" below.
  - 18 tests (vitest), all passing against the actually-compiled output:
    1 valid-envelope round-trip, 2 covering the new/null-field cases,
    1 covering `createArgusEnvelope`, 11 deliberate-rejection cases (bad
    companion_id, bad tenant_id, bad severity, confidence out of range x2,
    non-namespaced event_type, bad timestamp, bad semver, empty
    policy_reason, extra field, missing required field), 1 safeParse case,
    3 enforcement-mapping checks.
  - `prepare` npm lifecycle script — verified for real (wiped `dist/` +
    `node_modules`, ran plain `npm install`, confirmed `dist/` and the
    generated JSON Schema reappeared automatically) — this is what makes
    `npm install github:.../orpheus-argus-contract#v1.0.0` actually usable
    from a consumer without a manual build step.

incomplete_endpoints:
  - ~~Not pushed to GitHub~~ ✅ done 2026-07-26 — pushed to
    https://github.com/JKits123/orpheus-argus-contract.git (branch `master`),
    tag `v1.0.0` cut and pushed. Verified via `git ls-remote origin`: both
    `refs/heads/master` and `refs/tags/v1.0.0` present, both pointing at
    commit `05e88ae`. Consumers can now run
    `npm install github:JKits123/orpheus-argus-contract#v1.0.0`.
  - Zero companions wired to emit through this contract. That is explicitly
    out of scope for this session (see brief) — it's the next four sessions'
    work (VIGIL, SENTINEL, CERTATION, OPS), each independent.
  - No sidecar/interception layer (spec Section 3's "in-process interception
    layer wrapping each companion's emit/dispatch path") — each companion
    session builds its own; this package only defines the payload shape.
  - No persistence layer. Spec says envelopes are "persisted as JSONB" but
    doesn't say in which Supabase project / table — that's an integration
    decision for a wiring session or a dedicated ORPHEUS-side design pass,
    not something this package should decide unilaterally.
  - No ORPHEUS-side consumption/aggregation pipeline (Tier 4, spec Section
    12 — deliberately last, depends on real emitted data existing first).

missing:
  - Business-risk framing (decision/policy_reason must read as business
    consequence at ANOMALY/BREACH severity, spec Section 3) is NOT
    mechanically enforced — deliberately. It's a judgement call, not a
    regex; a wording heuristic would give false confidence while catching
    nothing real. Documented in README as a code-review checkpoint for each
    wiring session, with the spec's own good/bad example quoted.
  - No npm registry publish (no registry account exists for this project;
    git-dependency + tag-pin gets the real benefit — versioned, single
    source of truth, real `npm install` — without new infrastructure).

data_sources:
  - ORPHEUS_PLATFORM_SPEC_v2.0.md Section 3 (envelope field table, business-
    risk framing requirement, enforcement levels) — the actual spec this
    package implements.
  - GENESIS_ASSESSMENT/server/argusService.ts — read as the reference for
    what real quality-gate *behaviour* looks like (severity branching,
    instruction-vs-content auto-fill guard, occurrence-based learning via
    times_seen counters). Explicitly NOT the schema to copy — GENESIS
    predates this contract and uses its own internal RAMS-gap vocabulary
    (Gap/auto_fillable/overall_assessment), unrelated to the 15-field
    envelope.
  - CLAUDE.md (2026-07-26 roster) — source for the 16-companion
    `COMPANION_IDS` list, since the spec's own Section 9 table (13 values)
    predates OPS/CERTATION/PANEL.

last_session:
  date: 2026-07-26
  what_was_done: >
    Built the Platform ARGUS Contract from scratch: package.json, tsconfig,
    src/companions.ts (16-value companion_id enum, with the spec-deviation
    reasoning documented inline), src/schema.ts (15-field Zod schema,
    .strict()), src/enforcement.ts (severity → enforcement mapping),
    src/validate.ts (validateArgusEnvelope / safeParseArgusEnvelope /
    createArgusEnvelope / ArgusEnvelopeValidationError), src/index.ts
    (barrel export), src/tools/generate-json-schema.ts (build-time JSON
    Schema generation from the Zod schema via zod-to-json-schema),
    test/argus-envelope.test.ts (18 tests), README.md (envelope shape,
    placement decision + reasoning, the companion_id deviation, enforcement
    table, GENESIS reference-pattern writeup, usage examples, versioning
    policy, what this session deliberately did not build). Ran `npm install`,
    `npm run build` (real tsc compile + real JSON Schema generation,
    inspected the output), `npx vitest run` (18/18 passing) — then, after a
    real test failure showed Zod's default object schema silently strips
    unknown keys instead of rejecting them, added `.strict()` and reran
    (still 18/18). Separately wiped dist/ + node_modules and ran a bare
    `npm install` to prove the `prepare` lifecycle script rebuilds
    everything automatically — this is the mechanism a consuming companion's
    `npm install github:...` depends on, so it was worth confirming for
    real rather than assuming npm's documented behaviour holds here.
    git init + commit done locally.
  outcome: >
    Schema + validator complete and verified against real compiled/tested
    output, not just written and assumed correct. Pushed to GitHub
    (JKits123/orpheus-argus-contract, branch master, tag v1.0.0 — both
    confirmed live via git ls-remote) same session, after Jim supplied the
    repo URL. No companion is wired to it yet — correctly out of this
    session's scope per the brief ("this session does NOT wire any
    companion to the envelope yet").
  next_action: >
    One session each, independently, for VIGIL / SENTINEL / CERTATION / OPS:
    add `npm install github:JKits123/orpheus-argus-contract#v1.0.0`, build that
    companion's own sidecar/interception emit path per spec Section 3
    ("wrapping each companion's emit/dispatch path"), and — this is a human
    code-review step, not automatable — check that severity ANOMALY/BREACH
    events actually read as business consequence (README's good/bad
    example) before considering that companion's ARGUS wiring done.
