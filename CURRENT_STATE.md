# Current maintainer state

Shipping v15.16. The canonical app is `Nursing-Study-Suite v15.16.html`. Repository tooling now requires exactly one suite HTML unless an explicit path is supplied; Proton Drive Name clash copies fail loudly.

This file carries release-specific evidence, unresolved measurements, and the current source profile. It is intentionally separate from the always-loaded `AGENTS.md`.

## Anki text-only retrieval (v15.16)

- **The Anki prompt revision was explicitly approved on 2026-09-09.** Only ANKI_MASTER_PROMPT changed; the other ten frozen constants retain their baseline. The exact change is in `ANKI-v15.16-prompt.diff`.
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
- **v16 PDF vision remains unapproved and unbuilt.** The architecture in `Nursing-Study-Suite-v16-spec.md` is retained for a future source-profile change. The §11 benchmark is not currently needed because the maintained PDF sources do not contain facts that exist only in raster visuals.

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
