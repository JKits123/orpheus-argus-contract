import { z } from "zod";
import { ArgusEnvelopeSchema, ARGUS_ENVELOPE_VERSION, type ArgusEnvelope } from "./schema.js";

export class ArgusEnvelopeValidationError extends Error {
  constructor(public readonly issues: z.ZodIssue[]) {
    super(
      "Invalid ARGUS envelope:\n" +
        issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n")
    );
    this.name = "ArgusEnvelopeValidationError";
  }
}

/**
 * Validates a candidate envelope. Throws ArgusEnvelopeValidationError on
 * failure — call this at every emit point, per the spec's "validated by a
 * shared Zod validator at every emit" requirement (Section 3). Do not catch
 * and swallow this at the emit site: an invalid envelope reaching ORPHEUS
 * breaks the "identical consumption" guarantee for every other companion.
 */
export function validateArgusEnvelope(candidate: unknown): ArgusEnvelope {
  const result = ArgusEnvelopeSchema.safeParse(candidate);
  if (!result.success) {
    throw new ArgusEnvelopeValidationError(result.error.issues);
  }
  return result.data;
}

/** Non-throwing variant, for callers that want to handle invalid envelopes explicitly. */
export function safeParseArgusEnvelope(
  candidate: unknown
):
  | { success: true; data: ArgusEnvelope }
  | { success: false; issues: z.ZodIssue[] } {
  const result = ArgusEnvelopeSchema.safeParse(candidate);
  if (!result.success) {
    return { success: false, issues: result.error.issues };
  }
  return { success: true, data: result.data };
}

/**
 * Fields a companion should not need to compute by hand on every emit.
 * `timestamp` defaults to now; `version` defaults to the current contract
 * version. Everything else is still required — this is a convenience for
 * the boilerplate fields only, not a way to skip required business fields.
 */
export type ArgusEnvelopeInput = Omit<ArgusEnvelope, "timestamp" | "version"> &
  Partial<Pick<ArgusEnvelope, "timestamp" | "version">>;

/** Builds and validates an envelope, filling `timestamp`/`version` if omitted. */
export function createArgusEnvelope(input: ArgusEnvelopeInput): ArgusEnvelope {
  const candidate = {
    timestamp: new Date().toISOString(),
    version: ARGUS_ENVELOPE_VERSION,
    ...input,
  };
  return validateArgusEnvelope(candidate);
}
