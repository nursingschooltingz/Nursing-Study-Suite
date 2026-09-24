# Current maintainer state

## v17.5 license line (2026-09-24)

The canonical application is `Nursing-Study-Suite v17.5.html`. The only change from v17.4 is the "GPL-3.0 licensed" link beside the version in the rail footer. The user has frozen the suite here for the semester; open items (R08, PDF.js ESM plan, inline styles, assertion bookkeeping) are deferred by choice.

## v17.4 second production-review fixes (2026-09-24)

The canonical application is `Nursing-Study-Suite v17.4.html`. A second review (recorded in [production-review-2026-09-24.md](docs/reviews/production-review-2026-09-24.md)) reported eight Medium and four Low findings; all twelve were checked against the source before implementation. Ten held, R02 was overstated (the two reads it describes are synchronous and cannot interleave in a browser) and R11 is test-only. v17.4 implements R01–R07 and R09–R12 and hardens R02; R08 (PDF ingestion budgets) is deferred until limits are chosen from measurements.

- **Calculation disclosure (R01).** A Calculation answer with no supported equation in its rationale gets a warning that reaches every export; the bounded verifier is unchanged and nothing is promoted to an error.
- **Fallback hydration (R02).** `kbReadFallbackSnapshot` returns the parsed records and the exact bytes from one read; the hydration effect and the save queue baseline use the same bytes. The two existing hydration harnesses compile the effect with the new function.
- **NCLEX extraction (R03, R05, R06).** `nclexMergePairs` unions the regex and model pairings by question number; `nclexAdmitRecord` rebuilds each record from typed, bounded fields; a run tracker feeds `nclexRunSummary`, shown in the results view and written into the Markdown, text, PDF and copy exports.
- **Batch halting (R04).** `geminiHaltsBatch` is the one rule for the Knowledge Base build (both lanes), the Priority harvest, both NCLEX extraction modes and the NCLEX generator: cancellation, a deferred retry, a 429 after the transport's retries or a permanent HTTP failure stops the run and keeps what was extracted. A stopped Knowledge Base build commits nothing, like a cancelled one, and names the chunks attempted and never sent.
- **Anki factless guard (R07).** `kbUsableFactCount` runs before the deck is cleared or a packet is built.
- **Priority (R09, R10).** Streamed text survives any failure with an incomplete notice; `paParseOverlap` accepts zero.
- **Harness (R11).** The browser fixture releases its loopback server on every failure path.
- **Dependencies.** DOMPurify 3.4.16 on both CDNs; the app never uses the in-place mode the advisories require.

Verification: **3,427 assertions passed, zero failed** (67 added: 59 in `tools/review-r-findings-tests.js`, 3 build-halting scenarios, 3 Priority scenarios, 2 export-summary assertions); all eleven frozen prompt hashes, regenerated prompt documentation, LF/version checks and the full JSX transform; the six Playwright runners (visual 78 checks, remediation 17 scenarios, case remediation 12, Anki quality 25 checks, Anki source review, production recovery 4) all passing on the final bytes; eleven pinned CDN entries re-hashed with the two DOMPurify pins new and the rest matching; real-browser checks of the boot, the zero overlap and the factless Anki refusal with zero requests. See the [release verification record](docs/reviews/v17.4-release.md). Still open: R08 (PDF ingestion budgets, measured change), the inline-style migration, the harness assertion-total bookkeeping, and the PDF.js ESM migration plan.

## v17.3 production-review fixes (2026-09-23)

The canonical application is `Nursing-Study-Suite v17.3.html`. The [2026-09-23 production review](docs/reviews/production-review-2026-09-23.md) found one High, six Medium and twelve Low items; v17.3 implements plan steps 1–3 and 5–10 and withdraws step 4 and finding 16.

- **Settings focus (finding 1, verified v17.0 regression).** The drawer's entry-focus effect re-ran on every `App` render and stole focus into the API key field. It is mount-only with the close callback read through a ref, and `closeSettings` is memoized. `tools/settings-focus-tests.js` compiles the shipped drawer with the browser's Babel build and fails against the v17.2 bytes.
- **Render work (finding 3).** The KB study view and the Priority tiers memoize their sanitized HTML, `activeTool` left the config context, and the six tools are `React.memo` components. The browser runner counts real `marked.parse` calls while typing the API key and switching tools and requires zero.
- **Persistence witness (finding 2).** `meta.digest` (cyrb53, two seeds) replaces `meta.bytes`; legacy records verify by bytes and migrate on their next save; both stores hold the KB once. `tools/persistence-digest-tests.js` covers both witnesses, mismatches, fallback reads, save size and tombstones.
- **Links (finding 6).** Sanitized study links open in a new tab with `rel="noopener noreferrer"`.
- **Build lanes (finding 4).** Opt-in second lane for the Knowledge Base build with chunk-ordered assembly (`kbRunLanes`, `kbCompareOrder`). The source-regression harness proves a two-lane build publishes the same Knowledge Base as a sequential one with identical fact numbering. The live wall-clock gain is unmeasured (no Gemini calls were made); the synthetic runner shows the expected overlap. Priority, NCLEX and Anki remain sequential.
- **Finding 5 withdrawn.** A 1-second boot timer with a 2.9 s compile produced no false error: the Babel compile is synchronous inside DOMContentLoaded, so a pending timer cannot fire during it. No change.
- **Settings (findings 8, 9).** Model names, the manual switch and both manual levels persist under `latte_model_settings_v1` with per-field validation; saved profile rows are validated. Shipped defaults live in `MODEL_SETTINGS_DEFAULTS`, which `tools/repo-checks.js` and `tools/anki-pilot-spec.js` read. `tools/settings-persistence-tests.js`.
- **Remaining Lows (findings 7, 10, 13, 14, 15, 17).** Lazy Anki diagnostics JSON; recovery archives pruned to the newest five (archive first, prune after); hoisted Anki numeric regexes and per-fact token cache; file-identity keys for card conflicts; additive `extractJSON` fallbacks; `AnkiGenerator` refs synced in an effect. `tools/review-low-findings-tests.js`. Finding 16 withdrawn (the nested-run rejection is the v16.7 amplification guard).
- **Consolidation (findings 11, 12).** `useCappedLog`; one NCLEX adapter constant; 1,747 bytes of dead CSS removed. Not consolidated, deliberately: the decimal normalizers and unit vocabularies (separate harness extraction sections; identity guards added instead), the three HTML escapers (boot script isolation and Anki CSV/HTML export bytes), the abortable-promise helpers and the three focus-block builders (different prompt wording). The 483 inline styles were left for a presentation pass.
- **Dependencies (finding 19).** React 18.3.1 with fresh SRI; Babel 7.29.9 measured (no gain) and not adopted; PDF.js ESM migration planned in `docs/reviews/pdfjs-esm-migration-plan-2026-09-23.md`. cdnjs also lists JSZip 3.10.2, marked 18 and PDF.js 6.3; none is required by a finding.

Verification: **3,360 assertions passed, zero failed**; all eleven frozen prompt hashes, prompt documentation, LF/version checks and the full JSX transform; the Playwright visual runner at 360/768/1024/1440 px including the new checks, plus the optional Anki, recovery and remediation runners (one remediation expectation that predated the v17.1 shuffle advisory was corrected); ten pinned CDN resources re-hashed, the two React pins new for 18.3.1 and the other eight matching without edits. See the [release verification record](docs/reviews/v17.3-release.md). Still open from the review: the presentation-only inline-style migration (finding 12, second half), the harness's exact assertion total (18), and the PDF.js ESM migration (19, planned).

## v17.2 release (2026-09-23)

The canonical application is `Nursing-Study-Suite v17.2.html`. This release publishes the case-generator remediation and follow-up fixes developed as v17.1. The user confirmed the generator is working and requested publication as v17.2. Release preparation changes version labels, canonical filename, documentation and download links; it adds no generation behavior or model calls. The [release verification record](docs/reviews/v17.2-release.md) records the gates and asset identity. Source-grounding and clinical-review limitations from the implementation record remain applicable.

## v17.1 case remediation development (2026-09-23; shipped as v17.2)

The development application was `Nursing-Study-Suite v17.1.html`; its release filename is now `Nursing-Study-Suite v17.2.html`. The approved consolidated plan's software packages A–E are implemented: honest repair acceptance/publication, complete range and unit parsing, stem/title grounding, bounded exact calculations, stable option randomization, and consistent review/assumption exports. The generation and repair builders gain source-qualification guidance; all eleven frozen constants remain byte-identical.

The [implementation record](docs/reviews/case-remediation-v17.1.md) distinguishes deterministic and synthetic browser evidence from clinical source review. The user authorized the `Testing/v16.2 tests` folder; it contains KB JSON files and captured quotes, but no original PDFs or generated case exports. The TCA treatment concern is already present in its captured quote, while the Dermatitis quote contains a qualified childhood association. Original-page verification, correction of the absent case files, classification of their 44 timing warnings and any live regenerated-output measurement remain open. No private KB or generated course output belongs in Git.

The v17.1 development label was not published as a GitHub release; these changes ship in v17.2.

Follow-up: a newly supplied case reproduced two false validation errors: a supported pound value and numbered prose misread as liters. Pound aliases now normalize explicitly and bare g/L require a letter boundary. Private replay against the app-normalized authorized KB changes 2 errors / 21 warnings to 0 errors / the identical 21 warnings; this does not certify clinical content. The original export remains unchanged. The focused regression additions cover aliases, thresholds, ordinary prose, real units, unsupported tails and evidence mismatches. See the implementation record for verification and remaining content review.

Second follow-up: another export exposed missing length/time units and the first-range-only threshold parser. The shared validator now recognizes cm/mm and seconds/minutes/hours/days/weeks with explicit aliases, in data and prose alike, and inspects all explicit bounds without unit conversion. Latest private replay changes 2 errors / 14 warnings to 0 errors / the identical 14 warnings. The broader coverage supersedes the earlier export's zero-error result: it now flags one rationale whose time value is labeled directly sourced but is absent from its cited fact. That original output remains unchanged and requires source-based revision. There is no OB-specific validation path; these examples exercise gaps in shared measurement coverage. All 3,273 assertions and repository gates pass; frozen prompts and severity rules remain unchanged.

Third follow-up: the next supplied case parses all units but reproduces two rationale errors / 20 warnings. One explanation repeats a rejected option's unsupported number; another assigns that number to an alternative clinical context absent from its citation. The unfrozen generation and repair builders now explicitly require explanations based on the actual cited rule, without treating distractor values as evidence or relabeling them to bypass validation. The validator and audit gate are unchanged. A private corrected copy revises the two rationales (including one citation), then uses the app's once-only option shuffle: zero errors, the original 20 warnings and six option-order advisories. It is not linked to an open app session and has no live item audit. All 3,281 repository assertions pass; prompt adherence on future live generations has not been measured.

## v17.0 interface overhaul (2026-09-19)

The user asked for a complete interface overhaul rather than another palette pass, and explicitly
granted permission to restructure the presentation layer. The canonical application is
`Nursing-Study-Suite v17.0.html`. This is a presentation-only release: no study logic, prompt,
validation tier, storage key or export format changed.

The shell is now a workflow rail — Source / Plan / Practice, the same six tools numbered `01`–`06`
with extraction and generation still separate — beside a compact workspace header and a
setup-beside-results workbench. Settings moved out of its permanent 292px column into a dismissable
right-hand drawer, which is what freed the bench to split. Every tool gained numbered required
steps, collapsible secondary configuration that reports its value while closed, a results headline
carrying the export actions, and an empty state naming the next useful action. One stylesheet now
defines the tokens, type roles, surfaces and control states; blue carries navigation and structure,
orange is the accent and the one important action per stage and never paints a status surface.

Verification: **3,050 passing assertions / 0 failed**, all eleven unchanged frozen prompt hashes,
prompt documentation, LF/version checks, full JSX transformation, and all ten CDN pins rechecked
live without edits. Isolated browser acceptance passes at 360, 768, 1024 and 1440 px with no live
API calls, plus ten further browser runners.

Three findings were caught by those acceptance runs and fixed: the first drawer implementation's
scrim blocked the workspace, moving run logs behind a collapsed disclosure also hid their failure
lines, and a stage group in the narrow-width tool strip could shrink below its content and lay the
next group on top of the previous tool's label. All three are recorded, with everything that was
**not** tested, in the [interface verification record](docs/reviews/v17.0-interface.md).

## Anki source-check label drift, closed (2026-09-19, post-v17.0)

`tools/anki-source-review-browser-tests.js` had been failing since **v16.7**, not because of the
interface release. It waited for `Suggested correction:` — the label v16.1 shipped. v16.7 remediated
data-integrity finding **SUGGESTION**, "display proposed edits as not applied", by renaming it to
`Proposed edit to review — not applied:`, because the old wording implied the checker had already
rewritten the note. The runner was never updated.

The app's label is the intended one, so the test was corrected, not the application. **The shipped
HTML is byte-identical to the published v17.0 release**; only test files changed.

The real defect was coverage: that trust label lived only in an optional browser runner, so it
drifted through two releases with `node verify-repo.js` green. The mandatory gate now owns it —
`tools/anki-review-evidence-tests.js` asserts the unapplied-proposal wording is present and the
pre-remediation wording is gone, and that assertion fails against the v16.6 bytes. The runner's
hard-pinned `suiteVersion` literal, still `'16.9'` a release later, now reads the shipped version
instead. All twelve browser runners pass.

## v16.9 review follow-up release (2026-09-19)

Two independent reviews of the shipped v16.8 build found twelve defects; all twelve are fixed, and the
user then explicitly requested committing, publishing and updating the releases page. The canonical
application is `Nursing-Study-Suite v16.9.html`; the release asset is `Nursing-Study-Suite.v16.9.html`.
One defect is in code v16.8 itself changed (a cancelled comparison left an earlier card transcript
buildable); the other eleven are older.

Highest-impact: a legitimate per-minute bound followed by prose was refused as an unsupported
compound unit, so a correctly grounded case reported a grounding error and skipped its optional item
audit; and the A–F option marker collided with the Fahrenheit abbreviation, which either erased a
question's whole choice list or fabricated a sixth choice while deleting the unit from the export.

Verification: **3,045 passing assertions / 0 failed**, all eleven unchanged frozen prompt hashes,
prompt documentation, LF/version checks and full JSX transformation. The 71 added assertions extract
live functions and fail against the pre-fix bytes. Frozen prompts, model defaults, warning tiers and
dependency pins are unchanged. See the
[follow-up fix record](docs/reviews/review-followup-fixes-2026-09-19.md) for the per-defect table,
two withdrawn first attempts, the differential sweeps and remaining limits.

## v16.8 production-review release (2026-09-18)

The user authorized implementing the [production review](docs/reviews/production-review-2026-09-18.md), then explicitly requested committing, publishing and updating releases. All thirteen actionable findings are addressed, plus a file-picker lifetime defect discovered during native browser acceptance. The canonical application is `Nursing-Study-Suite v16.8.html`; the release asset is `Nursing-Study-Suite.v16.8.html`. See the [release verification record](docs/reviews/production-v16.8-release.md).

Case grounding now rejects unsupported compound-unit prefixes. NCLEX chunking preserves source coverage and all A–F choices. Saved-KB recovery preserves readable and damaged copies, archives them before saving resumes, and requires restored storage access plus reload when bytes cannot be read. Failed card reruns retain earlier transcripts for inspection while blocking their use as current evidence. Priority captures its source, cancels obsolete work, reports partial/truncated harvests in exports, and avoids synthesis without usable evidence.

Anki mounts up to 50 notes per page in all three views while checks and exports retain their full-deck scope. Style caching, count-only duplicate detection and lazy recall indexing remove edit-time work. PPTX extraction has byte/text/reference budgets and cancellation checks; print previews discard opener authority; long provider retry floors are surfaced without an early automatic retry. Privacy and source-limit documentation reflect actual behavior.

Verification: **2,974 passing assertions**, full JSX transformation, prompt documentation and all eleven unchanged frozen prompt hashes; 34 focused resource/transport assertions including actual JSZip; 47 reported synthetic browser checks across Priority, Anki, recovery, cards, persistence, operation ownership, source replacement and output policies. At 1,000 notes, the post-fix median Extra-edit measurement was **97 ms** across three runs, versus one pre-fix observation of 801 ms on this host. These are instrumented synthetic measurements, not clinical, live-provider or cross-device acceptance. See the [implementation record](docs/reviews/production-fixes-2026-09-18.md) for exact scope, reproducible commands, performance observations and remaining limits.

No live Gemini calls, private-material testing or native Anki import were performed during implementation. Frozen prompts, model defaults, warning tiers and runtime dependencies remain unchanged. Existing study export formats are preserved; Priority exports gain source/completeness notices and card failure receipts gain explicit latest-attempt metadata. The prior release sections below are historical checkpoints.

## v16.7 text-only Anki integrity release (2026-09-18)

The user approved implementing the [independent re-audit](docs/reviews/anki-integrity-reaudit-2026-09-18.md), including its bounded policy changes. The user subsequently authorized committing and publishing these changes as v16.7. The canonical application is `Nursing-Study-Suite v16.7.html`; the release asset is `Nursing-Study-Suite.v16.7.html`. This checkpoint supersedes earlier descriptions of parser filtering, import truncation/defaults, exact-dedupe ordering, numeric-hint scope and quote admission below; the named release sections remain historical evidence.

- **Preserved source and saved data.** Full source strings survive import; collection limits and invalid tier/category values produce explicit errors instead of truncation or guessed priorities. Recoverable invalid import rows retain dropped-row notices. App-created saved KBs restore without import caps or rekeying; malformed saved records remain inspectable/exportable with saving paused. Choosing a saved copy or the current workspace archives preserved copies before saving resumes.
- **Chunk recovery and source attribution.** Nested extraction/omission envelopes are checked inside per-chunk recovery. Failed neighbors cannot discard successful chunks; an entirely failed build preserves the current KB and retains raw failure diagnostics. Primary pointers are bound to the actual file/chunk with original model pointers retained. Optional quality/probe failures are disclosed.
- **Quote accounting and bounded admission.** Diagnostics distinguish attempted, matched, unverified and missing first-pass quotes. Both plain and de-hyphenated matching reject partial adjacent-digit matches such as `60` inside `600`; legitimate complete-token substrings and de-hyphenation remain supported. This explicitly approved change narrows omission admission. Primary quote failures and comparator/arrow disagreements remain warnings, and quote location does not prove fact entailment.
- **Anki preservation and comparisons.** Malformed fragments and physical ledger addresses survive parsing. Ambiguous neighboring line boundaries require a Text repair before export; clinical wording is not reconstructed. Numeric warnings preserve Unicode minus and complete exponent-bearing units, and include visible hints without changing warning severity.
- **Merge and edit review.** A second exact merge after proven alias normalization retains source unions, original addresses and normalization provenance. Manual repairs can use an explicit exact-merge action; differing Keep choices and nonidentical notes remain distinct. Text/Extra edits retain source associations while requesting fresh link review, acknowledged through Apply links. The association metric still does not claim semantic coverage.
- **Honest outcomes and evidence.** Empty, partial/truncated, structurally repairable and complete generation have distinct labels. Batch/source-check downloads share note provenance for merge and edit review. Suggestions and manual queue dispositions remain advisory; no automatic clinical correction, source-link erasure, model call or new semantic export gate is added.

The unified verifier passes **2,820 assertions**, all eleven unchanged frozen prompt hashes, prompt documentation and full JSX Babel transformation. The 256 added regression assertions exercise extracted live functions and handlers with synthetic data. The historical audit scripts and reports are retained unchanged; semantic-limit failures in the independent re-audit are not implementation targets that can be solved by structural validation. See the [implementation record](docs/reviews/anki-integrity-implementation-2026-09-18.md) for the final per-item disposition and checks. No live Gemini, private-material, browser, native IndexedDB, native PDF/PPTX or native Anki acceptance is claimed. CDN pins remain unchanged and all eight script resources plus both worker copies are rechecked for this release. See the [release verification record](docs/reviews/anki-v16.7-release.md).

## v16.6 Anki release (2026-09-13)

The user approved implementation as v16.6 after independent review of four v16.5 generated decks and Flash/Low checker reports, followed by adjudication of the supplied external review. The canonical file is `Nursing-Study-Suite v16.6.html`. The user subsequently authorized committing, pushing and publishing v16.6 as the latest release, with asset `Nursing-Study-Suite.v16.6.html`. No new live model measurement is claimed.

- Mixed Text/Extra contextual references are retained; visible Text takes precedence over Extra-only status. Same-note disjoint indices normalize without creating hidden coverage. Recovery history remains separate from citation recovery. Conflicting ranges, bad indices, invalid inventory roles and malformed JSON stay unresolved.
- Exact Condition tokens are computed from the existing safe canonical registry and supplied in each condition prefix. Conservative normalization and selection rules remain unchanged.
- Mixed source inventories and supported field receipts receive bounded advisory checks for suspicious context roles, noun-only citations with added predicates, and possible qualifier strengthening. These are review signals, not semantic verdicts or export gates. Literal hidden matches do not clear them.
- Focused runtime adapter and checker guidance preserves full propositions, substantive target destinations, useful Extra and faithful paraphrases. All eleven frozen constants and their baseline remain unchanged.
- Offline replay recovers 13 previously rejected records: OB improves 32/41→37/41 complete groups and med-surg 21/26→24/26. Both remain partial; eight unresolved records and one malformed JSON packet still require correction. These are parser results on saved responses, not evidence that card quality improved.

Verification and limits: [implementation note](docs/reviews/anki-v16.6-implementation.md). Private decks, KBs and raw reports remain ignored.

## v16.5 Anki release (2026-09-13)

The user approved the adjudicated implementation after four v16.4 subject exports and the follow-up external review, then explicitly authorized committing, pushing and publishing v16.5 as the latest release. The canonical application is `Nursing-Study-Suite v16.5.html`; its release asset is `Nursing-Study-Suite.v16.5.html`.

- **Scoped structural tags.** New structured-KB generation captures a hierarchical tag contract. Stray bare tokens are structurally ineligible; Topic/custom namespaces and existing unscoped records remain compatible. Repair preserves manual selection. Unknown names, disputed mappings and mixed conditions remain advisory; no majority-condition fallback is added.
- **Normalization evidence.** Every post-dedupe generation note retains its outcome and reason, before/after tags, mapped IDs and source location. Batch downloads preserve canonical/no-op and skipped outcomes as well as repairs. Source-check reports distinguish that capture from read-only checks of audit-snapshot notes; legacy history is unavailable rather than inferred from an empty edit list.
- **Approved generation instructions.** Only ANKI_MASTER_PROMPT changes among the eleven frozen constants, with an intentional baseline update and [exact diff](docs/history/ANKI-v16.5-target-allocation.diff). The [adapter diff](docs/history/ANKI-v16.5-adapter.diff) requires internal target allocation before composition, reconciliation after compression, preserved source relations/priority and equivalent-unit masking. The two-block fact-to-note map stays unchanged; no new target-output protocol, API call, model setting or semantic gate is introduced.
- **Evidence boundary.** The supplied exports demonstrate missing or untested targets and tag discrepancies, not a measured v16.5 improvement. Internal model planning is not an independently validated target inventory. Verification and remaining live measurements are recorded in [the implementation note](docs/reviews/anki-v16.5-implementation.md). Private course material remains outside Git.

## v16.4 Anki audit release (2026-09-13)

The user approved implementation of the recommendations adjudicated against four supplied v16.3 tests, then explicitly authorized committing, pushing and publishing v16.4 as the latest release. The canonical application is `Nursing-Study-Suite v16.4.html`; its release asset is `Nursing-Study-Suite.v16.4.html`. Flash / Medium, the generation adapter, all eleven frozen constants and their baseline remain unchanged.

- **Failure evidence.** All 72 supplied groups returned valid JSON; 64 passed validation and eight failed on five source-capital copying differences, two corrupted note IDs and one mixed hidden/context reference group. No truncation or transport failure was recorded. The 24,000-character packet ceiling remains; actual new wire payloads include the added source-address inventory and may require more groups. Private course material and per-card examples stay outside Git.
- **Exact addressing.** New requests use packet-local note handles and numbered source-token ranges. The app restores captured note IDs and exact source bytes. It does not infer an intended UUID, fold source units/capitalization or invent a cloze index. Hidden and contextual references remain distinct.
- **Accounted-for source.** The dynamic checker prompt starts with a complete source-token inventory, assigns each range to a target or explained context, separates meaningful list members, and compares full propositions including actor, modality, frequency and conditions. Accounting gaps fail that fact record. This is an explicit model inventory, not an independent semantic oracle: classifying an important detail as context can still be wrong. All-context facts enter advisory review; mixed inventories remain inspectable.
- **Partial evidence.** Independently valid fact/note records and findings survive malformed neighbors. Missing required records and invalid findings keep a group pending; explicit retries retain accepted work and exact captured requests. The private schema-4 report retains unresolved issues, original attempts and local note-handle maps. Transport and stale-source guards remain in force.
- **Whole-deck review.** The local queue searches captured notes across chunks and tiers for bounded literal candidates related to a flagged target. It reports candidate counts and eligibility, and warns about broad list-target receipts. No candidate automatically proves coverage or clears a finding. Warnings and review decisions never change notes, selection or export eligibility.

Validation and remaining measurements are recorded in [the implementation note](docs/reviews/anki-v16.4-implementation.md). No live Gemini calls or native Anki import were authorized or performed during implementation. New audit completion rates, target quality, latency and quota cost require a separate measured run.

## v16.3 Anki release (2026-09-13)

The user approved the follow-up audit and review changes and requested v16.3, including the previously stale visible version label, then explicitly authorized committing, pushing and publishing a new release. The canonical application is `Nursing-Study-Suite v16.3.html`; the release asset is `Nursing-Study-Suite.v16.3.html`. Flash / Medium remains the Anki default. All eleven frozen prompts and their baseline remain unchanged.

- **Audit recovery and retries.** Exact citations remain preferred. Unambiguous whitespace differences and a small explicit set of fact-initial prose capitals can recover to captured source bytes with a recorded diff; unknown words, units, numbers, symbols and inserted text remain strict. Malformed or truncated groups are quarantined while independent groups continue. Explicit Retry / resume reuses captured prompts/settings and skips accepted groups; transport failures stop the session. Reports retain attempts, failures, session history, canonical matches and pending groups.
- **Recall review stays advisory.** Local checks cover equivalent numeric ranges exposed on a front, numerical targets marked tested without the numeric target hidden, unexpected scripts absent from reliable linked sources, and suspect proposed fixes. Both visible-only and Extra-only targets enter review, with covered-elsewhere, intentional-context and manually fixed decisions. Decisions are bound to exact notes/source/tier and the applicable audit; edits invalidate them. They never change selection or block export.
- **Prompt scope.** Only the dynamic source-check builder gains suggestion constraints: preserve the three-cloze contract, avoid adding independent targets to existing bundles or answer-bearing hints, and preserve active higher-priority coverage when proposing duplicate removal. The generation adapter and frozen master are unchanged.
- **Evidence limits.** The supplied v16.2 tests comprised 1,188 notes across four subjects, two complete source checks and two failures. Offline replay recovered the isolated case-only citation failure and continued rejecting inserted text. These findings motivate software changes, not a clinical accuracy claim. No new live Gemini calls or native Anki import are authorized or performed. Verification is recorded in [the v16.3 implementation note](docs/reviews/anki-v16.3-implementation.md).

Earlier sections preserve their named release checkpoints.

## v16.2 Anki release (2026-09-13)

The user approved the follow-up improvements and Flash / Medium Anki default after eight v16.1 exports from four paired subjects, then explicitly authorized committing, pushing and publishing v16.2 as the latest release. The canonical application is `Nursing-Study-Suite v16.2.html`; its release asset is `Nursing-Study-Suite.v16.2.html`. Saved custom profiles remain intact; the Anki panel can apply the recommendation independently. Manual and other tool profiles are unchanged.

The implementation adds conservative alias-tag normalization, separate retrieval-label/cue and shared-gap diagnostics, manual source-link repair with history, independent checker settings, per-fact target and per-note field receipts, and status-aware private reports with timestamps and hashes. The dynamic KB adapter reinforces source-only Extra, supplied definitions, qualifiers and list recall; all eleven frozen constants and their baseline remain unchanged. Warnings remain advisory and no automatic semantic rewrite, new dedupe, or model call is added.

The paired evidence favors Medium for gradability, with no general source-fidelity winner. Only one supplied source check was complete; seven were unrun packets. The [release verification record](docs/reviews/anki-v16.2-implementation.md) distinguishes those findings from deterministic software acceptance: 1,775 assertions, full JSX parsing, unchanged frozen prompts, synthetic Chrome acceptance and all ten CDN checks pass. No new live Gemini calls are authorized or performed for this release. New generator/checker quality and native Anki import still require measurement.

Earlier sections below preserve their named release checkpoints and do not override this release scope.

## v16.1 Anki release (2026-09-11)

The user approved v16.1 to release the Anki source/retrieval and review tools committed at `6941e03`, together with a focused change to Extra. The canonical application is `Nursing-Study-Suite v16.1.html`; the intended release asset is `Nursing-Study-Suite.v16.1.html`. This supersedes the main-branch-only status of the checkpoint below. **Flash / Low remains the Anki Auto profile, and all advisory warning tiers remain unchanged.**

- **Focused prompt approval.** Phase 3.5 of `ANKI_MASTER_PROMPT` now makes Extra explicitly empty by default. It allows only a useful explanation or contrast explicitly supplied by the source and not already conveyed by Text, and rejects generic captions, restatements, and inferred nursing explanations. Six generic cue-caption examples are removed. Phase 3.75 and the rest of the prompt remain unchanged from the approved main-branch update. The [exact v16.1 diff](docs/history/ANKI-v16.1-extra-default.diff) records this focused change; the other ten frozen constants remain unchanged. The Anki baseline and generated documentation are updated deliberately.
- **What v16.1 releases.** The earlier [source/retrieval prompt revision](docs/history/ANKI-source-retrieval-update.diff), one-to-many source associations, actual review/source inspection, finding filters, local advisory checks, and explicit optional Prepare/Run source-check workflow are included. Findings and proposed corrections leave original notes intact; no new automatic API call, rewrite, dedupe, or export-blocking rule is added.
- **Latest supplied-export evidence.** Six exports from the updated main-branch HTML comprised two matched Low/Medium pairs plus an unpaired pharmacology Low run and an unpaired mental-health Medium run. Subject matching was checked against the supplied KBs rather than inferred from filename suffixes. Source fidelity and retrieval showed mixed gains and regressions; source-only Extra remained unreliable. These observations motivated the focused Extra change but do not measure that change's efficacy or establish a consistently superior thinking level. No private source excerpts or per-card findings are included in the repository documentation.
- **Release verification passed.** The unified verifier passes 1,579 assertions, full JSX Babel transformation, all eleven approved prompt hashes, live prompt documentation, and LF/version agreement. All eight script CDN resources and both PDF worker copies match their pinned SHA-384 values. Isolated Chrome source-review acceptance passes using synthetic notes and mocked Gemini. The [release verification record](docs/reviews/anki-v16.1-release.md) distinguishes these software checks from generation measurement. No new live Gemini calls were made for this release. New-prompt efficacy, source-check accuracy, and native Anki import/review remain unmeasured; a further live pilot requires separate run authorization.

The sections below preserve the state and evidence at their named checkpoints; they do not override the current v16.1 release scope.

## Anki source and retrieval main-branch checkpoint (2026-09-11)

The user approved this Anki implementation after four controlled Low/Medium export comparisons against their supplied knowledge bases, then explicitly authorized committing and pushing it. The application remains `Nursing-Study-Suite v16.0.html`; no version bump or tagged release was requested for this update. **Flash / Low remains the Anki Auto profile.** The paired reviews found wins and losses in both settings and did not establish a consistent source-fidelity benefit from Medium. These comparisons predate the new prompt and cannot measure its efficacy.

- **Approved prompt changes are applied.** Only `ANKI_MASTER_PROMPT` changes: Extra must stay source-supported and may be empty; a source-meaning re-audit preserves qualifiers and clinical relationships; list handling counts independently gradable targets even inside a single shared-index or comma/slash answer. The three-field output remains unchanged. The deliberately updated baseline and generated documentation match the [exact prompt diff](docs/history/ANKI-source-retrieval-update.diff); the other ten frozen constants are unchanged.
- **One fact can map to multiple notes.** The adapter now explicitly requests repeated one-edge mapping lines for legitimate splits, using the existing parser contract. Valid edges remain source associations, not proof of semantic coverage. The global all-tier linked-fact count does not prove that each substantive detail is recalled or that generated wording preserves its meaning.
- **Review is closer to the source.** The source inspector shows each actual masked front, hidden answers, and captured supporting fact text with condition and tier. Finding filters and note links help inspect and edit affected notes. Local advisory checks detect literal answers exposed on the front, conservative possible repeated targets, and inconsistent explicit F(C)/C(F) temperature pairs beyond displayed rounding. They preserve hints, siblings, units, comparators, and relevant context in their respective comparisons; they neither establish clinical correctness nor replace semantic review. Warnings, source conflicts, and candidate duplicates never change keep/export eligibility or exact dedupe.
- **An optional source check is explicit and bounded.** Prepare builds packets locally and displays the model, thinking level, and planned request count. A separate Run action consumes API quota; no call occurs automatically after generation or editing, and no repair/rewrite is applied. Packets use captured `fact.text` and actual review targets, include all note tiers to explain priority/selection, and use the chosen export tier for active scope. Primary groups are bounded to 24,000 serialized payload characters, with linked support retained; an oversized indivisible group fails preparation without truncation. The model reports advisory unsupported/changed-meaning/missing-target/duplicate-target/priority-loss/source-conflict findings. Each finding has a suggestion field for source-supported revised wording or a retrieval-target change; it stays empty when the source cannot establish a correction, including an unresolved source conflict. Originals remain intact. Unknown IDs, invalid verdict structures, truncated responses, cancellation, and stale notes/sources cannot silently become a complete current check. Completed groups and private evidence remain inspectable. Zero reported findings does not certify completeness.
- **Verification and measurement status.** The unified gate passes 1,563 assertions, including nine suggestion-field checks, the full JSX Babel transform, LF/version agreement, generated prompt documentation, and all eleven approved prompt hashes. Isolated synthetic browser acceptance passes warning/export isolation, source inspection and edit navigation, explicit mocked audits, suggestion display and evidence export with intact original notes, stale notes/KB, malformed evidence, cancellation/late replies, empty completed-batch audit controls, and the 360px layout; the optional harness is `tools/anki-source-review-browser-tests.js`. No live Gemini calls were made for this implementation. New-prompt efficacy and source-check accuracy remain unmeasured; a separately authorized paired pilot and native Anki import/review are still required before claiming those outcomes. Private comparison artifacts remain outside Git.

The sections below retain their release-specific history; statements about the restored v15.16 prompt or deferred one-to-many adapter describe those earlier checkpoints.

## v16.0 visual workspace (2026-09-11)

The canonical file is now `Nursing-Study-Suite v16.0.html`. The user's visual-update brief authorized the light blue/orange interface redesign and version bump, followed by explicit authorization to commit, push and publish the [v16.0 GitHub release](https://github.com/nursingschooltingz/Nursing-Study-Suite/releases/tag/v16.0). This does not reopen the archived selective PDF-vision architecture or change the source-profile decision below.

The unified gate passes 1,372 assertions, including 27 new UI contracts. The existing eleven prompt hashes and baseline, card transcription/resize settings, dynamic prompts, generation/validation logic, storage/import/export contracts, model profiles and token ceilings are unchanged. Eight script CDN resources and both worker copies were rehashed successfully. Responsive synthetic Chrome checks and existing storage, worksheet, output-policy and PDF/photo checks are recorded in [the v16.0 visual report](docs/reviews/visual-update-v16.0.md). Live clinical generation, actual Anki import/review and native print acceptance remain outstanding; no course files or Gemini quota were used.

Navigation now names each workflow, settings are collapsible, narrow viewports start on the study content, and all six tools still remain mounted. Accessible labels, focus/state cues, readable evidence panels and responsive form/table layouts accompany the theme. Existing untracked production-review documents were left untouched.

## v15.18 remediation release (2026-09-11)

The published `Nursing-Study-Suite v15.18.html` contains the requested production-review remediation. The user explicitly authorized committing and publishing it as the next release on 2026-09-11. The prior v15.17 release remains intact. The eleven prompt constants and baseline, card prompt/resize constants, dynamic generation prompts, measured Anki mapping adapter, model profiles and token ceilings remain unchanged. Its final unified gate passes 1,345 assertions; isolated Chrome checks cover storage/replacement/source races, interrupted worksheet audits, rejected repairs, output resources, PDF worker integrity and photo decoding. The implementation and browser evidence, migration notes, and deferred acceptance are maintained in [the execution ledger](docs/reviews/remediation-execution-v15.17.md).

Persistence now orders writes/deletes and preserves ambiguous legacy copies for recovery. Export the active KB and recovery copies before downgrading; older versions cannot read the new fallback/tombstone metadata. Unicode dedupe fixes prevent new losses but cannot restore previously merged facts. Source replacement invalidates pending case/worksheet generation and current links; failed and incomplete artifacts remain inspectable with explicit export notices. Live source-based pipeline acceptance and actual Anki import remain unperformed; no private material or API quota was used for this implementation.

The v15.17 Anki example-only prompt candidate failed its live pilot and was rolled back with explicit user approval; the app still uses the exact pre-pilot prompt. Mapping correction and actual Anki import remain outstanding. Historical designs and prompt diffs are archived under `docs/history/`. Repository tooling requires exactly one suite HTML unless an explicit path is supplied; Proton Drive Name clash copies fail loudly. The README points to the [v15.18 release](https://github.com/nursingschooltingz/Nursing-Study-Suite/releases/tag/v15.18).

This file carries release-specific evidence, unresolved measurements, and the current source profile. It is intentionally separate from the always-loaded `AGENTS.md`.

## Anki text-only reliability (v15.17)

- **Code-only stages A and B implemented.** Shared flat-cloze parsing blocks malformed notes at preview/export; manual selection is independent of structural eligibility. Edits cannot bypass pipe/newline checks.
- **Batch identity is conservative.** A replaced KB makes old notes stale. Sources and original mappings stay with their captured snapshot; active coverage, registry, numeric checks, and normal export stop. Aborted or superseded requests cannot publish late results.
- **Current counts and associations.** The UI distinguishes received notes, valid kept notes, and actual cloze review cards. Global linked facts and only the Anki registry entries follow edits, deletion, selection, and repairs. Style filters affect display only; tier filters affect export only.
- **Advisory numeric and collision checks.** Numbers compare complete value/unit tokens in revealed Text and Extra against validated linked fact text. Quote-only support, missing/partial mapping, unsupported notation, and stale batches have explicit statuses. This does not check comparator direction, value roles, or clinical entailment. Identical rendered fronts preserve case, punctuation, hints, and visible siblings; warnings never change selection.
- **Optional source pointers.** “Include source references” defaults off. Export-only footers deduplicate captured filename/location pairs, escape HTML safely, and show unavailable pointers. Pipe-delimited Text/Extra/Tags and current headers remain compatible.
- **Validation:** 904 deterministic assertions, all frozen prompt hashes and generated documentation, LF/version checks, and full JSX Babel transform pass after the approved rollback. The harness pins the restored prompt and rejected candidate hashes and retains the historical examples as formulation fixtures. All eight SRI pins matched their CDNs on 2026-09-11. The synthetic browser fixture exercised edit/repair/manual exclusion, deletion, tier/style filtering, cloze switching, inert markup, warnings, source export, empty regeneration, stale batches, and late response rejection. The registry remained stable between changes and preserved other artifact kinds.
- **Generation settings are preserved.** A0 SHA was `21fb5980f796649d3cb7f53f2f919e8b93e2136b` with 761 assertions. All eleven frozen prompts stayed unchanged through the code-only checkpoint `1da58a3`; the example edit and its approved rollback affected only `ANKI_MASTER_PROMPT`, now restored to its A0 bytes. Packet formatting, chunking, focus context, and the runtime mapping adapter retain their measured source hashes. Model/profile, transport, retry policy, and token ceilings were preserved.
- **The authorized paired pilot failed the revised example candidate.** The same scoped KB (40 conditions, 328 facts) completed eight chunks per run on 2026-09-11: 16 logical generation calls, no additional audit calls; actual HTTP retries were not independently counted. Baseline: 315 parsed/kept notes, 560 reviews, 328/328 linked facts, zero structural failures. Revised: 311 parsed notes, 147 four-field failures, 164 kept notes, 278 reviews, 170/328 linked facts. Another 26 revised notes placed explanation prose in Tags despite passing structural lint. No fictional-example contamination, numeric discrepancies or exact collisions were found; this does not establish clinical accuracy. Original revised responses are saved privately. Baseline rows, ledger and original diagnostics were captured from the UI and reproduced offline, but its original response bytes were not saved because the browser download failed. See `docs/history/ANKI-v15.17-validation.md`.
- **One-to-many mapping now has evidence, but the adapter is unchanged.** Three baseline notes legitimately split content from facts already mapped to other notes. Their missing edges support the conditional Stage D contract correction; they are not bad IDs, line numbers or parsing failures. A proposed adapter change needs a separate bounded live measurement and further call authorization.
- **The example rollback was explicitly approved and applied on 2026-09-11.** After reviewing the failed pilot, the user approved `docs/history/ANKI-v15.17-example-rollback.diff`. Its exact inverse restores Anki hash `353471cbee66c759341ad8f4d857fa75ea4051744a52771ce780fcf172efc548`. The baseline and prompt documentation now match the restored body; reliability code and the other ten frozen prompts are unchanged. No additional live calls were made for this rollback.
- **Import remains outstanding.** Native Anki control is unavailable in this session; no actual import/review was performed. Plain and source-reference exports retain three fields and the expected row counts. The actual revised export matches the replay byte for byte, but includes the 26 misplaced-tag rows and is not study-ready. Private evidence remains in gitignored `scratch/anki-pilot/`; no unrelated course files were inspected.

## Anki text-only retrieval (v15.16)

- **The Anki prompt revision was explicitly approved on 2026-09-09.** Only ANKI_MASTER_PROMPT changed; the other ten frozen constants retain their baseline. The exact change is in `docs/history/ANKI-v15.16-prompt.diff`.
- **Style checks are advisory.** Article clues, missing condition/topic + retrieval labels, repeated cloze indices, and fronts over the soft 15-word target never uncheck a note or block export. Exceptions need judgment; a missing anchor can be correct when the condition is the answer.
- **Preview models each cloze review.** Same-number gaps hide together, other cloze answers remain visible, and Extra appears after reveal. This previews the suite's flat text cloze syntax, not custom Anki templates or nested clozes.
- **The style filter changes review visibility only.** Export still includes all kept notes in the selected tier. Warnings update immediately when Text is edited.
- **Deterministic and browser checks pass.** All 761 assertions, the full JSX Babel transform, prompt documentation/hashes, and eight SRI pins pass. The browser fixture exercised masking, reveal, cloze switching, inert markup, filters, and editing with synthetic notes.
- **Live Anki generation remains unmeasured.** Deterministic checks cannot establish prompt adherence; a real-material generation and Anki import/review remain to be checked. No live Gemini calls were authorized or made for this change.

## NCLEX extractor

- **v15.15 fixes answer choices being mistaken for question numbers.** `nclexSplitByQNum` matched `1.` at a line start, which is both a stem marker and a first-choice marker. On a three-question Davis sample it returned the Q1 stem plus three Q1 choices as questions and lost Q2/Q3. `nclexDropOptionRuns` now detects printed choice runs by spacing and removes them from candidate starts.
- **All three drop guards are required.** A choice run must be preceded by something, must not exceed `NCLEX_OPTION_RUN_MAX`, and the question sequence must resume afterward. Each prevents a different false positive and has a harness case.
- **`NCLEX_OPTION_GAP`, `_RUN_MIN`, and `_RUN_MAX` are layout constants, not preferences.** Widening the gap or raising the maximum can make a genuine question list resemble a choice run and silently delete questions. Change only against a real PDF.
- **The fix is confirmed on live output.** A 2026-08-29 run on real source material confirmed that the filter holds on genuine `pdfLayoutText` output, including wrapped choices.
- **Mixed-marker selection remains untested.** The splitter chooses the pattern yielding the most distinct numbers. A book numbering stems `1.` and choices `1)` could let the choice pattern win while capturing choice lines. No known source does this. If a future extraction produces short fragments, measure this first; do not loosen the choice-run filter speculatively.

## v15.14 validation still outstanding

The deterministic gates pass, but these v15.14 paths still need real-material checks:

1. A chapter containing both `↑` and `↓` forms of the same lab; they must remain separate facts.
2. A hand-corrupted `sourceQuote` comparator; it must be reported.
3. A card transcribed and then its photo removed; it must not build.
4. One full-resolution phone photo through the downscale path, measured at two runs per card.
5. One split-mode run on a real Davis PDF to confirm windowed pairing recovers questions past the former 12,000-character cliff.

- **`kbQuoteOperatorsAgree` remains WARN tier.** It can false-positive on column/table spans as `reordered` misses do. A non-zero diagnostic deserves investigation, not automatic pass-2 discard, until a real corpus establishes the false-positive rate.
- **Card resize constants are prompt-class.** Changing `CARD_MAX_EDGE`, `CARD_JPEG_QUALITY`, or `CARD_RESIZE_ABOVE_BYTES` can change OCR accuracy and therefore requires two runs per card.
- **`responseSchema` remains deliberately unimplemented.** It changes model output shape even though it does not touch frozen prompt bytes. It needs a real batch before adoption.
- **Per-operation token budgets are rejected.** `maxOutputTokens` is a ceiling, not a reservation, and Gemini 3 thinking shares the budget. The universal 65,536 remains correct.
- **All eight SRI pins were verified again on 2026-09-09 for v15.16.** Both DOMPurify CDNs served 29,209 identical bytes. Recheck every pin on an application version bump.
- **`.gitattributes` pins `* -text`.** If the harness fails wholesale after a Git operation, check line endings first; every extraction anchor assumes LF (`\n`).

## Live-generation evidence

- **The item-audit gate has been measured.** Ten fixture items across three runs plus a six-call top-up produced zero verdict flips, zero false fatals on sound items, and both seeded defects caught and correctly named every run.
- **Fact coverage is confirmed working.** Live runs reported 18/30 and 23/30 where the metric had previously been structurally limited to zero.
- **Real usage is required after generator-pipeline changes.** Every v15.8 and v15.9 defect came from live Knowledge Base generation rather than synthetic fixtures.
- **Proton Drive Name clash copies can contain newer work.** During v15.9, three of four edits landed in a fork while the canonical filename retained only the first. The resolver now stops on clash filenames, but a human must still diff both copies before deleting either.
- **Test Plan Alignment remains WARN-only.** The generator does not receive the Test Plan activity statements.
- **The 2026 category label remains unverified.** Keep *Safety and Infection Control* until a primary NCSBN source confirms whether it became *Safety and Infection Prevention and Control*.

## Flashcard ingestion and the v16 boundary

- **Flashcard ingestion is not v16 multimodal PDF ingestion.** Card photos have no text layer, so pass 1 transcribes a photo and pass 2 gives only that transcript to the existing frozen extractor. Pass 2 must never receive the image.
- **The transcript is the trust boundary.** A digit misread in pass 1 can verify perfectly against the wrong transcript downstream. Repeat runs measure self-agreement, not accuracy, so transcripts and every clinical number require human review.
- **Front/back pairing is correctness-critical.** Davis backs contain the running header and card number but no condition name. `cardMergeFaces` joins category plus card number, front first.
- **`CARD_TRANSCRIBE_PROMPT` is tunable but load-bearing.** It must never guess a number, expand an abbreviation, or normalize symbols, and it must route unrecognized headings to `other`. Remeasure at two runs per card after an edit.
- **v16 PDF vision remains unapproved and unbuilt.** The architecture in `docs/history/Nursing-Study-Suite-v16-spec.md` is retained for a future source-profile change. The §11 benchmark is not currently needed because the maintained PDF sources do not contain facts that exist only in raster visuals.

## Current source profile

There are two source classes and they deliberately take different paths:

1. **Specialized text-first nursing PDFs.** They have no image tables, ECG strips, or raster-only figures, so the central v16 premise does not hold. Two-column reading order can break provenance quotes without losing fact content.
2. **Photographs of printed Davis-style flashcards.** They have no text layer and use the v15.12 transcription path.

If PDFs become actual textbook chapters with clinically important raster content, reopen the v16 spec and run its §11 benchmark first. Card photos alone do not trigger that architecture.

- **Two-column card backs are handled by transcription.** Vision reads the columns into transcript order; do not loosen the PDF quote matcher for them.
- **Two-column text PDFs create provenance failures, not demonstrated content loss.** The model receives the complete chunk and can extract the fact, but a verbatim quote may fail after column-major text scrambling.
- **The composition probe stays.** It is off by default, costs nothing when off, and provides a cheap way to retest the source-profile assumption if materials change.

## Quote-verification evidence

- **De-hyphenation is confirmed on live output.** A cardiovascular chapter produced 190 failed quotes: 83 hyphenation/ligature, 107 reading order, and zero partial/absent/too-short. After the additive fallback, hyphenation fell to zero, `dehyphSaved` was 77, first-pass misses fell from 182 to 97, and audit discards from 8 to 3.
- **No fabricated quotes were observed across the two measured runs** (about 370 quotes). A future meaningful `absent` count is therefore a signal, not expected noise.
- **The de-hyphenation fallback remains additive to the plain path.** `kbQuoteInSource` tries plain normalized matching first and consults de-hyphenation only after failure. The approved 2026-09-18 change applies the same adjacent-digit boundary check to both paths, so the historical acceptance of partial numeric tokens is intentionally narrower. This does not authorize looser comparison, source reordering, or changes to the WARN-only operator policy.
- **A non-zero `hyphenation` diagnostic is now a regression signal.** The classifier is reached only after both plain and de-hyphenated matching fail; pointing it at the promoted matcher would erase this signal.
- **Reading-order failures are accepted.** No matcher loose enough to bridge multi-column distances is safe for clinical doses. The fact remains available while its verbatim proof is marked unverified.
