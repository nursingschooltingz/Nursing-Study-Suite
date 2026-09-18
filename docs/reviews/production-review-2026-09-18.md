# Production readiness review — v16.7

**Implementation follow-up:** the user subsequently authorized fixes. See the [implementation and verification record](production-fixes-2026-09-18.md) for the resulting working-tree changes. The findings, source locations and measurements below describe the reviewed baseline.

Reviewed 2026-09-18 at revision `95bd91c990d3914644b69334f752b13dc84567a5`. This is a review of the current working source, not a release approval or a claim that every possible input is safe.

**Recommendation: hold release for the case numeric-validation defect and the source, recovery, and operation-state defects below.** Thirteen actionable issues: **0 Critical, 1 High, 8 Medium, 4 Low**. The two security findings are Low; the High finding concerns correctness of generated study material.

No shipped code, frozen prompts, dependency pins, or baseline files were changed. No code, dependencies, historical evidence, or compatibility paths were removed. Existing untracked review files were preserved. No private course materials or live Gemini calls were used.

## Evidence and limits

- `node verify-repo.js` passed, including **2,820 regression assertions**, frozen prompt checks, generated prompt documentation, LF/version/file checks, and complete JSX transformation. This does not establish browser acceptance or clinical correctness.
- Two synthetic scripts extracted the actual shipped functions/handlers and reproduced seven correctness defects. Their assertions confirm existing defective behavior; they are evidence, not permanent regression gates.
- The existing browser performance runner failed before measuring: its saved-KB fixture is invalid under v16.7. A scratch-only overlay adding `sources: []` allowed the same runner to measure the shipped UI.
- One instrumented headless Chrome run measured initial rendering and one Extra-field edit. These are host-specific observations, not p95 service-level measurements or proven post-fix improvements.
- A separate, fully intercepted Chromium test confirmed the print popup's opener behavior on a synthetic HTTPS origin. The exact `exportAsPdf` function was extracted; the print-document factory was stubbed to an allowed anchor and matching CSP. The `file://` deployment path was not tested for this issue.
- Security work combined an independent baseline, architecture mapping, focused source review, and parent validation. Coverage is explicitly partial for the full repository: executable production paths were prioritized; every historical report, test module, browser/OS combination, and third-party dependency implementation was not exhaustively audited. No source-history comparison was performed, so “regression” is used only where the current fixture conflicts with the current contract.
- Official vendor documentation was checked for current Gemini APIs/models, React migration constraints, and PDF.js vulnerability applicability. No live provider response, quota behavior, deployment headers, account configuration, or private datasets were verified.

Review evidence is in `scratch/production-review-2026-09-18/`: `ingestion-persistence-repro.js`, `priority-repro.js`, their result JSON files, `performance-review.js`, `performance-results.json`, `anki-helper-performance.js`, `anki-helper-performance-results.json`, `transport-opener-repro.js`, `transport-opener-results.json`, and `threat-model.json`. Scratch files are ignored and have not been added to Git.

## Findings

All HTML locations below refer to **`Nursing-Study-Suite v16.7.html`** in the repository root.

### 1. An unsupported compound unit can pass case numeric grounding

**Severity:** High

**Category:** Bug

**Location:** HTML, `caseParseThreshold`, lines 8826–8842; `caseAuditTextValues`, lines 8879–8885.

**Problem:** The threshold regex consumes a supported unit prefix without rejecting an unsupported suffix. `below 5 mg/(kg min)` becomes a threshold in `mg`. The stricter direct-value tokenizer correctly rejects the complete source notation, but the instantiated-value path bypasses it.

**Evidence:** The extracted tokenizer reports `5 mg/(kg min)` as unsupported; `caseParseThreshold` returns `{op:'<', value:5, unit:'mg'}`. A generated `4 mg` declared as `instantiated` receives no numeric issue. A complete synthetic call to `validateCaseStudy` returns `[]`.

**Impact:** A dimensionally incompatible clinical value can be admitted as source-grounded. This undermines an enforced correctness check, even though the product is educational and no patient harm was demonstrated. This is separate from the intentionally warning-only handling of deterioration outside a valid threshold.

**Recommendation:** Parse and validate the entire numeric/unit expression using the same suffix rejection rules as direct values. Preserve legitimate supported thresholds and the documented pH/dimensionless exception. Do not change warning tiers to fix this parser defect.

**Regression assertions:** Comparator and range cases containing `mg/(kg min)`, `mg²`, and `mg·kg` must fail grounding; valid complete units must continue passing. Include whole-case validation, not only a regex test.

**Expected benefit:** More reliable validation; maintainability through one unit grammar.

**Compatibility risk:** Previously accepted malformed cases will surface validation errors; retain their raw responses for review.

### 2. NCLEX chunking silently omits source text

**Severity:** Medium

**Category:** Bug

**Location:** HTML, `nclexChunkText`, lines 6195–6204; caller `runInline`, lines 6499–6523.

**Problem:** A chunk end backs up to a newline, but the next start advances by the original fixed stride. The shortened chunk can end before the next start.

**Evidence:** With defaults `size=3000`, `overlap=800`, and a newline at offset 1600, chunk one ends at 1601 and chunk two starts at 2200. The synthetic marker at offset 1800 reaches no chunk; offsets 1601–2199 disappear.

**Impact:** Questions, answers, options, and source sentences can be omitted before the model sees them, while the operation still appears complete.

**Recommendation:** Calculate the next start from the actual chosen end, with strict forward progress and bounded overlap. Keep the existing protection against zero-size infinite loops.

**Regression assertions:** Track the union of source offsets represented by chunks for newline boundaries, default and zero overlap, short input, and cleared/invalid settings. Assert coverage and termination, rather than only the number of chunks.

**Expected benefit:** Correct extraction; fewer unexplained missing items.

**Compatibility risk:** Complete coverage may increase calls or duplicate overlap candidates; retain item deduplication.

### 3. A corrupt fallback hides a healthy saved KB and disables subsequent saves

**Severity:** Medium

**Category:** Bug

**Location:** HTML, `kbReadFallbacks`, lines 1870–1876; App hydration, lines 10311–10324; save effect, line 10327.

**Problem:** Parsing one malformed fallback throws before reconciliation, queue initialization, and `setHydrated(true)`. The outer catch sets an error but does not publish valid candidates or recovery choices.

**Evidence:** Valid synthetic IndexedDB state plus malformed fallback JSON leaves no published KB, no recovery choices, `hydrated=false`, and no initialized save head.

**Impact:** The saved bytes survive, but the healthy KB is inaccessible through recovery controls. Later imports/builds can remain unsaved because the save effect exits while hydration is false.

**Recommendation:** Isolate failures per store/key, retain unreadable raw bytes for export, expose valid durable candidates, and enter an explicit recovery-paused state. Initialize the durable head safely. Resume writes only after the existing archive-and-choice contract is satisfied.

**Regression assertions:** Valid durable data with malformed fallback JSON, invalid envelope metadata, and throwing storage reads. Verify raw export, valid candidate inspection, and explicit recovery that resumes saving.

**Expected benefit:** Data availability and recoverability; maintainability.

**Compatibility risk:** Do not solve this by deleting or silently overwriting the corrupt fallback.

### 4. Failed retranscription leaves the old result looking like current evidence

**Severity:** Medium

**Category:** Bug

**Location:** HTML, `KnowledgeBaseBuilder.transcribeCards`, lines 2681–2695.

**Problem:** If every new transcription attempt fails, the handler puts an error in a local object and continues before publishing it. A previous successful transcript remains unchanged.

**Evidence:** After an earlier one-run success, a two-run retry with both calls failing leaves the old entry with `comparisonIncomplete:false`, no identity conflict, and an empty visible transcription error. A shared log line is the only failure evidence. The review checkbox is reset, but it does not encode the missing repeat comparison.

**Impact:** The user can reapprove old evidence without being told at the gate that the newly requested measurement failed.

**Recommendation:** Record the latest attempt status separately from retained successful evidence. Publish failed/incomplete status even with zero successful new runs, and require explicit reuse or successful remeasurement before satisfying the requested comparison.

**Regression assertions:** Existing clean evidence followed by zero-success repeats, partial repeats, cancellation, and removed/replaced photos.

**Expected benefit:** Trustworthy evidence state; clearer failure recovery.

**Compatibility risk:** Preserve old transcripts for inspection; do not discard them on a transient API error. No transcription prompt edit is required.

### 5. Priority analysis can publish results from a replaced Knowledge Base

**Severity:** Medium

**Category:** Bug

**Location:** HTML, `PriorityAnalyzer.runAnalysis`, lines 3468–3506; exports, lines 3517–3518 and 3562.

**Problem:** The operation slot checks run identity but never captures/checks source identity. The component remains mounted when the user changes tools and replaces the KB.

**Evidence:** A deferred synthetic harvest started from A remains unaborted after replacement with B, performs synthesis, and publishes the A result. The closure-level reproduction and component effects establish the missing source guard; this scenario was not separately repeated in a native React browser test.

**Impact:** The active source panel can refer to B while the displayed/downloaded guide belongs to A. Obsolete work can consume further provider calls.

**Recommendation:** Reuse the source snapshot/current-operation pattern already present in other generators. Cancel pending work after source replacement; preserve completed guides with their captured source and an earlier-source notice in every export.

**Regression assertions:** Replacement during delayed harvest, streaming synthesis, and after completion; verify cancellation, publication ownership, retained evidence, and export notices.

**Expected benefit:** Correct source association; lower avoidable cost and latency.

**Compatibility risk:** Retained completed output should stay inspectable rather than disappear without explanation.

### 6. Priority synthesis runs without usable source evidence

**Severity:** Medium

**Category:** Bug

**Location:** HTML, `kbForPriority`, lines 3427–3444; `runAnalysis`, lines 3474 and 3493–3506.

**Problem:** A zero-match selection still produces a nonempty packet header. Failed harvests become ordinary `[ERROR: ...]` strings and synthesis runs even when every harvest failed. Harvest truncation metadata is not captured.

**Evidence:** Both a header-only packet and a wholly failed harvest trigger a second mocked request and publish results with no final error. The all-failed synthesis receives only an error marker as evidence.

**Impact:** Paid generation can produce an ungrounded guide. Partial failure indicators disappear with the processing view and are absent from plain exports.

**Recommendation:** Require selected facts before harvesting and usable successful harvests before synthesis. Keep errors/completeness separate from model input. Persist failed/truncated chunk metadata in the result and exports, and avoid presenting a partial guide as complete.

**Regression assertions:** Zero matching conditions/tiers makes zero calls; all-failed harvest makes no synthesis call; mixed success and `MAX_TOKENS` retain explicit completeness notices.

**Expected benefit:** Correctness, reduced requests, reduced latency, and better observability.

**Compatibility risk:** Partial-output handling must stay explicit and inspectable; do not discard successful source work.

### 7. The sixth alphabetic NCLEX choice is merged into the fifth

**Severity:** Medium

**Category:** Bug

**Location:** HTML, `NCLEX_OPTION_MARK`, line 6301; `nclexSplitStemOptions`, lines 6303–6324.

**Problem:** The alphabetic marker grammar stops at E, although numeric markers extend through 9.

**Evidence:** `A. One B. Two C. Three D. Four E. Five F. Six` yields five options; E contains `Five F. Six`.

**Impact:** F loses its independent display/export structure, even when the answer key selects it. Its raw words are retained but become part of E.

**Recommendation:** Support at least A–F while preserving ordered-run discrimination against numbered content in the stem.

**Regression assertions:** Inline/multiline upper/lowercase A–F, split-mode repair, and TXT/Markdown output; preserve existing numeric-list disambiguation.

**Expected benefit:** Correct question representation; maintainability.

**Compatibility risk:** A wider marker grammar must not misclassify ordinary prose lists.

### 8. The browser fixture no longer satisfies the saved-KB contract

**Severity:** Medium

**Category:** Regression

**Location:** `tools/remediation-browser-fixture.js`, `syntheticKB`, lines 16–24; `tools/remediation-anki-performance.js`, `measure`, lines 15–16; HTML restore validation, line 1779.

**Problem:** The fixture omits root `sources`, now required for restored KBs. Browser tests seed it directly into persistence.

**Evidence:** Running the existing 1,000-note benchmark times out before measurement with `sources must be an array. No provenance was discarded.` Adding only `sources: []` in scratch permits hydration and measurement.

**Impact:** Shared browser acceptance/performance cases fail before exercising their intended scenarios. The unified verifier's fixture self-test does not detect this schema drift.

**Recommendation:** Correct the synthetic saved object and assert that it passes the live `kbNormalizeImported(...,{restore:true})`. Have browser setup fail immediately on recovery/error rather than wait for an impossible state. Record which browser acceptance suites actually ran.

**Regression assertions:** Current fixture roundtrip through saved-state normalization and one real browser hydration smoke test.

**Expected benefit:** Reliable tests, faster diagnosis, maintainability.

**Compatibility risk:** Fix the fixture, not the production restore validator or verifier gates.

### 9. Anki edits trigger excessive full-collection work and DOM rendering

**Severity:** Medium

**Category:** Performance

**Location:** HTML, `AnkiGenerator` derived state, lines 5742–5788; table/view rendering, lines 6152–6164; `ankiRecallContext`, lines 5245–5246; `ankiDedupeCards`, lines 4291–4305.

**Problem:** An edit recreates the full table and repeat style diagnostics; all rows are mounted. Counting exact duplicates invokes a deep-copying merge routine. Local-only review queues eagerly construct receipt indexes they do not consume.

**Measured evidence:**

| Synthetic notes | Initial render | One Extra edit | DOM elements |
| --- | ---: | ---: | ---: |
| 315 | 793 ms | 194 ms | 8,463 |
| 1,000 | 1,777 ms | 801 ms | 25,584 |

Original diagnostics did not rerun on the edit, and numeric audit count increased by only one. Those caches should be preserved. At 1,000 notes, a count-only prototype took a median 2.017 ms versus 3.837 ms for full dedupe; with four provenance-history entries per note, 2.129 ms versus 6.902 ms. These helper savings do not explain the entire 801 ms edit.

One 1,000-note local queue evaluation called the cloze parser 13,000 times and lint 3,000 times. Omitting unused local receipt indexes removed 3,000 parses and 1,000 lints. The 3,000-note timing was noisy and regressed, so no universal latency improvement is claimed for that prototype.

**Impact:** Noticeable input delay and unnecessary allocations, especially on larger decks and slower devices.

**Recommendation:** First bound mounted rows with pagination or local windowing and stabilize row rendering without adding a dependency. Cache unchanged per-note style results. Share an exact-merge key for counting while keeping full provenance merging for the explicit merge action. Build receipt indexes only when their consumers need them.

**Regression assertions:** Keyboard focus/caret, edits and Keep selection outside the initial page, filters/tier changes, source replacement, stale/current audits, and full-deck exports. Compare warning/output equality and immutability for helper optimizations. Measure repeated browser runs before claiming improvement.

**Expected benefit:** Latency, memory, reduced allocations, and maintainability.

**Compatibility risk:** UI pagination must not change export coverage or selection semantics. Do not replace immutable edits with mutation merely to make caches appear faster.

### 10. Retry handling shortens a provider-specified delay

**Severity:** Low

**Category:** API

**Location:** HTML, `geminiRetryDelayMs`, lines 766–774.

**Problem:** A valid provider delay is capped at 60 seconds before applying exponential backoff. The advertised floor therefore stops being a floor. `Retry-After` is parsed only as an integer, ignoring HTTP dates.

**Evidence:** The extracted function returns `60000` for `google.rpc.RetryInfo.retryDelay='120s'` on attempt zero. Google's contract says to wait at least the supplied duration. [Google RetryInfo documentation](https://docs.cloud.google.com/storage/docs/reference/rpc/google.rpc#retryinfo).

**Impact:** The client can retry while the provider still expects it to wait, consume its finite retry budget, and terminate a recoverable operation.

**Recommendation:** Honor valid server delays. If a delay exceeds the automatic waiting budget, stop with a retry-available time rather than sending early. Support valid HTTP-date headers, reject malformed values, and retain cancellation.

**Regression assertions:** 120-second hint, numeric/date headers, invalid hints, exponential floor, and abort during waiting; mock clocks rather than sleep through tests.

**Expected benefit:** Fewer wasted requests and more predictable recovery.

**Compatibility risk:** Long waits need visible status and cancellation; no model/prompt change is required.

### 11. PPTX extraction has no expansion or aggregate resource budget

**Severity:** Low

**Category:** Security

**Location:** HTML, `extractPptxText`, lines 683–717; `kbSourceUnits`, lines 1992–1995; `addFiles`, line 2629. CWE-409.

**Problem:** A selected archive is accepted by extension, expanded into whole XML strings, parsed into DOMs, and accumulated as text without compressed-size, entry-count, expanded-byte, or aggregate-text limits. The extraction path does not consume the caller's cancellation signal.

**Impact:** A malicious or accidental oversized deck can exhaust the importing browser's memory or responsiveness and disrupt unsaved work. This requires user import and affects the local session; no remote service DoS or code execution is established.

**Recommendation:** Add compressed admission limits and enforce actual per-entry and aggregate expanded-byte budgets before materializing unbounded XML. Bound slide/reference counts and total extracted text, and propagate cancellation. ZIP metadata or a post-`async('string')` size check alone is insufficient to prevent the allocation.

**Regression assertions:** Benign bounded compressed fixtures exercising each limit, repeated references, partial failure, and cancellation. Do not require a memory-exhausting archive to prove rejection.

**Expected benefit:** Security, bounded memory, and responsiveness.

**Compatibility risk:** Large legitimate decks may require splitting; choose/document limits from actual supported workloads. No private workload was read here.

### 12. Print preview retains an opener across external navigation

**Severity:** Low

**Category:** Security

**Location:** HTML, `exportAsPdf`, line 1233; allowed links, lines 610–611; `buildPrintDoc`, lines 1098–1101. CWE-1022.

**Problem:** `window.open('','_blank')` preserves `window.opener`. Sanitized study markup still allows links, so following a reference can give an external destination the retained opener handle.

**Evidence:** A fully intercepted synthetic HTTPS Chromium test retained the opener in both preview and destination. After a user gesture in the destination, it navigated the original tab to a synthetic replacement page. No credential read or direct XSS was demonstrated; `file://` behavior remains untested.

**Impact:** A malicious linked site can replace the study tab, creating a phishing/navigation risk after additional user interaction.

**Recommendation:** Clear `win.opener` synchronously after opening the blank window, before writing the preview. Keep the existing handle and iframe fallback. A blind `noopener` feature change can return `null` and accidentally force the fallback.

**Improved code (minimal insertion):**

```js
win = window.open('', '_blank');
if (win) win.opener = null;
winDoc = win ? win.document : null;
```

**Regression assertions:** The real preview has no opener; native popup printing still works; blocked-popup fallback still works; a locally fulfilled external destination cannot navigate the source tab.

**Expected benefit:** Security with negligible runtime cost.

**Compatibility risk:** Verify supported native browser print behavior and both hosted and downloaded-file modes.

### 13. Privacy wording omits image transmission and overstates key locality

**Severity:** Low

**Category:** Maintainability

**Location:** `README.md`, privacy text at line 312; HTML, `cardTranscribe`, line 2431; API header, line 814.

**Problem:** The broad privacy statement describes extracted text and says the key stays on the machine. Card transcription sends image `inlineData`; authenticated requests send the key header to Gemini. Another README section already explains the key transmission, leaving conflicting wording.

**Impact:** Users cannot accurately infer what leaves their browser from the privacy summary. No additional unapproved recipient was found.

**Recommendation:** State that parsing occurs locally, text and selected card images are sent to Gemini, and the key is retained locally for the session and transmitted to Gemini for authentication. Distinguish local storage from provider processing/retention without asserting an account policy that was not inspected.

**Expected benefit:** Readability and maintainability; informed data handling.

**Compatibility risk:** Documentation only; no runtime migration.

## API, dependency, and architecture assessment

The configured `gemini-3.8-flash` is a current stable model; Google lists its September 2, 2026 release and no announced shutdown. `gemini-3.1-pro-preview` remains preview with no announced shutdown. Do not claim that this Pro setting satisfies a stable-only requirement; a stable-only deployment should use the supported stable profile and remeasure output quality before changing defaults. [Google model lifecycle](https://ai.google.dev/gemini-api/docs/deprecations).

The application uses direct REST, so there are no obsolete Gemini SDK methods to replace. Google's current guide still documents `v1beta/models/...:generateContent` and streaming. No forced Interactions migration is justified. [GenerateContent guide](https://ai.google.dev/gemini-api/docs/generate-content).

JSON MIME mode does not enforce application schema. For a bounded follow-up, trial the currently documented `generationConfig.responseFormat.text` MIME/schema shape on one non-frozen structured-output path. Keep local semantic/numeric/provenance validators, malformed-response inspection, and existing public result shapes. Do not mechanically introduce deprecated `responseSchema` or `_responseJsonSchema` fields; provider schemas also do not establish clinical entailment. Measure failed-output/repair-call rates before broad rollout. [Structured output guide](https://ai.google.dev/gemini-api/docs/generate-content/structured-output), [API reference](https://ai.google.dev/api/generate-content).

The SSE implementation handles event framing and termination rather than treating arbitrary network chunks as complete output. The actionable streaming gap is missing harvest completeness handling in Priority, not a reason to replace the whole transport. Avoid automatic context caching or parallelizing every request without first measuring quotas, shared cancellation, and source ownership. The empty/failed Priority guards offer a directly provable reduction in avoidable requests.

React 18.2 is behind the current 19.3 line. React 19 removed UMD builds, so changing the CDN version alone would break this global-script architecture. A React upgrade requires a separate loading/compatibility decision within the single-file contract, explicit testing, and renewed SRI pins. Version age alone is not proof of an exploitable vulnerability. [React versions](https://react.dev/versions), [React 19 migration guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide).

PDF.js 3.11.174 falls within the versions covered by GHSA-wgrm-67xf-hhpq, but the sole application `getDocument` path sets `isEvalSupported:false`, the vendor's stated mitigation. Reporting that advisory as an unmitigated RCE here would be inaccurate. A worker/API upgrade remains maintenance work with PDF extraction and native-worker regression risk. The reviewed DOMPurify pin was current at review time. This is not a claim that all transitive dependency code was audited. [Mozilla advisory](https://github.com/mozilla/pdf.js/security/advisories/GHSA-wgrm-67xf-hhpq), [DOMPurify project](https://github.com/cure53/DOMPurify).

`document.execCommand('copy')` is a deprecated fallback after the modern clipboard path. Its removal would reduce downloaded-file/browser compatibility unless a replacement is verified. `document.write` is also discouraged, but this application uses it for a fresh sanitized print document and a fixed boot fallback; no arbitrary-script injection was established. Replace these only alongside native behavior tests, not as cosmetic cleanup. [Clipboard fallback status](https://developer.mozilla.org/en-US/docs/Web/API/Document/execCommand), [document.write cautions](https://developer.mozilla.org/en-US/docs/Web/API/Document/write).

No safely removable runtime dependency was established: React/ReactDOM render the UI, Babel compiles JSX, marked renders Markdown, DOMPurify enforces output policy, PDF.js reads PDFs, and JSZip reads PPTX. The legacy Anki audit validator still serves the active v4 decoder and is not dead code. Profile migration, sanitizer fallback, saved-state recovery, and live measurement tools each have a current consumer or documented role. Historical evidence files are not runtime payload and should not be deleted as an assumed startup optimization.

The architecture's main liability is repeated lifecycle and validation logic within a large single file. Priority has drifted from the source-ownership contract used elsewhere, and threshold parsing has drifted from direct numeric parsing. Centralize those specific pure guards/parsers inside the HTML, with tests extracted from the actual functions. A bundler, backend, TypeScript migration, module split, or generic state framework would cross explicit project constraints without resolving these defects by itself.

Security exposure differs from a multiuser service: there is no application backend, tenant authorization, cookie-authenticated mutation endpoint, server filesystem extraction, or SQL query path. CSRF, SSRF, server IDOR, server command injection, and replay-protection findings were not established. BYOK `sessionStorage` is an explicit design choice; browser code necessarily sees that key. All same-origin executable code remains inside that trust boundary. Hosting configuration, browser extensions, provider billing restrictions, and per-account rate caps require deployment evidence outside this review.

Two tooling portability concerns remain conditional: the verifier's predictable OS-temp Babel installation and the PDF browser runner's predictable temporary filename. Shared writable POSIX temp directories can introduce cross-user replacement/symlink risks depending on OS policy. The reviewed Windows host uses per-user temp, so these were not counted as confirmed vulnerabilities in this deployment. Prefer a private temp directory and exclusive file creation when making these tools portable.

## Scores and release decision

These are engineering judgments from the observed failures, not statistically calibrated security ratings.

| Dimension | Score / 100 | Main deductions |
| --- | ---: | --- |
| Production readiness | **62** | Silent grounding/source failures, recovery lockout, broken browser fixture, incomplete native acceptance |
| Maintainability | **57** | Repeated source/lifecycle/unit rules and fixture-contract drift inside a large single file |
| Security | **80** | Archive resource boundary and opener issue; deployment/dependency audit limits |
| Performance | **61** | 801 ms synthetic 1,000-note edit, eager DOM, repeated parsing and avoidable model calls |

Critical vulnerabilities: **none established**. High priority: **case unit validation**, then source coverage, recovery, stale/failed evidence, and source ownership. Security work should bound archive expansion and sever the popup opener. Performance work should first reduce mounted rows and repeated per-note work, then optimize duplicate counting. Technical debt/dead code/dependencies removed: **none; this was a review, and no deletion was justified without targeted change validation**.

## Ordered implementation plan

1. Fix complete-unit threshold validation and add direct/instantiated whole-case regressions. Preserve all approved warning policies.
2. Fix NCLEX chunk coverage and A–F option structure, with offset-coverage and export assertions.
3. Repair fallback failure reconciliation and recovery controls. Prove preservation of both raw damaged bytes and valid durable state before testing resumed writes.
4. Publish current transcription-attempt failure state without losing prior evidence. Test zero-success repeats and cancellation.
5. Bind Priority runs/results/exports to captured source identity; reject empty/failed harvests and preserve partial/truncated status. Add delayed-response replacement tests and no-request precondition tests.
6. Repair the saved-KB browser fixture, add live-normalizer assertions, and run actual browser lifecycle/source/export acceptance against the fixes. Complete the unified verifier for each implementation batch.
7. Add bounded PPTX expansion/cancellation and clear print opener. Test bounded synthetic archives and native popup/fallback behavior.
8. Honor provider retry floors; add deterministic timing/abort tests and visible long-delay recovery.
9. Reduce Anki DOM and repeat work in small measured changes. Preserve full export/selection/provenance behavior and compare repeated 315/1,000/3,000-note runs.
10. Correct privacy documentation; trial structured-output schema enforcement on one path only after measuring its benefit. Treat stable-only model selection and React/PDF dependency upgrades as separate compatibility work.

Every behavior change needs a non-vacuous regression assertion against shipped functions and `node verify-repo.js` before any commit. Preserve the 11 byte-frozen prompts. Prompt changes, a different runtime architecture, or warning-to-error promotion require the specific approval defined by the project contract. None is necessary for the first nine implementation steps as described. Live Gemini measurements still require explicit per-run authorization.

## Security scan artifact and telemetry

The Security plugin finalized scan `730611ba-a58c-4ee5-9bc9-3067a133115d`, with two Low findings and partial source coverage. Its canonical [generated security report](C:/Users/sai13/AppData/Local/Temp/codex-security-scans-a6jYOO/Nursing-Study-Suite/95bd91c990d3914644b69334f752b13dc84567a5_20260918T213401Z_50kvbgnz/report.md) is separate from this broader engineering review.

The plugin warned that working-tree contents changed during the scan and retained findings against its original snapshot. The only new nonignored repository artifact is this review report; both tracked working-tree and staged diffs were empty at completion. The two previously untracked review files remain untouched.

Reported aggregate scan telemetry across four tasks: 21,348,800 total tokens (21,270,836 input, including 20,362,624 cached input; 77,964 output, including 14,341 reasoning output). These are the plugin's aggregate counters, not a cost estimate or newly billed-token count. The telemetry's complete measurement coverage does not mean complete source-audit coverage.
