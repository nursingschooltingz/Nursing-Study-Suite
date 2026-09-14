# Deliberate project decisions

Read this before changing application behavior, API usage, validation severity, security boundaries, or architecture. These choices can resemble bugs during a quick review, but each is intentional.

- **`SAFETY_SETTINGS` all `BLOCK_NONE`.** Nursing content includes overdose thresholds, self-harm risk assessment, and abuse/neglect scenarios that generic filters can falsely block.
- **API key in client-side `sessionStorage`.** This is a local bring-your-own-key application, not a hosted service.
- **`thinkingLevel` is lowercase.** That matches the Gemini REST request format used by this application.
- **Pass-1 and pass-2 quote policy is asymmetric.** Primary extraction keeps facts whose `sourceQuote` fails verification and counts the miss; the omission-audit pass discards them. The risk profiles are intentionally inverted.
- **`generateContent`, not the Interactions API.** It remains supported and is required for the batch/caching path used here.
- **Warn-tier validators remain warnings.** Qualitative scanning, missing-field checks, terminology lint, item heuristics, and difficulty signals can false-positive. Numeric entailment is the deliberate exception once `instantiated` gave the legitimate case its own support type.
- **Anki recall labels are advisory.** A visible-only target may be tested in another note; Extra may contain either useful context or an omitted substantive target. Neither label alone creates an export gate. Manual queue decisions describe captured notes/source/tier and do not certify semantic coverage.
- **Generated Anki tag grammar has an explicit scope.** New structured-KB notes capture `hierarchical-v1`: each tag must have nonempty `::`-separated segments. This structural contract permits Topic and custom namespaces, excludes stray bare tokens, and preserves manual Keep choices. Unscoped records retain compatibility. Canonical condition identity and mixed mappings remain advisory; source-fact counts never choose a majority condition.
- **Anki audit locations are distinct from recall.** A visible-only target can retain both Text and Extra locations; Text presence takes precedence over extra-only. Disjoint indices on the same valid note can merge with explicit diagnostics. Conflicting citation coordinates, unknown indices, invalid roles and malformed JSON remain unresolved. Context-classification and weak-evidence signals are advisory and never rewrite cards or clear coverage automatically.
- **Anki audit accounting is distinct from semantic accuracy.** Packet-local note handles and source-token ranges establish exact identity and traceability. A complete token inventory cannot prove that the checker chose the right targets or preserved meaning. Partial validated records are retained, but unresolved required records keep the group incomplete. Whole-deck literal matches are candidates for manual review, never automatic coverage or deletion decisions.
- **NEIA evidence tiers must remain honest.** `[NEIA-VALIDATED]` means the rubric states it, `[NEIA-DERIVED]` is this project's operationalization, and `[LATTE-HEURISTIC]` is an invention. Never attribute published reliability figures to this Gemini configuration.
- **Test Plan Alignment can warn but never fail.** Neither generator receives the Test Plan activity statements. A `FAIL` on that criterion is downgraded in code.
- **`itemAudit` is intentionally blind to grounding.** It sees only what the student sees. Do not pass fact IDs, source quotes, or the fact packet into it, and do not split the shared profile by generator.
- **Worksheet `DISTRIBUTION` mismatch is an error.** It means the worksheet asserted compliance it did not verify.
- **`gemini-3.1-pro-preview` is the Pro default.** There is no stable Pro alias for the intended path.

For release-specific measurements, rejected proposals, and open verification work, read `CURRENT_STATE.md`.
