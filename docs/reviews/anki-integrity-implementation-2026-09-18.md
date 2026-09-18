# Anki integrity implementation — 2026-09-18

The user approved implementing each item in the independent integrity report. The actionable changes are implemented in the current single-file application and covered by the unified verifier. This is an **unreleased working-tree change**: the canonical filename and visible version remain v16.6, while v16.7 comments identify the intended next release. No commit, push or release was requested or performed.

The two audit sets remain historical evidence and were not rewritten to make their characterization or semantic-limit expectations pass. The new implementation regression modules extract current shipped functions and handlers and run inside latte-tests.js.

## Disposition of every report item

| Report item | Implemented behavior / disposition | Regression coverage |
|---|---|---|
| A1 — parser loses negation or note identity | Retain nonblank physical lines, raw fields and original addresses. An unpiped fragment and neighboring note remain structurally ineligible until a deliberate Text repair. Search across blank/whitespace lines, without moving the physical ledger address. Tags/Extra edits cannot clear the boundary. | Parser cases, detached prefix/suffix, CRLF, truncated fence, source ledger, actual edit handler and export |
| A2 — lossy import/restore | Preserve complete strings. External count limits reject with an exact path instead of clipping tails; 25 MiB file limit remains. Restore bypasses external count limits, retains saved identifiers/extensions, and validates saved structure instead of guessing. Empty saved KB restores. | Long terminal exception/quote, every bounded collection, actual save/reconcile/restore, actual import and hydration |
| A3 — minus/unit comparison | Normalize mathematical minus without losing sign. Consume exponent-bearing units completely, then compare or report an unsupported form; cm²/cm³ cannot match a cm prefix. | Changed and faithful signs, square/cubic units, valid denominators and warning-only export |
| A4 — visible hints | Compare numeric hints separately as advisory evidence. Per-note and batch statistics distinguish revealed tokens and hint tokens. | Supported/unsupported hints, hint-only counting and continued export |
| A5 — malformed later chunk | Validate nested primary structures within the per-chunk recovery boundary. Preserve successful chunks and exact malformed responses. If every chunk fails, retain downloadable failure diagnostics without publishing a KB. | Real build with mixed successful/malformed chunks, all-failed build and diagnostics UI/download |
| A6 — malformed omission response | Require the missed array and valid nested entries. Mark a malformed omission pass failed, preserve primary facts and raw audit response, and distinguish valid-empty from failed/truncated/not-run. | Absent/null/object arrays and malformed nested entries, valid-empty control |
| A7 — fabricated primary pointer | Bind each primary fact to the actual file/chunk range. Preserve the original model pointer beside the runtime binding in diagnostics. | Missing and fabricated model pointer, published KB and diagnostic provenance |
| A8 — zero-check green claim | Show checked/matched/unverified/missing counts. Positive styling requires at least one check and no missing/failed anchors. Explain that located words do not prove the fact's meaning. | Denominator summary and actual diagnostics binding |
| A9 — non-card STOP success | Record unusable or review-required output and per-chunk missing-note diagnostics, retaining raw response and truthful source accounting. Only usable, untruncated output receives Complete. | Actual generation handler: non-card response, invalid records, valid control |
| N1 — final normalization duplicates | Perform a second exact dedupe after proven alias normalization. Preserve original note IDs, per-note source associations, locations, parse records and normalization history. Different Keep choices, fields/tags and invalid notes remain separate. | Real generation order, canonical/alias collision, source unions and downloadable provenance |
| N2 — edited associations | Keep documented associations. Text/Extra changes visibly request link review; applying reviewed links records the manual acknowledgement. No-op edits/clean acknowledgements preserve identity; earlier checker captures remain outdated after actual changes. | Actual edit/link handlers, currentness, repeated acknowledgement and immutable source counts |
| N3 — invented enum defaults | Reject invalid tier or bucket with an exact field error; accept legitimate numeric-string tiers. Never infer clinical priority from the safety flag. | Invalid/missing enums and valid-string controls |
| MAXTOK | Preserve partial supported notes and the original warning, with Partial generation status in logs, UI and saved diagnostics. | Actual truncation handler, positive complete control and export callback |
| QUOTE_PREFIX | Apply the approved bounded numeric-edge rule in both plain and dehyphenated quote matches; search later complete occurrences. Classify a partial-number anchor separately. Primary misses remain advisory; omission misses follow existing discard policy. | 60 versus600, both edges, legitimate substring, later occurrence, dehyphenation, primary/omission behavior |
| PROBE | Preserve optional quality/composition failures as diagnostics-unavailable warnings without suppressing usable extracted text. | Injected helper/page-probe failure and diagnostic serialization; ordinary failure rate remains unmeasured |
| REPAIR_DEDUPE | Keep repaired notes until the user explicitly clicks Merge exact duplicate notes. Merge only valid equivalent fields/tags/Keep, retaining provenance and source-review state. | Actual manual repair, explicit merge, stale-source guard, different choices and fields |
| FACT_RENUMBER | Imports establish fresh identity; browser restore preserves saved fact IDs. Existing source ownership, registry clearing and stale export guards remain. Reports retain captured snapshots and original note locations. | Restore identity plus actual source-replacement/publication controls |
| OPERATOR | Preserve WARN-only operator disagreement and asymmetric primary/omission policy. No new clinical correction or comparator gate. | Existing operator gates plus the new actual-build warning-retention control |
| EXPORT | Preserve Text|Extra|Tags and current selection/escaping. Add explicit note provenance only to private diagnostic reports, not deck fields. | Existing export/preview controls, new boundary/hint/manual-merge cases, actual download callbacks |
| MISSING_LEAF | Preserve public receipt validation and separate unmapped/disputed applicability states; absence of a heuristic warning is still not approval. | Existing receipt/queue suites remain passing |
| POISONED_KB | Preserve original facts and explicit evidence boundaries. UI now states that a mistake already in the captured KB can survive its downstream check; quote diagnostics no longer claim a reading-order miss proves a fact sound. No automatic semantic rewrite is introduced. | Existing semantic-limit fixtures remain limitations, not a promised deterministic clinical oracle |
| SUGGESTION | Display proposed edits as not applied. Keep manual Fixed meaning explicit and preserve all no-auto-edit/currentness controls. | Existing source-check/manual-decision suites and actual lifecycle regressions |

## Recovery and evidence details

Strict restore rejection must not strand saved data. An invalid saved record remains available as an exportable/inspectable recovery copy. Saving pauses while choices remain. The user can import corrected data or build a replacement, then explicitly select Use current workspace. Preserved copies are archived before publication and before saving resumes; archive/validation failures keep them available.

Merged provenance is retained in live notes and in both private download paths. The shared projection copies only named evidence fields, so adding merge history does not serialize configuration or source object references. Original generated responses and normalization outcomes remain distinct from current edited notes.

The checker still cannot certify source entailment or clinical correctness. Source links remain associations; manual acknowledgements remain manual. No new model call, generation pass, runtime dependency, prompt edit or semantic export gate was introduced. Numeric, operator, mapping and review warnings remain advisory.

## Verification

Executed from repository root:

~~~text
node verify-repo.js
~~~

The final command was captured as:

~~~text
node verify-repo.js > 'scratch/anki-integrity-implementation/verify-final.txt' 2>&1
~~~

Result: **exit 0, 2,820 passed / 0 failed**, all 11 frozen prompt hashes, generated prompt documentation, LF/version checks and full JSX Babel transform. The expected assertion total was deliberately increased from 2,564 to 2,820; no gate was disabled.

Added live-code modules:

| Module | Assertions |
|---|---:|
| tools/anki-integrity-source-regression.js | 51 |
| tools/anki-integrity-import-regression.js | 72 |
| tools/anki-integrity-transform-regression.js | 67 |
| tools/anki-integrity-lifecycle-regression.js | 54 |
| tools/anki-integrity-evidence-regression.js | 12 |
| **Added** | **256** |

Three existing extraction/wording assertions were updated for the new quote denominator, numeric-boundary reason, and explicit composition-error capture. The probe-before-cleanup ordering assertion remains. The normalization diagnostic test supplies the newly required provenance projection and current-card input to the actual download expression.

Independent review identified and closed additional gaps before acceptance: blank-separated qualifier loss, rejected-restore recovery access, missing downloadable merge provenance, hint-only count reporting, and all-failed raw extraction diagnostics.

[Machine-readable implementation verification](anki-integrity-implementation-results.json) records the final file hashes, command/output, assertion totals and historical audit preservation checks.

**Limits:** no live Gemini call, private source material, native PDF/PPTX decoding, native IndexedDB, browser event-interleaving test or native Anki import/render was run. The repository Playwright/Chrome acceptance tooling was unavailable. Synthetic handler tests do not establish real-model quality or clinical accuracy. The published v16.6 download is unchanged; this implementation is not a new release.

