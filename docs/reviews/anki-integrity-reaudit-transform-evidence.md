# Independent Anki transform evidence — 2026-09-18

This stage band independently read the shipped HTML and routed repository guidance. Earlier audit reports/scripts were not read as discovery authority. Only public application code and synthetic fixtures were used. Production files, prompts and settings were not edited.

Executed command: `node tools/reaudit-anki-transform-tests.js --out docs/reviews/anki-integrity-reaudit-transform-results.json`. Exit **1** is intentional: **63 fixtures, 923 desired-behavior assertions, 914 passed, 9 failed**. All three in-memory mutants were killed by assertions that pass against production. Full inputs, real source snapshots, before/after stages, preview strings, decoded export records, results and mutation failures are in the adjacent results JSON. The command/action journal is `anki-integrity-reaudit-transform-commands.json`.

HTML SHA-256 observed by this script: `8524e35c8b3621e074a0499ba3857a672464b99721e4b502c381dfa29d0b9b12`. The coordinator owns the before/after production-byte proof and unified verifier runs.

## Extraction and test method

The script extracts the **actual** span `function ankiParseCards(raw` → `function AnkiStyleBadges` (HTML 4142–5407), the production terminology scanner and the exact `updateField` callback (5861). Every start, end and mutation anchor is unique; extraction order is asserted. The near-tail `ankiReviewDecisionEvidence` is executed with an actual current local decision and checked for current/superseded/reason values. The scanner tail is exercised using `5.0 mg`. These prevent a truncated or empty extraction from passing.

`uid` is the helper span's only invoked external. The extracted edit callback receives explicit `useCallback`, `setCards`, `lintAnkiCard` and real `ankiUnsafeAbbrevScan` dependencies. No production algorithm is rewritten. Every fixture uses the real `ankiSourceSnapshot` with its `sources:[{filename,location}]` shape. The before/after trace covers parse, map, dedupe, normalize, lint, edit, numeric and export. Fixtures without edits record an explicit no-op edit stage. The helper stage sequence is composed for inspection; companion lifecycle tests cover the actual generation handler.

Source-derived expectations accompany each fixture. Unsupported semantic fixtures are **not** converted into a requirement to reject export: warning policy remains unchanged. A structural pass, an existing fact ID and an absence of numeric warnings are not semantic approval.

## Safeguard inventory

Line numbers refer to `Nursing-Study-Suite v16.6.html`.

| Safeguard and definition | Actual call path and evidence | Action, limitation and downstream behavior |
|---|---|---|
| `ankiParseCards`, 4142 | Generation 5817; first fenced block or raw fallback | Trims and splits lines/fields, ignores all lines without `|`. Two/four-field rows are retained invalid; unpiped fragments are deleted before lint. `needsReview` does not itself gate export. |
| `parseKBCoverage`, 4155; `attachCoverageToCards`, 4177 | Generation 5824; captured snapshot and caller-provided chunk IDs | Accepts many-to-many declared edges, rejects unknown/out-of-chunk IDs and invalid destinations, records missing/duplicate/conflicting declarations. It proves address validity, not semantic support. Its note addresses inherit parser sourceLine numbering. |
| `ankiDedupeCards`, 4204 | Generation 5826, before condition normalization | Valid exact Text/Extra/effective tag-set/Keep duplicates merge links. Invalid notes are preserved. No semantic fuzzy deletion. No later dedupe occurs after tag normalization or edits. |
| `ankiNormalizeConditionTags`, 4274 | Generation 5826; real source names/aliases and reliable mappings | Changes only proven unambiguous aliases, records all outcomes. Unreliable/mixed mappings are left for review. Normalization can make surviving notes byte-identical. |
| `parseAnkiClozes`, 4304; `lintAnkiCard`, 4336 | Dedupe, generation, edit 5868, selection/export | Checks flat syntax, positive indices, at most three indices, tier, captured hierarchical tags, pipes and line breaks. Errors exclude notes through selection. Structure cannot prove source meaning. |
| `ankiSelection`, 4358 | Summary 4295; export 4474 | Recomputes live lint, tier and manual Keep; stale source gives zero kept notes. Repair preserves manual choice. Tested valid/invalid, selected/unselected and current/stale cases. |
| `ankiNumericTokens`, 4387; `ankiNumericAudit`, 4406 | Card UI, batch diagnostics; linked immutable source snapshot | Compares normalized value/unit membership in fact text. Quote-only and unsupported forms warn. Invalid, stale or unmapped notes are explicitly not checked. Numeric warnings never gate export. Revealed Text/Extra omit hints; comparator/role/clinical meaning are outside this check. |
| `ankiCollisionGroups`, 4431 | Diagnostics and current review UI | Groups actual identical masked fronts with expected answers. Advisory only; repaired invalid duplicates and normalized duplicates remain discoverable. |
| `ankiSourcePointers`, 4464; `ankiExportText`, 4473 | Download callback 5878–5882 | Revalidates selection. Header mode escapes `& < >` in Text/Extra and adds trusted `<br>` for optional pointers. Tags are unchanged; footer composition does not mutate editable Extra. Headerless contract depends on explicit plain-text Pipe import settings. |
| `updateField`, 5861 | Table edits | Recomputes both lint tiers and resets pipeCount while preserving Keep. Actual field bytes are still validated, so inserted pipes/newlines cannot escape via pipeCount. It does not re-dedupe. |

## A. Reproduced defects

### T1 — dropped multiline negation can invert an exported instruction (high; reconciles A1)

Source fact: `Do not administer the intervention.` The generated first block contains:

```text
Do not
{{c1::administer the intervention}}.||Nursing::LATTE::Treatments Condition::DiabetesMellitus Tier::1
```

The ledger maps `fact-0 -> #1`. The parser deletes `Do not`. The remaining affirmative note is mapped, lint-clean, kept and exported. The numeric status is `No supported numeric values found`; the linked count is 1/1. No deterministic later stage restores or diagnoses the lost negation. The raw response remains available in batch diagnostics, so this is loss from the active note/deck, not irreversible destruction of every copy.

Expected: preserve the prohibition or keep the malformed record visibly ineligible until repaired. The source explicitly prohibits the action. Desired regression `multiline-negation-prefix-lost:no-exported-negation-loss` fails today.

Related executed examples: an entirely unpiped cloze note is dropped; the following valid note becomes line 1 and receives the dropped note's fact link. `fact-1 -> #2` becomes invalid-destination. A truncated final unpiped cloze also disappears. Mapping diagnostics and, in the numeric example, a number warning mitigate the sourceLine case but do not repair its source association. The truncated raw response is retained elsewhere; lifecycle completion status is assessed by the companion script.

Smallest repair direction: retain malformed note-like fragments and a reliable source-line boundary instead of silently interpreting their remainder as a standalone valid note. A repair must keep raw evidence and must not guess a clinical reconstruction. This changes parsing behavior but requires no prompt edit or new model call.

### T2 — numeric tokenizer loses a mathematical minus or unit exponent (medium; reconciles A3)

| Supplied fact | Card claim | Actual numeric result | Expected |
|---|---|---|---|
| `Temperature is 5 °C.` | `Temperature is {{c1::−5 °C}}.` | `No numeric mismatch detected`, one checked token | Advisory discrepancy, because −5 differs from +5 |
| `Temperature is -5 °C.` | `Temperature is {{c1::−5 °C}}.` | Discrepancy for `5 °c` | No mismatch, because these minus glyphs denote the same value |
| `Length is 5 cm.` | `Area is {{c1::5 cm²}}.` | `No numeric mismatch detected` | Unsupported-unit review or discrepancy |
| `Length is 5 cm.` | `Volume is {{c1::5 cm³}}.` | `No numeric mismatch detected` | Unsupported-unit review or discrepancy |

All four notes remain exportable by deliberate warning-only policy. The bug is inaccurate warning status: an altered claim is treated as matching, and a faithful negative value receives a false warning. ASCII signed mismatch, changed number/unit, fraction/scientific unsupported forms, quote-only support and unsupported Extra numbers do warn in controls.

Root cause: `ANKI_NUMBER_PART` (4384) recognizes ASCII signs only, and token/unit boundaries admit a base-unit prefix before a superscript. Smallest fix: preserve/normalize U+2212 sign identity and consume or explicitly reject the entire unit exponent form before matching a base unit. Keep warning severity. Four source-derived `numeric-verdict` assertions are the regression targets.

### T3 — dedupe followed by alias normalization produces identical exported rows (low; N1)

Two otherwise identical `Dose is {{c1::5 mg}}.` notes carry `Condition::DM` and `Condition::DiabetesMellitus`; the real snapshot names `Diabetes mellitus` and supplies alias `DM`. Both map cleanly to `fact-0`.

Observed stage counts: **2 parsed → 2 mapped → 2 deduped → 2 normalized → 2 eligible → 2 byte-identical exported rows**. The alias normalization is justified; its ordering defeats the exact-duplicate goal. The identical-front advisory does appear, mitigating discovery but not duplicate export. Whether native Anki creates a new note or updates/skips an existing one is import-setting dependent and was not tested.

Expected: equivalent generated final records should be deduped while preserving all source links and normalization provenance. `alias-normalization-collision:no-byte-identical-export-duplicates` fails today. Smallest repair direction: a final exact-equivalence pass after normalization, preserving original note references, source unions and normalization diagnostics. Do not extend this into fuzzy deletion.

## B. Scope limits and refuted stronger claims

- **Visible numeric hints (A4 re-scope):** `Dose is {{c1::5 mg::7 mg}}.` against `Dose is 5 mg.` exports a front containing `[7 mg]`, but numeric checking reports no mismatch because it scans revealed content. This is a reproduced full-visible-content coverage gap. The shipped comment/README deliberately scope this check to revealed Text and Extra, so it is not described here as a regression against that declared algorithm. Broadening warning coverage to hints requires a scoped behavior decision; no export-blocking rule is proposed.
- **Semantic relations:** qualifier strengthening, negation reversal supplied entirely by the model, comparator reversal, route/population/timeframe changes, unrelated existing references and unsupported Extra prose can remain structurally eligible without numeric warnings. Every fixture explicitly records why its supplied source does not support the altered claim. These are heuristic/association limits, not evidence that membership checking promised to decide clinical entailment. The parser-created negation loss in T1 is different: the application itself deletes meaning.
- **Invalid duplicates after repair:** two invalid notes are intentionally exempt from dedupe. Both can become identical and exportable through the real edit callback. Identical-front warnings then identify them. Automatic dedupe on manual edits is a policy choice and could violate a student's intentional editing/selection; this audit asserts advisory discoverability, not automatic deletion.
- **Preview/export disagreement:** all **756** baseline equivalence assertions passed: 63 fixtures × header on/off × references on/off × all/tier-1/tier-2. The independent decoder checks field counts, one HTML decode layer, literal entities/angle brackets, hints, each masked/revealed review, note/review counts and export-only footer differences. It also checks read-only exports. Invalid/stale/unselected fixtures test absence from export. This refutes a blanket claim that the tested supported serialization path alters visible content. Native Anki is not covered; headerless export presumes explicit plain-text import settings.
- **Valid-card rejection:** supported exact values, synonyms, decimal/grouping/range variants, faithful paraphrase and flat clozes stay eligible. The faithful Unicode-minus case gets a false advisory, not an export rejection. Malformed structures are correctly ineligible; repairing an unchecked note keeps it unchecked. Different Extra/answers/effective tags and Keep distinctions are retained; exact duplicates union links.

## Mutation sensitivity and limits

The numeric `supported.has` short-circuit mutant produces six new failures; removal of the live lint-selection filter produces 73; a Text-only dedupe key produces five. Mutants only change in-memory extracted source. They are counted killed only by newly failing assertions that pass on production, never by already-failing defect targets.

This report does not collapse structural validity, numeric warnings, unsupported semantic claims, inconclusive/not-checked outcomes, silent content changes and fact associations into one accuracy rate. The 914 passing assertions are deterministic checks, not a card-fidelity or clinical-accuracy score. Actual API retries/publication/overlap, source-check receipts, ingestion and persistence belong to the companion audit bands. Native Anki, real browser/IndexedDB/event interleaving, private materials and live generation were not tested.
