# Nursing Study Suite — independent text-only Anki integrity re-audit

2026-09-18. **Audit only; no production fixes.**

The pipeline can export an instruction whose negation was deleted during parsing, silently shorten or drop imported/restored source material, and carry an invented source pointer into an exported note. Numeric-advisory and response-handling defects also reproduce. Several stronger hypotheses did not survive: source links are documented associations, missing heuristic evidence is not approval, and checker suggestions/manual acknowledgements do not automatically edit notes.

Seven implementation findings received unanimous confirmation. Four additional observations received two defect votes and one policy-based dissent; those disagreements are preserved below. Synthetic test results are not a clinical accuracy rate.

## Audited state and evidence

Commit: b6eb73ceabb7c8d292c186b07148c86949b37d34.

Entry: Nursing-Study-Suite v16.6.html, ReactDOM at line 10257; AnkiGenerator at 5541–6046; tools remain mounted at 10248. All HTML line references below refer to that file.

HTML SHA-256 before and after:

~~~text
8524e35c8b3621e074a0499ba3857a672464b99721e4b502c381dfa29d0b9b12
~~~

The final preservation comparison covers all 96 tracked files and all 12 pre-existing audit files. The two unrelated untracked documents were not opened or edited; no before/after content hashes were collected for those out-of-scope documents. See the [machine-readable execution record](anki-integrity-reaudit-results.json) and [final preservation record](anki-integrity-reaudit-state-after.json).

Six stage reviewers worked in bounded waves, then three fresh refuters reviewed all 22 candidates through distinct lenses: actual code behavior, downstream guards, and source/contract justification. The coordinator also authored the receipt harness. The earlier audit was not imported as an oracle; its four scripts ran read-only as reconciliation baselines.

Detailed safeguards, reproductions, smallest inputs, independent expectations, actual outputs and fixture traces:

| Band | Evidence | Complete fixture dataset |
|---|---|---|
| Source/build/import/persistence | [Source evidence](anki-integrity-reaudit-source-evidence.md) | [Source results](anki-integrity-reaudit-source-results.json) |
| Parse/map/dedupe/numeric/preview/export | [Transform evidence](anki-integrity-reaudit-transform-evidence.md) | [Transform results](anki-integrity-reaudit-transform-results.json) |
| Generation/transport/edits/retry/currentness | [Lifecycle evidence](anki-integrity-reaudit-lifecycle-evidence.md) | [Lifecycle results](anki-integrity-reaudit-lifecycle-results.json) |
| Optional checker/receipts/manual decisions | [Receipt evidence](anki-integrity-reaudit-receipt-evidence.md) | [Receipt results](anki-integrity-reaudit-receipt-results.json) |

Additional independent inventories: [extraction](anki-integrity-reaudit-stage-extraction.json), [import](anki-integrity-reaudit-stage-import.json), [receipt](anki-integrity-reaudit-stage-receipt.json). Refutations: [code](anki-integrity-reaudit-refute-code.json), [guards](anki-integrity-reaudit-refute-guards.json), [expectations](anki-integrity-reaudit-refute-expectations.json).

The execution record embeds command journals and fixture results. It retains exact commands, exits, captured outputs and artifact actions, including development mistakes and explicitly marked tool-truncated exploratory reads. Final test outputs are complete; the verifier was repeated once solely to capture its previously truncated output.

## Pipeline and safeguard inventory

The per-band evidence expands each row with exact predicates, definition/call locations, available evidence, action, error/inconclusive behavior and downstream effects.

| Actual stage / lines | Evidence and condition tested | Effect; limitation or downstream escape |
|---|---|---|
| PPTX655/682, PDF1013/1052, source units1981 | Text runs/relationships or coordinates, file extension, abort | Produces text/location units. Native decoding/visual fidelity inspected only. No image interpretation. |
| Group2014, split2034, chunk2070; build2708 | Unit size, overlap, source-quality totals | Retains units; splits/requeues truncation; sparse text warns. Probe exceptions can disappear. |
| Build2675; parse2779–2786 | JSON/top-level conditions array and current operation | API-error recovery preserves completed chunks. Nested null escapes catch (A5). Late publication is guarded. |
| Quote2097; calls2795/2820 | Normalized substring ≥10 chars; dehyphenation fallback | Primary miss warns/retains; omission miss discards. No entailment check; partial numeric token can match. |
| Operator2135; calls2798/2822 | Operator-preserving form of an accepted quote | Warning only by explicit policy. Zero mismatch cannot certify meaning. |
| Omission2812; pointer2826 | Missed array, quote, actual chunk | Malformed shape becomes empty (A6). Recovered pointer is runtime-bound; primary pointer is trusted (A7). |
| Merge1677; call2844–2845 | Condition aliases and exact normalized fact identity | Unions sources/rekeys IDs. No source-truth check. |
| Normalize1720; import2584; hydrate10168/10187 | Root/row shape, bounded values, enums | Rejects bad root, reports some malformed rows. Caps/defaults silently change valid data or metadata (A2/N3). |
| KB validation1904; builder2900; Anki5769 | Post-normalization fields, IDs and anchor presence | Reports structural issues; Anki logs and continues. Missing quotes warn, but filename is not checked against actual files. |
| Persistence1798–1902; App10138/10163–10187 | Copied bytes, writer/sequence/parent, transaction result | Queue/transaction controls pass; restore invokes lossy normalizer. Native IndexedDB untested. |
| Serialize1949, snapshot4166; generation5768–5813 | Captured fact text, pointers, IDs, source identity | Original source chunks absent; faithful generation propagates a wrong KB. |
| Transport797/896; run guard4217/5764 | HTTP/SSE finish, text, abort/run/KB identity | Retry/cancel/overlap controls pass. Non-card STOP and truncated content still reach Complete. |
| Parse4142; map4177; calls5817/5824 | Pipe-bearing lines, declared ledger, known chunk IDs | Invalid piped rows survive; unpiped fragments vanish and ledger positions shift (A1). Mapping proves association only. |
| Dedupe4204 → normalize4274; call5826 | Exact fields/effective tags/Keep; proven aliases | Invalid notes retained; tag normalization can create identical final rows (N1). |
| Cloze4304, lint4336, selection4358 | Syntax, tags, delimiters, tier, currentness, Keep | Invalid/stale/unselected notes excluded by live lint. No semantic proof. |
| Numeric4387/4406 | Revealed Text/Extra versus reliably linked fact values | Advisory only; minus/exponent bugs give wrong status (A3). Hints/semantic roles outside declared scope. |
| Edit5861; currentness5369/5580 | New card/batch/tier identities, current fields | Rechecks lint/numeric cache, preserves Keep/associations, invalidates old checker capture. |
| Preview/export4473; download5876 | Current selection, exact fields, optional escaping/pointers | 756 helper equivalence checks pass; real download callback executes. Native Anki untested. |
| Packet4600, decoder4923, validation4824 | Handles, indices, token inventory, source spans, required records | Rejects malformed evidence; protocol-valid wrong model judgments remain possible. |
| Merge5048, pending5373, handler5665 | Captured packet signature, required accepted records, run identity | Retries pending groups only; no receipt duplication; changed/cancelled capture cannot publish. |
| Suggestions5164, decisions5395, report5089 | Advisory findings, manual disposition, captured evidence | No automatic note edits; old decisions become outdated. Fixed is a manual assertion. |

## A — reproduced defects

Final priority: P1 = silent active-content loss/meaning alteration; P2 = material integrity/reporting issue; P3 = narrower duplication/status issue. This consolidated calibration supersedes reviewers' initial severity labels.

### A1 — parsing deletes a prohibition or note boundary (P1; unanimous)

Source: “Do not administer the intervention.” Generated first block:

~~~text
Do not
{{c1::administer the intervention}}.||Nursing::LATTE::Treatments Condition::DiabetesMellitus Tier::1
~~~

With fact-0 mapped to note1, parser4142–4151 deletes “Do not”. The affirmative remainder is mapped, lint-clean, kept and exported. Expected behavior follows directly from the source: preserve the prohibition or retain the malformed record as ineligible. Raw diagnostics retain the response, but the active note loses its meaning. Other fixtures show an unpiped first note disappearing, the next note receiving its fact association, and a truncated final note disappearing; some downstream mapping/numeric warnings mitigate those cases.

Smallest repair: preserve note-like malformed fragments and stable ledger addresses without guessing missing clinical wording. Transform targets multiline-negation-prefix-lost, dropped-no-pipe-line and truncated-note fail.

### A2 — silent import/restore content and provenance loss (P1; unanimous)

Valid imported fact4628 chars→4000 and quote728→600; suffix exception text disappears. Conditions2001→2000, facts5001→5000, per-fact pointers51→50, all with zero dropped counts. The actual save queue preserves4716 chars, then the hydration normalizer returns4000. A real merged4027-character fact also becomes4000 on restore.

Root: _kbStr1715 and normalizer1720/1726/1731/1746–1747; hydration10168. Expected: preserve valid saved/source bytes or disclose/reject loss. Smallest repair: separate app-save fidelity from external import limits and report every lossy limit. Seven source assertions cover truncation, caps and restore. Native reload was not run.

### A7 — unread source pointer reaches export (P2; unanimous)

Runtime source is synthetic.pdf page1. A primary fact carries a true located quote but model pointer never-read.pdf/page999. Build quote misses=0, validation=[], and actual serializer/snapshot/mapping/export retain that fictitious footer.

Merge1697–1701 trusts the individual pointer despite part-source assignment2800. The runtime file/chunk is an independent provenance oracle. Smallest repair: bind or verify primary pointers against that inventory, retaining raw model evidence; recovered omissions already use runtime pointers2826. Source A7-fabricated-first-pass-pointer fails. This is provenance, not proof of fact entailment.

### A5 — nested malformed chunk loses completed extraction work (P2; unanimous)

Valid chunk1 followed by {"conditions":[null]} throws outside the per-chunk catch ending2785; nested access/reduction2786–2794 aborts publication. Zero KBs are published. An ordinary API failure for chunk2 instead preserves chunk1.

Expected recovery is established by that existing control. The error is visible; previously saved KBs are not deleted. Smallest repair: validate nested shape inside the existing per-chunk recovery path. Source A5-nested-primary-shape fails.

### A3 — numeric sign/exponent representation corrupts advisory status (P2; unanimous)

Source +5°C versus card −5°C gives false clean status; source -5°C versus card −5°C gives a false discrepancy. Source5cm versus cards5cm²/5cm³ also gives false clean status. These expectations follow from exact mathematical value/unit identity, without clinical inference.

Root4384–4405: ASCII-only sign and incomplete unit boundaries. Smallest repair: preserve/normalize mathematical minus and consume or explicitly reject the whole exponent-bearing unit. Four transform numeric-verdict assertions fail. Warnings stay warnings; the faithful note is falsely warned, not rejected from export.

### A6 — malformed omission evidence becomes completed-empty (P2; unanimous)

After a valid primary response, {"missed":{}}, {"missed":null}, and {} all log +0 recovered without audit error. Fallback2812 converts each to []. Valid {"missed":[]} is a passing control; actual thrown audit errors warn.

Missing/wrong-shaped evidence cannot establish no omissions. Smallest repair: reject malformed envelopes into the existing warning/incomplete path while preserving primary content. Three source omission-shape assertions fail.

### A9 — unusable STOP response receives success status (P2; unanimous)

One-fact KB; nonempty STOP response “I cannot provide cards for this content.” The parser returns0, and5843–5847 publishes an empty batch and green Complete. Coverage still truthfully reports0/1 and missing-id diagnostics; export is empty.

Expected: distinguish transport success from usable generation. Smallest repair: explicitly mark zero-note output unusable/incomplete, retaining raw evidence and any valid independent chunks. Lifecycle non-card-stop fails its completion assertion.

### N3 — silent invalid metadata defaults (P2; 2 confirm, 1 policy dissent)

Import tier:"safety", latteBucket:"Pharm", otherwise valid and safetyCritical:true. Normalizer1737/1741 invents3/Look, with dropped0 and validation[]. Actual serializer/filtering consume those values. Valid string tier"1" is a passing control.

The majority identifies undisclosed replacement of priority/category as the defect. The expectation refuter notes intentional coercion, dropped counts being row counts, and no source-derived intended tier. **A clinical demotion is not proved.** Smallest proposal: explicitly report or reject invalid metadata; never guess intended clinical priority. Source N3-invalid-tier-bucket fails the transparency expectation. Agree that import policy before implementing.

### N1 — alias normalization defeats final exact dedupe (P3; 2 confirm, 1 policy dissent)

Two otherwise identical generated notes have Condition::DM and Condition::DiabetesMellitus; snapshot establishes the alias. Run5826 performs dedupe before normalization:2 parsed→2 deduped→2 canonicalized, byte-identical exported rows. An identical-front warning exists. Native Anki creation/update/skip behavior depends on settings and was not tested.

The majority treats this as final duplicate-export behavior. The dissent cites5825's explicit preservation of the existing dedupe scope and README retention of different tags. Smallest proposal: agree a final exact merge after proven normalization, preserving source unions, original addresses and normalization provenance. No fuzzy/manual deletion. Transform alias-normalization-collision fails its desired no-identical-final-rows assertion.

### QUOTE_PREFIX — numeric-token prefix is accepted as source anchor (P2; 2 confirm, 1 policy dissent)

Source: “The synthetic marker reads 600 units.” Omission fact says 60 units; sourceQuote is “The synthetic marker reads 60”. Actual kbQuoteInSource2100–2101 finds that prefix inside600; real build reports recovered1/discarded0/quoteMiss0/operatorMismatch0 and publishes altered60. A sparse-text warning exists; no quote-specific warning. A legitimate complete-token substring control passes.

The majority identifies insufficient numeric-token boundaries. The dissent correctly observes that60 is literally a substring of600, and comments2090–2120 deliberately preserve the accepted quote set; literal location never promised full fact entailment. Thus the proposed repair is a **measured matcher-policy change**, not permission to silently alter omission discard behavior: add a boundary diagnostic and evaluate legitimate substrings/dehyphenation before an approved gate change. Source QUOTE_PREFIX-numeric-token-boundary fails the stronger boundary expectation.

### MAXTOK — final Complete contradicts known truncation (P3; 2 confirm, 1 policy dissent)

One supported partial note plus MAX_TOKENS is retained, with batch.truncated=true and an explicit missing-cards error. Final5847 nevertheless appends green Complete. Truncation is **not silent**, and retaining the partial note is not a defect.

The majority confirms conflicting final wording; the dissent reads Complete as process completion, given the visible warning. Smallest proposal: use partial/truncated final wording while retaining evidence and available notes. Lifecycle max-tokens-retention fails only the final-label expectation; warning/retention controls pass.

All source/transform/lifecycle target commands exit1 on this version; exact runs and individual assertion outputs are in the datasets and execution record.

## B — concerns without an ordinary-input reproduction

**PROBE:** chunker2074/2077 swallows source-quality/probe exceptions. An injected throwing helper proves suppression and fails a desired diagnostics-unavailable assertion. No ordinary well-shaped input triggering the normally pure quality helper's failure was found. This is a code-path concern, not a reproduced source-file defect.

Native browser scheduling, IndexedDB, PDF/PPTX decoding and Anki import/render hypotheses were not promoted to findings based on inspection alone.

## C — policy recommendations, limits and refuted stronger claims

- **Executed source-poison chain:** original source says readiness lamp green; mock extraction writes red with a true green quote. Real build→kbForAnki→chunk→mock generation→parse→map→dedupe→normalize→preview/export emits red, correct synthetic footer and1/1 associations. Quote location and faithful KB-to-card generation do not establish original-source entailment.
- **Semantic receipt limit:** five unsupported and one inconclusive source-derived fixtures receive adversarial, protocol-valid supported model receipts. Six semantic expectation assertions fail. This proves structural validation cannot guarantee model truth, not a real Gemini error rate. Existing UI/report language attributes judgment to the checker and disclaims certification.
- **A4, hints:** the revealed Text/Extra numeric scanner intentionally omits visible hints. A7mg hint with5mg answer/source can be unflagged. Broader advisory inspection is a scoped product decision, separate from A3.
- **A8, quote denominator:** absent quotes create zero misses, but missing-anchor validation warnings exist. Static JSX3047 chooses green every-first-pass-quote-located wording at zero attempted checks. Recommend checked/missing/failed counts; reject “no diagnostic anywhere.” Browser rendering untested.
- **N2, edits:** README185 explicitly defines source associations, not semantic coverage. Text edits preserve associations but recompute checks and invalidate old checker capture. An optional review-links-after-edit affordance is reasonable; automatic link erasure is not established as a fix.
- **Repaired invalid duplicates:** preservation and manual Keep choices are intentional; identical-front warnings remain. Prefer an explicit merge proposal over automatic deletion after manual edits.
- **Fact IDs:** merge/import rekeys IDs. Actual source-replacement/publication guards invalidate old active associations/registry. External evidence should retain snapshot/hash, not only fact-N.
- **Suggestions/Fixed:** real decoder/queue and every manual disposition leave fields, selection and export unchanged. Fixed is the user's assertion, not an automatic repair or proof an edit occurred.
- **Missing leaf evidence:** public decoder rejects unknown handles/indices/empty supported evidence; mapping remains unmapped/disputed. Empty heuristic warnings are neither approval nor proof of falsehood. No fail-open approval was established.
- **Export:** 756 helper preview/export comparisons pass across hints/entities/Extra, header/reference choices and tier filters. Headerless import requires documented plain-text Pipe settings. No tested serialization loss established; native Anki remains untested.
- **Operator mismatch:** warning retention is explicit policy. No discard/block promotion, new model pass, runtime dependency or automatic clinical correction is proposed.

## Independent refutation and reconciliation

Votes: D=confirm-defect; P=rescope-policy; R=refute; U=not-reproduced. Every candidate was independently considered by all three refuters. No majority-refuted candidate remains in section A.

| Candidate | Code | Guards | Expectations | Final disposition |
|---|---|---|---|---|
| A1 | D | D | D | A: unanimous |
| A2 | D | D | D | A: unanimous |
| A3 | D | D | D | A: unanimous |
| A4 | P | P | P | C: policy/limit or not reproduced |
| A5 | D | D | D | A: unanimous |
| A6 | D | D | D | A: unanimous |
| A7 | D | D | D | A: unanimous |
| A8 | P | P | P | C: policy/limit or not reproduced |
| A9 | D | D | D | A: unanimous |
| N1 | D | D | P | A: majority; contract dissent |
| N2 | R | P | R | Excluded as defect; refuted |
| N3 | D | D | P | A: majority; contract dissent |
| MAXTOK | D | D | P | A: majority; contract dissent |
| REPAIR_DEDUPE | P | P | P | C: policy/limit or not reproduced |
| FACT_RENUMBER | R | R | R | Excluded as defect; refuted |
| OPERATOR | P | P | P | C: policy/limit or not reproduced |
| EXPORT | U | U | U | C: policy/limit or not reproduced |
| PROBE | U | U | U | B: ordinary trigger unproved |
| MISSING_LEAF | R | R | R | Excluded as defect; refuted |
| POISONED_KB | P | P | P | C: policy/limit or not reproduced |
| SUGGESTION | R | R | R | Excluded as defect; refuted |
| QUOTE_PREFIX | D | D | P | A: majority; contract dissent |

N2's unchanged associations are reproducible while its alleged semantic-certification contract is refuted. Likewise, N1/N3/MAXTOK/QUOTE_PREFIX observations are reproducible even though one reviewer disputes the stronger required-behavior expectation. A failing desired assertion is not, by itself, proof of a violated existing contract.

| Prior ID | Reconciliation | Fresh executed basis |
|---|---|---|
| A1 | Confirmed; expanded | Parser-created negation loss plus lost/misaddressed notes; raw evidence remains. |
| A2 | Confirmed; expanded | Text/quote/array/pointer limits, actual save/restore and merge/restore. |
| A3 | Confirmed; expanded | Also demonstrates false warning on faithful Unicode minus. |
| A4 | Re-scoped | Real visible-hint gap, outside declared revealed-only scope. |
| A5 | Confirmed, impact calibrated | Visible error aborts completed chunks; prior saved KB not deleted. |
| A6 | Confirmed | Three malformed shapes become empty; valid-empty/error controls differ. |
| A7 | Confirmed through export | Unread file/page survives footer generation. |
| A8 | Re-scoped | Missing-anchor warning refutes stronger no-warning claim; denominator wording remains. |
| A9 | Confirmed, impact narrowed | Empty successful batch; coverage0/1 and mapping warning are truthful. |

Earlier audit files remain untouched. N1/N3 are majority findings with dissent; N2 is excluded as an implementation defect. QUOTE_PREFIX was discovered and separately challenged during this run.

## Five distinct outcome categories

| Category | Executed evidence | Limit |
|---|---|---|
| Valid-card rejection | Supported wording/formats/entities stay selected; faithful Unicode minus gets false advisory. | No export rejection of valid supported content established in these cases; no comprehensive acceptance rate. |
| Unsupported-card approval | A1 altered instruction and A7 false provenance export; source-poison chain and five fabricated supported receipts demonstrate semantic limits. | Eligibility, associations and a model-supported judgment are not clinical certification. |
| Genuinely inconclusive | Under-specified semantic fixture stays model-supported; invalid receipts remain pending; unmapped/disputed status explicit; A6 erases malformed/empty distinction. | No applicable heuristic warning is not an affirmative verdict. |
| Silent content changes | A1 prefix removal; A2 content/provenance loss; N3 defaults; A3 comparison representation. | Proven alias normalization and reversible tested escaping are not themselves corruption. |
| Lost coverage | A1 lost/misaddressed notes; A2 removed facts; A5 uncommitted chunks; A9 no notes. | Association counts do not promise semantic recall; A9 does not falsely report full linkage. |

## Smallest-first repair plan — proposed only

1. Validate nested primary/omission shapes within existing recovery paths, then label zero-note/truncated/complete outcomes distinctly (A5/A6/A9/MAXTOK). Preserve available work and raw evidence.
2. Preserve app-created saved KBs and disclose/reject external import truncation/defaults, including source caps (A2/N3). Choose import policy explicitly; do not guess priority.
3. Bind primary pointers to actual runtime source/chunk inventory (A7). Retain original model pointer for diagnosis.
4. Preserve malformed note fragments and stable ledger addresses without reconstructing clinical prose (A1).
5. Correct minus/exponent comparison while retaining warning severity (A3).
6. Agree final exact dedupe semantics before adding a provenance-preserving post-normalization pass (N1); retain manual/invalid notes.
7. Measure token-boundary warnings against valid substring/dehyphenation cases, then separately authorize any changed omission admission rule (QUOTE_PREFIX).
8. Keep section C UI/advisory ideas separate from deterministic repairs; no new AI audit, generation pass or automatic correction.

Each later behavior change needs a non-vacuous main-harness regression and unified verification. This audit's four scripts remain standalone; EXPECTED_ASSERTIONS stays2564.

## Verification and limits

| Final executed command | Exit | Result |
|---|---:|---|
| node verify-repo.js | 0 | 2564 passed/0 failed; all11 frozen hashes; full JSX Babel transform |
| node tools/reaudit-anki-source-tests.js | 1 | 32 cases:18 pass/14 desired failures;2 mutants killed |
| node tools/reaudit-anki-transform-tests.js | 1 | 63 fixtures;923 assertions:914 pass/9 desired failures;756 equivalence passes;3 mutants killed |
| node tools/reaudit-anki-lifecycle-tests.js | 1 | 38 assertions:36 pass/2 status failures;0 unexpected errors;1 predicate mutant killed |
| node tools/reaudit-anki-receipt-tests.js | 1 | 54 controls pass/6 semantic-limit failures;2 mutants killed/1 survives |

Counts are not combined into one accuracy score. Source failures include repeated manifestations, a stronger boundary expectation and an injected concern; receipt failures are semantic limits, not six deterministic bugs.

Earlier scripts all exited0 read-only: source29 groups/4 mutants; transform40 groups/3 mutants/15 known expectations; lifecycle24 scenarios/1 mutant; receipt55 checks/2 killed/1 survivor. Their characterization tests remaining green does not negate desired-behavior failures.

Requested guard families were inverted in memory: pass-2 discard/publication; live lint selection; dedupe key; numeric supported-membership; run identity/source/abort; receipt handles/token inventory. Kills rely on newly failing production-passing controls. The lifecycle mutation checks the extracted predicate; full-handler races execute separately. Bypassing only the receipt's first handle guard survives because later validation still quarantines the unknown handle; the first guard's particular diagnostic is not independently pinned. This coverage gap is retained.

Live extraction requires unique anchors and non-vacuous tails. The lifecycle harness runs actual handler sequencing with a deterministic hook scheduler; other suites compose actual helpers for stage visibility. Snapshots use actual ankiSourceSnapshot and sources:[{filename,location}]. Note fixtures capture parse→map→dedupe→normalize→lint→edit/no-op→export and actual preview strings; source-only cases capture relevant source/import/build/persistence transitions. Synthetic boundary mocks supply expected values independently of validators.

**Not tested:** ignored private PDFs/decks/KBs/images/transcripts; real Gemini quality/quota; native Anki import/render; real React/browser event scheduling; native IndexedDB; native PDF/PPTX decoding and visual reading order; independent clinical correctness. Playwright/Chrome are not installed; every browser suite is **not tested**, never passed. No installations, live API calls, commits or production fixes were performed.

