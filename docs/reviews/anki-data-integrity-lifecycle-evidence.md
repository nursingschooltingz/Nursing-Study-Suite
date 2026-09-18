# Anki lifecycle, transport, selection and coverage audit evidence

Audit date: 2026-09-18. Application: `Nursing-Study-Suite v16.6.html`; inspected commit `b6eb73ceabb7c8d292c186b07148c86949b37d34`. The initial working tree had no tracked modifications and two unrelated untracked reports (`codex-remediation-plan-v15.17.md`, `production-review-2026-09-11.md`); neither was read or changed. This is one bounded part of the data-integrity audit, not a clinical accuracy assessment.

Only the isolated test and this report were added for this work. Production HTML, prompts, profiles, baseline, validation tiers and export behavior were not edited. No course materials, real credentials, live Gemini calls, or browser stores were used.

## Execution and evidence boundary

Run from the repository root:

```text
node tools/audit-anki-lifecycle-tests.js
```

Actual result on Node v24.19.0: **24 lifecycle scenarios passed; one isolated guard mutant killed. No live API requests.** These are scenario counts, not an overall source-fidelity pass rate and not the ordinary verifier's assertion count.

The test extracts the complete shipped `AnkiGenerator` body through its final JSX return, then replaces that return with a state/handler probe. It executes real run, edit, selection, export and source-check handlers and their real hooks/effects through a deterministic miniature hook runner. It also extracts real App `setKnowledgeBase` and `registerArtifact`, and real `callGemini`, `geminiRequest` and SSE parsing. Fetch is always a queued in-memory synthetic response. Retry sleeping is stubbed to collect requested backoff, not to wait. Clinical expectations below derive from the frozen synthetic facts, not from the validator's verdict.

This exercises integration between real functions without copying application logic. It does **not** establish React concurrent scheduling, DOM rendering, browser navigation/reload, native Anki behavior or real network behavior. The mocked transport deliberately ignores abort in selected tests to challenge the generator's independent ownership guard. Other tests use the actual transport's abort handling. Unmount, watchdog timeout and several simultaneous browser events were not exercised.

### Synthetic evidence and stage capture

The fixed source facts are:

1. `Observe for 1 minute; report below 60 bpm.` (Tier 1, Assess)
2. `The marker is blue.` (Tier 2, Look)

Valid output:

```text
[Synthetic] Observation: {{c1::1 minute}}; reporting threshold: below {{c2::60 bpm}}.||Nursing::LATTE::Assess Condition::Synthetic Tier::1
[Synthetic] Marker: {{c1::blue}}.||Nursing::LATTE::Look Condition::Synthetic Tier::2
```

The generated map associates fact-1 with line 1 and fact-2 with line 2. The test wraps the live functions to capture the response, parsed notes, mapped notes, deduped notes and tag-normalized notes before final selection/export. For the valid pair, **Text, Extra and Tags remain byte-for-byte identical at every stage**. The mapping stage adds fact IDs; no semantic alteration is expected or observed. Export equals the two note lines joined by one LF. Counts are two kept notes, three reviews and two linked facts.

Unsupported example: changing the second answer to `red` and Extra to `Always safe.` contradicts the supplied color and adds an absent safety claim. It remains selected/exportable with zero numeric findings. No optional source check has been performed and no semantic success verdict is created. This demonstrates the boundary of automatic numeric/structural safeguards; it is not evidence that the code promised to perform a complete semantic check.

Inconclusive example: the supported first note with an empty mapping block remains exportable with mapping/numeric-source diagnostics, **zero linked facts and zero registry entries**. Its source association is missing, not proven false. Adding `8 minutes` to Extra or changing `60 bpm` to `70 bpm` recomputes numeric findings; either is absent from the linked fact. Linking the same timing note to the color fact recomputes missing-support findings rather than reusing its earlier result.

## Actual pipeline and safeguard inventory

All line references below refer to the inspected HTML.

| Stage / live function and call site | Evidence and exact condition | Effect, errors and later invalidation |
| --- | --- | --- |
| `kbForAnki` 1949; called by `AnkiGenerator.run` 5768 | All current KB conditions/facts, supplied tags, source pointers; serialized text becomes the sole generation packet | No independent assertion that fact text matches the original document. `validateLatteKnowledgeBase` 1904 is called at 5769; errors produce a warning at 5771 but do not stop generation. |
| `ankiChunkText` 4119 and `splitOversizedConditionBlock` 4104; called at 5773 | Structured condition/fact line boundaries; 12,000 target characters | Structured chunks retain fact lines and condition prefix, do not add page overlap. One huge indivisible fact can exceed the target. `ankiChunkFactIds` 4175 captures IDs actually present in each chunk. |
| `AnkiGenerator.run` 5754–5853 | Captured KB identity, snapshot, model/level, context, prompt hashes; current source/ref/abort checks | Checks currentness after awaits and before final publication. A new run clears existing cards/batch immediately at 5758. Only after every chunk succeeds are notes published at 5846. |
| `callGemini` 879, `geminiRequest` 797; generation call 5813 | Actual HTTP status, first candidate, non-thought text parts, finish reason, streaming data | Empty STOP retries; missing finish metadata/malformed SSE retries then fails; fatal 400 fails once. STOP succeeds. MAX_TOKENS with text returns partial text with `complete:false`/`truncated:true`; generation keeps parsable notes and logs a warning. No schema validation occurs in transport. |
| Retry and stream cleanup 803–875 | Per-attempt text accumulator and watchdog; outer abort signal | Retry resets preview; no accumulated prior-attempt text is returned. Interrupted metadata is false-complete. Read errors cannot silently become success. Retry backoff is separate from model generation and does not rewrite a prior successful note. |
| Response processing 5814–5846 | Final accepted response string per chunk; its map; captured snapshot and chunk IDs | Parse → attach map → exact dedupe → conservative condition-tag normalization → lint/abbreviation scan → publish. No repair AI call or automatic clinical correction in this path. See other audit sections for detailed parser/normalizer semantics. |
| `ankiRunIsCurrent` 4217; closure at 5764 | Active run object identity, KB object identity, non-aborted signal; App current-source ref | Prevents delayed cancelled, superseded and old-source results publishing. Generation/source replacement effects at 5631 and unmount cleanup at 5633 abort ownership. Later source replacement disables the old batch even if numeric fact IDs match. |
| `updateField` 5861–5875 | Current edited Text/Extra/Tags | Clones note, recomputes structural lint and abbreviation warnings. Keeps manual `keep` choice unchanged. Numeric cache is keyed by note object and recreated for batch/source currentness changes (5607–5608); diagnostics recompute on edits. |
| `updateSourceLinks` 5737–5742 | IDs must belong to captured snapshot; current-source, not-busy gate | Calls `ankiSetSourceLinks`, retains mapping history; clean no-op retains identity, real edit clones note. Optional audit becomes stale. Changes source association but does not establish clinical support. |
| `ankiSelection` 4358; selected at 5596; export 5880 | Actual current field structure, manual keep, current batch and selected tier | Recomputes validity at export, so a stale cached lint cannot permit malformed output. Structural exclusion never changes keep. Manual exclusions survive repairs. Stale source gives zero exportable notes. Warning-only semantic/numeric findings do not gate export. |
| `ankiBatchSummary` 4294; coverage at 5591 | Only currently eligible, manually kept notes across all tiers; snapshot-valid fact IDs | Counts unique linked IDs; excludes invalid/deselected/deleted notes. Registry labels derive current Text. Links express associations, not target completeness. |
| Registry effect 5624–5627; App `registerArtifact` 10209 | Current summary entries + source identity | Replaces Anki entries only; unrelated artifact kinds survive note edits. App rejects stale-source publications. App `setKnowledgeBase` 10139 clears all prior-source registry entries on KB replacement. |
| Audit preparation 5657; `runSourceAudit` 5665 | Captured cards/batch/tier/profile, exact prompts, bounded groups | Preparation is local. Execution is explicit. On failure it keeps original notes and responses; retry uses captured prompt and remaining groups. Source-check group preparation may fail for oversized indivisible input rather than silently truncate. |
| Source-audit lifecycle 5576–5583, 5675–5727; `ankiSourceAuditCurrent` 5369 | Captured cards array and batch identity plus tier/currentness | Text, Extra, manual selection, source-link changes and tier changes invalidate prior preparation/verdicts. Editing while response is pending aborts the run and stops late publication. Cancel keeps completed evidence, never rewrites cards. |
| Source-check response acceptance 5692–5723 | Transport success, truncated metadata, protocol-specific parser result, unresolved records | Malformed or truncated responses remain partial; transport failure stops session as failed. Explicit retry can finish later. Original cards and selection remain identical. Semantic trust in accepted model receipts is separate from these lifecycle guarantees. |
| Persistence 5555, 5564–5574; App 10133–10182 | Notes/batches/audits are component state; KB has IndexedDB/fallback save queue | Anki notes and manual decisions are session-only. All tool components remain mounted across tab changes (10248), so switching tools is not a reload. Reload loses Anki notes/registry by design; private exports/diagnostics are explicit downloads at 6025–6030. Durable KB save/recovery mechanics were inspected only at their Anki boundary, not retested here. |

### Coverage and selection are different, and labeled correctly

Selecting Tier 1 leaves global linked coverage at 2/2 and both global Anki registry entries, while selected output contains only the first note and two reviews. This is **not a reproduced count defect**: the visible linked-fact label says `(all tiers)` at 5946. The selected-tier toolbar at 5991 separately reports filtered notes, kept notes and actual reviews. Export uses that same tier via `ankiExportText`.

The tests also establish that review/style filters do not filter exports; structural invalidity, a manual uncheck and deletion do reduce applicable counts. Repair restores structural eligibility only when the student has kept the note. KB replacement clears the registry and prevents export from an old batch. Other artifact kinds survive ordinary Anki edits.

## A. Reproduced status defect

### L1 — P2: a non-card response is committed as completed generation

**Location:** `AnkiGenerator.run`, 5813–5817, 5844–5848; `ankiParseCards`, 4142; `geminiRequest`, 848–858.

**Minimal input:** the synthetic nonempty KB above, whose supplied facts admit the demonstrated valid notes. Mock provider SSE with `finishReason:STOP` and text `I could not format this input.`.

**Expected:** a response violating the required two-block note/map contract should be reported as an unsuccessful or malformed generation result, rather than a successfully completed zero-note batch. The eligible supplied facts do not explain an intentional zero-note outcome. This is a response-shape/status expectation, not a request to promote warning-tier semantic diagnostics.

**Actual:** the STOP/non-card response creates a completed batch with zero cards and logs `Complete! 0 received notes; 0 after dedupe; 0 kept notes → 0 review cards.` It has no malformed-output or truncation status. Linked coverage remains truthfully zero; this is not silent semantic approval or a hidden count change.

**Root cause:** the final success log is unconditional once all transport calls return. Transport completion and artifact completeness are not separated in generation status. The checker path makes this distinction more explicitly.

**Smallest proposed fix:** record a failed/malformed generation result when a nonempty eligible packet returns non-note output, retaining the raw response for inspection. At minimum remove success completion wording in this case. Do not infer complete semantic coverage from nonzero records or a complete fact map. Prior-batch retention is a separate product decision below.

**Regression risk/test:** empty source conditions or deliberate omissions may legitimately yield zero cards; distinguish those from unexpected prose violating the response contract. Keep truthful counts/coverage. The test named `nonempty STOP response...` reproduces the behavior; after an approved fix, assert explicit failed/malformed status and retained response instead of completed batch.

## B. Concerns not reproduced as defects

- **MAX_TOKENS completion copy:** separately reproduced, a valid first-note response with `finishReason:MAX_TOKENS` keeps the selected note, `batch.truncated:true` and a visible warning, then logs green `Complete!`. This is a weaker reporting concern, not silent incomplete-success or coverage corruption: both warning and diagnostic evidence survive. Consider `Partial output received` wording without blocking valid retained notes. The dedicated MAX_TOKENS scenario locks the current warning/flag/export behavior.
- **Browser race equivalence:** deterministic hook/handler tests passed cancellation, older overlap, source replacement and stale-check cases. They do not prove all React scheduler or DOM-event interleavings. A mounted-browser repeat would strengthen evidence.
- **Source mutation in place:** currentness uses object identity; an out-of-contract in-place KB mutation could evade that test. Inspected App replacement uses a new object; no normal Anki UI path reproducing in-place mutation was found. This is not a reported current UI defect.
- **Reload and persistence:** session-only Anki state is visible in code and consistent with README's session cross-links. No real browser reload or IndexedDB fault test was performed by this audit slice.

## C. Deliberate policy and improvement options

### C1 — Successful earlier chunks and previous batch are unavailable as cards after a later failed run

The synthetic long source forces two generation chunks. Chunk one returns a valid supported note, then chunk two throws `synthetic quota exhausted`. Result: zero published cards/registry entries, `batch:null`, and one completed raw response retained under interrupted diagnostics. Separately, generate a successful two-note batch then start a failing run: prior visible cards/batch and their live registry entries are cleared before that new call succeeds.

This is a **reproduced loss of usable in-session output, but currently deliberate publication policy**, not silently relabeled as a parsing or validation bug. The code explicitly says interrupted responses are retained without publishing interrupted notes (4214–4216), and the UI says partial output contributes no notes or coverage (6025–6026). Raw completed chunks are recoverable manually from the diagnostics download. Prior-batch manual edits are not copied into the new failed-run diagnostics.

Smallest product option: keep the prior completed batch visible until replacement succeeds, with a clear pending-run indication. A larger option is explicit partial-batch recovery that maps only completed chunks and labels incomplete coverage. Regression risks include accidentally combining sources/runs or making partial output appear fully checked; preserve ownership checks and add assertions for prior-batch retention plus exact completed-chunk source IDs. Neither option was applied.

### C2 — Qualitative support is advisory/model-dependent, not certified by map or completion

The red/`Always safe.` example is exportable despite a real, in-chunk fact ID. The missing-map example is also exportable while explicitly inconclusive. These are supported expectations of existing warn-tier policy, not grounds for an automatic export blocker. Preserve the distinction between linked facts, structural eligibility, numeric token evidence, optional checker judgments and actual source fidelity. No new model call or correction is proposed here.

## Scenarios exercised

1. Valid supported notes preserved through parse/map/dedupe/normalization/export.
2. Selection, selected tier, style/review filter, edit repair, deletion, note/review counts and registry agreement.
3. Text/Extra/source-link/KB edit invalidation of numeric evidence and prepared audit.
4. Unsupported qualitative Text/Extra retained under advisory semantics.
5. Missing mapping remains inconclusive with zero linked coverage.
6. Empty STOP retry and preview reset.
7. Missing finish metadata exhaustion and fatal HTTP 400.
8. Failed attempt plus successful retry yields no duplicate notes.
9. Exhausted empty responses fail rather than producing a successful empty batch.
10. HTTP 429 provider backoff and malformed SSE rejection.
11. Real pending transport abort and interrupted metadata.
12. MAX_TOKENS partial-note preservation/status.
13. Nonempty STOP/non-card response status.
14. Late cancelled generation with an abort-ignoring mock.
15. Source replacement and late old-run response.
16. Same-source overlapping runs publish newest only.
17. Later chunk error retains earlier good raw response only in diagnostics.
18. New failed run clears prior visible batch.
19. Checker transport error/retry retains original notes and captured request.
20. Pending checker response after note edit cannot publish.
21. Malformed/truncated checks remain partial until explicit valid retry.
22. Tier/manual-selection changes invalidate prepared checks.
23. Checker cancellation rejects late verdict without changing notes.
24. Isolated ownership-guard mutation is caught.

The mutation replaces only the in-memory `ankiRunIsCurrent` return expression with `true`, keeping production bytes untouched. The same delayed-cancellation scenario then wrongly publishes two notes, and the expected-zero-note assertion throws. The test explicitly requires that assertion failure, proving the integration test reaches the guard's effect. No claim is made that every safeguard has mutation coverage.

Other audit parts own source-to-KB fidelity, detailed parsing/dedupe/export semantics and optional audit receipt semantics. The unified verifier is reported by the coordinating audit; it was not claimed as run by this lifecycle slice.
