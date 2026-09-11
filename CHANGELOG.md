# Changelog

All notable changes to the Nursing Study Suite.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Detailed engineering rationale for each change — including rejected proposals and why — lives in `LATTE-v15-changelog.md`. This file is the summary.

Releases use the unified verifier for Babel parsing, regression assertions, prompt documentation, and all 11 frozen prompt hashes. Through v15.15, the constants retained their v14.x bytes; v15.16 and v15.17 deliberately update only the explicitly approved Anki prompt baseline.

---

## [15.17] — 2026-09-11

### Fixed
- Flat cloze structure now drives preview, index counting, numeric scanning, collisions, and export validation. Malformed delimiters, nesting, empty/nonpositive indices, and edits that insert pipes/newlines cannot silently export. Structural eligibility is independent of manual selection.
- Anki batches capture immutable facts/pointers and validate mapping edges against the supplied chunk before dedupe. Unknown/out-of-chunk IDs, omissions, invalid destinations, and unmapped notes are distinguished. Valid duplicate mappings are retained.
- Replacing the KB makes old notes stale and rejects late generation results. Live global coverage and Anki Fact Inspector entries now follow edits, deletion, exclusions, and repairs, without changing NCLEX/case entries.

### Added
- Explicit received-note, kept-note, and cloze-review totals; style filtering stays independent of export and coverage.
- Warning-only exact numeric comparisons with honest checked/not-checked status, quote-only and unsupported-form findings; identical rendered-front groups distinguish possible ambiguity and redundancy.
- Optional source-pointer footers in the existing pipe-delimited export, default off, with safe HTML/plain rendering and explicit unavailable sources.
- Private raw-response diagnostics, including interrupted runs; a synthetic browser fixture and a read-only pilot planner.
- The example-only Anki prompt revision, applied under the user's one-time approval on 2026-09-11. Five fictional complete rows demonstrate context anchors and the existing import fields. Exact diff: `ANKI-v15.17-example-proposal.diff`.

### Validation
- `node verify-repo.js`: 904 assertions (143 added), full JSX Babel transform, LF/version checks, generated prompt documentation, and all eleven frozen hashes pass. The live prompt's examples pass formulation checks; reversing only the approved diff recovers its prior frozen hash. All eight CDN SRI pins rechecked and matched on 2026-09-11.
- Synthetic browser checks passed for editing/repair, manual exclusion, deletion, counts, global coverage/registry, filters, cloze switching/reveal, inert markup, warnings, escaped source exports, empty regeneration, KB replacement and late-result rejection.
- The other ten frozen prompts, source packet, chunker, focus block, runtime adapter, API models/settings and transport remain unchanged. Only `ANKI_MASTER_PROMPT`'s baseline was deliberately updated for the exact approved example diff.
- The user-approved paired live pilot completed 16 logical generation calls on one scoped KB. The revised example candidate failed: 147/311 notes had four fields versus 0/315 baseline, and 26 more revised rows put explanations in Tags. Existing structural checks excluded the 147 malformed notes. The exact inverse prompt diff is prepared, not applied; the current candidate is not ready for publication. Three baseline unmapped notes support a separately measured one-to-many adapter correction. See `ANKI-v15.17-validation.md` for counts, manual sampling and the baseline raw-response capture limitation. Actual Anki import remains outstanding. No unrelated course-file reads, publication or push occurred.

## [15.16] — 2026-09-09

### Changed
- **Approved Anki prompt revision:** consistent condition/topic and retrieval labels, article clues absorbed into clozes or removed through label phrasing, one independently gradable clinical pivot per review card, and a soft 15-word front target that never drops necessary qualifiers. Supporting mechanisms and contrasts stay source-grounded in Extra; substantive mechanisms still receive recall notes. Anti-redundancy rules now preserve separate notes when combining would reveal the target.
- Only `ANKI_MASTER_PROMPT` receives a new baseline hash. [Exact prompt diff](ANKI-v15.16-prompt.diff); the other ten frozen constants remain unchanged.

### Added
- **Review preview:** select a cloze index, reveal/hide its answer, and show Extra only after reveal. Same-index gaps hide together and other cloze answers remain visible. Generated text is rendered as inert text.
- **Advisory style warnings** for article clues, missing anchors/labels, multiple same-index gaps, and long review fronts. Warnings update after edits and never affect keep/export decisions.
- **Style warnings filter** across Table, List, and Preview. Export continues to include all kept notes in the selected tier, regardless of this review-only filter.

### Validation
- `node verify-repo.js` passes all 761 assertions (36 new), prompt hashes/documentation, LF/version checks, and the full JSX Babel transform. All eight CDN SRI pins rechecked on 2026-09-09 and matched.
- Browser check with synthetic notes confirmed same-index masking, c1/c2 switching, answer/Extra reveal, inert markup, combined tier/style filtering, and immediate warning removal after editing while preserving keep selection.
- Live generation adherence and a real Anki import/review remain unmeasured; no live Gemini calls were made.

## [15.15] — 2026-08-29

NCLEX Question Extractor. Three faults found by running v15.14 against a real question bank; all three were code, and **no prompt constant was touched**.

### Fixed
- **Answer choices were being read as question numbers, truncating every question to its stem and deleting most of the section.** `nclexSplitByQNum` matched `1.` at a line start, which is the stem marker *and* the first-choice marker. Question 1's slice therefore ended at its own first choice. On a three-question Davis-shaped sample the parser returned four items: the stem of Q1, and three of Q1's choices posing as questions — Q2 and Q3 were gone, their numbers already claimed. `nclexDropOptionRuns` now identifies choice runs by **spacing** (entries a line apart, ascending from 1, three to six of them) and removes them from the candidate question starts. Three guards must all hold before a run is dropped: it is preceded by something, it does not exceed `NCLEX_OPTION_RUN_MAX`, and the question sequence resumes afterwards. A section whose questions genuinely begin at 1, and a 20-question list, both survive untouched.
- **Multiple-choice options are now parsed, displayed and repaired.** `nclexSplitStemOptions` reads the choice list back out of the question text — numbered, lettered or parenthesised, on their own lines or inline — so question cards render choices as a list, and an item that arrived *without* choices is flagged on the card instead of looking complete. A numbered list inside the stem ("Vitals: 1. HR 110 2. BP 88/50") does not fool it: the real choices form the longer run and the longest run wins.
- **Split Q&A restores missing choices from the source page.** The batch still holds each question's verbatim page text, so when the model returns a bare stem `nclexRepairOptions` splices the choices back from the book's own bytes — no extra API call, nothing invented, and the log reports how many were restored. Inline mode has no equivalent source to repair from (the model itself decides where a question begins); the chunk overlap is what covers a split there.

### Changed
- **Every extractor export groups the answers at the end.** `.md`, `.txt`, **Copy** and **PDF** are now Questions first, then one Answer Key — the same `## Questions` / `## Answer Key` shape the NCLEX Generator worksheet has always used, pagebreak included, so the PDF starts its answer key on a fresh page. Answers previously sat directly beneath their own question, which made an exported set unusable for the thing it is exported for.

### Added
- **Page ranges on the Inline tab**, using the same `PageRangeSection` picker as Split Q&A, seeded from the detected page count. Opt-in via **Limit to specific pages**, so the default is still the whole document. With ranges on, Inline takes the same one-PDF-per-run restriction Split has always had — page 1–50 of file A applied to file B would quietly extract the wrong chapter.
- 41 assertions (678 → **719**), covering the Davis-shaped regression, each of the three drop guards, select-all runs, all four choice-label styles, the repair path, and the answer-key grouping in both export formats.

### Notes
- **Confirmed against a live PDF.** The maintainer ran this build on real source material after release and reports the extractor working as intended. That closes the check this release shipped with outstanding: the choice-run filter holds on genuine `pdfLayoutText` output, not only on fixtures.
- **A related hazard was found and deliberately left alone.** The splitter picks whichever pattern yields the most distinct numbers, so a book numbering stems `1.` and choices `1)` could still let the choice pattern win on count. No known source does this, and rewriting the selection rule is a larger change than the confirmed bug justified. If a book ever extracts as short fragments, look here first.

---

## [Unreleased]

### Added
- **One deterministic repository gate:** `node verify-repo.js` resolves one canonical suite HTML, rejects Proton Drive Name clash copies, checks LF/version agreement, verifies the 11 frozen prompt hashes, checks the generated prompt documentation, enforces the regression assertion total, and Babel-transforms the full JSX block. `--setup-babel` installs the pinned scratch parser under the operating-system temp directory, never in the repository.
- **Machine-enforced prompt provenance:** `prompt-baseline.json`, `tools/check-prompts.js`, and a generated `Prompts.md` appendix now cover all 12 named constants. The three NCLEX Extractor prompts are correctly marked byte-frozen; `CARD_TRANSCRIBE_PROMPT` is correctly marked tunable but remeasurement-sensitive.
- **Progressive project context:** `AGENTS.md` is now the compact operating contract, with release evidence in `CURRENT_STATE.md`, deliberate behavior decisions in `DECISIONS.md`, and implementation routing in `DEVELOPMENT.md`. `CLAUDE.md` points to the same canonical contract rather than duplicating it.
- Six repository-tooling assertions (**719 → 725**) cover the baseline shape, shared resolver, Name clash recognition, harness wiring, generated prompt coverage, and unified gate wiring.

### Changed
- All three harnesses now share one suite-file resolver and fail on ambiguous auto-discovery instead of choosing the lexically last filename. An explicit filename remains supported after the canonical copy has been identified.
- Live Gemini retest/transcription harnesses are explicitly outside the deterministic gate and require user authorization because they consume quota and may handle copyrighted source material.

### To do
- **Verify v15.14 against live output.** It ships from a three-way review with all gates green, but nothing in it has met a real Knowledge Base or a real deck. In order: a chapter carrying both an up-arrow and a down-arrow form of one lab (they must stay separate facts); a hand-corrupted `sourceQuote` comparator (must now be reported); a card transcribed then its photo removed (must NOT build); one full-resolution phone photo through the new downscale path, measured at 2 runs per card; one split-mode run on a real Davis PDF to confirm windowed pairing recovers questions past the old 12,000-character cliff.
- **Measure `kbQuoteOperatorsAgree` before promoting it.** It is WARN tier deliberately. Once a real corpus shows its false-positive rate on multi-column and tabular sources, decide whether pass 2 should discard on it. Same measure-then-act sequence de-hyphenation went through in v15.11.
- **`responseSchema` on the structured calls.** `responseMimeType` is set in eight places, `responseSchema` in none. It is a `generationConfig` field so it touches no frozen prompt, but it changes what the model returns — needs a real batch, which is why it was held back from 15.14.
- **Spot-check the 2 `partial` quotes** that appeared in the v15.11 rebuild (0 in the previous run). Most likely a chunk-seam artifact or a light paraphrase; 2 out of ~180 is noise, but `partial` is the one bucket that can indicate a genuine quoting problem rather than a layout one.
- **Watch transcription accuracy as card volume grows.** One deck transcribed clean at a single pass. That is one sample of one card type in good light; a drug card with dose columns is the harder case. Re-run with 2 runs per card after any change to `CARD_TRANSCRIBE_PROMPT`, and eye-check numbers on any card whose legibility is not `clean`.
- Confirm against a primary NCSBN source whether the 2026 Test Plan renames *Safety and Infection Control* to *Safety and Infection Prevention and Control*. The v4.2 patch claimed it; it could not be verified. `NCLEX_CATEGORY_LABELS` keeps the long-standing label until then.
- Supply real NCLEX-RN Test Plan activity statements to the generator, then promote Test Plan Alignment from WARN-only to a hard FAIL in the v4.2 gate.
- **Run a real batch after any generator change.** Every v15.8 and v15.9 bug came from live output; none was reachable from the synthetic tests.
- **B3 / B4** from the v15.7 brief are unstarted. B3a needs approval to edit two frozen extractor prompts.

### Under consideration
- *(nothing open)*

### Decided against
- **v16 — selective multimodal page ingestion. Still not being built.** Decided 2026-08-28; unchanged by v15.12. The cancellation's stated trigger — "a change of source material re-opens it" — fired one day later when flashcards entered, but it fired *narrowly*: cards needed a transcriber, not this spec's page-vision architecture. Sections 4–7 (evidence states, dual-track propagation, visual safety gate, two-signal router) remain unbuilt and unneeded. The original reasoning, preserved:

- **v16 — the original cancellation (2026-08-28).** The §11 benchmark was never run and is not needed. Its decisive row is "facts visible on the page but absent from the KB," and the sources this suite is actually fed — specialized, text-first nursing material rather than publisher textbook chapters — contain essentially no drug tables rendered as images, ECG strips, flowcharts or raster figures. §2's premise does not hold for that material, so vision has nothing to recover. "Build nothing" is one of the three outcomes §11 names, reached on better evidence than a 20-page pilot would have produced.

  Two notes so this does not get re-opened by accident. **A high `reordered` count is not a reason to revisit it** — two-column layouts scramble the text stream and inflate that bucket, but the model still receives the full text and still extracts the fact; only the verbatim quote fails, so the fact is marked unverified rather than lost. **A change of source material is** — if the inputs ever become real textbook chapters, the premise returns and §11 becomes the right first step again. The spec is kept for that case; nothing in it is approved.

  v15.10's instrumentation is not wasted: it was built to answer this question and it still answers the cheaper one (de-hyphenation) on every ordinary build. The opt-in composition probe stays in the app, off by default, as the cheap way to re-check the source-profile assumption.

---

## [15.14] — 2026-08-29

A correctness release, driven by three independent production reviews (Claude Code, ChatGPT, Gemini) rather than by new features. Nothing here adds capability. Every finding carried over from an external review was re-verified against the actual bytes before being acted on, and the ones that did not survive that check are recorded below so they are not re-raised next cycle.

The reviews turned out near-disjoint — roughly thirty real findings across three reviewers with almost no overlap. The useful lesson is that one review is not a review.

Gates: **678 assertions, 0 failed** (up from 568) · Babel transform clean · all 11 frozen prompt constants byte-identical. No prompt text changed at all this release, `CARD_TRANSCRIBE_PROMPT` included, so `Prompts.md` needs no regeneration.

### Tier 1 — integrity of the material itself

A defect here changes what the app reports as true, so these came first.

- **`kbFactKey` deleted the clinical operators.** The character class kept ASCII `<` and `>` but stripped `≤ ≥ ↑ ↓ +`, so "↑ BUN" and "↓ BUN" produced an **identical** merge key. `mergeLatteParts` then silently kept the first and unioned the *other* chunk's source pointer onto it — a fact citing the page that said the reverse. `CARD_TRANSCRIBE_PROMPT` rule 3 exists entirely to preserve arrows; the merge key threw them away one step later. The class is widened; `-` stays last so it remains a literal. The two spellings of each operator are deliberately **not** canonicalised into one: two copies of a fact is the safe direction.
- **Verbatim quote verification was blind to inverted comparators.** `kbNormForMatch` replaces `[^a-z0-9]+` with a space, so `"HR < 60"` and `"HR > 60"` both normalize to `hr 60`, and a quote with a reversed comparator verified cleanly against a source saying the opposite. `kbNormForMatch` is **not** touched — editing it would move which quotes pass in both directions and alter the pass-2 discard set. Instead `kbQuoteOperatorsAgree` runs *after* a quote has already been accepted, so it can only ever add a finding. **WARN tier on purpose:** this is the measure step, not the act step. The check can false-positive on a column or table span the same way `reordered` misses do, so pass 2 records but does not discard. De-hyphenation earned its promotion by being measured first; this gets the same treatment.
- **A removed card photo was still built into the Knowledge Base.** Transcripts were keyed on basename while `addFiles` de-duplicates on name+size+lastModified, so two photos sharing a name collided — and removing a photo never removed its transcript, while `cardChunks` reads every transcript. `cardFileId` now keys the transcript map, the file-chip React key, and the removal prune.
- **The flashcard review gate was a paragraph of UI text, not code.** Build was disabled on busy/apiKey/files alone, so it was clickable mid-transcription, on an unpaired back (which carries no condition name at all), on two fronts merged as a pair (`faces.length<2` cleared that), and on numbers the app had already flagged as unstable between identical runs. `cardChunkBlockers` blocks those; `cardChunkWarnings` passes front-only and uncertain, which are incomplete but sound. A review acknowledgement is now required, is cleared by anything that invalidates it, and is recorded in the transcript export.
- **Card facts could not be traced back to their photo.** Cards entered as a bare `flashcards`. On a 60-card deck that removes the only pointer making the required eye-check tractable. Queued chunks now carry the card number and source filenames.

### Tier 2 — availability, machinery, and spend

- **A cleared "Questions per batch" field hung the tab.** `Number('') === 0`, and `i += 0` never terminates: an infinite loop pushing empty arrays until the tab dies, taking all six tools' unsaved state with it. A typed letter gives `NaN`, where the loop exits immediately and produces **zero** batches, so the run reports success and extracts nothing. Split Q&A is the Davis-style path, so this sat on a primary workflow. Same bug class v15 fixed for `nclexChunkText` and missed here. Clamped at the input and, independently, inside the function.
- **`targetCount` had no ceiling**, so one keystroke could schedule ~99,999 generation calls. Both it and `chunkChars` now carry the ceilings their own markup already declared.
- **`itemRunPool` did not stop its sibling lane.** `Promise.all` rejected on the first throw while the other lane stayed inside its own loop, issuing calls — which defeated the QuotaStop path entirely, since only one of two lanes ever stopped. `e.partial` was also snapshotted at rejection, so anything the survivor finished afterwards was written and never surfaced: paid for twice over.
- **An aborted IndexedDB transaction hung forever.** No helper handled `tx.onabort`, and `kbLoadPersisted` never closed the handle on `req.onerror`. The promise never settled, `persistenceStatus` stuck on `'loading'`, and the save effect early-returns on `'loading'` — so the Knowledge Base silently stopped persisting for the rest of the session, with no error anywhere, and the user found out on reload.
- **Rate-limit backoff read a header the API never sends.** The `generativelanguage` v1beta endpoint returns the wait in the error *body* as a `google.rpc.RetryInfo` detail; the `Retry-After` branch had never once fired. Lifted into `geminiRetryDelayMs` and tested directly. A server hint is treated as a floor, never as licence to retry sooner than our own curve, and capped at 60s.
- **Case repair mutated React state in place.** `st.questions[ix]=fixed` wrote into the object already handed to `setCaseStudy`; the memoized exports recomputed only because `setIssues` happened to fire afterwards and happened to be in their dependency list.
- **Card photos had no size bound** against Gemini's ~20 MB inline ceiling. Downscaling is deliberately conservative, because this is an OCR path whose prompt says *never guess a number* and whose transcript is the trust boundary: nothing under 3 MB is touched, above it the long edge lands at 3000px at q0.92, and **every** failure path passes the original bytes through rather than erroring — HEIC decodes in Safari but not Chrome, and Gemini accepts `image/heic` directly. Treat those three constants as `CARD_TRANSCRIBE_PROMPT`-class: re-measure with 2 runs per card before changing them.

### Tier 3 — consolidation, provenance, and debloat

- **Printable worksheets left the app unstamped**, while the case generator stamped failed artifacts and refused to register them. The permissive generator was the one producing the sheet a student studies from. `caseValidationStamp` now takes an optional noun (case wording byte-identical), the worksheet is stamped, and a batch with structural errors no longer earns a Fact Inspector badge.
- **Three PDF page walks became one.** `kbSourceUnits` checked the abort signal and cleaned up each page; `nclexExtractPageRange` checked the signal but never cleaned up; `extractPdfTextSpaced` did neither, so Cancel was dead for the entire local read of a 900-page book. `pdfWalkPages` cleans up in a `finally` *after* awaiting `onPage`, which is what keeps the v15.10 composition probe seeing the operator list.
- **AI pairing saw only the first 12,000 characters** of each section, and its result replaced the regex pairing whenever it returned more pairs — so ~20 pairs could beat a weak 2-pair regex result while 180 questions vanished silently. It now walks the whole text in proportional windows (both sections run in question-number order, which is the premise of split mode) and merges by number with a seam overlap.
- **NCLEX dedup was quadratic** — one Set per run now, sharing its key with the batch form. **Four of five tool logs grew without bound** and rendered every entry as an index-keyed div; capped at 200 like the KB builder always was.
- **Condition ids had no uniqueness check** on either the build or the import path, so two names that slug identically produced duplicate React keys and made the second unselectable. Fact ids were already re-keyed for exactly this reason.
- **A single dense page was discarded outright** when it hit `MAX_TOKENS`: `kbSplitChunk` returned null for any single-unit chunk. It now falls back to a paragraph, then line, then character split, keeping the page pointer on both halves.
- **Dead code removed.** Both `destroyAllPdfDocs` unmount effects were unreachable — `App` keeps all six tools mounted for the whole session — and the function was cross-tool global besides, so had either component unmounted it would have destroyed the other's documents. The leak the Set actually had is fixed: `destroyPdfDoc` destroyed the proxy but never removed it. Anki's `chunkSz`/`overlapPg` were two permanent constants wearing a state hook. `nclexSleep` and `nclexId` were local re-implementations of `_sleep` and `uid`, and the sleep copy leaked one abort listener per chunk.
- **`callGemini` took ten positional parameters**, one inert since v15, so passing an `onMeta` meant three placeholder slots. Options object, with a guard that throws if anyone passes the old form.
- Smaller: the NCLEX picker now filters and de-duplicates like the drop zone always did; the page-count effect is stale-guarded and stops wiping page ranges the user just set; an inverted range says so; the fact drawer traps focus, which `aria-modal` was already claiming; three sibling parsers agree on digit width; a deterministic `MAX_TOKENS` failure is no longer retried twice; `itemParseAuditVerdict` actually implements first-verdict-wins; and `kbNormalizeImported` stopped counting conditions it went on to keep.

### Security

- **A deliberately narrow CSP.** `connect-src` is the one with value: the file makes exactly one network call, so this pins where model output could ever be sent. `default-src` and `script-src` are **not** set, on purpose — under `file://`, which is how this file is opened, `default-src` falls through to `worker-src` and would kill the pdf.js worker, and `script-src` would need `unsafe-inline` plus `unsafe-eval` anyway. `object-src`, `base-uri` and `form-action` are locked because none of them is used at all.
- **Every SRI pin re-hashed against its CDN.** All eight match. The shared DOMPurify hash across cdnjs and jsDelivr was an *assumption* until now — if it had been wrong, the no-downgrade fallback was dead code and a cdnjs outage would have halted the app in exactly the scenario the fallback exists for. Both serve 29,209 identical bytes. Re-run that check on any version bump.
- `.gitattributes` added. Windows autocrlf was rewriting the working copy to CRLF on checkout, stash, and merge, which breaks `latte-tests.js` instantly and silently — every span anchor is written with `\n`, so extraction throws and it reads as a wholesale regression rather than a line-ending problem.

### Deliberately not done

- **`responseSchema` on the structured calls.** The right idea — the app constrains the MIME type but not the shape, then leans on prompt text plus `extractJSON`. But it changes what the model returns, and the standing rule is that a generator-pipeline change needs a real batch. Shipping it unverified is what that rule exists to prevent. Next release, with a live run.
- **Per-operation token budgets — withdrawn as wrong.** `maxOutputTokens` is a ceiling, not a reservation: you are billed for actual output, so lowering it saves nothing and only truncates earlier. On Gemini 3 thinking shares that budget, which makes a lower ceiling strictly worse. The existing 65,536 is already correct.

### Review findings rejected on verification

Recorded so they are not re-raised. Each was checked against the bytes.

- **"`gemini-3.1-pro-preview` is invalid and returns 404; downgrade to `gemini-2.5-*`."** False, and acting on it would break Pro and regress Flash from 3.7. It is the current Pro path; the reviewer that raised it was contradicted by another reviewer's own citation. A knowledge-cutoff artifact — the same failure mode already recorded for `thinkingLevel`.
- **"`caseSplitValue` corrupts `120/80 mmHg` into `unit:"/80mmhg"`."** False. It has exactly one call site and is fed only tokens from `CASE_CLINICAL_TOKEN_RE`, whose blood-pressure alternative carries no unit part, so `"120/80 mmHg"` tokenizes as `"120/80"` and the BP branch handles it correctly. Analyzed in isolation without tracing the call site.
- **"`ngSpliceSection` suffers offset corruption after the first splice."** False. It does `indexOf` on the old section's *content*, recomputed per call — it stores no offsets. The suggested regex replacement would also have discarded the "return null if ambiguous, leave the worksheet untouched" property v15.8 added deliberately.
- **"There is no in-repo testing harness; build one in Vitest."** False — `latte-tests.js` exists and runs clean. The proposed replacement also requires the forbidden build system.
- **"SSE `\r\n` handling corrupts JSON."** Non-issue; `line.trim()` already strips a trailing `\r`.
- **"`text +=` in PDF extraction is an O(n²) memory disaster."** Overstated — V8 uses rope strings. The real defect in that function was cancellability, which that reviewer missed.
- **Bundler / module split / backend / Interactions API.** All four are standing non-goals, and two reviewers proposed them anyway. The project note predicting exactly that is doing its job.

---

## [15.12] — 2026-08-29

Flashcard ingestion. Photographs of printed nursing flashcards become LATTE facts, through a transcription pass that the rest of the pipeline never has to know about.

### Why this is not v16

v16 was cancelled on 2026-08-28 because text-first specialized PDFs lose nothing to a text-only parser. **That is still true and v16 is still not built.** What changed is not the verdict — it is that a *new source type* entered the picture. Davis-style flashcards are photographs: no text layer at all, so there is nothing for `pdfLayoutText` to extract and nothing for the v16 debate to be about.

The cancellation record named exactly this trigger — "a change of source material re-opens it" — and it fired as written. It also fired *narrowly*: this release is a card transcriber, not the spec's selective page-vision architecture. No router, no five-state evidence model, no `visualGrounded`, no dual-track propagation, no deterministic visual safety gate. None of that was needed, for one reason given below.

### Added

- **Flashcard photos are a source type.** The Knowledge tab accepts `.jpg/.jpeg/.png/.webp/.heic/.heif` beside PDFs and decks.
- **Pass 1 — transcription.** Each card image becomes a structured, verbatim transcript: enumerated section keys with the printed heading kept alongside, one array entry per printed bullet, and a separate list of every clinically-meaningful number. `CARD_TRANSCRIBE_PROMPT` is new surface and freely tunable — it is *not* one of the 11 frozen constants — but its rules are load-bearing and pinned by the harness: never guess a number, never expand an abbreviation, preserve symbols exactly, keep an open enum for unrecognised headings.
- **Pass 2 is the extractor you already had.** The transcript enters the queue as ordinary source text, so `KB_EXTRACTION_PROMPT` runs unchanged and byte-frozen.
- **A review step between them.** Transcripts are shown before anything is built, with the numbers pulled into their own list to be checked against the card by eye, and legibility flagged per section. Optional repeat runs diff a card against itself and report anything that changed.
- **Front/back pairing on category + card number.** Not cosmetic: a Davis back face carries the running header and card number but **no condition name**. A back extracted alone produces facts with nothing to attach them to. Faces merge front-first so the condition name leads.
- **`cardTranscribe` profile row** — Flash at low thinking. Reading printed text off a photograph is transcription, not reasoning.

### Why this stayed small

Because pass 2 reads text, **the existing matcher verifies its quotes with no new machinery.** A quote taken from a transcript passes `kbQuoteInSource` exactly as a quote from a PDF does — verified in the live app, along with a fabricated quote correctly failing. That single property is what let sections 4 through 7 of the v16 spec stay unbuilt.

### The cost of the design, stated plainly

**The transcript is the trust boundary.** If pass 1 misreads `>3 cm` as `>8 cm`, pass 2 grounds against the wrong transcript flawlessly, the auditor agrees, and every downstream check passes. Nothing after pass 1 can catch it.

Repeat runs measure *self-agreement*, which is not accuracy — a model can misread the same digit identically every time and look perfectly stable. That is why the numbers are surfaced for a human eye check rather than a green tick, and why the panel says so on screen.

### Notes

- **First real cards transcribed clean on a single pass**, including a rotated photograph on a patterned background, a two-column back face, dilation thresholds in cm, and an `↑` before a lab value.
- **Vision fixes the reading-order problem here.** A two-column card back is the layout that produced v15.11's 107 `reordered` quote misses on PDFs. A model reading the image follows column order correctly, so that failure mode does not carry over to card sources.
- **Known and inherited, not new:** `kbNormForMatch` collapses newlines, so a quote spanning two *adjacent* bullets also verifies. Consecutive PDF lines have always behaved this way; the matcher was never line-aware. Fixing it would move which quotes pass on every existing source, so it is documented rather than changed.
- Harness 547 → 568 assertions. No prompt constant was touched.

---

## [15.11] — 2026-08-28

Acts on what v15.10 measured. One release cycle, one number, one decision.

### The measurement

A real cardiovascular chapter — 6 chunks, 362 facts, audit pass on — produced **190 failed quotes**:

| Reason | Count |
|---|---|
| line-break hyphenation / ligature | **83** |
| reading order (columns / tables) | **107** |
| partial | 0 |
| absent | 0 |
| too short | 0 |

**The zero row is the finding.** Across 190 verification failures, not one quote was fabricated or paraphrased. Every single failure was a typesetting artifact — a hyphen at a line break, or a two-column text stream. The extraction was never the problem; the matcher was reading a mangled source.

### Changed

- **De-hyphenation promoted into `kbQuoteInSource`.** `kbDehyphNormForMatch` shipped in v15.10 wired only to the classifier, precisely so the payoff could be measured before the policy moved. It has been, so it moves: 83 quotes per chapter stop being reported as unverified.

  The fallback is **strictly additive** — the plain normalized match runs first and returns on success; the de-hyphenated comparison is consulted only after a failure. It can turn a FAIL into a PASS and never the reverse. That property is load-bearing, because pass 2 *discards* a fact whose quote fails, and a matcher that could newly fail a previously passing quote would silently shrink the knowledge base. Do not collapse it into a single de-hyphenated comparison.

  It also cannot fabricate a match across records: de-hyphenation rejoins a token broken by a line break, never reorders, and never bridges two rows of a table. Asserted in the harness against a two-drug table.

- **Reading-order failures are left alone, deliberately.** The remaining 107 come from multi-column layout — all the words are present, hundreds of characters apart in the stream. Those facts are extracted correctly; only the verbatim proof fails. No matcher loose enough to accept them is safe for doses (v16 spec §4). Accepted as a known provenance cost, not a defect.

### Fixed

- **The diagnostics rollup mixed two populations under one label.** Pass-1 misses and pass-2 audit discards were counted into a single `byReason` object, rendered directly beneath the sentence reporting the *first-pass* count. A real build read "182 first-pass quote(s) could not be located" and then a breakdown summing to **190** — the extra 8 being that run's audit discards. The numbers were correct; the label was wrong, and the discrepancy was only visible on a build that had both misses and discards. They now roll up separately, each printed under the number it reconciles against.

- **A clean run rendered nothing at all.** Zero unverified quotes produced no line, which is indistinguishable from the panel being broken. It now says so explicitly.

### Added

- **`dehyphSaved`** — a count of quotes that verified *only* via the fallback, shown in the panel and included in the diagnostics export. It makes the fix visibly earn its keep, and would make it visible if it ever stopped working.

### Notes

- **The `hyphenation` bucket is now a regression detector.** `kbClassifyQuoteMiss` still diagnoses the *plain* match, and since this release it is only reached for quotes that failed plain **and** de-hyphenated. The bucket therefore cannot fire unless the matcher and the classifier have come apart. Do not "fix" a future non-zero reading by pointing the classifier at the promoted matcher — that would delete the signal.
- Harness 538 → 547 assertions. The v15.10 assertion pinning `kbQuoteInSource` as byte-identical was replaced, not deleted: the property under test is now "strictly additive" rather than "unchanged."
- No prompt constant was touched.
- **Confirmed on a live rebuild of the same chapter.** `hyphenation` collapsed to **0**, the regression detector stayed silent, and **77 quotes verified only via the fallback**. First-pass misses fell **182 → 97**; audit discards fell **8 → 3**, meaning five recovered facts that had been thrown away for a line-break hyphen are now retained — the fix recovered content, not just reporting.

  The cross-run agreement is the part worth keeping. v15.10's classifier predicted 83 of 190 failures (43.7%) were hyphenation-fixable; v15.11's fallback rescued 77 of 177 (43.5%) on an independently generated set of quotes. The diagnostic was an accurate predictor of the repair, which is the evidence that the measure-then-act sequence worked rather than got lucky.

  Both rollups reconciled against their own headline (97 = 95 reading order + 2 partial; 3 = 3 reading order), confirming the mislabelled-rollup fix.
- **Still zero `absent` across both runs.** Roughly 370 quotes over two independent builds, no fabricated citation in either. The residual 95 reading-order misses are the accepted structural cost of a two-column source.

---

## [15.10] — 2026-08-20

Instrumentation for the v16 decision. No behavior changed: `kbQuoteInSource` is byte-identical, the pass-1/pass-2 quote asymmetry is untouched, and no prompt constant was edited. This release only retains and labels what was previously counted and discarded.

### Why

v16 has been blocked on the 20-page benchmark in `Nursing-Study-Suite-v16-spec.md` §11, and v15.9 could not answer its two most decision-relevant rows.

The spec's §4 splits quote-verification failures into two populations that argue in opposite directions. *Hyphenation and ligature* failures are fixable by normalizing the matcher — cheap, no vision. *Column-major reading-order* failures are the ones the spec says only seeing the rendered page can fix. Which population dominates decides whether v16 gets built at all. `quoteMiss` was a single integer, and the quote strings were thrown away, so the split could not be measured.

### Added

- **Quote misses are retained and classified** into `tooShort · hyphenation · reordered · partial · absent`. `kbClassifyQuoteMiss` labels every pass-1 miss and every pass-2 discard; the panel shows the rollup under the existing unverified-quote line. `tooShort` is a bucket rather than a silent drop specifically so the reasons reconcile with the count printed beside them.
- **`kbDehyphNormForMatch`** — the de-hyphenation candidate (line-break hyphen joining, ligature folding, soft-hyphen and superscript stripping), implemented but wired **only** to the classifier. This measures what promoting it would buy without moving the pass/fail line. Promotion is a one-line change once the numbers justify it.
- **`kbTextQuality` now names which pages are sparse** via an additive `perPage`. The four aggregate fields are unchanged — they are load-bearing for the scanned-source warning.
- **Opt-in page composition probe**, off by default. Counts raster ops, vector path ops, paint ops and text runs per page, and subtracts the document's own median so running heads, borders and logos cancel themselves out. This is §7's `repetitiveDecoration` term, and nothing routes on it — no thresholds, no vision, no page leaves the machine.
- **Diagnostics export (JSON)** — run config, per-chunk stats with page ranges, classified misses, per-page text quality, and the composition probe. The panel is a scroll box the next build discards, and §11 stages this run into a 50–100 page calibration set later, so the numbers have to outlive the session.

### Changed

- The diagnostics panel's note said diagnostics are "never written into … any export." A diagnostics export now exists, so it reads "any study artifact" and warns that the file quotes the source. `LATTE-Extraction-Diagnostics*.json` is gitignored — it carries verbatim copyrighted text.

### Notes

- Harness 505 → 538 assertions.
- **The v16 spec's §7 was wrong about the pinned build, and is corrected.** It listed `paintJpegXObject` among four raster operators "verified present" in pdf.js 3.11.174. It is not in the OPS table — JPEGs arrive as `paintImageXObject` — and the claim was evidently written from recall rather than checked. The spec also omitted the Repeat, Group and SolidColorImageMask variants, which is how tiled figures and scanned pages actually paint; counting only the singular forms would have undercounted precisely the pages the probe exists to find. Found by exercising `kbPageComposition` against the live `pdfjsLib.OPS` table in the browser.
- **The benchmark has not been run.** This release makes it answerable; it does not answer it. Next step is one dense pharmacology or cardiac chapter with the audit pass on and **chunk size at or near the 6,000-char floor** — at the 30,000 default a chunk spans 10–15 pages and averages prose, tables and diagrams into one number that means nothing.

---

## [15.9] — 2026-08-20

A correctness release with no new features. Every item came from either a two-reviewer production audit or a real generation run; none was reachable from the synthetic tests.

### Fixed
- **The worksheet repair splice could corrupt the worksheet.** `String.replace(str,str)` expands `$$`, `$&`, `` $` ``, `$'` and `$n` in the replacement, and the replacement is model-generated text — a repaired item containing `$&` grew a 99-char document to 147 by splicing a section into itself. It also wrote to the first match anywhere in the document. Now an index-based splice bounded to the located section.
- **A quota stop discarded verdicts already paid for.** When a lane threw `QuotaStop`, `Promise.all` rejected, the caller's assignment never ran, and every audit the other lanes had completed was dropped. Partial results now travel out on the error.
- **Ordering-step lists destroyed answer-key parsing.** PART 4's entry for an Ordering question carries its own numbered step list — the prompt asks for "one line per step" — restarting at 1 at question indentation. Each step parsed as a new question block, and because the lookup Map keeps the last match, an ordering step silently replaced question 1's real entry. Reported as "14 numbered entries" for 10 questions with Q1 missing its ANSWER line, across multiple runs. A block now starts only where the number ascends.
- **Comma-grouped and trailing-zero values compared wrongly.** `"7,000 mL"` tokenized as `"000 mL"`, a token that can never match source text, so a correctly grounded Parkland calculation was reported as fabricated every time. Separately `"8.0 g/dL"` did not match a source saying `"8 g/dL"` — while the terminology linter simultaneously asked for the shorter form, so following a style rule silently decided whether grounding passed. Numbers now canonicalise on both axes.
- **`instantiated` forbade the values an unfolding case exists to show.** A urine output of 22 mL/hr against a cited "maintain 30-50 mL/hr" target is the clinical point of a deterioration stage, and is grounded in the threshold precisely because it violates it. Now a warning naming both readings; a value with no threshold in any cited fact remains an error.
- **Rationales were double-jeopardied.** A datum accepted as case data was then rejected in every rationale that reasoned about it, because each rationale was audited against its own fact subset. A datum cites the facts that establish a value; a rationale cites the facts that support its reasoning. Rationales may now reference values the case itself presents as validated data — a datum that failed its own audit contributes nothing.
- **Calculation answers were checked against option labels**, and **rotated PDF text broke per glyph** (`transform[0]` is 0 for 90-degree text and `??` does not default 0). Anki lint and the unsafe-abbreviation scan now **recompute when you edit a card**, which they never did. `paParseTiers` no longer dumps the whole analysis into the Tier 1 box when the model writes `### TIER 2`.

### Changed
- **Both generators size themselves to the facts they have.** They checked that facts existed, never that there were enough. Three case runs generated 12 questions from 6, 8 and 13 facts — 0.5 to 1.1 per question, against the NCLEX generator's own `factsPerQ` default of 3 — so the model had nothing left to cite and reached forward into unrevealed stages. The case generator now names a shape that fits ("8 fact(s) supports about 4 grounded question(s) … Try 2 stage(s) × 2"), recomputed live. NCLEX batches shrink to what the pool can ground rather than letting the model invent the difference.
- **Body weight is explicitly permitted** for weight-based calculations with no supplied weight, presented as case data. A Parkland question is impossible without one, so the model had to invent it and was then errored for inventing it.
- **PDF documents are released on unmount**, and `ngParseCited` accepts bracket-less citations, which had been silently degrading cross-batch dedup.

### Notes
- **The v15.8 coverage fix is confirmed on real output.** Live runs report 18/30 and 23/30 where the metric had been structurally incapable of anything but 0.
- A two-reviewer audit produced 12 findings. Five were real and are fixed above; two "Critical" findings were verified as **not bugs** (a claimed `workRaw` race has no `await` between read and write, and the claimed IndexedDB wipe cannot occur — the persist effect early-returns while loading and the KB is set before the status flips), and four proposed fixes would have introduced regressions, including one that would have created the data-loss bug it claimed to prevent.
- Harness 386 → 505 assertions.

---

## [15.8] — 2026-08-20

First release driven by real usage rather than fixtures. Every item below was found by running the two generators against a live Knowledge Base; none was reachable from the synthetic tests.

### Fixed
- **Fact coverage was structurally always zero** (pre-existing since v15). A real 50-question run reported `Fact coverage: 0/122` — arithmetic, not a bad batch. The grounding adapter asks for `[fact-N]` in PART 1 concept names; `NCLEX_GEN_PROMPT` asks for C-numbers in PART 4; nothing asks for fact IDs in Parts 3/4, which is exactly where v15 narrowed the scan. `ngCitedFactIds()` now maps C-number → fact IDs through PART 1 and resolves what Parts 3/4 actually cite. No prompt change.
- **A malformed `DISTRIBUTION:` line silently disabled its own check.** One batch emitted the distribution as prose instead of the required bracketed shape; both regexes missed, every comparison loop iterated over nothing, and the batch reported 0 errors. The self-report check turned itself off on precisely the output it exists to police. It now warns that the counts could not be checked.
- **A repaired item kept displaying its pre-repair verdict.** The panel showed `FAIL — DISTRACTOR LENGTH` for an item the log had already reported as rewritten. New `REPAIRED` status, deliberately neither PASS (never re-audited) nor FAIL (no longer the shipped text), in both generators and the audit-trail export.

### Changed
- **The item audit defaults to Flash**, not Pro. A cost decision, not a quality one, and the comment says so: a real free-tier key exhausted its Pro allowance after ~26 calls, and the audit runs once per MCQ. Thinking stays high. One click restores Pro.
- **Audit calls are paced for free-tier limits.** Pool width 3 → 2, retry budget 1 → 3, and an early stop after two quota failures that explains the situation in plain language instead of grinding through every remaining item. `neia-retest.js` gains `--rpm` for the same reason. Note this helps a per-minute rate limit; a per-day allowance needs fewer calls or a cheaper tier.

### Notes
- **The audit gate is now measured, not assumed.** A full test–retest run (10 fixture items × 3, plus a 6-call top-up) produced **zero verdict flips**, zero false fatals on the sound items, and both seeded defects caught and correctly named in all three runs. No criterion warranted demotion, so the cutoffs and severities stand.
- `neia-retest.js` no longer counts a failed call as a changed verdict, and separates genuine verdict instability from label drift on a stable verdict.

Harness 356 → 386 assertions.

---

## [15.7] — 2026-08-20 — item quality for the NCLEX Generator

The v15.6 work gave the Case Study Generator deterministic checks and an independent audit. The NCLEX Generator — the suite's primary item producer — still had neither: its eleven-criterion gate ran *inside* the authoring call and reported itself on the `DISTRIBUTION:` line. "Never report compliance you have not verified" is unfalsifiable when the only witness is the thing being checked. v15.7 closes that.

- **`validateNCLEXWorksheet` (B1c).** Deterministic, no API calls. Parses the worksheet and checks what the model asserts about itself: question/answer counts against the batch size actually requested, a Why line for every option, truncation, and — the important one — whether the `DISTRIBUTION:` counts match the items really present. A mismatch is an **error**. Also runs the shared terminology lint and MCQ heuristics over each item.
- **One `itemAudit` profile, not one per tool (B1a/B1b).** `casesAudit` → `itemAudit`, labelled *Item quality · audit*. The payload is a rendered item and the criteria are the same regardless of which tool authored it, so two rows would be two places to drift. `caseAuditPayload` now delegates to a tool-agnostic `itemAuditPayload`. Saved v15.6 profiles are migrated on read so a customised model choice does not silently revert.
- **Worksheet MCQs route through the auditor (B1d).** Same pipeline and same order as the case generator: author → deterministic validation → audit (pool of 3) → repair → re-validate. Errors block the audit, exactly as they do for cases. Repair splices the rewritten item back into the worksheet text and **carries the original Strategy and Tags lines through verbatim**, so a repair cannot invalidate the distribution the worksheet just asserted; if the item cannot be located unambiguously the worksheet is left untouched.
- **Provenance stamp (B2).** `latteProvenanceStamp()` records the generator model and level, the auditor model and level, the criteria version (`LATTE_STANDARDS_VERSION`), and the Test Plan version. Captured at run time, because per-tool profiles can change between generating an artifact and exporting it — and because intra-rater consistency was never measured, so two runs of one configuration may not agree. Audit trail only, never the student-facing worksheet.
- **Anki unsafe-abbreviation lint (B5).** A `SAFE TRANSCRIPTION` directive in the prompt plus a code-side scan of generated cards for `q.d.`, `QOD`, `IU`, bare `U`, trailing zeros, and missing leading zeros. **WARN tier, kept out of `lint`** so flagged cards stay exportable. The preferred-vocabulary half (client/PHCP/UAP) is deliberately excluded — cloze cards test source recall, not NCLEX register, and rewriting mid-cloze risks breaking the deletion span. The authority here is medication-safety practice, which the NEIA reference reproduces rather than originates; this does not claim NEIA validates flashcards.

**The file is now `Nursing-Study-Suite v15.7.html`.** Both harnesses auto-detect any `Nursing-Study-Suite*.html`, so future version bumps need no code change.

`Prompts.md` regenerated from live bytes and extended: `paBuildExtractPrompt` was stale by 592 chars (the v15.6 Stage 1 carve-out had never been documented), and the Case Study Generator and item-quality auditor now have sections of their own.

Harness 307 → 356 assertions.

#### Not done, and why

- **The test–retest gate was not run.** It needs a live API key and ~30 calls. Every heuristic cutoff (`CASE_LEN_RATIO_*`, `CASE_JACCARD_DUP`) and every criterion severity therefore remains **provisional** — set from the brief's placeholders, not from measured flip data. Run `neia-retest.js` and tune before trusting any of them.
- **B3** (extractor item-quality scan), **B4** (Needs Review queue), **B6** (strict dual audit), **B7** (Test Plan alignment) are not started.
- **A2 and A3 needed no work** — both had already shipped in v15.6. The v15.7 brief was written against a stale copy of the file.

---

## [15.6] — 2026-08-20 — NEIA hardening for the Case Study Generator

Implements the v15.6 brief in full — all eight items.

Evidence tiering is enforced in code comments throughout: `[NEIA-VALIDATED]` for anything the rubric states, `[NEIA-DERIVED]` for our operationalization of a validated criterion, `[LATTE-HEURISTIC]` for our own inventions. No published reliability figure is cited as a property of this build — the June study tested five OpenAI and two Anthropic configurations and zero Gemini.

- **Terminology linter (item 1).** `NEIA_TERMINOLOGY_RULES` + `neiaTerminologyScan()` flag `patient`→`client`, `doctor/physician`→`primary health care provider`, and the unsafe abbreviations and decimal forms from Appendix A's Terminology Reference. **WARN tier only** — the rubric's Terminology subcategory carries no stop criterion. Scoped strictly to model-authored text: never runs over `sourceQuote`, the fact packet, or Priority Analyzer Stage 1 output.
- **`instantiated` support type (item 2).** New enum member plus `caseParseThreshold()`, which parses `<`, `>`, `≤`, `≥`, "less than", "below", "under", "at least", "no more than", and `a–b` ranges out of a cited fact. A value absent from its cited facts is now an **error** for `direct`/`combined`/`inference`, and for `instantiated` it must satisfy a threshold an actual cited fact states. This resolves a standing contradiction where the prompt forbade inventing vital-sign values while the validator only warned about them.
- **Deterministic item heuristics (item 3).** `caseItemHeuristics()` measures option-length ratio, stem/key lexical overlap, option Jaccard similarity, and negative stem construction on MCQ items. All findings are warn-tier and carry their measurements. **Every threshold is a LATTE heuristic, not a NEIA number** — the rubric names no ratios.
- **Case-level NEIA audit pass (item 4).** The Case Study Generator now runs a second review call per single-best-answer MCQ, checking the rendered item against the same eleven stop criteria the NCLEX generator got in v4.2. Key design points:
  - **The auditor is blind to grounding.** It receives the case exactly as the student sees it through the item's stage, built by truncating the case and reusing `caseToMarkdown()`, then cutting at the worksheet/answer-key page break. No fact IDs, no source quotes, no fact packet, no `supportType`, no prior audit output. Cutting at the renderer's own boundary means a future answer-key field cannot leak into the payload by accident.
  - **Answer-accuracy failures are never auto-repaired.** It is the only criterion where the reviewer overrules a keyed answer with no reference standard, and it sits in the AI's second-weakest measured domain. Those are surfaced for the user; every other failure routes to one repair round.
  - **`REVIEW` is a first-class verdict,** and unparseable output defaults to it rather than to PASS. Both rater types in the June study misclassified ~86–88% of moderate-quality items, nearly all by rating them upward.
  - **A `FAIL` naming Test Plan Alignment is downgraded to a warning in code,** not merely forbidden in the prompt. No Test Plan document is supplied, so that criterion can never disqualify an item.
  - Bounded concurrency (width 3) with a working abort path; code validation runs first so a structurally broken case never consumes audit calls. New `casesAudit` profile row defaults to Pro + high reasoning — applying a rubric to a rendered artifact is a judgment task, not a grounded extraction task.
  - **No total score, percentage, or quality band** is computed or displayed anywhere.
- **Operationalized difficulty (item 5).** `foundational`/`exam`/`advanced` previously had no behavioral contract — the level was interpolated bare into the prompt. Each level now carries a cognitive and distractor construction spec, and every level emits the same ceiling: difficulty rises through cue integration, competing priorities, and near-miss options, never through trivia or convoluted language. That asymmetry is deliberate — NEIA's Difficulty subcategory has no stop criterion but Stem Relevance does, so hard is permitted and out-of-scope is fatal. `caseDifficultySignals()` then validates structural signatures the model cannot relabel after the fact: cross-stage citation of revealed data, near-miss distractor density by fact tier, and required CJMM skills. Warn tier — a difficulty shortfall is a quality signal, not a broken artifact.
- **Priority Analyzer Stage 1 carve-out (item 6).** Rule 4 now distinguishes adding content (banned) from classifying content already present (permitted), resolving its conflict with the FLAGS block. CRIT-LAB gains a caveat that its ranges are heuristic buckets, not universal thresholds — a dialysis K+ or a therapeutic INR presented as this client's baseline is not critical.
- **UI copy fix (item 7).** Tier 3 was described as the distractor pool; distractors are built from contextually plausible near-misses at any tier. No logic change.

- **Gemini test–retest harness (item 8).** `neia-fixture.json` (10 fixed MCQs — 2 sound, 2 with a single injected defect each, 6 borderline) plus `neia-retest.js`, which runs each item N times under identical settings and reports verdict flips, per-criterion flips, false fatals on the sound items, missed defects on the seeded ones, answer-accuracy and distractor-plausibility disagreement, and latency/token cost. Any criterion that flips across identical runs is a demotion candidate: FAIL → WARN until it stabilises. This is also the run that will set item 3's provisional cutoffs.
  - **It measures; it does not decide.** Nothing it reports may be compared to a published ICC or accuracy figure — the June study tested zero Gemini configurations and lists intra-rater reliability as unmeasured.
  - The **borderline six are excluded from every accuracy rate** by design. They exist to confirm the gate does *not* discriminate at the moderate/high boundary; scoring them would mean tuning toward the exact band the published data says is unreliable.
  - The runner extracts the real prompt builders from the shipped HTML by anchor, never a copy. Built-ins only, key read from `GEMINI_API_KEY` and never written to the report. It costs live API calls and is deliberately **not** wired into `latte-tests.js` — but the fixture's shape and its compatibility with the shipped audit path *are* asserted there, so it cannot rot silently.

Harness 98 → 307 assertions (356 as of v15.7). `Prompts.md` regenerated from live bytes (its `NCLEX_GEN_PROMPT` section was still v4.1 after the v15.5 bump).

---

## [15.5] — 2026-08-20

### Added
- **SRI `integrity` pins on every CDN script tag.** All eight tags — React, ReactDOM, Babel, marked, pdf.js, JSZip, and **both** DOMPurify tags (cdnjs and the jsDelivr fallback inside `document.write`) — now carry a `sha384` hash computed from the bytes each CDN actually served. The two DOMPurify hashes are identical, confirming jsDelivr serves the npm dist bytes verbatim as the v15.3 comment claimed.
- **NCLEX generator prompt v4.1 → v4.2**, adapting the NEIA Scoring Tool (Simms, Hensel & Kumar, *Nurse Educ Pract* 93:104804, 2026):
  - **NCSBN terminology block** — `client`/`prescription`/`order`/`primary health care provider`/`UAP` in model-authored text, plus error-prone abbreviation and decimal-formatting rules. Explicitly scoped so it never overrides the ANCHOR RULE: verbatim source quotations keep their own wording.
  - **Eleven-criterion item-quality gate** in FINAL VERIFY, MCQ-only, emitting `gate=PASS/FAIL` per item. Criteria are written in the prompt's own voice, not reproduced verbatim — the rubric is Elsevier-copyrighted and this repo ships GPL-3.0.
  - **Bias check** — the prompt library previously had zero coverage of bias, equity, or cultural language.
  - **Five distractor tests** (length, plausibility, distinctiveness, clarity, consistency) and a content-blind **answer integration test** that explicitly forbids "make the key shortest" as a fix, since that just substitutes one test-wise cue for another.
  - **`NCLEX_CATEGORY_LABELS`** — category IDs are now documented as internal version-stable identifiers with official display labels held in a separate versioned map, so the enum never has to be renamed and existing Anki tags never orphan.

### Changed
- **Stem rule no longer mandates padding or demographics.** Was "2-4 sentences" with required patient age and history; now "shortest clinically sufficient scenario" with detail included only when it changes the clinical decision. The old rule pushed toward the exact gratuitous demographics the bias criterion penalizes.
- **Negatively constructed stems are now prohibited** ("which is NOT", "all are correct EXCEPT", "least likely"), with explicit carve-outs for the legitimate "requires intervention" false-response stem and for "least restrictive" as clinical content.
- **Honesty check no longer demands a defect.** Was "if you pass all 10 with zero revisions you have rubber-stamped"; that instructed the model to manufacture a finding whether or not one existed. The disclosure fallback — name the two weakest options and justify them — is kept.
- **Part 2d is now explicitly grounding-only**, since it runs before any text is rendered and structurally cannot assess clarity, integration, or bias.

### Notes
- **Test Plan Alignment is WARN-only in this build.** No Test Plan document is supplied to the model, and neither source paper reproduces the activity statements — Appendix A only links out to NCSBN. A gate that FAILs on an unverifiable criterion would reject every item or induce fabricated statements, so the criterion warns and never fails. The other ten stop criteria fail hard.
- Harness grew 69 → 98 assertions.

---

## [15.4] — 2026-08-14

### Fixed
- **Knowledge Base now uses the app's layout-aware PDF extractor.** `kbSourceUnits` had been flattening each page with `tc.items.map(x=>x.str).join(' ')`, merging table rows into their neighbours, while the coordinate-aware extractor already existed 40 lines away and was used only by the NCLEX Extractor. Both now share `pdfLayoutText()`.

### Added
- **Scanned-PDF detection.** `kbTextQuality()` probes the text layer and warns *before any API call* when a file yields little or no text (avg < 100 chars/page, or ≥60% of pages under 50 chars). Previously such files silently produced an empty Knowledge Base.

### Changed
- Default Flash model → `gemini-3.7-flash` (GA 2026-08-13). Same endpoint, same lowercase thinking levels, same 64K output ceiling. Pro default unchanged — no Pro successor has been announced.

---

## [15.3] — 2026-07-24

### Added
- Rationale-level numeric entailment auditing — the audit now runs where fabricated values actually live, in the text arguing an answer.
- Rationale `supportType` enum validation, closing a case where drifted casing produced a misleading required-factIds error.
- Warnings for missing `supportType`, `availability`, and `condition` fields.
- **Knowledge Base replace guards.** Building or importing over a non-empty KB now requires explicit confirmation showing condition and fact counts. Both paths previously replaced wholesale and overwrote IndexedDB, silently destroying prior work across sessions.

### Changed
- SATA questions with more than 4 correct answers are now an **error**, not a warning — the prompt states the 2–4 range explicitly. (Corrects a false claim in the 15.2 notes.)
- `exportAsPdf` wraps its `win.document` read so exotic popup blockers fall back to iframe printing.

---

## [15.2] — 2026-07-24

### Added
- **Numeric value-entailment auditing.** Unit-bearing values in case data are checked against the cited facts' text and source quotes, unit-normalized both directions. Warn-tier by design: instantiating a sourced threshold legitimately trips it.
- Validator structural contracts: MCQ exactly-one-correct, SATA minimums, Ordering as a full permutation of option labels, sequential stage numbering, condition echo, and supportType/availability enum checks.
- **`latte-tests.js`** — standalone dependency-free regression harness. Extracts live functions from the shipped HTML so tests can't drift from the code.

---

## [15.1] — 2026-07-24

### Security
- **Removed the DOMPurify 3.0.8 downgrade path.** The suite now loads 3.4.12 from cdnjs, falls back to the *same version* on jsDelivr, and if both fail halts with a visible error before the app can render anything unsanitized.

### Added
- Warn-tier qualitative clinical-term scanning in case narrative prose ("becomes hypotensive", "appears confused").
- Registry provenance split — stage clinical data and per-question rationales now get separate entries, so the Fact Inspector no longer claims every stage fact was used in every question.

### Changed
- Case prompt: replaced an allowed-narrative example that was itself an assessment finding.

---

## [15.0] — 2026-07-24

### Fixed
- **App-wide crash on every completed NCLEX-generator allocation run** — `showUncov` was rendered but declared in the wrong component, so the root error boundary wiped all six tools.
- **PPTX ingestion** — decks were split on a regex that never matched slide markers, collapsing every presentation into one mislabeled unit.
- Extractor freeze when Chunk Size was cleared (infinite loop on a zero stride).
- Two validator regexes whose trailing word boundary made `%` and `contraindicat` unmatchable — silently exempting the exact values they existed to catch.
- Abort now cancels in-flight requests, retries, and sleeps rather than only skipping future chunks.

### Security
- Mitigated **CVE-2024-4367** (pdf.js arbitrary JS execution from a crafted PDF) via `isEvalSupported:false`.
- DOMPurify 3.0.8 → 3.4.12; `crossorigin` on all CDN scripts.

### Added
- Per-tool error boundaries, so one tool's crash no longer erases the others' state.
- `destroyPdfDoc()` releases pdf.js worker memory when files are removed.
- Separate model profile for the Priority Analyzer's harvest stage.

### Changed
- Coverage metrics now count only student-facing output; question dedup uses full text; stable question IDs; unified clipboard handling.

---

## [14.x] — baseline

Pre-release. The 15.x series began with a full production review of the 5,075-line v14 file; findings and adjudication are recorded in `LATTE-v14-code-review.md`.
