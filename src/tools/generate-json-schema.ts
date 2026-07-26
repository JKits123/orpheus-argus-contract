import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ArgusEnvelopeSchema, ARGUS_ENVELOPE_VERSION } from "../schema.js";

// The Zod schema (src/schema.ts) is the single source of truth. This script
// generates schema/argus-envelope.schema.json FROM it at build time, so the
// two can never drift out of sync — do not hand-edit the generated file.

const jsonSchema = zodToJsonSchema(ArgusEnvelopeSchema, {
  name: "ArgusEnvelope",
  $refStrategy: "none",
});

// Spread first, then override — zod-to-json-schema's own $schema (draft-07)
// must not win over our explicit choice below.
const output = {
  ...jsonSchema,
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://orpheus.systems/schema/argus-envelope.schema.json",
  title: "ORPHEUS ARGUS Platform Contract Envelope",
  description:
    "Generated from argus-contract/src/schema.ts (Zod). Do not hand-edit — " +
    "run `npm run build` in argus-contract/ to regenerate. " +
    "See ORPHEUS_PLATFORM_SPEC_v2.0.md Section 3 for the source specification.",
  version: ARGUS_ENVELOPE_VERSION,
};

const __dirname = dirname(fileURLToPath(import.meta.url));
// dist/tools/ -> ../../schema (package root's schema/ folder)
const outDir = join(__dirname, "..", "..", "schema");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "argus-envelope.schema.json");
writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n", "utf-8");

console.log(`Generated ${outPath}`);
