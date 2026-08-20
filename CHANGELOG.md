# Changelog

All notable changes to the Nursing Study Suite.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Detailed engineering rationale for each change — including rejected proposals and why — lives in `LATTE-v15-changelog.md`. This file is the summary.

Every release since 15.0 has been verified against three gates before shipping: Babel parse of the full JSX block, the `latte-tests.js` regression harness, and a byte-comparison proving all 11 prompt constants are unchanged from the 14.x baseline.

---

## [Unreleased]

### v15.6 — in progress (NEIA hardening for the Case Study Generator)

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

Harness 98 → 307 assertions. `Prompts.md` regenerated from live bytes (its `NCLEX_GEN_PROMPT` section was still v4.1 after the v15.5 bump).

### To do
- Run the 20-page benchmark in `Nursing-Study-Suite-v16-spec.md` §11 to decide whether v16 multimodal ingestion gets built at all.
- Confirm against a primary NCSBN source whether the 2026 Test Plan renames *Safety and Infection Control* to *Safety and Infection Prevention and Control*. The v4.2 patch claimed it; it could not be verified. `NCLEX_CATEGORY_LABELS` keeps the long-standing label until then.
- Supply real NCLEX-RN Test Plan activity statements to the generator, then promote Test Plan Alignment from WARN-only to a hard FAIL in the v4.2 gate.

### Under consideration
- **De-hyphenation** — de-hyphenation and ligature normalization in `kbNormForMatch`, to promote quote-verification misses caused by line-break hyphenation. Cheaper than v16 and may resolve a meaningful share of `quoteMiss`.
- **v16** — selective multimodal page ingestion. Architecture settled, build blocked pending benchmark data. See `Nursing-Study-Suite-v16-spec.md`.

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
