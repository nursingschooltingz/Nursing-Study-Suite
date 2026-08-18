# Changelog

All notable changes to the Nursing Study Suite.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Detailed engineering rationale for each change — including rejected proposals and why — lives in `LATTE-v15-changelog.md`. This file is the summary.

Every release since 15.0 has been verified against three gates before shipping: Babel parse of the full JSX block, the `latte-tests.js` regression harness, and a byte-comparison proving all 11 prompt constants are unchanged from the 14.x baseline.

---

## [Unreleased]

### To do
- Paste verified SRI `integrity` attributes on all CDN script tags, including **both** DOMPurify tags (the primary and the one inside the `document.write` fallback). Hashes and the verification command are in `LATTE-v15-changelog.md`.
- Run the 20-page benchmark in `Nursing-Study-Suite-v16-spec.md` §11 to decide whether v16 multimodal ingestion gets built at all.

### Under consideration
- **v15.5** — de-hyphenation and ligature normalization in `kbNormForMatch`, to promote quote-verification misses caused by line-break hyphenation. Cheaper than v16 and may resolve a meaningful share of `quoteMiss`.
- **v16** — selective multimodal page ingestion. Architecture settled, build blocked pending benchmark data. See `Nursing-Study-Suite-v16-spec.md`.

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
