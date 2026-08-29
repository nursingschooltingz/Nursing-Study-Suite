# CLAUDE.md

Project context for Claude Code. Read this before proposing changes.

## What this is

A single-file, serverless HTML study suite for nursing students. It turns lecture PDFs and PPTX decks into a source-cited LATTE knowledge base, then generates prioritized study guides, Anki cloze cards, NCLEX practice questions, and unfolding clinical case studies from it. Everything runs client-side against the Gemini API with a user-supplied key.

Maintained by one person — a working LPN in an LPN-to-RN bridge program — between clinical shifts. Optimize for changes that are small, verifiable, and reversible.

## Hard invariants — do not violate without explicit approval

1. **The 11 prompt constants are byte-frozen.** `KB_EXTRACTION_PROMPT`, `KB_VERIFY_PROMPT`, `ANKI_MASTER_PROMPT`, `NCLEX_INLINE_PROMPT`, `NCLEX_SPLIT_PROMPT`, `NCLEX_AI_PAIR_PROMPT`, `NCLEX_GEN_PROMPT`, `NCLEX_DISTRACTOR_RULES`, `NCLEX_ANCHOR_RULES`, `NCLEX_RATIONALE_RULES`, `NCLEX_COMPLETENESS_RULES`. These were tuned across many iterations; a "harmless" rewording is a silent regression with no test that catches it. If a change genuinely requires touching one, say so up front, make the smallest possible edit, and report the exact diff afterward.
2. **Single file, no build pipeline.** One `.html` containing everything, loaded from CDNs, compiled by in-browser Babel. This is a deliberate product constraint — the user opens the file by double-clicking it, on any machine, with no install. **Never propose** bundlers, npm builds, TypeScript migration, module splitting, or a backend. Reviews suggest these constantly; they are all out of scope.
3. **All three gates pass before any commit.** See Testing below.
4. **No new runtime dependencies.** The CDN list is fixed. `latte-tests.js` uses only built-in `fs`.

## Testing (required before every commit)

```
node latte-tests.js
```

Expect **568 passed · 0 failed**. The harness extracts live functions from the shipped HTML by anchor strings — it never copies code, so it fails loudly if a refactor moves an anchor. That failure is signal, not noise: fix the anchor reference, don't weaken the test.

Watch for *vacuous* passes as well as failures: an end anchor that matches earlier than intended silently truncates a span, and every assertion about the missing tail then passes for the wrong reason. `caseBuildPrompt` hit exactly this — `'\n}\n'` matched inside its JSON-shape block. Where a span covers a prompt, assert that something near its *end* is present.

Two more gates for changes touching the HTML:
- **Babel parse** — the whole `<script type="text/babel">` block must transform cleanly with `presets:['react']`. Install `@babel/standalone` outside the repo (a scratch dir) so no dependency lands here.
- **Prompt byte-check** — extract all 11 constants and confirm they are unchanged.

`neia-retest.js` is **not** part of any gate — it makes live API calls and costs quota. Run it by hand after a prompt or model change.

New behavior gets a new assertion in `latte-tests.js`. A change without a test is not finished.

## How to make changes

Edits to the HTML are exact-match string replacements with an occurrence-count assertion — verify the old string appears exactly once before replacing, and fail loudly otherwise. Read the actual bytes before editing rather than reconstructing from memory; the file is large and near-duplicate strings are common.

Every non-obvious change carries a `// vNN.N:` comment explaining *why*, including what the previous behavior was and why it was wrong. Several past bugs were reintroduced by well-meaning "cleanups" of code that looked redundant.

## Deliberate decisions that look like bugs

Do not "fix" these:

- **`SAFETY_SETTINGS` all `BLOCK_NONE`.** Nursing content — overdose thresholds, self-harm risk assessment in psych, abuse/neglect scenarios — false-positives generic filters. Deliberate and documented.
- **API key held client-side in `sessionStorage`.** This is a local bring-your-own-key tool, not a hosted service. Not a vulnerability in this architecture.
- **`thinkingLevel` is lowercase.** Matches Google's documented REST format. Reviewers have claimed uppercase three times; they are wrong.
- **Pass-1 vs pass-2 quote policy is asymmetric.** Primary extraction *keeps* facts whose `sourceQuote` fails verification (counting `quoteMiss`); the audit pass *discards* them. The risk profiles are inverted — see the code comments. Making both strict reintroduces omissions.
- **`generateContent` (not the Interactions API).** Legacy but fully supported, and required for batch/caching.
- **Warn-tier validators.** Qualitative term scanning, missing-field checks, terminology lint, item heuristics, and difficulty signals warn rather than error, on purpose. Errors block registry inclusion; warnings inform. Don't escalate without asking. (Numeric entailment was the exception: v15.6 escalated it to error once `instantiated` gave the one legitimate case its own declared support type.)
- **NEIA evidence tiering.** Comments are tagged `[NEIA-VALIDATED]` (the rubric states it), `[NEIA-DERIVED]` (our operationalization of a validated criterion), or `[LATTE-HEURISTIC]` (our invention). Never let a LATTE heuristic acquire the authority of a validated criterion, and never cite a published reliability figure as a property of this build — the reliability study tested zero Gemini configurations.
- **Test Plan Alignment can warn but never fail.** No Test Plan document is supplied to either generator. A `FAIL` naming that criterion is downgraded in code, not merely discouraged in the prompt.
- **The `itemAudit` auditor is blind to grounding on purpose.** It sees only what the student sees. Do not "helpfully" pass it fact IDs, source quotes, or the fact packet — that reintroduces the generator's own framing into its review. One profile row serves both generators; do not split it per tool.
- **The worksheet DISTRIBUTION check is an error, not a warning.** A worksheet whose own `DISTRIBUTION:` line disagrees with its contents means the model reported compliance it never verified — the precise failure an in-call self-gate cannot catch.
- **`gemini-3.1-pro-preview` as the Pro default.** There is no stable Pro alias; this is the current Pro path.

## File map

| File | Purpose |
|---|---|
| `Nursing-Study-Suite v15.12.html` | The entire application. The filename carries the version — quote it on the command line. Both harnesses auto-detect any `Nursing-Study-Suite*.html`, so a version bump needs no code change. |
| `latte-tests.js` | Regression harness, 568 assertions |
| `neia-fixture.json` | 10 fixed MCQs with reference classifications, for the audit test–retest |
| `neia-retest.js` | Test–retest runner — **costs live API calls**, never part of `latte-tests.js` |
| `davis-transcribe-test.js` | Flashcard transcription batch runner — **costs live API calls**, never part of `latte-tests.js`. The in-app panel is the normal path; this is for measuring a deck without clicking through it. |
| `CHANGELOG.md` | Release summary (Keep a Changelog format) |
| `Nursing-Study-Suite-v16-spec.md` | Multimodal architecture spec — **build blocked** pending benchmark |
| `Prompts.md` | All five prompt families, extracted verbatim from live bytes. Regenerate it after any prompt edit — it drifts silently otherwise. |
| `README.md` | End-user guide |

## Current state

Shipping v15.12. The app file is `Nursing-Study-Suite v15.12.html` — both harnesses auto-detect it, so a rename needs no code change. Open items:

- **The audit gate has been measured.** A full test–retest (10 fixture items × 3, plus a 6-call top-up) produced **zero verdict flips**, zero false fatals on the sound items, and both seeded defects caught and correctly named every run. No criterion was demoted; the cutoffs and severities stand on evidence, not guesses. Re-run `neia-retest.js` after any prompt or model change.
- **Fact coverage is confirmed working.** Live runs report 18/30 and 23/30 where the metric had been structurally incapable of anything but 0.
- **Real usage finds what fixtures cannot.** Every v15.8 and v15.9 bug came from running the generators against a live Knowledge Base; none was reachable from the synthetic tests. Run a real batch after any change to the generator pipelines.
- **Beware Proton Drive name clashes.** This repo lives in a synced folder. During v15.9 the client forked the app file mid-edit into `... (# Name clash ... #).html`; three of four edits landed in the fork while the working copy kept only the first, so an edit reported success and was not in the file under test. If a clash file appears, diff both before deleting either — the fork may hold the newer work.
- **Test Plan activity statements** are not supplied to either generator, so Test Plan Alignment is WARN-only in both. Neither source paper reproduces the statements — Appendix A only links to NCSBN.
- **Unverified:** whether the 2026 Test Plan renames *Safety and Infection Control* to *Safety and Infection Prevention and Control*. `NCLEX_CATEGORY_LABELS` keeps the long-standing label until a primary source confirms.
- **Flashcard ingestion shipped in v15.12, and it is NOT v16.** Photographed cards have no text layer, so they take a two-pass path: pass 1 transcribes the image to verbatim structured text, pass 2 is the existing frozen extractor reading that text. Because pass 2 reads text, `kbQuoteInSource` verifies its quotes unchanged — which is precisely why none of the v16 spec's evidence states, routers, or visual safety gates were needed. Keep that boundary: **pass 2 must never be handed the image.** Doing so would reintroduce every problem sections 4–7 of the spec exist to solve.
- **The transcript is the trust boundary, and nothing downstream can police it.** A number misread in pass 1 is then verified flawlessly against the wrong transcript by the extractor, the auditor, and every numeric check — all agreeing, all wrong. Repeat runs measure self-agreement, which is *not* accuracy: a model can misread the same digit identically every time. This is why transcripts are reviewed before use, why every clinical number is surfaced in its own list for an eye check, and why that must not be replaced with a green tick.
- **Front/back pairing is a correctness requirement, not polish.** A Davis back face carries the running header and card number but **no condition name**. A back extracted alone yields facts with nothing to attach them to. `cardMergeFaces` joins on category + card number, front first.
- **`CARD_TRANSCRIBE_PROMPT` is not one of the 11 frozen constants** and may be tuned freely — but its rules are load-bearing and pinned by the harness: never guess a number, never expand an abbreviation, preserve symbols exactly (an `↑` before a lab *is* the fact), keep an open enum so an unrecognised heading lands in `other` rather than being dropped. Re-measure with 2 runs per card after any edit to it.
- **v16 multimodal ingestion is STILL NOT being built. Decided 2026-08-28; unchanged by v15.12.** Its stated re-open trigger fired one day later when cards arrived, but narrowly: cards needed a transcriber, not selective page vision over PDF pages. Sections 4–7 remain unbuilt and unneeded. Do not re-open the spec's architecture without new information about the **PDF** sources. The §11 benchmark was not run, and does not need to be: its decisive row is "facts visible on the page but absent from the KB," and the maintainer's actual sources make that row zero by construction. See *Source profile* below. "Build nothing" is one of the three outcomes §11 names, reached early on better evidence than a 20-page pilot would have produced. The architecture in `Nursing-Study-Suite-v16-spec.md` remains sound and is kept for the day the source profile changes; nothing in it is approved.
- **Source profile — two kinds now, and they take different paths.** (1) Specialized, text-first nursing PDFs — no image tables, ECG strips, or raster figures — which is why the v16 spec's §2 premise does not hold for them and vision has nothing to recover there. (2) Photographs of printed Davis-style flashcards, added 2026-08-29, which have *no* text layer and go through v15.12's transcription pass. Neither profile is visible in the code or git history, and the pair remains the most load-bearing assumption in the roadmap: **if the PDF sources ever become real textbook chapters, the v16 spec goes back on the table and its §11 benchmark is the right first step.** Cards arriving did not do that — see the entry above.
- **Two-column card backs are handled by transcription, not by loosening the matcher.** Vision reads columns in the right order, so the `reordered` failure mode below does not carry over to card sources. It still applies in full to PDFs.
- **A two-column layout is not an argument for v16 here.** Specialized sources are often two-column, which scrambles the text stream and inflates `quoteMiss` via the `reordered` bucket. That is a *provenance* failure, not content loss: the model still receives the full chunk text and still extracts the fact correctly — it just cannot produce a quote that survives the verbatim check, so the fact is silently marked unverified rather than lost. Do not let a high `reordered` count on text-only sources reopen the vision question.
- **The composition probe stays, deliberately.** Off by default, zero cost when off, fully tested. It is the cheap way to re-check the source-profile assumption above if the material ever changes. Keep it even though the feature it was built for is cancelled.
- **De-hyphenation shipped in v15.11 and is confirmed working on live output.** The measurement that justified it: a cardiovascular chapter (6 chunks, 362 facts) produced 190 failed quotes — **83 hyphenation/ligature · 107 reading order · 0 partial · 0 absent · 0 tooShort.** The rebuild after the change: **hyphenation 0, dehyphSaved 77, first-pass misses 182 → 97, audit discards 8 → 3.** The classifier predicted 43.7% of failures were hyphenation-fixable; the fallback rescued 43.5% on an independently generated quote set. Measure-then-act worked as intended — do not skip that sequence on the next candidate.
- **Zero fabricated quotes across both runs** (~370 quotes). Every verification failure to date has been typesetting or layout, never invention. That is a real property of this extraction pipeline and a useful baseline: a future run showing meaningful `absent` counts is a signal worth chasing, not noise.
- **The fallback's safety rests on being strictly additive.** `kbQuoteInSource` tries the plain normalized match first and returns on success; the de-hyphenated match is consulted only after a failure, so it can turn a FAIL into a PASS and never the reverse. That is what makes it safe in pass 2, where a failed match *discards* the fact. Do not "simplify" it into a single de-hyphenated comparison — that would change which quotes pass in both directions and silently alter the pass-2 discard set.
- **A non-zero `hyphenation` count in the diagnostics panel is now a bug signal.** `kbClassifyQuoteMiss` still diagnoses the *plain* match, and since v15.11 it is only reached for quotes that failed plain **and** de-hyphenated. The bucket therefore cannot fire unless the matcher and the classifier have come apart. Free regression detector; don't "fix" it by pointing the classifier at the promoted matcher.
- **Reading-order failures are deliberately not addressed.** 107 of the 190 come from multi-column layout: the words are all present but hundreds of characters apart in the text stream. The fact is extracted correctly and only its verbatim proof fails. No matcher loose enough to accept those is safe for doses — see the v16 spec §4. This is a provenance cost, accepted knowingly.

## Conventions

- Version bumps: update the top-of-file HTML comment, `CHANGELOG.md`, and the harness count if assertions changed.
- Scratch/plan files (`run-node-*.md`) are gitignored — don't commit them.
- Never commit `*.pdf`, `*.pptx`, or `LATTE-Knowledge-Base*.json`. These contain copyrighted textbook content.
- Prefer amber warnings over hard errors when a check could false-positive on legitimate authoring.
