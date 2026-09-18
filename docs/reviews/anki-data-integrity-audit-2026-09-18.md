# Nursing Study Suite text-only Anki integrity audit

Audit date: 2026-09-18. **Production behavior was not changed. No live Gemini requests were made.** This is a code and synthetic-response audit, not prompt tuning, a model comparison, clinical validation or a general security review.

## Result

The pipeline has useful structural, identity and export protections, but it does **not** establish that an exportable card is source-supported. Reproduced implementation defects include silent loss of wrapped response text, lossy KB restore/import, numeric scanner blind spots, inadequate response-shape isolation, and misleading completion/provenance reporting. Separately, a model can supply a perfectly addressed source-check receipt for a false claim and the code will accept it. That last result is a documented semantic-checking limitation, not evidence that reference validation itself is broken.

The most urgent changes are to preserve text at parsing/import boundaries. They require neither altered generation prompts nor another AI call. Warning-only numeric and source diagnostics should remain warnings; nothing in this audit authorizes automatic deselection, clinical correction or a new export gate.

## Audited state and reproducibility

- Commit: `b6eb73ceabb7c8d292c186b07148c86949b37d34` (`Release v16.6 Anki audit references and source review`).
- Actual entry point: `Nursing-Study-Suite v16.6.html`; `ReactDOM.createRoot(...).render(<BootErrorBoundary><App/></BootErrorBoundary>)` at HTML:10257. The App mounts the Anki component; the current path consumes the shared structured KB, not a direct PDF-to-Anki path.
- HTML SHA-256: `8524e35c8b3621e074a0499ba3857a672464b99721e4b502c381dfa29d0b9b12`.
- Initial working tree: no tracked modifications. Two unrelated, untracked files existed: `docs/reviews/codex-remediation-plan-v15.17.md` and `docs/reviews/production-review-2026-09-11.md`. They were neither opened nor changed.
- Added only isolated audit scripts, synthetic evidence and this report. No application, frozen prompt, prompt baseline, model/profile, export contract, ordinary harness or verifier changes. No commit or release was made.
- All line references below and in the supporting reports refer to the audited HTML bytes. The original `Text|Extra|Tags` contract remains intact.

Run these from the repository root:

```text
node verify-repo.js
node tools/audit-anki-source-tests.js
node tools/audit-anki-transform-tests.js
node tools/audit-anki-lifecycle-tests.js
node tools/audit-anki-receipt-tests.js
```

The ordinary verifier passed **2,564 assertions**, all 11 frozen prompt hashes, generated prompt documentation, LF/version checks and full JSX Babel transformation. The standalone audit tests deliberately characterize current defects; their successful exit is not a semantic correctness score. `node tools/audit-anki-transform-tests.js --strict` instead fails on the explicitly listed, independently specified expectations that the current implementation does not meet.

Final execution is recorded in [execution results](anki-data-integrity-execution-results.json), including commands, exit codes, output and unchanged before/after HTML hashes:

| Audit suite | Observed result |
|---|---|
| Source-to-KB | 29 assertion groups passed; four targeted mutants killed |
| Transformation/export | 40 control groups passed; three mutants killed; 15 known expectation failures documented separately (five manifestations of three implementation defects, ten semantic limitations) |
| Lifecycle | 24 scenarios passed, including one killed ownership-guard mutant |
| Optional receipts | 55 characterization/control assertions passed; two mutants killed and one redundant-guard mutant survived |
| Strict transformation demonstration | Exit 1 as expected for the same 15 documented unmet expectations |

These counts use different test-group granularities and are not added into a single accuracy measure.

Detailed reproductions, source-based expectations, actual outputs, line references, proposed fixes and regression risks are in:

- [Source extraction, KB import and persistence](anki-data-integrity-source-evidence.md).
- [Parsing, numeric validation, deduplication, preview and export](anki-data-integrity-transform-evidence.md).
- [Generation, transport, edits, cancellation, selection and source-check lifecycle](anki-data-integrity-lifecycle-evidence.md).
- [Optional checker receipts, semantic limits and retry provenance](anki-data-integrity-receipt-evidence.md).
- [Frozen transform cases and stage captures](anki-data-integrity-transform-results.json) and [receipt cases and stage captures](anki-data-integrity-receipt-results.json).

## Pass 1 — actual pipeline and safeguards

The tables below form the consolidated inventory; the linked stage reports expand exact branches and executed counterexamples. A stage's name or comment is not treated as proof of its guarantee.

| Stage / functions and call sites | Evidence and actual check | Action / errors / later boundary |
|---|---|---|
| PDF/PPTX text extraction: `extractPptxText` 682, `pdfLayoutText` 1013, `pdfWalkPages` 1052, `kbSourceUnits` 1981 | Text layer/slide runs, coordinates, presentation relationships and speaker notes | Reconstructs text; no semantic layout proof or raster interpretation. File failures are logged; publication ownership prevents canceled work replacing current state. |
| Source quality/chunking: `kbTextQuality` 1030, `kbGroupUnits` 2014, `kbSplitChunk` 2034; builder 2711, 2766 | Character density, page/slide units, overlap, truncation metadata | Sparse text warns. Truncated primary extraction is split and retried with bounded depth. A split does not prove a relationship survived. |
| KB primary extraction and omission pass: builder 2763–2839; `extractJSON` 899 | Frozen prompts, original source chunk, primary extracted facts for omission check | Primary quote misses retain facts; omission quote misses discard recovered facts. Empty/wrong-shaped results and nested shape isolation have defects A5/A6. These are existing extraction calls, not Anki repair calls. |
| Quote checks: `kbQuoteInSource` 2097, `kbQuoteOperatorsAgree` 2135; calls 2794–2823 | Normalized quote containment, minimum length 10, additive dehyphenation; accepted quote's explicit operators | Only containment is established. Operator disagreement warns. It does not compare a fact's proposition to its quote, bind the pointer to a page, or preserve per-fact uncertainty into the KB. |
| KB merge/validation/import/storage: `mergeLatteParts` 1677, `kbNormalizeImported` 1720, `validateLatteKnowledgeBase` 1904; App 10138–10187 | Exact normalized fact key; structural fields; writer/sequence and source operation identity | Dedupe unions pointers and keeps first other metadata. Shape validator is not grounding. Save ordering is guarded; importer/restore can silently truncate (A2). Anki logs KB errors and continues. |
| Source capture/serialization/chunking: `kbForAnki` 1949; `ankiSourceSnapshot` 4166; `ankiChunkText` 4119; generator 5758–5813 | Captured KB object, fact text, condition/aliases, supplied tier/bucket/pointer and canonical Condition tag | Generation receives fact text as the sole source, without original quote evidence. Conditions/facts drive chunking; the usual structured path has no page overlap. Source-to-KB errors are inherited. Context boxes steer generation; source tiers take precedence in instructions. |
| Gemini transport: `geminiRequest` 797 / `callGemini` 879; generator 5813 | SSE candidates, finish metadata, HTTP status, abort/timeout, captured model/thinking settings | Retries transient/empty/incomplete transport results, resets attempt text; fatal errors propagate. MAX_TOKENS metadata survives. Nonempty STOP alone does not establish a valid Anki response (A9). |
| Response parsing: `ankiParseCards` 4142; call 5817 | Fenced blocks or fallback lines, pipe separators, line numbers, generated tag scope | Trims field edges and retains field-count diagnostics, but ignores non-pipe lines. Wrapped prefixes can vanish while the suffix passes all structural checks (A1). Raw responses remain in diagnostics, not current editable notes. |
| Fact mapping: `parseKBCoverage` 4155, `attachCoverageToCards` 4177; call 5824 | IDs must exist in captured snapshot and corresponding generation chunk; destinations must name parsed rows | Unknown/out-of-chunk IDs and invalid destinations do not create links. Repeated/conflicting/missing edges produce diagnostics. Valid many-to-many links survive. Links prove identity, not support or recall. Warnings do not deselect notes. |
| Deduplication: `ankiDedupeCards` 4204; call 5826 | Full normalized Text, Extra, tag set, validity and manual Keep choice | Exact equivalent notes merge fact IDs. Distinct answers, comparators, Extra, tiers, case and meaningful punctuation survive. Similarity only creates advisory review candidates. Cross-chunk exact duplicates retain both links in source-check packets. |
| Condition-tag normalization: `ankiConditionTagIndex` 4230, `ankiConditionTagCheck` 4245, `ankiNormalizeConditionTags` 4274; call 5826 | Safe canonical registry, clean mappings, unambiguous aliases | Only proven aliases normalize; before/after/reasons retained. Ambiguous/unknown/mixed mappings warn. Text and Extra are unchanged. No model-based repair is applied. |
| Structural validation: `parseAnkiClozes` 4304, `ankiTier` 4328, `ankiTagFormatIssues` 4332, `lintAnkiCard` 4336; selection/export 4358/4473 | Flat cloze syntax, nonempty answers, safe positive indices, <=3 distinct indices, exactly one tier, two pipes, one line per field; captured generated-tag grammar | Structural invalidity excludes export independently of manual Keep. Lint is recomputed after edits and again at export, preventing cached-state bypass. Nested/malformed clozes stay invalid; no clinical text is repaired. |
| Numeric/advisory checking: `ankiNumericTokens` 4387, `ankiNumericAudit` 4406, `ankiUnsafeAbbrevScan` 8584 | Revealed Text/Extra value-unit tokens against the **union of linked fact texts**, with quote-only/mapping/unsupported-notation states | Warnings only. It does not search every unrelated chunk fact. However, several linked facts can supply the right tokens in the wrong roles; comparators are outside its claim. Lexer and hint-input gaps are A3/A4. |
| Preview/collision/style: `ankiRenderClozes` 4349, `ankiReviewCard` 5430, `ankiCollisionGroups` 4431, `ankiReviewCandidates` 4530, `ankiStyleWarnings` 4567 | Shared flat-cloze parser, actual masked fronts/hints, visible sibling answers, source overlaps | Same front/different answer remains available with ambiguity warning. Similarity never deletes or automatically deselects. Text renders inertly; native Anki behavior is not established by this suite's preview. |
| Optional checker packet/decoder: `ankiAuditGroups` 4600, `ankiAuditPacket` 4667, `ankiParseSourceAuditV4` 4923; prepare/run handlers 5656–5727 | 24,000-character packet budget; exact note handles and source token ranges; selected scope, field receipts, full token inventory | Oversized indivisible packet throws without truncating. Invalid individual records remain unresolved while good neighbors survive. Malformed JSON/truncated check stays incomplete. Complete addressing is not semantic entailment. |
| Optional checker retry/queue: `ankiMergeSourceAuditResult` 5048, `ankiAuditReviewItems` 5321, `ankiSourceAuditPending` 5373 | Exact captured packet signature, independently accepted receipts, retained findings | Explicit retry reuses captured settings/requests and skips complete groups. Previous warnings survive newer receipts; this can leave contradictory judgments (C2). Suggestions/decisions do not change cards or export policy. |
| Currentness and edits: `ankiRunIsCurrent` 4217; `ankiSourceAuditCurrent` 5369; generator effects 5572–5638; `updateField` 5861 | Operation/source identity, abort state, immutable cards/batch/tier identity | Canceled, replaced or superseded runs cannot publish late results. Changes invalidate optional checks and manual review decisions. In-place future mutations remain an untested hazard; current UI paths replace objects. |
| Selection, counts, registry and export: `ankiSelection` 4358, `ankiBatchSummary` 4294, `ankiExportText` 4473; effects 5620; UI 5940–5960 | Current, kept, structurally eligible notes; actual distinct cloze indices; captured valid links; selected tier | Export includes selected-tier kept notes, independent of display/style filters. All-tier linked-fact coverage is explicitly labeled all tiers. Deselected/deleted/invalid notes leave active coverage. Quotes/IDs never establish semantic coverage. Header HTML escaping and optional source footer preserve three fields. |
| Persistence/reporting: source-check evidence 5089, Anki batch diagnostics 4447, App KB persistence 10138 onward | Captured source, original responses, notes, currentness, hashes and attempts | KB persists; generated Anki cards/checks/registry are session state. Downloads retain evidence, but interrupted generation publishes no partial notes. Reload is not an Anki session restore. Prior-batch replacement policy is discussed separately below. |

## Passes 2–4 — prioritized findings

### A. Reproduced implementation defects

Severity describes study-data impact and recovery cost, not bedside risk or prevalence. **P1** means actual silent loss/change of meaning; **P2** means bounded loss, incomplete diagnostics or misleading acceptance/provenance. Each linked evidence report contains exact inputs, independent expectations, actual results, command, root cause, smallest proposed fix and regression risks.

| ID | Priority | Reproduction and user-visible impact | Root cause / smallest proposed fix |
|---|---|---|---|
| **A1 / T1** | **P1** | `[Demo] In children do not\nadminister {{c1::5 mg}} orally.||Tier::1` becomes only `administer {{c1::5 mg}} orally.` It is lint-clean and exportable. A no-delimiter note is discarded entirely. [Transform evidence](anki-data-integrity-transform-evidence.md) | Parser ignores non-pipe lines (4142–4162). Retain malformed response records visibly as invalid with exact source text, or explicitly quarantine the malformed block. Do not guess/join a clinical sentence automatically. |
| **A2 / S1** | **P1** | A 4026-character source fact containing a final restriction becomes 4000 characters on import/restore; `dropped` stays zero. 5001 facts become 5000; 2001 conditions become 2000 without loss counts. [Source evidence](anki-data-integrity-source-evidence.md) | Silent `slice` limits in `_kbStr`/`kbNormalizeImported` (1715–1746), also used on restore. Preserve accepted content or reject/report over-limit input before replacement; preserve lossless own-app round trips. |
| **A3 / T2** | **P2** | A source `5 °C` fails to trigger numeric discrepancy for card `−5 °C` (Unicode minus). `5 cm²` is treated like `5 cm`. Exported content is not altered, but the advisory checker misses an explicit value/unit difference. [Transform evidence](anki-data-integrity-transform-evidence.md) | Incomplete numeric token boundaries/notation handling (4365–4404). Recognize supported signs/units exactly or classify the entire unsupported form as inconclusive. Keep this diagnostic advisory. |
| **A4 / T3** | **P2** | `{{c1::5 mg::100 mg}}` shows `100 mg` on the front, but the numeric audit only scans revealed `5 mg`; no unsupported-number warning. [Transform evidence](anki-data-integrity-transform-evidence.md) | Audit removes hints by rendering revealed content first (4406–4428). Inspect distinct visible hint text too, preserving the source location in the warning. No automatic repair/deselection. |
| **A5 / S2** | **P2** | Successful source chunk followed by `{"conditions":[null]}` causes whole-build failure, preventing publication of the earlier supported chunk. An ordinary API failure correctly preserves that chunk. [Source evidence](anki-data-integrity-source-evidence.md) | Nested processing escapes the per-chunk try/catch (2779–2794). Validate nested containers locally and isolate the affected chunk; avoid partially appended malformed records. |
| **A6 / S3** | **P2** | Optional omission response `{"conditions":[]}` is treated as `missed:[]`, logging `audit: +0 recovered`; selected-pass diagnostics say verified. [Source evidence](anki-data-integrity-source-evidence.md) | Missing required array defaults to empty (2812). Reject this shape through the existing warning path and distinguish attempted/incomplete from completed-empty. No new API schema required. |
| **A7 / S4** | **P2** | A correct quote from `source.pdf` retains model pointer `never-read.pdf`, page 999; validator accepts it, and optional Anki source export can repeat it. [Source evidence](anki-data-integrity-source-evidence.md) | Primary per-fact pointers are not bound to known input provenance (2800, 1697). Attach actual filename and verify fine location against chunk units; use truthful chunk location when unresolved. |
| **A8 / S5** | **P2** | Empty quotes contribute zero quote misses, so the diagnostics pane displays the green all-quotes-located message despite absent anchors. A separate missing-anchor warning exists. [Source evidence](anki-data-integrity-source-evidence.md) | No attempted/missing-anchor denominator (2795, 3045–3047). Report missing/attempted/verified/failed separately; retain first-pass facts under the existing policy. |
| **A9 / L1** | **P2** | Nonempty STOP output with no note records, for a source requiring notes, commits a zero-note batch and logs green `Complete!`. Malformed content is not identified as a malformed response. [Lifecycle evidence](anki-data-integrity-lifecycle-evidence.md) | Transport success plus no parser-level response completeness outcome (5817–5848). Separate a completed request from a usable/invalid response; preserve raw evidence and allow correction/retry. Do not infer semantic coverage from note count. |

No finding above is a recommendation to rewrite frozen prompts, change the chosen model, add AI audit calls, introduce runtime API schemas or change the application architecture.

### B. Code-path concerns not established as current defects

- Complex PDF/PPTX table/column/run order and a truncated single-unit split may separate a qualifier from its subject. Simple extraction/layout helpers and split/retry paths were tested; realistic native files and resulting model behavior were not measured.
- `ankiSourceAuditCurrent` and numeric caches rely on immutable object replacement. Current edit/source paths passed; a future in-place mutation could retain stale validation. No current UI bypass was reproduced.
- Export helpers preserve the flat text contract, but actual native Anki import, custom templates, unusual HTML entity interpretation and any broader Anki cloze grammar were not tested. Do not infer native card-count equivalence beyond the supported flat subset.
- This is a bounded review of the Anki dependency paths, not proof that all browser races or transport events are covered. Hook/setter tests execute real handlers with a small test React scheduler; they are not browser rendering tests.

### C. Demonstrated limitations and policy/design recommendations

1. **Source truth stops at the supplied KB.** Matching quote text cannot prove the recovered fact; an opposite action/comparator can pass with a genuine quote. A faithful card then faithfully reproduces a wrong KB fact. Preserve this distinction in labels and diagnostics; do not silently correct either source or card from model memory.
2. **Exact receipts are accounting evidence.** Five deliberately unsupported cards and one underdetermined card received accepted supported receipts with no local queue finding; two supported controls survived. Full-source citations can be irrelevant or contradictory. See the [independent fixture table](anki-data-integrity-receipt-evidence.md). This is a semantic limit of the optional checker, not justification for automatic rejection. The protocol currently lacks an explicit inconclusive field verdict; adding one is a separate design decision.
3. **Retry findings can conflict.** A partial attempt's unsupported finding survives a later supported receipt and remains in the current queue. Keep history, but attribute each judgment to its attempt and make disagreement explicit rather than silently clearing either one.
4. **Conservative quote policy loses some supported omissions.** Exact quote `Rash.` is too short to pass the 10-character normalized threshold and is discarded in pass2. That is a reproduced valid-fact loss under an intentional inconclusive-evidence policy, not an unapproved reason to loosen the matcher.
5. **Numeric support is token membership, not full proposition support.** Qualifier/negation/comparator changes, swapped roles, changed routes/populations/time origins and qualitative Extra/hints can all escape. Existing IDs and numbers are not proof. Warnings remain advisory; blanket promotion would reject valid paraphrases and cannot solve these limits.
6. **Interrupted/new generation is destructive to session selection by policy.** Starting a new Anki run clears the previous visible batch; a later chunk failure retains earlier good responses only in diagnostics. Preserving a prior batch until replacement is usable, or exposing partial output explicitly, requires a separate approved behavior choice. This is not a stale-request leak. No partial content is silently presented as the completed new deck.
7. **Completion language needs care.** MAX_TOKENS produces a real warning and retained `truncated:true`, but a green final Complete log still follows. That is a reporting weakness; it does not erase the truncation evidence. Optional-check complete likewise means completed accounting, not clinical or semantic certification.
8. **Coverage is not recall.** All-tier linked-fact counts truthfully follow current eligible kept notes, and tier export counts agree. A linked fact may contain untested details; a note can merely mention its target in visible text or Extra. Preserve the existing labels and manual review rather than advertising linked counts as tested coverage.

## Outcome categories and verification limits

These categories are deliberately not collapsed into a pass percentage:

| Requested outcome category | Observed evidence |
|---|---|
| Valid-card rejection | Supported single-line cards/paraphrases remain intact in controls. Structurally malformed/nested clozes and malformed generated tags are intentionally ineligible. A short but supported source omission is discarded under the quote policy. No similarity-based deletion of distinct valid cards was reproduced. |
| Unsupported-card approval | Numeric lexical/hint gaps and ten separately labeled semantic-limit fixtures are exportable. Optional checker accepts five source-unsupported fixtures as supported. Exportability means structural eligibility, not semantic approval. These fixture sets overlap and must not be summed into a prevalence claim. |
| Genuinely inconclusive outcomes | Unmapped/stale/partial evidence has explicit states in tested paths; malformed source-check records remain pending. Conversely, wrong-shaped omission output and the one underdetermined optional-check fixture are presented too positively. |
| Silent content changes | Wrapped prefixes vanish; KB import/restore truncates text. Ordinary trim/tag normalization and HTML escaping were captured separately. Numeric defects change the diagnostic interpretation, not note bytes. |
| Lost coverage | No-delimiter note records disappear; importer caps remove entries; malformed source chunk prevents good new chunks being published. Intentional interrupted-run/short-quote policy costs are listed separately. Current selected/exported note and cloze counts, registry removal and cross-chunk dedupe source links passed controls. |

Mutation checks modify only extracted code strings in memory or child processes. The source audit kills four mutants, transformation audit three, lifecycle audit one, and receipt audit two. A first-handle-guard bypass **survives** because downstream checks still quarantine the bad reference; the receipt report records this gap explicitly. Production bytes never need restoration because they were never mutated.

## Smallest-first repair plan

1. **Protect the content boundary:** reproduce A1/A2 as desired-behavior regressions, then prevent unreported partial-line acceptance and lossy import/restore. Preserve raw input for manual correction; do not automatically reconstruct clinical prose.
2. **Contain malformed results:** isolate nested KB extraction failures (A5), distinguish missing omission schema from explicit empty results (A6), and identify unusable Anki response shape (A9). Good independent work should remain recoverable under the existing stage policy.
3. **Correct advisory observations:** fix numeric sign/unit boundaries and scan visible hints (A3/A4), preserving warning severity, manual selection and export rules.
4. **Make provenance/status truthful:** bind known source pointers (A7), report missing-anchor denominators (A8), and clarify truncation/completion wording. Retain uncertain original evidence.
5. **Review policy separately:** attempt-attributed checker disagreement, an inconclusive verdict, durable per-fact uncertainty, interrupted-batch recovery, short-quote treatment and any semantic-coverage metric. These are not bundled into implementation bug fixes.
6. After approved changes, move narrow regression assertions into the established live-function harness, retain non-vacuous extraction tails, run `node verify-repo.js`, and perform synthetic browser/native-import acceptance where relevant. Model-quality claims would require a separately authorized measurement; this audit made none.

Not inspected: ignored/private PDFs, decks, KBs, card images/transcripts or previous private model reports; unrelated feature pipelines beyond demonstrated shared dependencies; actual model generation quality; native IndexedDB/browser rendering/native Anki import; independent clinical correctness. No source material was uploaded and no sensitive user data was used. **Stop point: audit complete; production fixes remain unapplied.**
