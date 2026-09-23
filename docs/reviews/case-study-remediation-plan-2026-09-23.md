# Case-study generator: consolidated remediation plan

Date: 2026-09-23  
Status: implementation plan; application changes have not been made.

This plan covers every confirmed finding from the initial implementation review and the subsequent Dermatitis, Anxiety, and Tricyclic Antidepressant Overdose output review. The initial review used synthetic numeric/calculation cases; its record does not identify a fourth supplied clinical-topic file. The plan preserves that distinction rather than inventing missing evidence.

## Scope and success criteria

Fix the case-study tab's incorrect acceptance, incorrect rejection, repair handling, review status, and export inconsistencies. Add reliable variation in correct-answer placement. Resolve the identified clinical-content defects through their actual source evidence.

Success means each confirmed software defect has a failing-before/passing-after regression, valid neighboring inputs still work, and the screen, audit payload, answers, rationales, registry and exports agree. It does not mean every future model response is clinically correct or warning-free.

The application stays one HTML file with no new runtime dependency. Preserve all eleven frozen prompt constants, existing model profiles, one-round repair policy, source-replacement cancellation, and warning tiers. The optional item auditor remains blind to the source packet. No clinical keyword blacklist, broad semantic rejection gate, or automatic source correction is proposed.

Current implementation references below refer to `Nursing-Study-Suite v17.0.html`; line numbers are starting landmarks, not replacement anchors. Read actual bytes and prove each HTML replacement matches exactly once. Add the required version comment for non-obvious HTML changes. Preserve unrelated work.

## Evidence baseline

The initial review executed extracted live functions and mocked generation/repair handlers. It confirmed eight software defects. The second review replayed supplied output through shape checks, stage timing, item heuristics, export builders and the compiled audit-panel fragment. It did not run a browser session or live Gemini generation.

| Supplied output | Questions | Reported errors | Warnings | Timing warnings | Audit snapshot |
|---|---:|---:|---:|---:|---|
| Dermatitis | 12 | 0 | 14 | 8 | Running; five N/A rows, no completed MCQ verdicts |
| Anxiety | 12 | 0 | 23 | 20 | Running; three PASS, four FAIL, five N/A |
| TCA overdose | 12 | 0 | 19 | 16 | Complete; seven REPAIRED, five N/A, zero PASS |

All 44 timing warnings reproduced. All 56 validation warning messages were absent from replayed Markdown/PDF input, while JSON Copy retained them. Twenty-eight of 29 single-answer questions were keyed A. Every supplied MCQ still had four options. These outputs contain no Calculation questions or numeric clinical data, and no original/repaired pairs; they do not prove that the numeric or unchanged-repair defects occurred in those runs.

The last executed unified gate passed 3,051 assertions and the prompt/documentation/JSX checks. That green baseline does not cover the newly reproduced defects.

## Work inventory

| ID | Priority | Confirmed issue / requested feature | Implementation landmark | Work package |
|---|---|---|---|---|
| C01 | P1 | Clinical numbers in question stems and stage titles bypass relevant checks | `validateCaseStudy`, 9713, 9757 | B |
| C02 | P1 | Correct calculated results fail literal numeric grounding | `caseAuditTextValues`, 9420; rationale caller, 9799 | C |
| C03 | P1 | Shared-unit ranges lose their lower endpoint | `caseNumericTokens`, 9324 | B |
| C04 | P2 | Trailing prose such as "per protocol" is consumed as a unit | `CASE_CLINICAL_TOKEN_RE`, 9221; numeric parsing | B |
| C05 | P2 | An unchanged failed item becomes REPAIRED | repair acceptance/publication, 10395-10405 | A |
| C06 | P2 | A repair can discard the original MCQ's distractors | repair contract, 10399 | A |
| C07 | P2 | Assumed calculation weight loses its visible qualification | `caseToMarkdown`, 9887; `CaseRenderer`, 10669 | E |
| C08 | P2 | Text/PDF exports lose question-specific audit findings | `artifactExportNotice`, 1579; case export assembly, 10503 | E |
| C09 | P2 | Warning-only validation disappears from text/PDF exports | `caseValidationStamp`, 9938 | E |
| C10 | P2 | Pending audit panel claims each MCQ was reviewed | audit panel, 10611-10618 | E |
| C11 | P1 content | TCA case teaches routine physostigmine treatment | supplied TCA stage 3 medication order and s3q3 | F |
| C12 | P2 content | Dermatitis rationale treats absent childhood history as excluding atopic dermatitis | supplied Dermatitis s2q1, rationale A | F |
| R01 | Requested | Correct answers overwhelmingly occupy position A | generation publication, repairs, renderer and exports | D |

C08 is the same defect in both reviews, not two separate fixes. C11/C12 are confirmed defects in generated study content; attribution to the original source, extraction, generation or repair is not yet established.

## Package A — Establish fixtures and make repair acceptance honest

Start with this package because randomization must not disguise a no-op repair or conceal a broken answer mapping.

1. Add small synthetic fixtures to the existing live-function regression harness. Do not copy the supplied course outputs or private KBs into Git. Keep supplied files available only for the authorized private replay.
2. Capture the original item's id, type, option labels and option count before requesting a repair.
3. Require the repaired candidate to preserve that identity and exact label set/count, in addition to existing case validation. Compare sets and counts rather than requiring rationale array ordering to be identical.
4. Remove `repairNote` from the substantive comparison. Compare explicit question fields; property serialization order and a changed repair note alone must not count as a rewrite. Do not attempt fuzzy semantic equivalence.
5. If the substantive item is unchanged, retain the original FAIL and its criterion. Record that the attempted repair made no change. Do not increment the repaired count or claim "rewritten".
6. If it changed and satisfies the captured contract, publish an immutable candidate and mark it REPAIRED, explicitly not re-audited. Preserve the existing handling of answer-accuracy failures.
7. Publish the accepted candidate's validation findings with that candidate, before the next asynchronous boundary. Test cancellation while another repair is pending so retained output cannot carry findings from a prior revision. This is lifecycle acceptance coverage, not a claim that this race occurred in the supplied files.

Required regressions:

- Failed item returned unchanged, including reordered JSON properties or changed `repairNote`: original FAIL remains.
- Four-option item returned with one or three options: original item and verdict remain.
- Same-count repair with a renamed label: original remains.
- Valid text repair with the same four labels and complete rationales: accepted, immutable, REPAIRED.
- Malformed or ungrounded repair: existing rejection remains.
- Two repairs completing in either order: neither overwrites the other.
- Cancellation/source replacement during repair: no late publication, honest retained audit state, current findings for retained content.

## Package B — Repair numeric parsing, then apply it to omitted fields

Implement parser corrections before adding callers, so newly checked fields do not inherit known false rejections.

### B1. Shared-unit ranges (C03)

Represent both signed endpoints with their full shared unit. Parse the range as one source span so the separator cannot be mistaken for a negative sign and the upper endpoint cannot be counted twice. Preserve the existing distinct treatment of direct support and threshold instantiation.

Required paired regressions:

- Source `3.5–5 mEq/L`: unchanged range and direct `3.5 mEq/L` / `5 mEq/L` are supported.
- Generated `2–5 mEq/L` against that source: the unsupported lower endpoint is detected.
- Hyphen, en dash and `to` forms, negative endpoints, decimals and supported compound units retain complete values.
- A direct interior value is not automatically supported merely because it is inside the range; the existing instantiated route remains available.
- Unsupported unit tails cannot donate a valid prefix; existing out-of-bound instantiated-value warnings keep their severity.

### B2. Unit/prose boundary (C04)

Make direct-token and threshold parsing agree for the demonstrated trailing prose forms (`per protocol`, `per shift`). Do not solve the bug by truncating every unknown denominator after `per`; that could turn an unsupported compound into apparently valid evidence.

Required paired regressions:

- Exact `5 mg per protocol` supports the complete `5 mg` value.
- A source containing `12 breaths per minute per shift` supports direct `12 breaths/min`.
- `5 mg per dose` remains `mg/dose`; supported `mcg/kg/min` remains complete.
- Unknown explicit denominator, parenthesized denominator, unit product and superscript cases retain existing handling.
- Existing v16.9 threshold-with-trailing-prose regressions still pass.

### B3. Stems and stage titles (C01)

- Apply the existing uncited-prose scanner to stage titles, just as for the case title and narrative.
- Apply numeric grounding to a question stem using that question's supplied rationale citations and independently validated case data. Do not use the whole KB as support.
- Make the stem caller handle numeric text with no evidence explicitly; merely calling the existing helper with an empty fact-ID list would hit its early return and preserve the bypass. Do not change unrelated callers' missing-citation severity.
- Preserve the existing distinction between numeric support and stage-timing advisories. Do not quietly turn timing warnings into errors or globally change the rationale's presented-value behavior.
- Do not audit deliberately incorrect option text as though it were asserted patient data.

Required paired regressions:

- Packet containing only a monitoring instruction cannot support a stem asserting `82/50 mm Hg`.
- The same stem with an independently supported case datum passes.
- A stem repeating a legitimately instantiated case value passes without borrowing unsupported values.
- An uncited numeric stage title is detected; ordinary numbered titles, ages and clock times remain valid.
- An incorrect numeric distractor does not acquire a new automatic grounding error solely because it is a distractor.

## Package C — Support verifiable calculations without disabling grounding (C02)

Keep this separate from generic numeric matching. A calculated result is neither a literal quotation nor threshold instantiation.

1. Add a small calculation-specific evidence helper invoked for Calculation questions. Begin with the evidenced dose-times-weight expression and explicit supported multiplication/division forms needed by the retained fixtures; do not implement an arbitrary natural-language math engine.
2. Recognize both a conventional expression such as `2 mg/kg × 70 kg = 140 mg` and the reproduced equivalent wording `2 mg/kg multiplied by 70 kg gives 140 mg`.
3. Resolve operands independently against the question's supplied facts or validated case data, including the existing consistent assumed-weight exception. Neither the proposed result nor another unvalidated rationale can establish its own operands.
4. Verify the supported operation and resulting unit. Use bounded parsing with no `eval` or dynamic execution of model text. Use exact decimal arithmetic for the supported forms, or a documented narrowly defined rounding rule when the question explicitly requests rounding; do not introduce a broad floating-point tolerance.
5. Supply verified derived values only to the relevant calculation explanation/answer checks. Do not add them to a global exemption that another datum or question can borrow.
6. Unrecognized derivations retain the existing source-review behavior, with an accurate explanation. Do not suggest `instantiated` as the remedy for arithmetic, and do not exempt every Calculation rationale.

Required paired regressions:

- Cited `2 mg/kg`, permitted consistent `70 kg`, result `140 mg`: accepted with the worked explanation.
- Result `150 mg`, changed weight, unsupported operand or wrong unit: does not receive derived support.
- Result placed in an unrelated datum/question cannot borrow the calculation exemption.
- Existing literal calculations, no-option and placeholder-option representations, and already supported rationales still pass.
- Supplied patient weight still prevents inventing a different assumed weight.
- Unsupported operations, division by zero and unrecognized rounding instructions do not create false evidence or crashes.

The closure claim is bounded: the reproduced valid calculation and declared supported arithmetic forms are fixed. Do not claim arbitrary clinical formulas can be verified from prose.

## Package D — Randomize answer placement without breaking meaning (R01)

Use a local code transformation rather than trusting the model to stop choosing A. Default to genuine random permutations, not a visible repeating A/B/C/D cycle or a mandatory equal-position quota. Occasional repetition is legitimate random behavior; never reject a case because its answer distribution looks uneven.

### Transformation

- For structurally valid MCQ, Prioritization and Education items, use Fisher–Yates to shuffle the option records and relabel their displayed positions consistently.
- Apply the same mapping to SATA options and every correct-answer label, preserving the exact correct option-content set and answer count.
- Leave Ordering and Calculation untouched in this work package. Ordering has a semantic sequence and Calculation may have a free numeric answer or placeholder.
- Construct an explicit old-label-to-new-label map. Update `options[].label`, `correctAnswers`, and `rationales[].option` together. Keep rationale text, fact IDs, question id, type, CJMM skill and support metadata attached to their original content.
- Reorder rationale records for readable display if needed, without changing which option each explains.
- Account for explicit label references in stems, option text and rationale text. Remap only unambiguous references. If an item's order-dependent wording cannot be transformed safely, preserve it and expose an advisory that it was not shuffled; never replace every standalone letter or introduce a new rejection gate.
- Do not normalize a malformed item into apparent validity. Such items retain their current error/export behavior.

### Placement in the run

1. Parse and shape-check the generated case, then perform existing validation.
2. Transform eligible, valid items and revalidate the immutable result.
3. Publish that result once and build the item-audit payload from exactly that stored representation. The auditor, student and answer key must agree on the labels.
4. For a repair, perform Package A's identity/shape/no-op checks against the current stored item before any permutation. If the repair is accepted, shuffle only that changed item, remap its references and revalidate before publication. It stays REPAIRED, not PASS. This prevents fresh repair output from restoring a systematic A bias.
5. Do not reshuffle unaffected items after the audit or on render, answer reveal, tab change, export, settings edits, or KB replacement. Keep the displayed case stable while the user is studying it.
6. Existing artifact identity and source-staleness handling remain intact. An audit verdict belongs to its reviewed question revision; a label transformation must not make an unchanged FAIL look like a successful repair.

Required regressions:

- Inject a deterministic random source in tests; exercise nonidentity permutations and every destination for a correct option.
- Verify by option content that the same answer is correct before/after shuffling.
- Verify each rationale and its fact IDs still explain the same option content.
- For SATA, verify the correct content set is unchanged after a nontrivial permutation.
- Ordering and Calculation remain byte-equivalent in their question fields.
- Explicit label references and order-dependent options are handled losslessly or preserved with an advisory.
- Repeated UI renders, JSON Copy, Markdown and PDF preparation produce identical stored order and answer mappings.
- Audit payload matches the first published order; repaired item publication changes only that item.
- Exercise a synthetic all-A batch to demonstrate that the transformation no longer preserves model position bias. Use deterministic fixtures, not a flaky test that demands an exact distribution from random production runs.

## Package E — Keep review status and exports consistent (C07-C10)

### E1. Assumed weight

Display `assumed for calculation` beside the permitted neutral weight in the case view and both text/print renderings. Preserve `neutral-framing` in JSON. Do not relabel sourced weights as assumed or imply that an invalid assumed weight passed checks.

Regression: a valid assumed `70 kg` case retains that qualification on every surface, while a sourced weight keeps its ordinary label. Existing failed-case stamps remain visible.

### E2. Validation and audit appendix

- Retain the existing conspicuous failed-validation banner.
- Add a case-specific review appendix after the answer key for all validation findings, including warning-only cases, and per-item audit verdicts.
- Map stable question ids to the exported `Q<stage>.<position>` numbering. Preserve criterion, useful detail, warnings, pending/unscored state and the repaired/not-re-audited distinction.
- JSON Copy must carry equivalent review information through `_suiteReview`; retain existing fields and add information compatibly where required.
- Keep requested/actual counts, source-staleness notice, and running/interrupted/failed/disabled audit notices in all formats.
- Keep review material outside the student question section. Do not let the appendix leak answers or fact packets into the item auditor: `caseAuditPayload` currently depends on the worksheet/answer-key boundary in `caseToMarkdown`.
- Prefer a case-specific appendix over changing shared `caseValidationStamp` semantics for every NCLEX export. If shared helpers change, run the existing worksheet regression checks as well.

Required regressions:

- Replayed warning-only fixtures with 14, 23 and 19 messages retain every message in JSON and text/print input.
- Mixed errors/warnings retain both the failure banner and full review details.
- Anxiety-like four failures remain attributable to the four correct exported question numbers.
- Pending audit, quota interruption, source replacement and repaired items retain accurate notices.
- N/A stays distinct from PASS; clean/disabled-audit cases do not invent warnings or scores.
- The student's questions remain before the answer-key page break; item-audit payload has no appended verdicts, rationales, source packet or new answer leakage.

### E3. Audit panel

Drive wording from the captured run's audit state and completed eligible-item count. During the Dermatitis-like state, display pending MCQs rather than "Each MCQ was reviewed." Distinguish auditing, repairing, interrupted, failed, complete and disabled states using existing operation state where possible.

Make a repaired-only result explicitly say the current rewritten items were not re-audited. Do not infer success from zero FAIL rows when eligible items are still pending. Do not use the user's currently toggled audit checkbox to relabel a previous run.

Regression: zero completed MCQs plus five N/A rows cannot render completed-review wording; mixed completed/pending rows show accurate counts; disabling/changing settings during a run does not rewrite its captured status; finished cases retain their actual verdicts.

## Package F — Resolve content defects through source evidence (C11/C12)

This work can start alongside the software fixes once the original cited facts are supplied or specifically placed in scope. The three output files are already in scope. No authorization is inferred to search ignored KBs, PDFs, decks or transcripts elsewhere in the repository.

### Evidence to collect

- TCA `fact-10`: physostigmine claim and original quote/location.
- TCA `fact-2`, `fact-3`, `fact-11`: rhythm/temperature/treatment claims implicated by the unresolved VF and hypothermia concerns.
- Dermatitis `fact-3` and `fact-5`: differential descriptions behind the invented/exaggerated negative findings and exclusion rationale.
- Anxiety `fact-9` and `fact-10`: source for the specific environmental and behavioral assertions, distinct from generic intervention recommendations.
- Pre-repair and repaired question versions, if available. A final REPAIRED status cannot establish whether the original was unchanged or which version introduced a claim.

### Correction process

1. Trace each disputed statement from source quote to KB fact to case datum/rationale and, when available, repair output.
2. If extraction changed the source meaning, document the mismatch and make the smallest scoped correction with the maintainer. Do not modify the frozen KB extraction prompts as an incidental fix.
3. If generation or repair added a contraindicated treatment, unsupported absence, or unjustified diagnostic exclusion, replace that affected case content using verified source support. Preserve correct questions.
4. If the original teaching source itself conflicts with current guidance, record the conflict for instructor/source resolution. Do not silently substitute web content into a source-only KB or claim the generator solved it.
5. If the supplied packet cannot support a sound replacement, shorten the case under the existing shortfall contract and explain the omission.
6. For recurrence prevention, prepare a small, reviewable addition to the unfrozen case-generation and case-repair builders: generic disease descriptions do not establish patient-specific absence/history; qualified associations do not justify absolute exclusions. Preserve the source-only contract. Prompt clarification is not a deterministic clinical guarantee or a new validator gate.
7. Check generated prompt documentation after any dynamic-builder edit. All eleven frozen hashes remain unchanged.

Reference evidence from the review:

- Utah Poison Control: https://poisoncontrol.utah.edu/news/2024/02/physostigmine-or-rivastigmine-anticholinergic-toxicity
- American Academy of Dermatology: https://www.aad.org/public/diseases/eczema/adult/can-get
- AHA special-circumstances resuscitation guidance: https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines/adult-and-pediatric-special-circumstances-of-resuscitation
- AHA adult cardiac-arrest algorithm: https://cpr.heart.org/-/media/CPR-Files/CPR-Guidelines-Files/2025-Accessible/Algorithm-ACLS-CA-LngDscrp-250725-Ed.pdf?sc_lang=en

Completion evidence: each confirmed content defect has a source-backed disposition and corrected/replaced/omitted case material. Do not mark F complete merely because the software gate passes. Live regenerated-output acceptance remains a separately authorized measurement.

## Concerns that must not become speculative fixes

| Concern | Next action | Boundary |
|---|---|---|
| Timing warnings include differential/background explanations | Classify the actual 44 warnings with source evidence; preserve warnings in exports immediately | Do not suppress all distractor citations, mark every fact background, or promote warnings to errors |
| Generic knowledge and patient-specific findings share a fact ID | Document where the current timing heuristic overstates dependence | No new citation-role schema or semantic dependency engine in this remediation |
| TCA VF question lacks a resuscitation context | Inspect the exact treatment source and correct the scenario if needed | Its wording asks about anticipated intervention, so omission alone does not prove the keyed answer categorically wrong |
| TCA repeatedly says hypothermia | Compare `fact-3` with its exact source; resolve any transcription/source discrepancy | Do not blindly replace every occurrence with a different temperature finding |
| All-A bias versus genuinely random repetition | Implement R01 and test identity-preserving permutations | No rejection based on answer-position quotas |
| First two exports say audit running | Verify lifecycle behavior with mocked delayed calls and captured state | The snapshots alone do not establish a stuck audit |

## Delivery order and verification

Recommended implementation increments, each independently reviewable:

1. **A:** synthetic regression fixtures and repair acceptance/lifecycle correctness.
2. **B:** range parsing, unit/prose parsing, then omitted numeric callers.
3. **C:** bounded calculation evidence with positive and negative examples.
4. **D:** stable answer-option randomization and mapping through audits/repairs.
5. **E:** assumption labels, review appendix and accurate pending-audit presentation.
6. **F:** source-backed content resolution; may proceed earlier when the missing evidence is available.
7. Documentation, focused browser acceptance and release preparation after the implementation is verified.

For every increment:

- Tests extract the shipped functions/handlers and assert meaningful outcomes, including a non-vacuous extraction-tail check where anchors change.
- Each defect-specific regression fails against the pre-fix implementation; valid-input neighbors pass after the fix.
- Run `node verify-repo.js`; never weaken gates or update frozen baselines to obtain green output. Setup Babel only if the existing scratch runtime is unavailable.
- Inspect the diff for unintended edits outside the case path, prompt bytes, dependency pins and validation tiers.

After the integrated change, use the existing isolated browser fixture/runtime with synthetic KBs and mocked Gemini responses to check:

- All supported question types, reveal/hide behavior, randomization stability and answer/rationale correspondence.
- Initial generation, accepted/rejected/no-op repair, concurrent repair completion and cancellation.
- KB replacement with reused fact IDs, stale badges, registry publication and exports from the original source.
- JSON Copy, Markdown, case-view Copy and print/PDF content; inspect native page breaks and the answer-key/review appendix separation.
- Pending, complete, disabled, quota-stopped and interrupted audits; no late state updates or stale review metadata.
- Clean valid cases, warning-only cases, failed cases and malformed responses all retain their intended availability and export behavior.

Record deterministic tests, browser checks, source review and live-model measurements separately. No live Gemini call is authorized by creation of this plan; the manual quota-consuming tools remain excluded from ordinary gates.

For a release, choose the version during implementation and update the filename, HTML release comment, visible version, CHANGELOG and generated prompt documentation together. Recheck all CDN/worker integrity pins as required by the repository contract. Committing, publishing and live measurement are not performed by this planning task.

## Final acceptance checklist

- [ ] C01-C06 have executed failing-before/passing-after regressions and valid-input controls.
- [ ] C07-C10 are consistent across UI, JSON, text and print, including partial/interrupted runs.
- [ ] R01 randomizes eligible answers while preserving content identity, citations and stable study/export state.
- [ ] Frozen prompts, single-file architecture, runtime dependencies and advisory validation tiers are preserved.
- [ ] Unified verifier passes; focused browser/print results and any unavailable checks are recorded honestly.
- [ ] C11/C12 have source-backed dispositions; remaining clinical concerns are explicitly unresolved or resolved with evidence.
- [ ] No private source files, generated cases, KB exports, transcripts or API keys enter the commit.
- [ ] Documentation distinguishes source references, deterministic validation, item review and clinical accuracy.

Software remediation may finish before the source-dependent content work. Report those statuses separately; do not describe all four review areas as fully resolved until their respective acceptance evidence exists.
