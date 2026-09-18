# Independent optional-check re-audit

Date: 2026-09-18. Source: `Nursing-Study-Suite v16.6.html`, commit `b6eb73ceabb7c8d292c186b07148c86949b37d34`, SHA-256 `8524e35c8b3621e074a0499ba3857a672464b99721e4b502c381dfa29d0b9b12`. This evidence does not modify or replace the prior audit.

## Executed tests

```text
node tools/reaudit-anki-receipt-tests.js
node tools/reaudit-anki-receipt-tests.js --json
```

The first development execution reported 50 passing controls and six unmet semantic expectations; four controls were then added. The final JSON execution reports **54 passing controls and six failing desired semantic expectations, exit 1**. This is an intentional failing audit suite, not a production regression gate. The six failures are semantic-checking limitations, not six deterministic coding defects. The exact command output and serializable traces are included in the main results JSON.

The script independently extracts the actual helper block from `function ankiParseCards(raw` to `function AnkiStyleBadges`, verifies each anchor is unique, and asserts the final review-decision helper is present. Only UID, Web Crypto and TextEncoder are injected. It uses the existing `tools/fixtures/anki-audit-response.js` solely to fabricate protocol-valid **model responses**, never to determine what the source means. Every fixture starts with a KB and calls the real `ankiSourceSnapshot`; captured pointers have production `sources:[{filename,location}]` shape. No prior audit implementation is imported.

Each ordinary fixture records the raw response, before/after parse, mapping, dedupe, Condition normalization, lint, explicit no-edit stage, plain/headered/reference exports and masked/revealed previews. The review-decision fixture records original notes before/after suggestions and each acknowledgement. The export equivalence assertion decodes only the emitted HTML escapes; this is not a claim that native Anki was run.

## Independent semantic expectations

Default source: `Store the red marker in the north drawer.` None of these examples uses medical knowledge.

| Fixture | Source-based desired outcome | Actual behavior |
|---|---|---|
| Supplied north destination | Supported; retain note unchanged | Pass |
| `Place` paraphrase | Supported; storage relation unchanged | Pass |
| South answer with an exact north citation | Unsupported: contradictory destination | Receipt remains `supported`; desired assertion fails |
| Visible `Do not store` with north hidden | Unsupported: reverses the directive outside the cloze | Receipt remains `supported`; desired assertion fails |
| Extra says marker dissolves in water | Unsupported: no supplied solubility information | Extra remains `supported`; desired assertion fails |
| Hint calls the drawer sterile | Unsupported: source has no sterility property | Receipt remains `supported`; desired assertion fails |
| North/red-marker card cites blue-square/east-cabinet fact | Unsupported: existing ID is irrelevant evidence | Receipt remains `supported`; desired assertion fails |
| Source distinguishes red→north and blue→south; card omits color | Inconclusive: target is underdetermined | Receipt remains `supported`; desired assertion fails |
| Literal entities, angle brackets, quotes, hint and Extra | Preserve exact text-only field values and all preview fronts/backs | Pass for both plain and headered helper exports |

The complete source token range, valid note handle and valid cloze index do not establish entailment. The desired assertions compare the accepted status to the written source expectation; they do not assert the current defective status or a fixed number of failures. A future improvement may make a failure pass without requiring its test to be rewritten to expect a new defect count.

These are deliberately adversarial mock checker judgments, not a measured model failure rate. No new clinical validator, new checker pass or automatic correction follows from them. The UI at HTML:5466–5479 explicitly attributes these judgments to the checker and warns that traceability does not prove meaning or exhaustive recall. The report at 5089–5104 retains the same limitation.

## Direct challenge of missing-evidence branches

`ankiReceiptRecallIssues` (5148–5163) returns no local numeric-recall warning for missing fact, invalid source span or absent/invalid note references. `ankiRecallIssues` (5134–5146) stops source-script comparison when mappings are absent, unknown or disputed. These are applicability checks, not affirmative approval functions.

The tests exercise the leaf shapes and then the production boundary:

- Unknown note handles, absent cloze indices, unknown source facts and a supported field with empty evidence make `ankiParseSourceAuditV4` incomplete; invalid records remain unresolved.
- An unsupported field without its required finding also remains incomplete. Missing evidence alone is not converted into a proven-false verdict.
- A numeric target that really has `7` in its supplied span, but only `blue` hidden in its referenced card, produces `receipt-number-mismatch` as a positive control.
- A missing or disputed mapping remains visibly `unmapped`/`mapping-review` through `ankiSourceLinkStatus`, even though the script heuristic returns no warning. The script captures the numeric status too.
- A false-negative mock checker finding against a supported card does not deselect it or change export bytes.

Therefore the proposed “empty leaf result means fail-open approval” finding is **not established** for these executed public call paths. Returning no applicable warning is not a semantic pass. Adding a structured inconclusive result to every heuristic may be a useful design choice, but is not an existing contract whose violation was proved here.

## Suggestion and manual review lifecycle

The mock checker proposes `[Marker] Use {{c1::radiation}} to sterilize the marker.` This is unsupported by the supplied drawer instruction. The real decoder/queue retains the suggestion as advisory text. The script calls `ankiMakeReviewDecision` (5395) for `fixed`, `intentional-context`, `covered-elsewhere` and `unresolved`, and calls the corresponding currentness and evidence functions.

Desired invariants all pass: neither suggestion display nor any acknowledgement changes Text, Extra, Tags, Keep, selection or export bytes. Text, source batch, selected tier and manual selection changes invalidate captured decisions. An absent covered-by note throws. `fixed` is a **manual assertion** that the student reviewed the item, not an automatic repair or proof a correct edit occurred. It must not be interpreted as independent source validation.

No evidence supports a current automatic “repair from model memory” path in the text-only Anki tool. Users can manually copy an unsupported suggestion; preventing that would require a separate policy, not a silent clinical rewrite.

## Retry and evidence controls

The real decoder retains a valid fact record from one partial attempt and a valid note receipt from a complementary retry. The real merge completes the same immutable packet, does not duplicate records on replay, and rejects a different captured fact body. No note content is rewritten. A stale capture produces `checkComplete:false` in downloaded evidence. Actual request scheduling/cancellation and pending-group retry dispatch are covered by the independent lifecycle script.

## Safeguard inventory

| Definition / call sites | Evidence / actual predicate | Effect, errors and later boundary |
|---|---|---|
| `ankiAuditGroups` 4600; prepare 5658 | Captured KB snapshot, actual note structure/Keep/tier, chunk IDs; unique nonempty IDs; actual V4 wire payload <=24000 characters | Rejects ambiguous identities and oversized indivisible packets; never truncates them. Linked support facts accompany the selected source facts. Does not determine source truth. |
| `ankiAuditSourceTokens` 4654 / `ankiAuditSourceRange` 4658; packet 4667, decoder 4936 | Exact whitespace token addresses, integer ordered bounds and known fact | Produces exact source substring or rejects. No unit/case rewrite. Correct substring does not entail the card. |
| `ankiParseSourceAuditV4` 4923; run 5706 | Exact response keys; packet handles; complete nonoverlapping token inventory; existing hidden indices; context-role rules; required note/fact records | Good independent records survive malformed neighbors. Invalid JSON throws; unresolved records keep group partial. Does not semantically verify a model-supported field. |
| `ankiValidateSourceAuditRecords` 4824; called by V4 at 4948 | Exact record schema, valid IDs, selection eligibility, real spans; status-specific required findings | Prevents empty supported evidence and unknown references. Explicit unsupported judgments remain advisory; originals remain exportable. |
| `ankiReceiptRecallIssues` 5148; queue 5362 | Literal source numbers versus numbers in cited existing hidden answers | Warns if a tested source number is not hidden. Missing/invalid inputs return no applicable warning; decoder rejects them before accepted receipt use. |
| `ankiRecallIssues` 5134; queue 5366 | Valid note plus complete undisputed linked sources; bounded unexpected-script/style checks | Warning only. No mapping skips source comparison, while separate mapping/numeric indicators remain inconclusive. |
| `ankiSuggestionWarnings` 5164; queue 5344 | Proposed text, cloze syntax/counts, answer-bearing hints, mixed-tier deletion suggestion | Adds advisory warnings. Does not apply any suggested edit or supply missing clinical evidence. |
| `ankiAuditReviewItems` 5321 | Current capture, accepted findings/receipts, currently eligible notes and supplied facts | Adds advisory queue entries; stale accepted findings do not enter current queue. No finding auto-deselects or rewrites a note. |
| `ankiMakeReviewDecision` 5395; UI save handler 5601 | Existing item, allowed disposition, current source and eligible covered-by note | Creates a manual record. Invalid covered-by identity throws. It cannot prove an edit occurred or semantic coverage. |
| `ankiReviewDecisionCurrent` 5388 / `ankiReviewDecisionEvidence` 5402 | Item key/signature; exact cards/batch/tier identity and prepared audit timestamp | Marks changed evidence or superseded choices outdated; preserves history without source object references. |
| `ankiMergeSourceAuditResult` 5048 / `ankiSourceAuditPending` 5373; run 5708 | Same captured packet signature; independently accepted required records | Merges by record ID, retains findings, skips completed groups. A partial/invalid record cannot manufacture completion. Contradictory judgments across attempts remain a separate provenance design issue. |
| `ankiSourceAuditEvidence` 5089 | Currentness, requested/accepted/pending groups, unresolved failures, source/card hashes | Explicitly distinguishes protocol completion from semantic correctness and labels changed captures outdated. Hashes identify captured bytes, not truth. |

## Mutations and limitations

All mutations apply to in-memory extracted strings only; production bytes never move.

| Mutation | Outcome |
|---|---|
| Bypass complete source-token inventory guard | Killed: missing-tail desired assertion fails |
| Guess `n01` as `n1` | Killed: exact-handle rejection assertion fails |
| Bypass only first handle guard | Survives: downstream dereference/validation still quarantines the unknown handle. The outcome test does not independently pin the first guard's diagnostic; this gap is disclosed. |

No model, browser, native Anki or private course material was used. The new snapshots repair the prior fixture-shape gap without modifying its files. An accepted fabricated semantic receipt remains a limitation; missing applicability evidence is not itself a reproduced false approval. Changing these policies requires separate approval. Production fixes are not applied.
