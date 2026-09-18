# Source-to-KB audit evidence for the text-only Anki pipeline

Audit date: 2026-09-18. Read-only production review of `Nursing-Study-Suite v16.6.html`, commit `b6eb73ceabb7c8d292c186b07148c86949b37d34`, SHA-256 `8524e35c8b3621e074a0499ba3857a672464b99721e4b502c381dfa29d0b9b12`. No tracked production changes were present when inspected. The unrelated untracked `docs/reviews/codex-remediation-plan-v15.17.md` and `docs/reviews/production-review-2026-09-11.md` were not opened. This evidence covers the source preparation, extraction, merge, KB import and persistence dependencies of Anki; the main report covers the downstream card pipeline.

## Execution and test scope

Run from the repository root:

```text
node tools/audit-anki-source-tests.js
node tools/audit-anki-source-tests.js --trace
```

Result: **29 assertion groups passed; four in-memory mutations killed**. The second command adds synthetic before/after records. The script extracts the real helper definitions plus the actual `KnowledgeBaseBuilder.build` and `importJSON` closures, with unique anchors and a non-vacuous completion check. It mocks only file extraction boundaries, Gemini calls and component setters. Unit grouping, JSON extraction, quote checks, merge, sanitizer, publication ownership, save queue and reconciliation run production code. Synthetic `onMeta({truncated:true})` tests the real split/requeue branch. The tests use no private sources, images, API keys, network or live model calls. Assertions explicitly preserve current defects as audit observations, not proposed acceptance criteria.

The four mutations run in separate subprocesses with modified source strings in memory; the HTML is never written. Bypassing omission quote rejection fails the discard/surviving-primary test. Bypassing operator warnings fails the reversed-operator test. Removing the final source-publication guard fails the canceled-build test. Removing comparators from the exact dedupe key fails the two-distinct-facts test. Each mutant must exit with an assertion failure, rather than a parse/extraction failure.

## Actual pipeline and safeguard inventory

References below are one-based lines in the audited HTML.

| Stage / real call sites | Evidence and exact condition | Effect, failure behavior and later boundary |
| --- | --- | --- |
| `extractPptxText` 682, `_pptxRunText` 655, called by `kbSourceUnits` 1981 | ZIP presentation relationship order; DrawingML text runs plus related speaker notes; falls back to slide filename order only if no usable presentation order | Extracts text, trims individual runs, joins body runs with newlines and notes with spaces. Does not verify visual/semantic reading order. Missing library/no slides throws; the per-file build catch records a problem. PPTX extraction does not receive the abort signal, though canceled output cannot publish. |
| `pdfLayoutText` 1013, `pdfWalkPages` 1052, `kbSourceUnits` 1981 | Positioned text-layer runs; y shift greater than half font scale creates a line; large negative x shift creates a line; positive x gap creates a space | No OCR, image understanding or table relation validation. The walk checks cancellation between pages and cleans each page in `finally`. Simple row/column separation is tested; complex layout remains unmeasured here. |
| `kbTextQuality` 1030, `kbBuildSourceChunks` 2070, build 2711 | Per-page extracted character counts; build warns when average <100 or at least 60% of pages have <50 characters | Warning only; sparse chunks can still reach the model. Empty source queue throws. Optional composition probe is diagnostic only. |
| `kbGroupUnits` 2014 / `kbSplitChunk` 2034, build 2766 | Pages/slides, target character size and trailing-unit overlap; response metadata reports truncation | Overlap repeats source context. Truncated extraction splits at unit boundaries, then text boundaries for a single >=2000-character unit, with depth <4. Exhausted splitting records failed chunk. Oversized text halves can split prose relationships; no semantic recombination check. |
| `kbBuildFocusBlock` 1607, build 2689 | Student focus and explicit mode | Prioritize changes requested tiers; scope explicitly permits omission. This is intentional policy, not hidden extraction loss. |
| Primary extraction, build 2763–2802 | Original source chunk + frozen prompt; actual parsed JSON | `extractJSON` 899 rejects missing, malformed and truncated JSON. Only the outer `conditions` array is checked inside the chunk catch. API/parse failure preserves earlier good chunks. Nested malformed records escape this protection (S2). |
| Primary quote check, build 2794–2798 | Each nonempty model quote and the entire current chunk; ASCII lowercase/punctuation-stripped containment, then dehyphenated containment; normalized quote must have >=10 characters | Misses warn/count and retain facts by intentional policy. Empty quotes bypass the counter (S5). Matching does not prove the fact proposition or claimed page. The source text/quote verdict does not become a persistent per-fact trust status. |
| `kbQuoteOperatorsAgree` 2135, calls 2798 / 2823 | Accepted quote, operator-preserving normalized chunk; `< > ≤ ≥ ↑ ↓ %` in the quote | Disagreement is advisory, never discard. A quote with no tracked operator returns true. The check compares quote to source, not fact text to quote. Pass2 can retain fact/quote disagreement without an operator warning. |
| Omission pass, build 2811–2839 | Original chunk, primary facts and frozen omission prompt | Nonempty fact text plus quote match required to retain recovered fact; nonmatching quote is discarded. This intentional asymmetry rejects genuinely supported short quotes too. Syntax errors warn and keep primary content. Wrong-shaped valid JSON becomes zero omissions (S3). Truncation only warns after parse; a malformed truncated body enters the catch. |
| `mergeLatteParts` 1677, build 2844 | Extracted/recovered parts and model condition aliases | Exact bucket/subtype/whitespace-normalized-text key; distinct comparators remain distinct. Duplicates union source pointers, retain first fact's other metadata. New fact/condition IDs are generated. Primary per-fact pointers are not bound to the actual source file (S4); omission pointers are set by code. |
| `validateLatteKnowledgeBase` 1904; KB UI 2900; Anki generation 5769 | Merged/imported KB only | Checks duplicate IDs, bucket, tier, empty fact text, missing quote; safety/numeric facts need some nonempty filename. It does not verify filename existence, pointer range, quoted passage or semantic entailment. Anki logs validation errors and still generates. Warnings/errors do not certify semantic correctness. |
| `kbForAnki` 1949, call 5768 | Current fact text, bucket, tier, condition and filename/location | Serializes the KB as sole source and says each FACT is already source-grounded. No original PDF/PPTX text reaches this stage. Source-to-KB errors can therefore pass otherwise faithful KB-to-card checks. |
| `importJSON` 2575, `kbNormalizeImported` 1720 | User JSON; 25 MiB file cap; structural validation/coercion | Rejects missing `conditions`, filters malformed entries, rekeys facts and condition IDs, and reports malformed counts. Silent truncation/caps modify or remove valid input (S1). No source-text verification is available. |
| `createOperationSlot` 2525, build/import final publication guards 2845 / 2583 | Current operation identity and abort state | Import supersedes pending build; canceled/stale successful response cannot publish. Actual build/import closures pass cancellation and reverse-completion tests. Cancellation intentionally does not commit completed new chunks; prior active KB remains. |
| `kbCreateSaveQueue` 1879, App 10138–10180; hydrate 10168 | Snapshot copy, writer/sequence lineage, captured fallback bytes and compare-before-write durable record | Serializes saves, reports store failures, preserves conflicting snapshots, and avoids late hydrate overriding newer mutation. Saved KB is structurally normalized on reload: this changes long facts and capped arrays (S1). The audit tests save/reconcile/sanitizer helper chain; native IndexedDB transaction behavior is outside this test. |

## A. Reproduced implementation defects

### S1 — P1: import and reload silently truncate fact meaning and omit valid entries

**Location:** `_kbStr` 1715; `kbNormalizeImported` 1726, 1731–1734, 1746; import 2584–2592; App hydrate 10168 and recovery 10187.

**Minimum trigger:** a valid source-supported fact longer than 4000 characters. The fixture uses 3959 filler characters plus `. Administer the synthetic medicine; do not administer to children.` The original is 4026 characters. After import it ends `... do n`, losing the restriction, while `dropped` is `{conditions:0,facts:0}`. This is a boundary fixture, not a prevalence estimate. The same sanitizer also keeps only the first 5000 facts in a condition or 2000 conditions and reports no dropped entries for the excess.

**Expected:** supported text must remain unchanged, or a truncation/limit must be reported before accepting a changed KB. The existing size limit does not justify silently changing a fact's proposition. The code has no corresponding 4000-character limit when building facts.

**Actual/impact:** `mergeLatteParts` preserves the long original; the actual save queue stores all 4026 characters; reconcile/restore calls `kbNormalizeImported` and reduces it to 4000. The storage record is not destroyed during hydration, but the active restored KB, future Anki input and subsequent exports use the truncated text. Later normal saving can persist that version. Explicit import presents no warning because nothing was counted as malformed. Quote, source, name and alias fields have analogous undocumented truncation; tested semantic evidence concerns fact text and array counts.

**Smallest fix proposal:** preserve accepted fact/source strings, or reject an over-limit import with a clear reason rather than slice. Count every capped array omission and surface the count; preferably reject lossy import before replacement. Do not silently impose import limits on the application's own persisted snapshots. No clinical inference is needed. Regression: exact build→save→reload and JSON export→import text equality including a qualifier across the limit; accepted oversized-array behavior must explicitly report loss. Risk: removing caps without retaining whole-file/memory bounds can regress responsiveness.

### S2 — P2: a malformed nested extraction record loses unrelated completed chunks

**Location:** primary response shape check 2779; fact count/iteration 2786 / 2794; outer catch 2867; merge 2844.

**Minimum response sequence:** first chunk returns one ordinary supported fact; second returns `{"conditions":[null]}`. Both are valid JSON and the second passes `Array.isArray(parsed.conditions)`. Accessing `c.facts` then throws outside the per-chunk catch.

**Expected:** flag the malformed chunk and retain independently successful chunks, consistent with the stated source-upload behavior at 2902 and the existing API-error path.

**Actual/impact:** the first chunk logs success, but no new KB is committed; the outer error is `Cannot read properties of null (reading 'facts')`. The existing KB is retained. The test contrasts this with an ordinary error on chunk two, which correctly commits chunk one with a warning. Other malformed nested shapes can fail during iteration/merge for the same reason; only the null-condition example was executed here.

**Smallest fix proposal:** check nested condition/fact container shape inside the existing per-chunk error boundary before adding a part, or extend that boundary through primary processing. Preserve good records if a deliberate record-level recovery policy is selected; otherwise quarantine only the affected chunk. Do not reuse the lossy importer without first resolving S1. Regression: successful chunk plus malformed neighbor must publish the supported chunk and explicit failure diagnostics. Risk: partially processed bad chunks must not leave unreconciled stats or duplicate parts.

### S3 — P2: wrong-shaped omission results masquerade as zero omissions

**Location:** build 2812, success log 2835, diagnostic `verified:verifyPass` 2864.

**Minimum response:** primary extraction succeeds; omission API returns `{"conditions":[]}` instead of `{"missed":[]}`.

**Expected:** an absent required result array is an inconclusive check, not evidence that nothing was missed.

**Actual/impact:** `Array.isArray(vp?.missed)?vp.missed:[]` converts this to an empty result. There is no warning/error; the log reports `audit: +0 recovered`, and `diag.verified` is true because the pass was selected. No clinically unsupported note was demonstrated from this alone, but an unperformed omission inventory appears completed. Genuine malformed JSON (`{"missed":[`) is correctly reported as a failed audit and preserves primary facts.

**Smallest fix proposal:** require a parsed object with an explicit `missed` array locally, using the existing catch/warning path on mismatch. This is response shape validation, not a runtime API schema or new call. Distinguish attempted, complete, truncated and failed audit counts in diagnostics. Regression: `{}`, wrong field, `missed:null` cannot equal an explicit empty array. Risk: preserve actual empty-array success and primary content when the optional check fails.

### S4 — P2: first-pass source pointers can identify a file never read

**Location:** build 2800; merge 1697–1701; validator 1919; serializer 1967; captured Anki source fields 4166–4170.

**Minimum source/response:** file `source.pdf`, page 1, text `Assess skin color.`; model returns exactly that supported text and quote, but `sourcePointer:{filename:'never-read.pdf',location:'page 999'}`.

**Expected:** known provenance should be attached from the input file/chunk; model-provided fine location should be verified against the chunk before becoming a receipt.

**Actual/impact:** top-level `kb.sources` correctly says `source.pdf`; the fact's `sources` still says `never-read.pdf`, page 999. The KB validator raises no issue. Anki receives/captures that false pointer and optional source exports can repeat it. A matching quote establishes presence somewhere in the chunk, not the pointer's filename/location.

**Smallest fix proposal:** set the primary fact filename from `file.name`, as pass2 already does, and retain only a verified in-chunk page/slide location or fall back to the truthful chunk label. Regression: fabricated filename/out-of-range page cannot survive as a trusted pointer; valid fine-grained pointers remain useful. Risk: replacing every location with a broad chunk range loses precision, so do not unnecessarily overwrite valid locations.

### S5 — P2: missing quotes produce misleading all-quotes-verified status

**Location:** build 2795, diagnostic branch 3045–3047.

**Minimum response:** a supported fact with `sourceQuote:''`.

**Expected:** distinguish missing anchors from successfully verified anchors.

**Actual/impact:** empty quotes are skipped; `diag.quoteMiss` remains zero and the UI branch reads `Every first-pass quote was located verbatim in the source.` The separate KB validator correctly records a missing-anchor warning, so this is contradictory status reporting rather than complete suppression of uncertainty. The tests execute the build and assert both outcomes, then pin the actual UI branch; they do not mount React.

**Smallest fix proposal:** count missing, attempted, verified and failed anchors separately; only show complete verified status when every nonempty fact has a verified anchor. Keep pass1 retention policy unchanged. Regression: no anchor must yield unknown/missing, not verified. Risk: maintain diagnostic rollup reconciliation and avoid inadvertently making the warning an export gate.

## B. Reproduced safeguard limitations and remaining code-path concerns

- **A true quote is not entailment.** Source `Hold the synthetic dose if pulse < 60 bpm.` plus recovered fact `Administer the synthetic dose if pulse > 60 bpm.` and the exact original source quote passes the omission quote check, generates no operator mismatch, and passes the structural KB validator. The independent expectation comes from the source's opposite action/comparator, not the checker's verdict. This is a demonstrated semantic coverage gap, not a new deterministic-clinical validator proposal. `kbForAnki` then treats the incorrect fact text as its sole source. Existing quotation policy intentionally does not establish clinical correctness.
- **Operator check scope is narrower than its name.** Omitting `<` from a quote is accepted and `kbQuoteOperatorsAgree` returns true because no tracked operator remains. Normalization also collapses punctuation/case. The test demonstrates the omission, without recommending promotion of operator warnings to blockers.
- **Supported facts can be conservatively discarded.** Exact source `Synthetic condition\nRash.` and omission fact/quote `Rash.` is discarded as `tooShort` because normalized length is <10. Expected semantic support is obvious in this invented source; the code intentionally calls short anchors inconclusive. This is a coverage cost of the policy, distinct from S2/S1 implementation loss.
- **Diagnostic evidence does not persist into KB facts.** Quote failures, operator mismatches and missing-source reading-order evidence live in build diagnostics, not per-fact persisted verification status. After reload, downstream code cannot distinguish a originally verified anchor from a retained unresolved one. Extending evidence metadata is a separate policy/design change; do not label all retained facts independently verified.
- **Reading-order status overstates its evidence.** The UI at 3050 says reading-order misses mean the fact is sound and only its proof fails. `kbClassifyQuoteMiss` 2178 assigns `reordered` from >=90% overlap of selected quote words with a chunk-wide word bag. That cannot establish ordering, entailment, or fact correctness. This is a static wording/policy concern; no additional defect count or clinical validation claim is inferred from it.
- **PDF/PPTX relationships are not guaranteed by extracted text.** Layout reconstruction and speaker-note run joining were inspected; realistic native PDF/PPTX extraction and multicolumn/table semantics were not benchmarked. Text split at a 2000+ character single-unit midpoint has no overlap and can split a proposition. No model-quality claim is made from a synthetic split/retry test.
- **Duplicate metadata is first-wins.** Exact duplicate fact text merges pointers but keeps the first quote/tier/safety metadata. Whether differing duplicate tiers should choose the higher priority is a separate policy question, not an established distinct-fact deletion bug. Distinct comparator facts remain separate in executed tests.

## C. Smallest-first repair order and limits

1. Stop unreported importer/restore truncation (S1); add lossless round-trip regression assertions.
2. Restore per-chunk error isolation for nested malformed output (S2).
3. Reject inconclusive omission result shapes locally and report attempted/completed status accurately (S3).
4. Bind known source filenames/locations at extraction (S4).
5. Correct missing-anchor status language/counters (S5).
6. Separately review durable provenance uncertainty and short-quote/duplicate-metadata policies; keep warnings advisory and obtain explicit approval before crossing existing policies.

No production fixes, prompt changes, model/profile changes, live Gemini calls, new runtime dependency or API schema were applied. This source audit did not measure clinical correctness, actual Gemini behavior or prevalence, browser IndexedDB storage, native Anki imports, OCR/card photographs, complex native PDF/PPTX layout, or downstream source-check/card UI. The parent audit owns repository verification and the remainder of the Anki lifecycle. Safeguard tests show both retained valid input and refused/inconclusive input separately; the 29 test groups are not an accuracy pass rate.
