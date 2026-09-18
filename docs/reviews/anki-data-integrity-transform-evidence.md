# Anki transformation and export audit evidence — 2026-09-18

This is an audit, not a production change. The exercised application is `Nursing-Study-Suite v16.6.html`, commit `b6eb73ceabb7c8d292c186b07148c86949b37d34`, SHA-256 `8524e35c8b3621e074a0499ba3857a672464b99721e4b502c381dfa29d0b9b12`. Initial status contained two unrelated untracked review files, neither read nor changed. All examples below are invented source text, not clinical guidance or private course material.

The standalone [test](../../tools/audit-anki-transform-tests.js) follows the repository harness pattern: exact, unique anchors extract and execute the actual shipped function span. A tail assertion requires `ankiReviewDecisionEvidence` to remain present. No copied parser, numeric scanner, renderer, normalizer, or exporter substitutes for production code. Immutable synthetic KBs and synthetic responses define source-based expectations independently of the numeric check. It records each response, parse, source-link attachment, dedupe, tag normalization, lint/numeric check, preview, and export stage in the [saved JSON](anki-data-integrity-transform-results.json).

## Execution and interpretation

Run from the repository root:

```text
node tools/audit-anki-transform-tests.js
```

Observed exit **0**: **40 control groups passed; 3/3 in-memory mutations were killed; 15 independent semantic expectations remain unmet**. Five are manifestations of the three reproduced implementation issues below; ten are documented semantic-check limitations. A zero exit means the audit reproduced its documented current behavior and the controls passed. It does **not** mean every note is faithful or every safeguard passes its desired semantic expectation.

```text
node tools/audit-anki-transform-tests.js --strict
```

Observed exit **1**, deliberately reporting the same 15 unmet expectations. The strict mode is a demonstration of known gaps, not a new repository gate. Existing verifier/assertion totals were not changed.

```powershell
node tools/audit-anki-transform-tests.js --json | Set-Content -LiteralPath docs/reviews/anki-data-integrity-transform-results.json -Encoding utf8
```

Executed successfully. The saved file contains synthetic data only. Mutations were never written to the HTML:

| Isolated in-memory mutation | Independent assertion that failed |
|---|---|
| Replace `if(supported.has(token.key))continue;` with `if(true)continue;` | Invented `17 mg` must return `Numeric discrepancy`, not a clean result |
| Bypass `lintAnkiCard` in `ankiSelection` | A note with an embedded pipe must not enter the export selection |
| Change exact Text dedupe key to masked front | Same visible front with different hidden answers must retain two notes |

These demonstrate sensitivity to numeric checking, structural exclusion, and destructive dedupe. They do not establish mutation coverage for every safeguard or semantic proposition.

## Reproduced implementation defects

### T1 — P1: the line parser can delete negation/population and export the opposite instruction

**Location:** `ankiParseCards`, HTML lines 4142–4150; generation call 5817. Downstream `lintAnkiCard` 4336, `ankiNumericAudit` 4406, `ankiBatchSummary` 4294, and `ankiExportText` 4473 all accept the surviving row under their respective contracts.

Minimal supplied fact:

```text
fact-1: In children do not administer 5 mg orally.
```

Synthetic response (a physical newline inside Text):

```text
[Demo] In children do not
administer {{c1::5 mg}} orally.||Nursing::LATTE::Treatments Condition::Demo Tier::1
```

Mapping: `fact-1 -> line #1`.

Expected: preserve the full proposition, or retain the malformed row as visibly invalid for manual correction. Its formatting violation must not silently turn a prohibition into an affirmative instruction. The response is malformed under the one-line output contract; this finding does not claim that multiline notes should become automatically exportable.

Actual saved stages:

```text
parsed Text: administer {{c1::5 mg}} orally.
needsReview: false
lint: []
factIds: ["fact-1"]
numeric: No numeric mismatch detected (1 token)
kept notes: 1; reviews: 1; linked facts: 1
exported body: administer {{c1::5 mg}} orally.||Nursing::LATTE::Treatments Condition::Demo Tier::1
```

The parser trims each physical line and silently returns for every line without a pipe. It neither records ignored nonempty content nor marks the adjacent row as uncertain. Subsequent checks see only the shortened Text. The retained number and source ID cannot restore the lost context. Original responses remain downloadable in batch diagnostics, so the raw evidence is not destroyed; the editable/exported note nevertheless loses meaning without a structural finding.

Related manifestation: a fully source-supported `Observe {{c1::the blue indicator}}.` response with no pipe separators creates **zero notes**. It is malformed output, but its substantive content disappears from the card table instead of remaining as an invalid row. The corresponding fact remains uncovered. This is lost supported content, not a rejection of an otherwise conforming three-field note.

**Smallest proposed fix:** make nonempty, unparsed content inside the designated note block explicit parser evidence. Retain malformed candidates and conservatively invalidate affected row association when continuation or line numbering is ambiguous. Do not guess which sentence belongs to which row, concatenate arbitrary commentary, or rewrite clinical wording. Good independent rows should remain available. Regression risk: model prose, header rows and existing line-number maps must not be accidentally treated as cards or shifted without a diagnostic. Prevent recurrence with `multiline-negation-loss`, `missing-delimiters`, and the supported one-line control.

### T2 — P2: numeric tokenization silently drops a Unicode minus and a unit exponent

**Location:** `ankiNumericText` 4365; `ANKI_NUMBER_PART` 4384; `ANKI_SUPPORTED_UNIT` 4386; `ankiNumericTokens` 4387–4404. `ankiNumericAudit` uses those tokens at 4412–4428.

Minimal independent cases:

| Source fact | Response Text | Actual normalized token and verdict |
|---|---|---|
| `The calibration reference is 5 °C.` | `[Demo] Calibration: {{c1::−5 °C}}.` | `5 °c`; `No numeric mismatch detected` |
| `The reference line is 5 cm long.` | `[Demo] Reference measurement: {{c1::5 cm²}}.` | `5 cm`; `No numeric mismatch detected` |

Both notes have a clean source map and valid structure and export unchanged. The minus is U+2212. In each case the expected result is a discrepancy or explicit unsupported-form review, never a clean value/unit comparison: positive and negative temperatures differ; length and area have different dimensions.

Root cause: the number grammar recognizes ASCII `+`/`-`, while the start boundary permits matching immediately after U+2212. The suffix boundary and leftover-numeral detector omit superscript digits after a recognized unit. As a result the recognized substring donates a misleading supported token while the omitted sign/exponent generates no warning. This is narrower than general semantic entailment: the lexical value/unit test loses information before comparison.

**Smallest proposed fix:** normalize only semantically unambiguous mathematical minus to the supported sign grammar (or mark the full expression unsupported); ensure unit suffixes/exponents prevent supported-prefix matches and trigger review. Preserve original note bytes. Do not infer converted doses or introduce new export blockers. Regression risks: range dashes, signed ranges, scientific notation, numeric Unicode, supported `/m2` units and unknown compound suffixes. Prevent recurrence with `unicode-minus`, `unit-superscript`, existing ASCII signed-value controls, and `supported-but-inconclusive-numeric-form`.

### T3 — P2: unsupported numeric hints are absent from the numeric audit input

**Location:** `ankiRenderClozes` 4349–4354; `ankiNumericAudit` 4412; actual review front `AnkiReviewCard` at 5430–5449. This is not an automatic selection/export failure; the numeric warning is missing.

Source: `In children do not administer 5 mg orally.`

Response Text:

```text
[Demo] In children do not administer {{c1::5 mg::100 mg}} orally.
```

Expected: the unsupplied visible `100 mg` should enter the same advisory value/unit comparison as other note content. Actual: the front reads `[Demo] In children do not administer [100 mg] orally.`, while the audit reports `No numeric mismatch detected`, one checked token, and no findings. The exported cloze retains the hint.

Root cause: the audit concatenates `ankiPreviewText(..., 0, true)` for Text and Extra. Revealed rendering substitutes only each answer and discards each hint. The unsupported value is absent before tokenization. README accurately describes checks of *revealed* Text and Extra, but the intended numerical safeguard therefore does not cover all user-visible review content. That is an input-coverage gap, not evidence that the token comparator approved `100 mg` itself. Qualitative hints remain a separate semantic-check limitation.

**Smallest proposed fix:** include parsed hint strings in the advisory numeric scan while keeping review and export text unchanged. Deduplicate repeated findings if the same number also appears in an answer. Regression risks: non-numeric hints, hints carrying unit context, a hint repeated in visible text, and misleading aggregate checked-token counts. `unsupported-hint-number` must gain a discrepancy; `unsupported-extra-number` remains a positive control. Keep the warning tier unchanged.

## Documented limitations and inconclusive results (not deterministic semantic bugs)

The following ten frozen response cases all remain exportable without numeric findings: a changed negation, changed comparator, an existing but irrelevant reference, swapped numeric roles, an invented qualitative Extra assertion, an invented qualitative hint assertion, stronger modality (`may` → `must`), changed route, changed population, and changed time origin (`after` → `before`). Each fixture states its exact source-based rationale in the JSON. The test does not use medical knowledge to invent expected answers.

`ankiNumericAudit` deliberately checks normalized value/unit **occurrence**, not proposition entailment. It collects the union of tokens in the **linked fact texts**, not every fact in the generation chunk. A value appearing only in another unlinked fact is correctly flagged. If the model instead links that unrelated fact, or links both facts with swapped roles, occurrence checking cannot establish semantic support. `DECISIONS.md` and the UI explicitly acknowledge this boundary. Linked-fact counts therefore establish association rather than recall completeness or factual approval.

Missing links produce `Not checked` and zero linked facts; they do not deselect the note. A source-supported fraction (`1/2 mg`) produces `Source review needed` with unsupported-form evidence while preserving selection and exact content. A value present only in `sourceQuote` produces `quote-only` review instead of being accepted as fact-text support. These are honest inconclusive outcomes or deliberate warning policies, not proven-false verdicts and not valid-card rejection.

Do not fix these limitations by promoting numeric/source warnings into blockers, removing user selections, blindly matching more source text, or automatically rewriting clinical content. Broader semantic policy would require separate approval and evaluation. The optional model checker, covered in the companion audit, does not provide an independent clinical ground truth either.

## Pipeline and safeguard inventory for this scope

| Live helper / generation call site | Evidence and exact decision | Consequence; bypass/error boundaries |
|---|---|---|
| `ankiParseCards` 4142 / 5817 | First fenced block (or raw fallback); physical lines with pipes; exactly 3 fields marks normal row | Trims field edges, creates notes; extra pipes retained in Tags and malformed flag. No-pipe lines disappear (T1). No semantic checking. |
| `parseKBCoverage` 4155; `attachCoverageToCards` 4177 / 5824 | Parsed IDs must exist in snapshot and caller-owned chunk; a single destination line must resolve; repeated edges/omission conflicts recorded | Replaces source-link arrays, records problems; missing/disputed links remain advisory. Existence does not imply entailment. |
| `ankiDedupeCards` 4204 / 5826 | Valid notes with identical Text, Extra, effective tag set and Keep | Merges source IDs/issues and removes only exact equivalent rows; other differences survive. No similarity-based deletion. |
| `ankiNormalizeConditionTags` 4274 / 5826 | Clean unique mapping, one condition, unambiguous supplied alias, safe canonical slug | Changes only Condition tag; records before/after or skipped reason. Text, Extra and Keep preserved. Ambiguous mappings never select a majority. |
| `parseAnkiClozes` 4304; `lintAnkiCard` 4336 / 5830, 5867, selection/export | Flat positive-index syntax, ≤3 distinct indices, complete single tier, scoped tag grammar, exactly two delimiters and no field newline/pipe | Blocks structural eligibility without changing Keep. Nested, empty, malformed, excess-index cases remain visible. Numeric/semantic claims are not linted. |
| `ankiNumericAudit` 4406 / 5608, diagnostics | Current batch, valid structure, mapped source; normalized tokens from revealed Text+Extra compared with linked fact text; quotes separately classified | Read-only advisories. Missing evidence/structure/staleness is `Not checked`; unusual syntax is review. T2/T3 bypass parts of the numerical evidence. |
| `ankiCollisionGroups` 4431; `ankiReviewCandidates` 4530 / 5609, 5588 | Exact masked-front collisions and bounded similarity for same answers/shared fact links, with qualifier guards | Advisory only. Same front/different answers, case, tier, Extra, and similar wording all survive dedupe. |
| `ankiPreviewText` 4355; `AnkiReviewCard` 5430 | Same flat parser; only chosen index hidden, siblings revealed; hint visible | Structural errors prevent normal preview. Literal Text is React text; Extra is shown literally on answer reveal. Hints survive front/export but are absent from numeric scan. |
| `ankiSelection` 4358; `ankiBatchSummary` 4294 / 5596, 5591 | Live current source, current structural validity and Keep; export additionally scopes tier | Counts/export exclude invalid, deselected, deleted and stale notes. Source links survive manual content edits as associations, while checks recompute from edited bytes. |
| `updateField` 5861 | Current editable fields; resets cached pipe count, recomputes structure and abbreviation lint | No automatic content repair; manual Keep is preserved. Source/audit invalidation belongs to the wider lifecycle tests. |
| `ankiSourcePointers` 4464; `ankiExportText` 4473 / 5878 | Re-runs live selection; headered escape of `&`, `<`, `>`; optional captured pointers cleaned of separators/newlines | Preserves three fields. Only trusted source separator gets HTML `<br>`. Source pointers are export-only and do not mutate Extra. Quotes are emitted literally; native importer quoting behavior was not tested here. |

## Controls that did not reproduce the feared loss

The tests preserved all structurally valid supported control notes, including a negative directive, population/route context, leading-zero/written-unit variants, case distinctions, different tiers, different Extra, manually excluded twins, repeated source associations and near-duplicate wording. Distinct hidden answers with identical fronts remained separate and received advisory collision findings. No similarity-based automatic deletion exists on the exercised path.

Changed numeric values/ordinary units, invented numeric Extra, and a number present only in another unlinked fact correctly produced warnings while preserving the user's selection. Missing links and unsupported fractions stayed explicitly inconclusive. Live counts exclude invalid/deselected/deleted/stale notes, and selected-tier export agrees with those selections. Condition normalization changed only the proven alias tag. Headered exports escaped literal HTML/entity text; plain exports retained field bytes; optional pointers stayed out of editable Extra. These are test results, not native Anki acceptance or a clinical-accuracy claim.

## Smallest-first repair sequence and remaining limits

1. Repair tokenizer boundaries/sign treatment with precise tests, preserving advisory severity and source bytes.
2. Add numeric hint evidence to the existing advisory scan without an extra API call.
3. Make malformed/unparsed response content explicit and retain affected candidates for review; carefully preserve mapping line identities and independent good rows.
4. Evaluate any broader proposition-checking policy separately. No blanket semantic validator, source rewrite, automatic deletion, or extra model call is proposed here.

This sub-audit did not run a live model, examine private source files, change prompts/model settings, invoke native Anki, or test its import CSV quoting rules. It exercised real functions through deterministic integration stages rather than mounting the browser UI. Transport/retry/cancellation, KB intake, persistence and optional checker receipt lifecycle belong to the companion audits. Anki import parsing of literal double quotes, case-insensitive cloze markers, and extra-field cloze text remains an integration acceptance gap; no defect is claimed solely from inspection of those cases.
