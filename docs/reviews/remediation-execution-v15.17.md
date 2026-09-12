# v15.17 remediation execution ledger

Implementation requested 2026-09-11. Source plan: the user-supplied `codex-remediation-plan-v15.17.md` (the Downloads copy was read first).

Baseline: HEAD `549ee927c2d362e01facbc5741ee8df9c48112df`; one canonical `Nursing-Study-Suite v15.17.html`; 904 assertions; all eleven prompt hashes, generated prompt documentation, LF/version and Babel gates passed. The pre-existing untracked `docs/reviews/` documents are preserved. No private inputs or live Gemini calls are authorized by this implementation.

Version strategy: implementation was measured as local v15.17. The user subsequently requested commit and publication, so the release is v15.18 with the existing v15.17 tag/asset preserved. Release metadata and generated prompt-document version are updated; all script and worker pins are reverified.

Validation contracts retained: worksheet MCQ four-option and SATA five-to-six-option counts warn; missing optional/support/citation fields retain existing warnings; Test Plan Alignment warns; threshold instantiation outside bounds warns while absent threshold support errors; Anki numeric/style/collision findings advise only; case source quotes may supply numeric support; Anki has its separate quote-only advisory policy. Plain Anki fields remain literal; headered Text/Extra escape HTML and Tags remain plain.

| Package | State | Evidence / remaining checks |
|---|---|---|
| P00 | complete | Baseline verifier passed, 904 assertions; unchanged prompt baseline |
| P01 | browser verified | Real App on isolated origins, controlled asynchronous storage/Gemini, context-wide request interception; 14 fixture self-tests |
| P02 | browser verified | 17 extracted storage assertions plus actual Chrome empty/legacy/conflict/reload/import-during-hydration/ordered-save/tombstone/concurrent-writer/unmount scenarios; additional fallback-conflict guard reviewed |
| P03 | browser verified | Shared build/import ownership, synchronous Priority guard through streaming, owner-only teardown; reversed imports and Priority reset exercised in Chrome |
| P04 | implemented/offline verified | Current photo IDs filter both transcript publication and card build inputs; identity disagreements/incomplete comparisons block intake; 17 combined ownership/photo assertions |
| P05 | browser verified | Immutable case/worksheet source snapshots, cancellation on replacement, stale badges, source-checked registry; same-ID replacement and original-source Markdown export passed in Chrome |
| P06 | implemented/offline verified | Whitespace-only fact/condition identity preserves Unicode and case; true duplicates retain source unions |
| P07 | implemented/offline verified | Complete signed value/unit and BP tokens; per-record evidence; 21 follow-up unit/optional-field assertions and 24 neutral-weight assertions. The calculation exception cannot override supplied pounds or exempt unrelated datum labels; no weight conversion was added. Threshold/missing-citation policy retained; independently reviewed |
| P08 | browser verified | Safe invalid-case raw inspection; exact frozen worksheet packet, explicit concept citations, answer/shape/shortage checks and validation before repair publication; 65 new assertions; actual worksheet malformed/out-of-packet repair rejection passed |
| P09 | implemented/offline verified | Equivalent valid Text/Extra/effective-tags/keep only; one complete effective tier; plain/HTML encoding fixtures retained; actual Anki acceptance outstanding |
| P10 | browser verified | Shared worksheet/case export notices, including JSON Copy, carry audit status, failed/repaired outcomes, staleness and requested/actual counts without answer details. Six actual worksheet browser scenarios passed: cancellation, prior verdict retention, quota interruption, N/A-only batches, malformed and ungrounded repair rejection. Case JSON copy retains original fields plus review metadata |
| P11 | browser verified | Narrow output markup policy, DOMPurify 3.4.15 on both pinned CDNs, resource CSP and print sandbox; app/popup/iframe interception and intentional CSP probe passed. Native print-dialog/layout acceptance remains outstanding |
| P12 | implemented/offline verified | 39 extracted transport assertions: event/UTF-8 boundaries, malformed/incomplete EOF, terminal reasons, retry/abort/cleanup, HTTP metadata and permanent-failure batch stop |
| P13 | browser verified | 18 regressions and matched browser fixtures. A 315-note single collision group fell from 99,225 to 315 members; unchanged original diagnostics no longer rerun per edit. 315/1,000/3,000-note small-group measurements are recorded separately; no universal speed claim |
| P14 | complete | 126 offline tooling assertions, import guards, strict arguments, dry-run/live opt-in and honest incomplete measurements; no live execution |
| P15 | browser verified | Native fetch integrity, verified Blob worker and explicit shared PDFWorker port; 33 resource assertions; vendor ownership independently reviewed; all five real Chrome PDF/card groups passed including actual file:// startup, corrupted bytes/fallback/retry, CSP startup failure, multi-document lifetime and cleanup |
| P16 | implemented/offline verified | Removed unreferenced kbAllFacts and nclexDedup; original duplicate/distinct assertions now call the production accumulator. PDF lifetime bookkeeping now has a real page owner and is retained |
| P17 | deferred with rationale | PDF.js v6.3.289 is available, but ESM/file startup and real layout/quote equivalence are not established for a major upgrade. Retain 3.11.174 with isEvalSupported:false and verified worker; major migration is not needed for confirmed fixes |
| P18 | awaiting scoped live acceptance | Final unified gate: 1,345 assertions, all frozen prompts/docs/LF/version/Babel pass; git diff --check passes. Browser/worker/performance evidence and all eight script pins plus both worker pins verified. Local implementation is complete; native Anki import controls failed in the isolated attempt, and selected live materials/native print acceptance remain outstanding |

## Verification evidence and changed files

The shipped implementation is entirely in `Nursing-Study-Suite v15.18.html`; the original browser measurements below used its v15.17 pre-release name. `latte-tests.js` invokes the new extracted-source regression modules in `tools/`, with an enforced assertion total. `davis-transcribe-test.js`, `neia-retest.js`, `tools/repo-checks.js` and `tools/render-prompts.js` contain tooling changes. README, CURRENT_STATE, DEVELOPMENT and CHANGELOG document current behavior while retaining the historical published-release evidence.

Pre-release measured application SHA-256: `924accd6eb97d58728d83cd58617451ef569d7dde6cf88462e35630fa406fee5`. The gate grew from 904 to 1,345 non-vacuous assertions. `prompt-baseline.json` has no diff; the only release update to `Prompts.md` names v15.18; dynamic generation prompts, card transcription prompt and resize constants were separately compared with HEAD and retained.

- `node verify-repo.js`: canonical-file, LF/version, eleven frozen prompt hashes, generated prompt appendix, full regression harness and JSX Babel transform.
- `node tools/remediation-browser-tests.js --self-test`: 14 offline isolation assertions.
- `node tools/remediation-browser-tests.js --output-policy`: actual App storage/replacement/source/Anki/output tests in disposable Chrome contexts.
- `node tools/remediation-worksheet-browser-tests.js`: six completed actual-App worksheet audit/cancel/repair scenarios.
- `node tools/remediation-pdf-browser-tests.js`: five actual Chrome PDF/card acceptance groups.
- `node tools/remediation-anki-performance.js <count> <single|small>`: matched actual-browser collision and edit measurements.

Reproduction settings, exact scenarios, limitations and measurements are in [browser validation](remediation-browser-validation.md) and [resource validation](remediation-resource-validation.md). Browser tools use an existing external Playwright installation; no application dependency or build pipeline was introduced. Ordinary repository verification remains offline.

## Persistence migration

Internal IndexedDB metadata is a companion `active-save-v2` record committed with the raw `active` KB. Fallback records use one atomic `latte_knowledge_snapshot_v2` value; legacy raw localStorage data remains readable. Raw JSON exports are unchanged. Conflicting legacy copies are never ranked by dates, size, or store. A choice archives both candidates before overwriting active data. Save jobs serialize; deletes are ordered tombstones; a compare-and-set transaction detects other browser writers and pauses instead of asserting last-writer correctness. Export the active KB and recovery copies before downgrading: older versions cannot understand v2 fallback/tombstone metadata and must not be used to reconcile storage.

Independent review caught and corrected recursive save-metadata growth, a recovery choice overwriting a later import, and concurrent fallback writers. Old callback cleanup checks the captured fallback, invalid envelopes preserve existing bytes, and current status follows the requested mutation. This is single-browser persistence, not multi-device synchronization.

Independent evidence review also caught a missing-supportType warning inadvertently suppressing otherwise proven datum reuse, and unsupported compound-unit suffixes donating shorter known prefixes. The correction preserves optional-field warnings and checks the same complete-unit boundary in output and source evidence. Case quota-stop status remains interrupted after final generation cleanup, as it does for worksheets.

## Dependency evidence (2026-09-11)

All eight existing script pins matched their selected CDNs before editing. Both new [DOMPurify 3.4.15](https://github.com/cure53/DOMPurify/releases/tag/3.4.15) CDNs served identical 29,369-byte files, SHA-384 `uUMu9JDY09vBzRf9SPcK2VgUj+W/70J6Soc+Dded5P474ElQ63iv9j5N3DE7Kp3N`. The separate PDF.js 3.11.174 worker resources served identical 1,087,212-byte files, SHA-384 `SnzOobpRMLXZ52iJvZm/C0fYw0OQemTXzTjIsdsfMcrCtCEe9qgzxTd3RSklO5x2`.

The [PDF.js v3.11.174 source](https://github.com/mozilla/pdf.js/blob/v3.11.174/src/display/api.js) confirms that an explicit worker port takes `_initializeFromPort` instead of the fake-worker loader, and `getDocument` owns/destroys a worker only when one was not supplied. The [v6.3.289 release](https://github.com/mozilla/pdf.js/releases/tag/v6.3.289) is recorded for the deferred major migration; it was not installed or presented as validated.

## Outstanding external acceptance

No live Gemini generation, private course-file inspection, or actual Anki import/review was performed. The transcription prompt, image resize constants, dynamic generation prompts, mapping adapter, model profiles, thinking settings and output ceilings remain unchanged. Source pairing and changed generator validation still need a bounded run against explicitly selected materials; choose that scope before computing/authorizing the exact logical operations and retry ceiling. Recovering facts already lost by older deduplication requires a separately scoped rebuild; these fixes cannot reconstruct them.

Anki 26.5 was opened in a new disposable base, but the native file picker repeatedly returned a stale cached-element error, and the supported file-open handoff produced a blank import window. The instance was closed; no existing profile or deck was inspected. Neither synthetic fixture was imported. [Resource validation](remediation-resource-validation.md#anki-desktop-acceptance-attempt) records the exact errors and expected three-note/six-card checks, without claiming actual rendering or counts. README now explains the duplicate-import setting needed to preserve equal-Text variants.

Live acceptance must name the particular source files/KB and selected profile before a run is requested. The affected paths are photo identity/pairing and removal through ingestion, Unicode-preserving extraction/merge with quote verification, and worksheet/case output parsing, grounding and repair. Success criteria are preservation of source identity and meaningful facts; valid complete citations/value units; expected question counts or honest shortages; and retention of deterministic/audit limitations in exports. A scoped plan must include extraction/verification batches, generation batches, eligible MCQ audit calls, possible single-round repairs and each path's existing retry ceiling. No exact call count is asserted without that scope. The CLI dry runs prepare bounded transcription/item-audit plans without reading payloads or consuming quota.

Confirmed defect corrections are distinguished from defense in depth: the output-resource CSP/sandbox and independently pinned worker add browser protections beyond correcting storage, lifecycle, evidence, export and transport bugs. P17 is the sole deferred implementation proposal; native print acceptance, actual Anki review and selected live-material measurements are separate unperformed acceptance work. Publication was separately authorized by the user; it does not establish completion of these unperformed checks.

## v15.18 release handoff

The version bump changes only the HTML release-history comment and displayed harness assertion total, plus the canonical filename and release documentation. Runtime code and prompt bytes match the browser-tested implementation. Release HTML SHA-256: `e3d2bb379147925ba237eaf054949db83a7db5e16e00b3de2397f6ad18887ab1`. The unified verifier passed all 1,345 assertions and every other gate on the release bytes before the commit. All eight script resources and both worker CDN copies matched their SHA-384 pins again at 2026-09-11 20:04 EDT; the release bump leaves that manifest unchanged. Release/tag: [v15.18](https://github.com/nursingschooltingz/Nursing-Study-Suite/releases/tag/v15.18).
