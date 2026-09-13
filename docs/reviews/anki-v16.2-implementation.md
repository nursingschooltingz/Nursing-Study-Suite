# Anki v16.2 release verification

The user authorized the Anki improvements following four paired v16.1 Low/Medium comparisons, then explicitly requested committing, pushing and publishing v16.2 as the latest GitHub release on 2026-09-13.

## Changes

- Anki Auto defaults to Flash / Medium. Existing saved tool choices remain intact; the Anki panel can apply the recommendation without resetting other tools. Manual mode retains its shared settings. The optional source checker has separate Flash/Pro and thinking controls, captured when preparing its packet.
- The dynamic structured-KB adapter reinforces source-only Extra and Text, explicitly supplied definitions, preserved populations/qualifiers/actions, and recall of substantive list members. All eleven frozen constants and `prompt-baseline.json` remain unchanged. The exact adapter diff is recorded separately.
- Missing topic cues and missing retrieval labels have separate advisory codes. Three or more separate spans hidden by one cloze index receive an additional advisory. Comma-separated lists inside one span still require semantic review; these checks do not decide that every compound answer should split.
- Source-link diagnostics are separate from overall fact-link counts. Users can inspect captured facts and explicitly edit a note's supporting IDs. Unknown or duplicate IDs are rejected. History retains original mappings and diagnostics; text, Extra, selection and the source KB are untouched. Edits update current coverage and invalidate earlier audit results.
- Condition tags normalize only proven source-name/alias equivalents with clean mapping metadata and one unambiguous condition. Unicode distinctions, acronyms, uncertain relationships and source grouping are preserved. Normalization follows existing exact deduplication and records before/after tags. It does not introduce semantic deduplication or rewrite mismatched condition names.
- A completed source check now requires per-fact target records and separate Text/Extra support records for every in-scope note, alongside findings. Literal source spans, valid note/cloze references, scope, exclusion status and receipt accounting are validated. Findings-only responses fail. Source conflicts cannot propose unsupported corrections.
- Local preparation is labeled as unrun. Reports distinguish prepared, running, incomplete, completed and outdated states. They include independent generation/checker settings, timestamps, local source/note/prompt hashes, currentness, completed-group counts, mappings and edit history. SHA-256 identifies captured input; it does not certify correctness. Missing Web Crypto is reported without blocking private evidence export.

## Evidence behind the default

The supplied eight exports contained 2,234 notes. Medium reduced multi-span shared-index notes from 154 to 37; notes with three or more such gaps fell from 30 to 2. This supports a default for easier grading, not a general source-fidelity claim. Both settings still needed source review.

Only one of the eight supplied source-check files represented completed requests; the other seven were prepared packets. The completed check's mostly empty findings did not establish substantive recall coverage. One unmapped note reappeared in multiple packets because of packet grouping; it was not repeatedly generated.

Conservative offline tag replay found 51 possible alias normalizations under an explicitly stated assumption of clean historical mappings. Those historical files omitted mapping diagnostics, so strict replay made zero automatic changes. No course excerpts, source files or per-card findings are committed.

## Verification

- `node verify-repo.js`: 1,775 assertions, all eleven unchanged frozen hashes, generated prompt documentation, LF/version agreement and full JSX Babel transformation pass.
- `tools/anki-source-review-browser-tests.js`: isolated Chrome acceptance passes with synthetic notes and mocked Gemini. It covers Medium generation, independent captured checker settings, unrun/completed/outdated report hashes, receipt display, invalid and valid source-link edits, mapping history, incomplete receipts, cancellation/late responses, source replacement, empty batches and a 360px viewport. No unexpected requests or JavaScript page errors. A restricted-network attempt failed closed on a CDN dependency; the public-CDN retry passed.
- All eight script CDN resources and both separately pinned PDF worker copies match their SHA-384 pins. The final application preserves the verified URL/pin set.
- An independent review found and fixed repeated registry work in closed source inspectors and a missing checker-builder hash. A subsequent no-op source-link confirmation preserves a previously checked card array; actual edits still invalidate it.

No live Gemini calls are part of these checks. Native Anki import/review, new generation quality, and the upgraded checker's sensitivity/precision require separate measurement; validated receipts do not establish exhaustive target decomposition or semantic entailment.

## Distribution

The release contains `Nursing-Study-Suite.v16.2.html`, a byte-identical copy of the canonical HTML, and `SHA256SUMS.txt`. The publication workflow verifies the uploaded asset digest, tag commit and latest-release selection. Earlier releases remain available. Private knowledge bases, exports and diagnostics, scratch artifacts, and unrelated review documents are excluded from the commit and release.
