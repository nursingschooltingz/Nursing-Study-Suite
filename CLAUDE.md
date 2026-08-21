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

Expect **505 passed · 0 failed**. The harness extracts live functions from the shipped HTML by anchor strings — it never copies code, so it fails loudly if a refactor moves an anchor. That failure is signal, not noise: fix the anchor reference, don't weaken the test.

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
| `Nursing-Study-Suite v15.9.html` | The entire application. The filename carries the version — quote it on the command line. Both harnesses auto-detect any `Nursing-Study-Suite*.html`, so a version bump needs no code change. |
| `latte-tests.js` | Regression harness, 505 assertions |
| `neia-fixture.json` | 10 fixed MCQs with reference classifications, for the audit test–retest |
| `neia-retest.js` | Test–retest runner — **costs live API calls**, never part of `latte-tests.js` |
| `CHANGELOG.md` | Release summary (Keep a Changelog format) |
| `Nursing-Study-Suite-v16-spec.md` | Multimodal architecture spec — **build blocked** pending benchmark |
| `Prompts.md` | All five prompt families, extracted verbatim from live bytes. Regenerate it after any prompt edit — it drifts silently otherwise. |
| `README.md` | End-user guide |

## Current state

Shipping v15.9. The app file is `Nursing-Study-Suite v15.9.html` — both harnesses auto-detect it, so a rename needs no code change. Open items:

- **The audit gate has been measured.** A full test–retest (10 fixture items × 3, plus a 6-call top-up) produced **zero verdict flips**, zero false fatals on the sound items, and both seeded defects caught and correctly named every run. No criterion was demoted; the cutoffs and severities stand on evidence, not guesses. Re-run `neia-retest.js` after any prompt or model change.
- **Fact coverage is confirmed working.** Live runs report 18/30 and 23/30 where the metric had been structurally incapable of anything but 0.
- **Real usage finds what fixtures cannot.** Every v15.8 and v15.9 bug came from running the generators against a live Knowledge Base; none was reachable from the synthetic tests. Run a real batch after any change to the generator pipelines.
- **Beware Proton Drive name clashes.** This repo lives in a synced folder. During v15.9 the client forked the app file mid-edit into `... (# Name clash ... #).html`; three of four edits landed in the fork while the working copy kept only the first, so an edit reported success and was not in the file under test. If a clash file appears, diff both before deleting either — the fork may hold the newer work.
- **Test Plan activity statements** are not supplied to either generator, so Test Plan Alignment is WARN-only in both. Neither source paper reproduces the statements — Appendix A only links to NCSBN.
- **Unverified:** whether the 2026 Test Plan renames *Safety and Infection Control* to *Safety and Infection Prevention and Control*. `NCLEX_CATEGORY_LABELS` keeps the long-standing label until a primary source confirms.
- **v16 multimodal ingestion** — architecture settled, build gated on the 20-page benchmark in the spec's §11. Do not start implementing it.
- **De-hyphenation candidate** — de-hyphenation and ligature normalization in `kbNormForMatch`, to promote quote-verification misses caused by line-break hyphenation. Cheap, may resolve much of `quoteMiss` without vision.

## Conventions

- Version bumps: update the top-of-file HTML comment, `CHANGELOG.md`, and the harness count if assertions changed.
- Scratch/plan files (`run-node-*.md`) are gitignored — don't commit them.
- Never commit `*.pdf`, `*.pptx`, or `LATTE-Knowledge-Base*.json`. These contain copyrighted textbook content.
- Prefer amber warnings over hard errors when a check could false-positive on legitimate authoring.
