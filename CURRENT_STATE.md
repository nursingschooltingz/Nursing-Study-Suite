# Current maintainer state

## v15.18 remediation release (2026-09-11)

The canonical `Nursing-Study-Suite v15.18.html` contains the requested production-review remediation. The user explicitly authorized committing and publishing it as the next release on 2026-09-11. The prior v15.17 release remains intact. The eleven prompt constants and baseline, card prompt/resize constants, dynamic generation prompts, measured Anki mapping adapter, model profiles and token ceilings remain unchanged. The final unified gate passes 1,345 assertions; isolated Chrome checks cover storage/replacement/source races, interrupted worksheet audits, rejected repairs, output resources, PDF worker integrity and photo decoding. The implementation and browser evidence, migration notes, and deferred acceptance are maintained in [the execution ledger](docs/reviews/remediation-execution-v15.17.md).

Persistence now orders writes/deletes and preserves ambiguous legacy copies for recovery. Export the active KB and recovery copies before downgrading; older versions cannot read the new fallback/tombstone metadata. Unicode dedupe fixes prevent new losses but cannot restore previously merged facts. Source replacement invalidates pending case/worksheet generation and current links; failed and incomplete artifacts remain inspectable with explicit export notices. Live source-based pipeline acceptance and actual Anki import remain unperformed; no private material or API quota was used for this implementation.

The v15.17 Anki example-only prompt candidate failed its live pilot and was rolled back with explicit user approval; the app still uses the exact pre-pilot prompt. Mapping correction and actual Anki import remain outstanding. Historical designs and prompt diffs are archived under `docs/history/`. Repository tooling requires exactly one suite HTML unless an explicit path is supplied; Proton Drive Name clash copies fail loudly. The README points to the [v15.18 release](https://github.com/nursingschooltingz/Nursing-Study-Suite/releases/tag/v15.18).

This file carries release-specific evidence, unresolved measurements, and the current source profile. It is intentionally separate from the always-loaded `AGENTS.md`.

## Anki text-only reliability (v15.17)

- **Code-only stages A and B implemented.** Shared flat-cloze parsing blocks malformed notes at preview/export; manual selection is independent of structural eligibility. Edits cannot bypass pipe/newline checks.
- **Batch identity is conservative.** A replaced KB makes old notes stale. Sources and original mappings stay with their captured snapshot; active coverage, registry, numeric checks, and normal export stop. Aborted or superseded requests cannot publish late results.
- **Current counts and associations.** The UI distinguishes received notes, valid kept notes, and actual cloze review cards. Global linked facts and only the Anki registry entries follow edits, deletion, selection, and repairs. Style filters affect display only; tier filters affect export only.
- **Advisory numeric and collision checks.** Numbers compare complete value/unit tokens in revealed Text and Extra against validated linked fact text. Quote-only support, missing/partial mapping, unsupported notation, and stale batches have explicit statuses. This does not check comparator direction, value roles, or clinical entailment. Identical rendered fronts preserve case, punctuation, hints, and visible siblings; warnings never change selection.
- **Optional source pointers.** “Include source references” defaults off. Export-only footers deduplicate captured filename/location pairs, escape HTML safely, and show unavailable pointers. Pipe-delimited Text/Extra/Tags and current headers remain compatible.
- **Validation:** 904 deterministic assertions, all frozen prompt hashes and generated documentation, LF/version checks, and full JSX Babel transform pass after the approved rollback. The harness pins the restored prompt and rejected candidate hashes and retains the historical examples as formulation fixtures. All eight SRI pins matched their CDNs on 2026-09-11. The synthetic browser fixture exercised edit/repair/manual exclusion, deletion, tier/style filtering, cloze switching, inert markup, warnings, source export, empty regeneration, stale batches, and late response rejection. The registry remained stable between changes and preserved other artifact kinds.
- **Generation settings are preserved.** A0 SHA was `21fb5980f796649d3cb7f53f2f919e8b93e2136b` with 761 assertions. All eleven frozen prompts stayed unchanged through the code-only checkpoint `1da58a3`; the example edit and its approved rollback affected only `ANKI_MASTER_PROMPT`, now restored to its A0 bytes. Packet formatting, chunking, focus context, and the runtime mapping adapter retain their measured source hashes. Model/profile, transport, retry policy, and token ceilings were preserved.
- **The authorized paired pilot failed the revised example candidate.** The same scoped KB (40 conditions, 328 facts) completed eight chunks per run on 2026-09-11: 16 logical generation calls, no additional audit calls; actual HTTP retries were not independently counted. Baseline: 315 parsed/kept notes, 560 reviews, 328/328 linked facts, zero structural failures. Revised: 311 parsed notes, 147 four-field failures, 164 kept notes, 278 reviews, 170/328 linked facts. Another 26 revised notes placed explanation prose in Tags despite passing structural lint. No fictional-example contamination, numeric discrepancies or exact collisions were found; this does not establish clinical accuracy. Original revised responses are saved privately. Baseline rows, ledger and original diagnostics were captured from the UI and reproduced offline, but its original response bytes were not saved because the browser download failed. See `ANKI-v15.17-validation.md`.
- **One-to-many mapping now has evidence, but the adapter is unchanged.** Three baseline notes legitimately split content from facts already mapped to other notes. Their missing edges support the conditional Stage D contract correction; they are not bad IDs, line numbers or parsing failures. A proposed adapter change needs a separate bounded live measurement and further call authorization.
- **The example rollback was explicitly approved and applied on 2026-09-11.** After reviewing the failed pilot, the user approved `docs/history/ANKI-v15.17-example-rollback.diff`. Its exact inverse restores Anki hash `353471cbee66c759341ad8f4d857fa75ea4051744a52771ce780fcf172efc548`. The baseline and prompt documentation now match the restored body; reliability code and the other ten frozen prompts are unchanged. No additional live calls were made for this rollback.
- **Import remains outstanding.** Native Anki control is unavailable in this session; no actual import/review was performed. Plain and source-reference exports retain three fields and the expected row counts. The actual revised export matches the replay byte for byte, but includes the 26 misplaced-tag rows and is not study-ready. Private evidence remains in gitignored `scratch/anki-pilot/`; no unrelated course files were inspected.

## Anki text-only retrieval (v15.16)

- **The Anki prompt revision was explicitly approved on 2026-09-09.** Only ANKI_MASTER_PROMPT changed; the other ten frozen constants retain their baseline. The exact change is in `docs/history/ANKI-v15.16-prompt.diff`.
- **Style checks are advisory.** Article clues, missing condition/topic + retrieval labels, repeated cloze indices, and fronts over the soft 15-word target never uncheck a note or block export. Exceptions need judgment; a missing anchor can be correct when the condition is the answer.
- **Preview models each cloze review.** Same-number gaps hide together, other cloze answers remain visible, and Extra appears after reveal. This previews the suite's flat text cloze syntax, not custom Anki templates or nested clozes.
- **The style filter changes review visibility only.** Export still includes all kept notes in the selected tier. Warnings update immediately when Text is edited.
- **Deterministic and browser checks pass.** All 761 assertions, the full JSX Babel transform, prompt documentation/hashes, and eight SRI pins pass. The browser fixture exercised masking, reveal, cloze switching, inert markup, filters, and editing with synthetic notes.
- **Live Anki generation remains unmeasured.** Deterministic checks cannot establish prompt adherence; a real-material generation and Anki import/review remain to be checked. No live Gemini calls were authorized or made for this change.

## NCLEX extractor

- **v15.15 fixes answer choices being mistaken for question numbers.** `nclexSplitByQNum` matched `1.` at a line start, which is both a stem marker and a first-choice marker. On a three-question Davis sample it returned the Q1 stem plus three Q1 choices as questions and lost Q2/Q3. `nclexDropOptionRuns` now detects printed choice runs by spacing and removes them from candidate starts.
- **All three drop guards are required.** A choice run must be preceded by something, must not exceed `NCLEX_OPTION_RUN_MAX`, and the question sequence must resume afterward. Each prevents a different false positive and has a harness case.
- **`NCLEX_OPTION_GAP`, `_RUN_MIN`, and `_RUN_MAX` are layout constants, not preferences.** Widening the gap or raising the maximum can make a genuine question list resemble a choice run and silently delete questions. Change only against a real PDF.
- **The fix is confirmed on live output.** A 2026-08-29 run on real source material confirmed that the filter holds on genuine `pdfLayoutText` output, including wrapped choices.
- **Mixed-marker selection remains untested.** The splitter chooses the pattern yielding the most distinct numbers. A book numbering stems `1.` and choices `1)` could let the choice pattern win while capturing choice lines. No known source does this. If a future extraction produces short fragments, measure this first; do not loosen the choice-run filter speculatively.

## v15.14 validation still outstanding

The deterministic gates pass, but these v15.14 paths still need real-material checks:

1. A chapter containing both `↑` and `↓` forms of the same lab; they must remain separate facts.
2. A hand-corrupted `sourceQuote` comparator; it must be reported.
3. A card transcribed and then its photo removed; it must not build.
4. One full-resolution phone photo through the downscale path, measured at two runs per card.
5. One split-mode run on a real Davis PDF to confirm windowed pairing recovers questions past the former 12,000-character cliff.

- **`kbQuoteOperatorsAgree` remains WARN tier.** It can false-positive on column/table spans as `reordered` misses do. A non-zero diagnostic deserves investigation, not automatic pass-2 discard, until a real corpus establishes the false-positive rate.
- **Card resize constants are prompt-class.** Changing `CARD_MAX_EDGE`, `CARD_JPEG_QUALITY`, or `CARD_RESIZE_ABOVE_BYTES` can change OCR accuracy and therefore requires two runs per card.
- **`responseSchema` remains deliberately unimplemented.** It changes model output shape even though it does not touch frozen prompt bytes. It needs a real batch before adoption.
- **Per-operation token budgets are rejected.** `maxOutputTokens` is a ceiling, not a reservation, and Gemini 3 thinking shares the budget. The universal 65,536 remains correct.
- **All eight SRI pins were verified again on 2026-09-09 for v15.16.** Both DOMPurify CDNs served 29,209 identical bytes. Recheck every pin on an application version bump.
- **`.gitattributes` pins `* -text`.** If the harness fails wholesale after a Git operation, check line endings first; every extraction anchor assumes LF (`\n`).

## Live-generation evidence

- **The item-audit gate has been measured.** Ten fixture items across three runs plus a six-call top-up produced zero verdict flips, zero false fatals on sound items, and both seeded defects caught and correctly named every run.
- **Fact coverage is confirmed working.** Live runs reported 18/30 and 23/30 where the metric had previously been structurally limited to zero.
- **Real usage is required after generator-pipeline changes.** Every v15.8 and v15.9 defect came from live Knowledge Base generation rather than synthetic fixtures.
- **Proton Drive Name clash copies can contain newer work.** During v15.9, three of four edits landed in a fork while the canonical filename retained only the first. The resolver now stops on clash filenames, but a human must still diff both copies before deleting either.
- **Test Plan Alignment remains WARN-only.** The generator does not receive the Test Plan activity statements.
- **The 2026 category label remains unverified.** Keep *Safety and Infection Control* until a primary NCSBN source confirms whether it became *Safety and Infection Prevention and Control*.

## Flashcard ingestion and the v16 boundary

- **Flashcard ingestion is not v16 multimodal PDF ingestion.** Card photos have no text layer, so pass 1 transcribes a photo and pass 2 gives only that transcript to the existing frozen extractor. Pass 2 must never receive the image.
- **The transcript is the trust boundary.** A digit misread in pass 1 can verify perfectly against the wrong transcript downstream. Repeat runs measure self-agreement, not accuracy, so transcripts and every clinical number require human review.
- **Front/back pairing is correctness-critical.** Davis backs contain the running header and card number but no condition name. `cardMergeFaces` joins category plus card number, front first.
- **`CARD_TRANSCRIBE_PROMPT` is tunable but load-bearing.** It must never guess a number, expand an abbreviation, or normalize symbols, and it must route unrecognized headings to `other`. Remeasure at two runs per card after an edit.
- **v16 PDF vision remains unapproved and unbuilt.** The architecture in `docs/history/Nursing-Study-Suite-v16-spec.md` is retained for a future source-profile change. The §11 benchmark is not currently needed because the maintained PDF sources do not contain facts that exist only in raster visuals.

## Current source profile

There are two source classes and they deliberately take different paths:

1. **Specialized text-first nursing PDFs.** They have no image tables, ECG strips, or raster-only figures, so the central v16 premise does not hold. Two-column reading order can break provenance quotes without losing fact content.
2. **Photographs of printed Davis-style flashcards.** They have no text layer and use the v15.12 transcription path.

If PDFs become actual textbook chapters with clinically important raster content, reopen the v16 spec and run its §11 benchmark first. Card photos alone do not trigger that architecture.

- **Two-column card backs are handled by transcription.** Vision reads the columns into transcript order; do not loosen the PDF quote matcher for them.
- **Two-column text PDFs create provenance failures, not demonstrated content loss.** The model receives the complete chunk and can extract the fact, but a verbatim quote may fail after column-major text scrambling.
- **The composition probe stays.** It is off by default, costs nothing when off, and provides a cheap way to retest the source-profile assumption if materials change.

## Quote-verification evidence

- **De-hyphenation is confirmed on live output.** A cardiovascular chapter produced 190 failed quotes: 83 hyphenation/ligature, 107 reading order, and zero partial/absent/too-short. After the additive fallback, hyphenation fell to zero, `dehyphSaved` was 77, first-pass misses fell from 182 to 97, and audit discards from 8 to 3.
- **No fabricated quotes were observed across the two measured runs** (about 370 quotes). A future meaningful `absent` count is therefore a signal, not expected noise.
- **The fallback must remain strictly additive.** `kbQuoteInSource` tries plain normalized matching first and consults de-hyphenation only after failure. It can turn FAIL into PASS and never the reverse. Do not replace both paths with one loose comparison.
- **A non-zero `hyphenation` diagnostic is now a regression signal.** The classifier is reached only after both plain and de-hyphenated matching fail; pointing it at the promoted matcher would erase this signal.
- **Reading-order failures are accepted.** No matcher loose enough to bridge multi-column distances is safe for clinical doses. The fact remains available while its verbatim proof is marked unverified.
