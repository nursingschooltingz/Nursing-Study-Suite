# Codex remediation plan for the v15.17 production review

**Status:** Ready for implementation; no remediation has been applied by this planning task.  
**Baseline:** commit `549ee927c2d362e01facbc5741ee8df9c48112df`, canonical `Nursing-Study-Suite v15.17.html`, 904 passing assertions. Re-establish these facts before editing; the repository may have advanced.  
**Objective:** Fix the confirmed data-loss, source-integrity, validation, security, transport, and performance defects with small reversible changes. Preserve the single-file application and existing study/export contracts.

This is the reconciled execution specification. It supplements the [original production review](<docs/reviews/production-review-2026-09-11.md>) and incorporates the subsequent verification of Claude's additions. When a recommendation in either earlier report conflicts with an explicit correction here, follow this plan and the actual code/project contract.

## 1. Execution brief for Codex

When the user asks to implement this plan:

> Read AGENTS.md and its routed documents, then execute the confirmed work packages below in order. Reproduce each failure against extracted shipped functions or a safe synthetic browser fixture, apply the smallest fix, add meaningful regression coverage, and run node verify-repo.js after each logical change. Continue through independent work without requesting approval for ordinary inspection, offline tests, or reversible authorized edits. Keep the eleven frozen prompts, card-transcription prompt/resize settings, model profiles, token ceilings, and established warning tiers unchanged. Preserve Anki's plain-versus-HTML import encoding. Do not access private course material or make live Gemini calls without explicit authorization for those materials and that run. Do not publish, push, or release merely because local verification passed. Record completed work, evidence, and remaining acceptance checks in the execution ledger. If a conditional item cannot be verified, isolate and document it rather than silently implementing it or claiming it complete.

This document does not start implementation, create a new Codex task, authorize live measurements, or publish a release. Once implementation is requested, the packages are work boundaries, not repeated permission checkpoints.

### Required context and files

Read [AGENTS.md](<AGENTS.md>), [DECISIONS.md](<DECISIONS.md>), [CURRENT_STATE.md](<CURRENT_STATE.md>), [DEVELOPMENT.md](<DEVELOPMENT.md>), and [README.md](<README.md>) before changes. Read [Prompts.md](<Prompts.md>) and [prompt-baseline.json](<prompt-baseline.json>) to confirm contracts; do not edit prompt bodies. The dormant v16 design is outside scope.

Primary code: [Nursing-Study-Suite v15.17.html](<Nursing-Study-Suite v15.17.html>). Ordinary gate: [verify-repo.js](<verify-repo.js>). Regressions: [latte-tests.js](<latte-tests.js>). Existing Anki browser fixture: [tools/anki-browser-fixture.js](<tools/anki-browser-fixture.js>). Review-only probes: [scratch/review-2026-09-11/repro.js](<scratch/review-2026-09-11/repro.js>) when present; this ignored file is convenient evidence, not a durable gate.

### Non-negotiable working rules

- Locate live symbols again. Line numbers in reviews refer to the baseline and will move.
- Before every HTML replacement, prove the exact old text occurs once; fail otherwise. Preserve LF bytes. Add the required version comment explaining the previous defect.
- Preserve unrelated work and the existing untracked review. Never remove a Name clash copy before diffing it.
- Keep one canonical suite HTML. No bundler, application module split, backend, new application runtime dependency, or framework migration.
- Never adjust frozen hashes to make a test pass. Also leave dynamic generation prompts, the Anki mapping adapter, card payload constants, and model/profile settings unchanged unless a separate measured change is explicitly brought into scope.
- New behavior gets a live-function regression. Preserve extraction-tail assertions. Keep the enforced assertion total accurate; a larger number alone is not evidence of better coverage.
- Run `node verify-repo.js`. If scratch Babel is missing, use the documented `--setup-babel` once, outside repository dependencies.
- Keep changes ready to commit separately. If commits are within the implementation request, commit only after the gate passes, with an explicit file list. Do not push/publish without authorization.
- If choosing a new development version, confirm the next unused v15 patch number first; v15.18 is only an expectation. Update filename, top comment, changelog, and generated documentation together, verify all SRI pins, and keep that version consistent throughout the work. A local version bump is not a release.
- A blocked browser/live acceptance check does not prevent independent deterministic work. Report the unverified behavior precisely; do not weaken a gate.

## 2. Reconciled scope

F01–F20 refer to the original review. N1–N6 refer to Claude's additions.

| Finding | Disposition | Package |
|---|---|---|
| F04 persistence rollback | Confirmed; first-priority data-loss fix | P02 |
| F05 build/import overwrite | Confirmed | P03 |
| F06 removed-photo resurrection | Confirmed | P04 |
| F13 Priority Analyzer reentry | Confirmed | P03 |
| F03 stale artifact evidence | Confirmed | P05 |
| F01 Unicode fact/condition collapse | Confirmed for remaining Unicode; arrows already preserved | P06 |
| F02 numeric false support | Confirmed; preserve calculation and threshold exceptions | P07 |
| F07 malformed questions/grounding | Confirmed; preserve existing warnings and permitted shortages | P08 |
| F10 Anki dedupe; F18 multiple tiers | Confirmed | P09 |
| F11 ignored card identity disagreement | Confirmed | P04 |
| F08 audit status lost on export | Confirmed | P10 |
| F09 output resource leakage | Confirmed policy gap; browser interception required | P11 |
| F12 incomplete SSE | Confirmed | P12 |
| F14/F15 Anki rendering/recomputation | Confirmed; browser speedup still to measure | P13 |
| F16/F17 misleading/mismatched measurements | Confirmed | P14 |
| F19 dependency maintenance | Sanitizer refresh in scope; PDF major migration conditional | P11/P17 |
| F20 dead helpers/bookkeeping | Confirmed candidates; preserve production coverage | P16 |
| N1 unverified PDF worker | Valid addition; existing eight script SRI pins are real | P15 |
| N2 controller ownership elsewhere | Reproduce reachability; harden touched lifecycle paths, not six assumed new bugs | P03/P05/P12 |
| N3 extraction/empty-prompt guards | Low diagnostic hardening; existing gates already fail these mutations | P14 |
| N4 CLI argument bugs | Confirmed; opt-in/dry-run are additional safeguards | P14 |
| N5 identical-byte Anki export proposal | Rejected: would risk double escaping and changed tags | Preserve in P09 |
| N6 print iframe sandbox | Defense in depth, not a network-leak fix | P11 |

Do not inflate severity based on patch count or debate scores before fixing defects. Persistence rollback is release-blocking regardless of whether it is labeled High or Critical.

### Explicit exclusions

Do not implement the rejected Anki encoding change. Do not “correct” the accurate count of eight existing SRI-pinned script resources: the unverified worker is an additional resource. Do not reintroduce arrow canonicalization or change `≤` to `<=` in fact identity.

Do not adopt Gemini response schemas, change SDK/API families, lower output ceilings, alter thinking/safety settings, tune OCR, or repair the measured one-to-many mapping adapter under this plan. Those are separate behavioral proposals requiring their own evidence. No live material is needed to implement the confirmed deterministic fixes.

## 3. Shared design constraints

### Keep three identities separate

1. **Mutation/run ownership:** a local token decides which pending operation may publish state or clear a controller.
2. **Source identity:** a captured KB identity/snapshot decides whether artifact fact links belong to the active KB.
3. **Persistence ordering:** a durable save identifier/revision orders writes to storage.

Saving the same KB must not make its artifacts stale. Replacing a KB must invalidate old grounding even when it reuses every fact ID. A revision imported from a file is untrusted data, not proof that it is newer than local work.

### Storage migration must preserve ambiguity

Legacy raw KB values contain no reliable save-order metadata. `metadata.createdAt` is not a save revision. If legacy IndexedDB and localStorage disagree, preserve both and present a recovery choice/export flow. Do not assume that IndexedDB, localStorage, or the larger KB is newest.

Prefer a small additive internal persistence record compatible with existing raw KB exports. If introducing an envelope or companion metadata key, specify how current readers, legacy records, and reopening an older app version behave. Do not wrap exported JSON in an internal envelope. Commit KB and ordering metadata transactionally where IndexedDB permits it.

A “saved” indicator means the current snapshot's write committed. It must not be set by an older callback. Fallback cleanup must check which fallback is being superseded; an old success must not delete a newer fallback.

### Preserve established validation semantics

Before adding checks, make a small table of existing rule/severity contracts and retain assertions for them:

- Worksheet MCQ four-option and SATA five-to-six-option checks remain warnings.
- Existing missing condition/support-type/availability, terminology, qualitative scanning, difficulty, and Anki numeric/style/collision checks retain their severity.
- Test Plan Alignment never becomes a failure.
- Instantiated values outside a cited threshold can describe deterioration and remain warnings; missing/unparseable threshold support remains an error.
- Case numeric support can use source quotes; Anki's advisory numeric checker has a different evidence policy. Share parsing primitives only where semantics match.
- Missing citations that currently warn do not become errors indirectly. Such data must not be silently treated as independently validated numeric support for other content.
- `itemAudit` remains blind to the grounding packet.
- Invalid artifacts remain inspectable; do not silently coerce them into a valid-looking shape.
- Cases may return fewer stages/questions with explanation in `debrief.notes`. Allocation prompts also permit fewer NCLEX questions with explanation in PART 2. Preserve the existing worksheet count-error policy while separately showing requested/actual completeness. Never pad with fabricated content.

## 4. Work packages

Each package ends with focused regressions, the unified gate, a diff review, and a ledger update. Split a package further when its changes can be independently verified; do not combine unrelated packages into a large patch.

### P00 — Establish the implementation baseline

**Locations:** repository workflow, verifier, source/documentation inventory.

1. Read routed context; record HEAD, working-tree changes, canonical filename, prompt hashes, assertion total, and source version.
2. Run the unified verifier and preserve a concise result.
3. Capture the existing Anki plain/HTML encodings and warning-tier contracts as fixtures/assertions before changing shared helpers.
4. Establish the development version strategy described above without publishing.
5. Create an execution ledger within this plan or a companion Markdown file. Never include source material, API keys, or raw model content from private runs.

**Done when:** baseline is reproducible and unrelated changes are identified; no implementation starts on an unexplained failing gate.

### P01 — Add safe regression infrastructure

**Locations:** latte-tests.js; a separate real-App browser fixture under tools/, if needed.

- Extend the existing harness with extracted pure helpers/closures and controlled deferred promises. Assert externally visible outcomes: final storage, active output, source links, current controller, and export bytes.
- Keep the existing Anki fixture for Anki behavior. It substitutes SyntheticAnkiApp, so it does not test the real App hydration/save effects.
- Add a focused real-App fixture with synthetic KBs and mocked Gemini. Use a fresh browser context/profile and isolated origin/storage namespace; never exercise destructive storage tests on the user's normal file:// KB.
- Serve only the intended fixture route. Do not serve the repository directory or discover private files.
- Use browser-context request interception for CSS, images, workers, frames, and popups. Replacing window.fetch alone is insufficient.
- Synthetic PDF/image fixtures may be generated locally for decoder tests. Keep these test-only and separate from copyrighted inputs.

**Tests:** fixture fails on a real unexpected Gemini request; delayed callbacks can be resolved out of order; each test resets its own storage; gate imports cannot execute manual measurement mains.

**Done when:** data-loss, race, and output-policy tests can run without credentials, private data, or live generation.

### P02 — Repair persistence ordering and recovery

**Locations:** App initialization/hydration/save effects; kbLoadPersisted, kbSavePersisted, kbDeletePersisted, kbRunTx.

- Separate “hydration complete” from “has conditions.” Capture the in-session mutation token at hydration start and refuse late hydration publication after a user replacement.
- Reconcile existing stores before any automatic save can overwrite them.
- Preserve conflicting legacy snapshots and expose concise recovery actions: choose one, inspect/export the other. If preserving the second copy fails, keep existing data and report the failure.
- Introduce minimal persisted snapshot/revision metadata for new saves, documenting backward reading and downgrade behavior.
- Serialize local writes/deletes. Tie completion/status to the saved revision. Coalesce superseded pending writes only when it preserves the newest state and clear ordering.
- Clear obsolete fallback only after a corresponding/newer durable commit and only when that fallback still matches the superseded snapshot.
- Keep the existing transaction-abort handling. If delete is supported, order it with writes and prevent resurrection with a tombstone or equivalent protocol.
- Do not build general multi-device sync. If concurrent browser writers cannot be ordered safely, preserve/report the conflict rather than claiming last-write correctness.

**Required tests:** empty stores; either store alone; identical legacy stores; different legacy stores; failed save A → successful B → reload B; successful A → fallback B → reload B; import during hydration; adversarial A/B/C callback ordering; old success after newer fallback; storage quota/abort; failed clear/delete; unmount before completion.

**Done when:** the current saved snapshot survives reload, older callbacks cannot report it saved, and no migration conflict is silently discarded.

**Migration/rollback:** raw exported KB format remains supported. Retain recovery copies until successful reconciliation. Reverting code must not erase newly stored snapshots; document how to export before a downgrade.

### P03 — Fix replacement and run ownership

**Locations:** KnowledgeBaseBuilder.build/importJSON; PriorityAnalyzer.runAnalysis; touched controller/finally paths.

- Give build and import one shared replacement-ownership mechanism. An accepted later replacement invalidates earlier pending publication before its first await.
- Guard success, failure, progress, streaming callbacks, metadata, logs, and final teardown where stale updates could affect the current operation.
- A finishing run clears busy/controller state only if it still owns the slot.
- Priority Analyzer gets a synchronous entry guard and busy state covering harvest plus synthesis. Switching its view to results must not enable another run. New/reset invalidates the prior run.
- If an import fails after superseding a build, report that failure; do not allow the abandoned build to unexpectedly take control again.
- Inspect other tools for reachable overlap. Reuse the same simple pattern in touched code; do not claim a reproduced race based only on similar finally syntax.
- Keep cancellation's existing policy for completed partial work. Navigation that merely hides a mounted tool is different from unmount.

**Tests:** build paused → import B → build resolves; two imports reversed; failed import; Priority streaming → attempted reentry; reset/cancel then late callbacks; old finally cannot clear new controller/busy; unmount abort.

**Done when:** the newest accepted operation owns state and cancellation throughout its lifetime.

### P04 — Make card source selection and identity reliable

**Locations:** transcribeCards; file removal; cardChunks/cardUnstable/cardGate; cardCompareRuns.

- Keep a current-file-ID ref. Removing a source synchronously invalidates relevant pending work and its review acknowledgment.
- Publish completed transcripts through a functional update filtered to current source IDs; remove captured whole-map republishing.
- Independently derive buildable card chunks only from still-loaded image IDs.
- Preserve completed, still-current transcripts on cancellation.
- Consume facesDisagree/idsDisagree as structural identity conflicts. Show the conflicting runs and block that unresolved pairing from KB intake without altering OCR prompts or resize constants.
- Preserve individual face provenance and the existing front/back/duplicate-face safeguards.

**Tests:** remove pending photo; remove completed photo while another runs; remove last photo while retaining PDF; remove then re-add different same-name photo; cancel/restart; equal bullets/numbers but differing face/category/card number; correctly paired faces; incomplete second run.

**Done when:** no removed image enters a build, and uncertain card identity cannot silently select runs[0] and pair as reliable.

### P05 — Bind artifacts and inspector links to their source KB

**Locations:** App knowledge/inspector/registry contexts; NCLEXGenerator; CaseStudyGenerator; existing Anki snapshot/currentness helpers.

- Capture a KB identity plus immutable source lookup at generation start. Use the actual packet for validation and a source snapshot for later inspection/export.
- Add source identity to registry entries or registry partitions; never merge old entries into a replacement KB's fact namespace.
- Invalidate source-dependent in-flight NCLEX/case work on KB replacement. Ignore late responses/repairs/registration from the old source.
- Make badges resolve against their captured snapshot or show an explicit stale state. A missing snapshot must never fall back to the live KB for an old artifact.
- Preserve old artifacts for inspection. Stale exports, if retained under current case/worksheet policy, must name the stale/source status and use original references. Keep Anki's existing stale-export blocking.
- Preserve case history intentionally within a source partition; do not erase unrelated artifact kinds while fixing one registry writer.
- A storage save of the same KB must not change currentness.

**Tests:** A and B reuse fact-1 for different text; old badge/registry/export cannot show B as A's evidence; response/repair arrives after replacement; same KB save does not stale; Anki/NCLEX/case registry kinds remain independent.

**Done when:** every clickable/exported reference identifies the source that actually produced it.

### P06 — Preserve meaningful characters in deduplication

**Locations:** kbFactKey and mergeLatteParts condition-name equivalence.

- Replace destructive ASCII stripping with conservative Unicode-preserving comparison.
- Preserve Greek letters, micro characters, signs, unit case, and meaningful punctuation. Normalize whitespace only unless a specific additional equivalence is justified by tests.
- Keep the already-preserved arrow/comparator behavior and avoid new operator canonicalization.
- Use a similarly conservative rule for condition aliases; do not collapse different names after deleting non-ASCII letters.
- Retain source-pointer union only for demonstrably equivalent facts.

**Tests:** μg/g; µg/g; α/β; −5/5; unit case; existing arrows/comparators; condition-name collisions; whitespace duplicates; source ownership of each survivor.

**Done when:** distinct facts/conditions survive separately and genuine duplicates retain their sources.

**Migration:** never claim repaired code reconstructs facts already lost. Rebuild affected material only when the user explicitly scopes its sources.

### P07 — Repair case numeric support without changing clinical policy

**Locations:** case tokenization/normalization, caseAuditTextValues, caseAuditDatumValues, threshold helpers, presentedValues.

- Introduce/use a complete value-unit tokenizer with explicit aliases. Eliminate substring support and unit-prefix/wildcard acceptance.
- Preserve compound denominators and signs. Do not invent unit conversions or silently accept the supported prefix of unknown notation.
- Parse each cited fact and quote separately; concatenation must not manufacture a token across records.
- Keep direct/combined/inference support distinct from threshold instantiation and rationale reuse of validated presented data.
- Direct BP evidence must compare the full pair; systolic-only threshold interpretation stays confined to the existing instantiation path.
- Missing-citation warning cases must not donate supposedly validated numbers to presentedValues.
- Validate neutral-framing instead of trusting its label. Preserve the prompt's exception: an ordinary adult body weight may be chosen when a weight-based calculation requires it and the packet provides no weight. Do not invent clinical weight cutoffs. Keep that assumed datum identifiable and consistent across dependent calculations; block arbitrary dose/lab/vital exemptions.
- Do not replace Anki's advisory support policy with case semantics.

**Tests:** 5 mg/15 mg; mL/hr/mL/day; mg/dL/g/dL; full compound units; micro aliases; exact decimals/grouping/signs; full BP pair; unknown units; tokens split across facts; neutral 900 mg rejected; permitted calculation weight retained; invalid datum cannot authorize a rationale; outside-threshold deterioration stays warn; missing threshold stays error.

**Done when:** complete-token support is required and all established legitimate exceptions retain their behavior.

### P08 — Validate usable output and exact grounding contracts

**Locations:** local case shape boundary, validateCaseStudy, validateNCLEXWorksheet, parser/repair call sites.

Split into small changes:

**A. Safe shape boundary.** Validate model container/value types before timing, difficulty, coverage, audit extraction, rendering, or registry traversal. Null stages/options/rationales and string factIds must produce an inspectable invalid result, not throw. Keep raw output separately. Do not turn malformed containers into empty valid-looking lists.

**B. Question contracts.** Require usable stems, nonempty option/rationale text where the type requires them, unique IDs/labels, and valid type-specific answer membership/cardinality. Preserve Calculation computed values and Ordering permutations. Existing MCQ/SATA option-count warnings stay warnings.

**C. Grounding/completeness.** Pass an immutable run contract to initial and repair validation. For allocation mode it includes targets AND supplied supporting context; for legacy mode it is the filtered pool actually sent. Resolve unique concept IDs to valid stable IDs and validate explicit Source/cites references. Avoid treating ordinary clinical text such as C5 as a concept citation. Report requested/actual counts and declared shortages without generating padding or silently claiming completion.

Keep existing missing-field warning tiers. If a proposed rule actually promotes an existing warning, prepare the exact change separately and obtain the required approval; continue independent fixes.

**Tests:** null/scalar containers; empty stem; duplicate labels/IDs; ANSWER Z against A–D; multiple MCQ answers; invalid SATA/Ordering membership; computed Calculation answer; missing rationale text; unknown/out-of-packet IDs; duplicate concept mappings; valid supporting-context citations in distractor/rationale reasoning for a question testing at least one target fact; rejection of questions whose correct answer tests only supporting context; bare C5 prose; valid short case with explanation; unexplained shortage; post-repair contract revalidation.

**Done when:** unusable structures cannot enter ordinary consumers, unresolved references cannot claim grounding, and valid shortage/format exceptions remain visible and supported.

### P09 — Fix Anki equivalence and tier parsing

**Locations:** ankiDedupeCards, lintAnkiCard, tier badges/filter/selection/export.

- Deduplicate only completely equivalent Text, Extra, and effective tags. Preserve meaningful case/punctuation. Do not merge conflicting keep choices or malformed notes merely because Text matches.
- Keep variants for user review with their own mappings; union links only after equivalence.
- Parse complete whitespace-delimited tier tags once and require exactly one effective Tier::1–3. Define duplicate copies of the same tag separately from multiple distinct tiers.
- Reuse the parsed result for badges/counts/filters/export, preserving manual selection versus structural eligibility.
- Keep style filtering display-only and export scope unchanged.
- Leave the measured one-to-many mapping adapter alone.
- Preserve raw headerless Pipe fields and HTML-escaped headered Text/Extra. Do not HTML-escape Tags. Keep source-footer formatting and cloze syntax intact.

**Tests:** equal Text/different Extra; different tier/tags; complete duplicates; meaningful case; zero/multiple/lookalike tiers; manual exclusion and repair; source unions only on true equivalence; plain/HTML imports with <, >, &, literal entity strings, cloze hints, and references.

**Done when:** no explanation or priority is silently discarded, tier behavior is consistent, and export encodings preserve rendered/imported meaning. Actual Anki acceptance remains required; equal file bytes are not the criterion.

### P10 — Preserve audit and completeness truth in exports

**Locations:** wsMd/workMd; caseMd/casePrintMd; caseValidationStamp; audit state/summary.

- Track audit requested/disabled/running/complete/interrupted/failed plus per-item outcomes.
- Retain FAIL, ERROR, REVIEW, N/A, and REPAIRED distinctions; “rewritten, not re-audited” must not become PASS.
- Add a concise export metadata notice for unresolved failures, incomplete audit, source staleness, and incomplete generation. Keep questions separate from answers and do not leak the key in warning text.
- Preserve deterministic validation separately from model item quality. Registration must not imply clinical correctness merely from source-ID resolution.
- Keep failed material inspectable/exportable under the existing policies; stamp it honestly.

**Tests:** deterministic pass plus answer-accuracy FAIL; quota interruption; disabled audit; repaired but not re-audited; case/worksheet shortage; stale source; MD/TXT/copy/popup/iframe parity; no answers in question section.

**Done when:** exported artifacts retain material limitations visible in the app.

### P11 — Restrict generated resources and refresh the sanitizer

**Locations:** mdToSafeHtml, CSP, buildPrintDoc, printViaIframe, DOMPurify primary/fallback scripts.

- Define one narrow untrusted-output policy covering required headings, text, lists, tables, emphasis, and code.
- Remove untrusted style tags/attributes and automatically fetching media/resource attributes, including img/srcset, picture/source, audio/video/poster, SVG resources, iframe/object/embed, and CSS imports/URLs.
- Keep trusted application/print CSS outside the untrusted-content policy; preserve the application's trusted SVG icons.
- The app currently decodes photos with createImageBitmap(File) and canvas; it does not display photo previews. Start with a tested `img-src 'none'` policy if all current functionality passes.
- Do not add default-src without specifying/testing the resulting script, style, font, worker, and frame policies. Do not break in-browser Babel to claim stronger CSP.
- Apply the policy to both popup and iframe printing. Add minimal tested iframe sandbox capabilities preserving parent-driven printing; this is additional protection, not the network policy itself.
- Verify the currently supported DOMPurify patch from primary sources at execution time; update both CDN pins and retain fail-closed/no-downgrade behavior. No unpinned fallback.

**Tests:** rendered markup contains no untrusted auto-fetch elements/styles; zero unapproved browser-network requests across app/popups/frames; intentional CSP probes blocked; text/tables/comparators preserved; trusted icons and card decoding/resizing work; popup-blocked print content/dialog/cleanup; primary/fallback sanitizer failure paths.

**Done when:** untrusted content cannot silently load remote resources, and the tested sanitizer runs on both print paths.

### P12 — Harden SSE completion and request cleanup

**Locations:** geminiRequest, callGemini integration, affected partial-output consumers.

- Parse complete SSE events/UTF-8 boundaries and distinguish non-data lines from malformed nonempty payloads.
- Track terminal completion. EOF without valid finish metadata is incomplete, not truncated:false success.
- Preserve partial diagnostics separately from completed output; do not publish an incomplete response as a finished artifact.
- Keep each retry attempt's text distinct; clear/reset preview on a new attempt without losing the prior attempt's diagnostic status.
- Own the reader and controller through finally. Cancel an unfinished reader/abort the attempt as needed, release locks, remove listeners/timers, and avoid masking the original error.
- Preserve legitimate STOP/MAX_TOKENS/safety behavior, existing retry budgets, RetryInfo-aware delay, thought filtering, and watchdog semantics.
- Preserve HTTP status/retry metadata internally. If outer loops demonstrably retry permanent failures as fresh batches, add a narrow stop classification with tests; do not invent a universal quota heuristic.
- Replace the 900 ms non-abortable inter-batch pause with the existing abortable helper when touching that path.

**Tests:** fragmented UTF-8/events; multiple events per read; malformed event; EOF without finish; reader rejection; partial retry; abort before fetch/during stream/backoff; valid STOP; MAX_TOKENS; safety block; permanent error; reader/controller cleanup; old callbacks ignored.

**Done when:** partial/damaged streams remain distinguishable from completed artifacts and cancellation releases owned resources.

### P13 — Remove measured Anki UI waste

**Locations:** AnkiCollisionWarnings, ankiBatchDiagnostics, derived state, registry effect.

Use two separately verifiable changes:

1. Render each collision group once, with per-note references or genuinely lazy details. Closed details alone does not avoid descendant rendering.
2. Split immutable original-batch diagnostics from live selection statistics. Reuse already-computed summaries and cache source numeric parsing by snapshot and unchanged-note work by identity where worthwhile.

Inspect registry publication: edits can legitimately change inspector labels/links. Skip only semantically unchanged registry updates, such as Extra-only changes that leave links/labels intact. Do not make references stable at the cost of stale inspector data. Callback recreation from changed focus inputs is not by itself a bug.

**Tests/measurement:** large single collision group and many small groups; linear rendered-member count; original diagnostics do not rerun per edit; selection/currentness still update; correct inspector updates; no idle publication loop; same 315/1,000/3,000-note fixtures before/after; browser input/render latency and DOM counts.

**Done when:** warnings remain complete, exports unchanged, and measured waste falls without new stale-data behavior. Do not claim a speedup from Node timings alone.

### P14 — Make tooling results, arguments, and diagnostics reliable

**Locations:** davis-transcribe-test.js; neia-retest.js; tools/repo-checks.js; tools/render-prompts.js; harness extraction.

- Extract pure argument/configuration helpers and guard executable mains so importing tests never performs API calls.
- Parse positional image paths separately from option values; validate finite integers/ranges for runs/width and finite allowed pacing values; reject NaN, infinity, negatives, fractions where inappropriate, missing values, and unknown options.
- Add `--dry-run` and an explicit live-execution opt-in. Dry-run requires no key, sends nothing, writes no measurement report, and prints selected model/profile, planned logical operations, and maximum attempts under retry policy. Do not promise exact actual HTTP calls or price.
- An opt-in flag prevents accidental execution; it does not replace the project's per-run human authorization requirement.
- In Davis measurements, track comparable/failed/incomplete images. Require the requested comparison count for a conclusive summary; distinguish no observed drift from accurate transcription. Return documented nonzero status for incomplete measurement.
- Keep the CLI original-image baseline explicit. Resolve/record an app-matching model when requested and record model, level, prompt hash, original/actual payload metadata, and observed attempts. UI resize acceptance must exercise actual cardFilePayload, not a new image-processing dependency.
- Add missing anchor-presence checks and reject empty documented prompt bodies. Preserve the existing assertions that already fail these cases; this is clearer diagnostics, not a newly repaired gate bypass.

**Tests:** all failure/completion combinations; --out foo.png excluded from inputs; NaN/infinity/zero/fractions; bad width/pacing; dry-run with no key; import has no side effects; no-opt-in makes zero requests; valid plans; missing regex anchor and empty card prompt fail specifically.

**Done when:** ordinary tests remain offline and measurement tools cannot turn missing evidence into a success conclusion.

### P15 — Verify PDF worker bytes before execution

**Locations:** PDF.js bootstrap/getPdfDoc; worker resource lifecycle; release resource documentation.

- Keep the count of eight existing SRI-pinned script resources accurate. Add an explicit worker integrity pin as a separate resource.
- Prefer native fetch integrity for the pinned worker, then construct the tested verified-Blob worker/URL integration. Do not introduce custom digest code without a concrete platform requirement.
- Verify before getDocument can load worker code. Deduplicate concurrent initialization and allow an explicit retry after failed initialization.
- Verify every fallback path. Network/hash/CSP failures must not restore the raw unverified URL. Inspect PDF.js fake-worker fallback and ensure it cannot bypass verification.
- Give the worker/Blob URL an explicit owner; destroying one document must not break other documents or pending opens. Clean up owned resources at the appropriate lifecycle boundary.
- Preserve isEvalSupported:false.

**Tests:** valid pin; mismatched bytes; primary failure and pinned fallback; both fail; concurrent documents; worker startup/CSP failure; fake-worker path; document destruction; retry after failure; cleanup; loopback and actual file:// startup; synthetic multi-page PDF text/ranges/cancellation.

**Done when:** every reachable worker-code execution path uses verified bytes and normal PDF reading remains functional.

### P16 — Remove proven dead code

**Locations:** kbAllFacts; unused nclexDedup wrapper; _pdfLiveDocs bookkeeping; CLI flag helper and stale comments.

- Recheck references after previous packages; a helper may now have a legitimate use.
- Remove unused helpers and duplicate bookkeeping. Transfer equivalent dedup assertions onto the production accumulator before deleting the old wrapper.
- Preserve real PDF cleanup and any ownership introduced in P15; do not remove the new worker owner because the old set was inert.
- Keep the casesAudit→itemAudit settings migration and clipboard fallback.
- No runtime dependency has been established as removable.

**Tests:** gate and extraction-tail coverage; live accumulator duplicate/distinct behavior; document lifetime tests still pass.

**Done when:** remaining code/comments describe actual behavior, with no loss of relevant coverage.

### P17 — Conditional PDF.js major-version maintenance

The old PDF.js branch is maintenance debt; the known CVE workaround is already present. Do not make a speculative major migration a prerequisite for shipping the confirmed fixes.

- Check primary release/migration documentation at execution time and select a fixed supported version.
- If compatible with the single-file/CDN/in-browser-Babel contract and testable in the current environment, implement in an isolated change after P15, adapting the verified worker loading for the new format.
- Test ESM bootstrap ordering, file:// CORS, text layout/quote fixtures, worker/fake-worker paths, cancellation, multiple documents, and print.
- Preserve all input/output contracts and isEvalSupported:false where supported.
- If compatibility or acceptance cannot be established, leave the working mitigated/pinned version intact and record a concrete deferred migration with the missing evidence.

**Done when:** either the supported version passes the complete PDF acceptance matrix or the migration is explicitly deferred with rationale. Never label an untested major upgrade complete.

### P18 — Final acceptance and release preparation

- Run all focused regressions and node verify-repo.js on the final canonical bytes.
- Run real-App storage/replacement races and Anki UI tests in isolated synthetic contexts.
- Perform actual Anki import/review in a disposable profile/deck using synthetic notes: plain and HTML modes, correct separator/mapping, cloze counts, literal entities, tags, references, and meaningful variants. If unavailable, record it as outstanding.
- Identify which changed ingestion/generation paths require live-material verification. Prepare exact material scope, model/settings, planned calls, retry bounds, and success criteria before requesting authorization.
- Any changed transcription prompt/resize constants would require two runs per card; this plan intentionally leaves them unchanged. Pairing/model-output changes still need the appropriate bounded acceptance required by CURRENT_STATE.
- Update README behavior, CURRENT_STATE evidence/open work, DEVELOPMENT tooling instructions, and CHANGELOG migration notes. Do not overwrite historical pilot results.
- Verify every script and worker pin against the selected CDN bytes. Confirm fail-closed fallback behavior.
- Publish/push/create a release only when explicitly requested. Local implementation complete, browser acceptance complete, live measurement complete, and published are separate statuses.

**Done when:** all confirmed implementation packages are verified; conditional/deferred or externally blocked acceptance is clearly reported; no claim of production readiness rests on an unperformed test.

## 5. Dependencies and safe parallelism

| Sequence | Work | Dependency |
|---|---|---|
| First | P00–P01 baseline/fixtures | None |
| Data durability | P02 | P01 |
| Ownership and sources | P03–P05 | P01; align with P02 identity definitions |
| Evidence semantics | P06–P08 | P01; P08 uses P05 captured contracts and P07 numeric results |
| Notes and exports | P09–P10 | P05/P08; retain encoding fixtures |
| Output security | P11 | P01 browser interception |
| Transport | P12 | P03 publication ownership |
| UI performance | P13 | P05/P09 correctness behavior |
| Tooling | P14 | P00; largely independent |
| Worker/dependency cleanup | P15–P17 | P01/P11; P16 follows changed lifetimes |
| Acceptance | P18 | All completed implementation packages |

Parallelize read-only review, synthetic fixture preparation, or isolated tooling edits. The shipped HTML is one shared file: use one writer at a time or isolated branches with explicit integration. Never let independent agents perform competing exact replacements in the same HTML. Require an independent review of persistence, numeric validation, and worker loading before final integration.

## 6. Required acceptance matrix

| Surface | Passing evidence |
|---|---|
| Persistence | Actual final stored snapshot survives reload; conflicting legacy data retained; current status correct |
| Async ownership | Old callbacks/finally cannot change current KB/output/controller/registry |
| Transcription | Removed source excluded twice: publication and build queue; pairing conflicts visible |
| Provenance | No old artifact resolves an ID against a different KB |
| Numeric support | Complete value/unit equality with documented exceptions; no false validated-value donation |
| Output structures | Invalid shape is inspectable without crashes; answer/packet references checked |
| Anki | Meaningful variants retained; single effective tier; plain/HTML rendered meaning preserved |
| Audit exports | Failure/incomplete/repaired/stale states survive every export without revealing answers early |
| Output security | No unapproved media/style requests in app or print; trusted application functions work |
| Transport | Completion explicit; malformed/partial responses identified; readers/timers/listeners cleaned |
| Performance | Linear collision rendering and fewer repeated computations, measured against same fixtures |
| Measurement tools | Offline imports/dry-runs; bounded valid arguments; inconclusive evidence not called success |
| PDF worker | Verified bytes in all execution/fallback paths; file:// and multi-document behavior verified |
| Release | Unified gate, browser evidence, migration docs, pin checks, and explicit publication authorization |

## 7. Execution ledger and handoff

Maintain this table as implementation proceeds:

| Package | State | Files/commit | Regression evidence | Browser/live evidence | Remaining risk |
|---|---|---|---|---|---|
| P00–P18 | Not started | — | Baseline: 904 assertions passed during review | No new acceptance performed by this planning task | See package gates |

Expand to one row per package. Allowed states: not started, in progress, implemented/offline verified, browser verified, awaiting scoped live acceptance, complete, deferred with rationale. Never mark a package complete merely because its code was written.

For each completed change report:

- What changed and which finding it resolves.
- Exact verification command and meaningful outcomes, including assertion total.
- Behavior/migration effects and any approval-dependent validation change.
- Remaining browser/live checks, with no implication they ran.
- Any intentionally deferred proposal and why.

The final handoff must list confirmed fixes separately from optional hardening and deferred major migrations. Existing private KBs may require rebuilding to recover previously merged facts, but only after the user scopes the material. Do not modify private data as part of repository remediation.

## 8. Reference decisions behind this plan

- Anki distinguishes plain and HTML field import; Tags follow their own parser. Preserve rendered semantics rather than forcing identical bytes: [Anki import manual](https://docs.ankiweb.net/importing/text-files.html), [importer implementation](https://raw.githubusercontent.com/ankitects/anki/main/rslib/src/import_export/text/csv/import.rs).
- Native fetch integrity verifies downloaded bytes: [RequestInit integrity](https://developer.mozilla.org/en-US/docs/Web/API/RequestInit#integrity).
- Iframe sandbox capabilities and network restrictions are distinct: [iframe sandbox reference](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#sandbox).
- DOMPurify does not by itself provide a CSS/resource privacy policy: [DOMPurify threat model](https://github.com/cure53/DOMPurify/wiki/Security-Goals-%26-Threat-Model).
- Recheck provider/dependency versions at implementation time. The reviewed app already uses stable Gemini 3.8 Flash and supported generateContent calls; this plan requires no model or API-family migration.
