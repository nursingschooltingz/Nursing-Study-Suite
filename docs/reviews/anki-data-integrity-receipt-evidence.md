# Optional source-check evidence — 2026-09-18

Scope: the actual v16.6 text-only Anki source-check parser, queue, retry merge, currentness and report helpers. No production edits or API calls. This supplements `anki-data-integrity-audit-2026-09-18.md`.

## Reproduction

```text
node tools/audit-anki-receipt-tests.js --out docs/reviews/anki-data-integrity-receipt-results.json
```

Executed successfully: **55 characterization/control assertions**. The JSON contains the complete synthetic response and each note after parsing, mapping, deduplication, tag normalization, the advisory audit and export. Helpers are extracted from the live HTML, with unique start/end anchors and a non-vacuous tail check. Only UID, Web Crypto and TextEncoder are injected. There is no replacement implementation of the pipeline.

The tests deliberately submit incorrect *mock checker verdicts*. They measure what the application will accept, not how often Gemini makes those judgments. Passing characterization assertions confirm reproduction; they do not count an unsupported card as semantically correct.

## Source-based outcomes, kept separate

All examples use invented workshop instructions, not clinical advice. The usual source is `The red marker belongs in the north drawer.` The checker returns an exact full-source token range, an existing `n1` handle and existing cloze index 1, marks the target `tested`, and marks Text/Extra `supported` as applicable.

| Case | Independent expectation and rationale | Actual result |
|---|---|---|
| `The red marker belongs in the {{c1::north}} drawer.` | Supported: copies the supplied destination | Complete receipt; supported; exported intact |
| `Place the red marker in the {{c1::north}} drawer.` | Supported: a faithful wording variant | Complete receipt; supported; exported intact |
| `The red marker belongs in the {{c1::south}} drawer.` | Unsupported: south contradicts north | Complete receipt; supported; no queue finding; exportable |
| `The red marker does not belong in the {{c1::north}} drawer.` | Unsupported: visible negation reverses the proposition | Complete receipt; supported; no queue finding; exportable |
| Correct Text plus Extra `The marker dissolves in water.` | Unsupported Extra: source supplies no solubility claim | Both fields supported; no queue finding; exportable |
| `{{c1::north::sterile drawer}}` in otherwise correct Text | Unsupported hint: source supplies no sterility claim | Complete receipt; supported; no queue finding; exportable |
| North/red-marker card cited to `The blue square belongs in the east cabinet.` | Unsupported: the existing source concerns a different object and destination | Complete receipt; supported; no queue finding; exportable |
| `Place the marker in the {{c1::north}} drawer.` with source `A red marker goes north; a blue marker goes south.` | Inconclusive: omitted color makes the answer underdetermined | Complete receipt; supported; no queue finding; exportable |

**Two supported controls remain intact, five unsupported fixtures are accepted, and one independently inconclusive fixture is accepted as supported.** These are deliberately chosen counterexamples, not prevalence estimates. No content is changed or deleted by the optional audit. No source-fidelity pass rate is asserted.

## Classification: reproducible semantic limitation, not a new structural-parser bug

`ankiParseSourceAuditV4` (HTML:4923), `ankiValidateSourceAuditRecords` (4824), and `ankiAuditSourceRange` (4658) validate addresses, identity, inventory accounting and relationships between receipt statuses and findings. They do not prove entailment between the entire card and a source. A real fact ID, a real quote, and a real cloze index can all belong to a false claim.

`ankiEvidenceReviewIssues` (5286) adds bounded warnings for short/noun-only citations and certain qualifier shifts. Full citations and unrecognized predicates escape those heuristics. `ankiAuditReviewItems` (5321) adds the surviving warnings to an advisory queue. It never changes Keep or export eligibility. The V4 prompt asks the model to check full meaning, including visible text and Extra (4679), but this is an instruction to an imperfect checker, not an independently verified property.

The application explicitly says model judgments are advisory; report metadata says completed requests and validated references do not certify correctness or completeness (5089–5104). Therefore these counterexamples demonstrate a consequential limit, not a violation of the documented decision to keep warnings advisory. A smallest-first response is to retain these fixtures and make supported receipts visibly attributable to the checker. Do **not** turn lexical heuristics or missing evidence into automatic rejection or deselection. No prompt change or additional AI pass is proposed by this audit.

Source fidelity is also distinct from clinical correctness: even a faithful card cannot establish whether a supplied source is clinically right.

## Partial retry produces conflicting current evidence

Minimal reproduction in the test:

1. Attempt 1 returns a valid `unsupported` Text receipt and matching finding, but omits the required fact receipt. The group remains partial.
2. Attempt 2 returns a complete result for the *same captured card and source*, now marking Text `supported`, with no findings.
3. `ankiMergeSourceAuditResult` (5048–5061) replaces the note receipt by note ID but unions old and new findings. The complete merged result has both a current supported Text receipt and the former unsupported finding. `ankiAuditReviewItems` still puts that old finding in the active queue.

This is **a design/provenance concern**, not proof that the old or new model judgment is correct. Retaining unresolved earlier warnings is deliberately conservative. The weakness is that active finding objects do not identify which attempt produced or superseded them; readers must reconstruct that from saved raw attempts. The smallest proposed change is attempt attribution and an explicit conflict/review label, while retaining both judgments in history. Do not automatically erase the old warning or clear coverage. A regression should assert that conflicting attempts remain inspectable and clearly distinguished without mutating notes.

## Controls and failures

- Invalid note evidence is quarantined while an independently valid fact record survives. Unknown/near-match handles are not guessed. Missing inventory tokens remain incomplete.
- Empty, truncated JSON and missing-schema responses throw rather than becoming success.
- An entire fact marked context can be structurally complete with zero targets, but produces `inventory-context` in the advisory queue. This exposes the classification without pretending every token was tested.
- Text, Extra, selection and source-link edits, a new source batch, tier changes, and a stale source invalidate the captured audit under the immutable update paths used by the UI. Reports label such results outdated and set `checkComplete:false`.
- Malformed records remain pending. Report completion records protocol/request completion, with its semantic limitation explicitly retained.
- Source-check suggestions are displayed only; no automatic clinical repair or model-knowledge correction is applied.
- Exact cross-chunk deduplication retains both source IDs, and both audit groups retain the surviving note and supporting facts. Keeping the representative note's first chunk does not lose these source-check associations.

Currentness uses object identity (`ankiSourceAuditCurrent`, 5369). An in-place mutation by future code would evade that guard; this is a code-path concern, not a reproduced current UI defect. The audited UI edits replace the cards array and source replacement updates the batch/current flag. New mutable code needs a regression or an explicit content signature.

## Mutation evidence

Mutations are made only to an extracted in-memory function string. The HTML is never written, so no restoration of production bytes is needed.

| Mutation | Result | Meaning |
|---|---|---|
| Bypass full-source token accounting | **Killed**: the independent omitted-tail control fails | The inventory completeness assertion detects removal of this protection |
| Invert captured-card currentness comparison | **Killed**: a current capture fails the control | Currentness checks are exercised |
| Bypass the first note-handle guard only | **Survives** | Later dereferencing/validation still quarantines the unknown handle. Outcome tests do not independently enforce the exact first-guard diagnostic. This is a disclosed mutation coverage gap, not evidence that unknown IDs pass. |

The semantic counterexamples cannot be resolved merely by making these structural mutation tests stronger. An exact address is not an entailment oracle.
