# v15.17 text-only Anki implementation and validation

Updated 2026-09-11. The reliability implementation passes its software checks. The example-only prompt candidate failed the paired live pilot and was rolled back after separate explicit user approval. The exact pre-pilot prompt is restored; mapping correction and actual Anki import remain outstanding. These results do not certify clinical accuracy.

## Baseline and scope

- Starting checkout: `21fb5980f796649d3cb7f53f2f919e8b93e2136b`, clean `main`, canonical `Nursing-Study-Suite v15.16.html`.
- Starting unified verifier: 761 assertions passed; all frozen hashes, prompt documentation, LF/version checks and full JSX Babel transform passed.
- Working branch: `codex/text-only-anki`. Final canonical file: `Nursing-Study-Suite v15.17.html`.
- Stages A0–A5 and B are implemented. Stage C's authorized paired pilot completed, with the baseline response-capture limitation below. D now has evidence of a one-to-many contract limitation but remains unimplemented and needs separate measurement. E's exact example diff was applied under the user's one-time approval on 2026-09-11, failed the pilot, and was restored under a separate explicit rollback approval. F's local version/docs/file checks are done; actual Anki import and public publication are not done.
- The user explicitly scoped one KB and approved 16 generation calls total, at most 48 HTTP attempts under the existing retry policy. Both runs completed; no additional audit calls were made. No unrelated course files, manual quota-consuming test scripts, API keys in files, push, merge, or publication were involved.

All eleven hashes remained unchanged through the code-only checkpoint `1da58a3`. The subsequently approved `ANKI-v15.17-example-proposal.diff` changed only `ANKI_MASTER_PROMPT`, from `353471cbee66c759341ad8f4d857fa75ea4051744a52771ce780fcf172efc548` to `9d6c99229af067191df7b34d92c8ad98ff569870dd8f3be88634a5eb1a378b83`. After the failed pilot, the user approved the exact inverse in `ANKI-v15.17-example-rollback.diff`. The current prompt and deliberately restored Anki baseline again have hash `353471cbee66c759341ad8f4d857fa75ea4051744a52771ce780fcf172efc548`. Both approvals are recorded in the baseline description. The other ten frozen constants retain their baseline. `Prompts.md` contains the restored source bytes.

The user approved applying the example edit before a live baseline existed. The pre-edit application was preserved privately and remains recoverable at `1da58a3`. The comparison used that preserved application and the then-current candidate with the same implementation and generation settings. The only generation-input difference was the approved example diff.

The following generation-input source hashes were measured from the A0 checkout and are now regression assertions. These are trimmed source spans, not hashes of a generated deck.

| Input | SHA-256 |
| --- | --- |
| KB-to-Anki packet | `abf40adde002b03587eefe395958ec67de14c7bec5c1fee5db600cc527e74a71` |
| Anki chunker and oversized-condition helper | `b3d15fb1e63a7b1cdd49eb105db827debac59bd0340c282fdae5049989e42002` |
| Anki focus-context builder | `b096b8eb8733da287a097a99ede3f3e233d8e413c01bdf5605376f516054094f` |
| Runtime KB mapping adapter | `5cc837d1317a87d3d58d2bc6ed7afef835dbace0b6d089167e83b354863b3836` |

The recommended profile remains `gemini-3.8-flash`, low thinking, 12,000-character chunk limit, overlap setting 2, streaming through the existing transport, at most two retries per request, and a 65,536-token output ceiling. Manual settings remain available. None of these generation settings were changed.

## Implemented behavior

| Area | Behavior |
| --- | --- |
| Flat clozes | One parser supplies spans, offsets, positive safe integer indices, answers, hints and structural issues. Repeated indices, uppercase markers and up to three distinct indices are supported; nesting, empty answers, stray delimiters and malformed markers are rejected. |
| Preview/export | Invalid fields show structural errors in Preview; raw fields stay editable. Current Text/Extra/Tags are revalidated at export. Model markup remains inert. Extra is hidden until answer reveal. |
| Selection | `keep` means the student's choice. Structural ineligibility is separate. A repair restores a selected note; manual exclusion survives all edits. Advisory findings never change selection. |
| Provenance | Immutable copies of fact text, quote and filename/location pointers are captured at run start. Ledger edges must identify a fact supplied to that chunk and a real chunk-local destination. `line #0` is omission. Duplicate-note consolidation unions only valid links and retains raw pre-dedupe measurements. |
| Identity | Object replacement invalidates the batch even if fact IDs repeat. A run must match both the active run and source KB, and must not be aborted, before it can publish. Old notes stay visible without active links, checks, coverage or normal export. |
| Counts/registry | Current eligible kept notes determine review totals, global linked facts and only `ankiNotes` registry entries. The stable effect replaces entries after edits/deletions/exclusions and clears empty/stale results. Other registry kinds are preserved. |
| Numeric warnings | Complete revealed Text and Extra are compared with linked fact text using exact normalized value/unit tokens. No substring match, unit conversion, rounding or automatic correction. Both supported range endpoints are checked. Quote-only and unsupported forms remain source-review findings. |
| Collisions | One rendered-front index includes visible siblings and hints, preserving punctuation, case, units and qualifiers. It distinguishes same-answer redundancy from different-answer ambiguity. Full-batch findings precede UI filtering; kept-note and raw diagnostics have separate counts. |
| Source footer | Default off; deduplicated filename/location pairs are composed into exported Extra only. Pointer pipes/newlines are sanitized; HTML text is escaped before inserting a trusted break. Missing pointers are explicit. Quotes, tiers and tags are not changed. |
| Measurement | Completed batches retain raw responses, mappings and the original source snapshot; a private diagnostics download includes aggregate original/current counts. Interrupted runs retain completed responses and partial stream text without publishing notes. No credentials or controllers enter those exports. |

## Deterministic verification

`node verify-repo.js` passes **904 assertions** after rollback: 143 added to the original 761. All prior meaningful coverage remains. Extraction anchors were updated where needed, with non-vacuous helper-tail assertions. The old assertion that repairs forcibly recheck notes was replaced with the new, tested requirement that manual choice survives repairs. The five example rows are retained as fixtures extracted from the reproducible historical candidate; they are no longer described as shipped examples. Assertions pin both the exact restored live prompt hash and the rejected candidate hash, diff reproducibility from either side, and rejection of partially applied examples.

The full JSX block Babel-transforms, prompt documentation matches, all eleven frozen hashes pass, and the canonical HTML is LF-only with matching filename/release comment. The application remains one HTML with the original CDNs and runtime dependencies.

All eight CDN pins were fetched and re-hashed on 2026-09-11:

| Resource | Downloaded bytes | Integrity |
| --- | ---: | --- |
| React 18.2.0 | 10,737 | Matched |
| ReactDOM 18.2.0 | 131,882 | Matched |
| Babel standalone 7.23.9 | 2,849,480 | Matched |
| marked 11.1.1 | 35,141 | Matched |
| DOMPurify 3.4.12 / cdnjs | 29,209 | Matched |
| DOMPurify 3.4.12 / jsDelivr | 29,209 | Matched; identical to cdnjs |
| pdf.js 3.11.174 | 320,004 | Matched |
| JSZip 3.10.1 | 97,630 | Matched |

## Synthetic browser acceptance

Ran `node tools/anki-browser-fixture.js 4173` in the supported in-app browser. The server exposes only its synthetic route, extracts the live generator and the harness fixture, substitutes an in-memory generation response, and blocks fetch. This exercises the actual generation completion path and React effects without a Gemini request or course material.

- Initial response: 7 parsed/post-dedupe notes, 1 structural exclusion, 6 kept notes, 8 review cards, 5/5 linked facts, and 6 Anki registry entries. One three-index note creates three reviews; its repeated c1 gaps hide together.
- Style filtering reduced displayed notes to 2 while retaining 6 exported notes, 8 reviews, 5/5 global links and unchanged registry publication count. A repeated export was byte-identical. Tier 2 exported exactly 3 notes while the global registry retained all 6 entries.
- c1/c2 switching hid the selected spans and displayed sibling answers. Answer reveal displayed Extra; switching the index hid Extra again. Literal `<b>` in Text and `<img ...>` in Extra displayed as text.
- The broken note showed an error instead of an exposed-answer preview. Repair increased eligibility to 7 kept notes and 9 reviews. Manually unchecking, breaking, and repairing that note left its checkbox unchecked and kept it out of the registry.
- Editing the 50 bpm note to a distinct 60 bpm front cleared both its numeric discrepancy and the collision group. The registry label immediately reflected the edited text.
- Deleting the sole note for fact-5 reduced global links from 5/5 to 4/5 and removed its registry entry. NCLEX and case entries survived.
- HTML source export preserved all three fields, escaped comparisons and pointer metadata, deduplicated repeated sources, inserted `<br>` only between separately escaped Extra/pointer text, and marked two missing pointers unavailable. Plain-mode behavior is also covered deterministically.
- KB replacement displayed the earlier-KB warning, disabled export and numeric checks, and cleared Anki entries after the effect ran. Delayed completion after replacement was discarded; the cancellation notice and separate interrupted evidence remained available.
- Empty regeneration produced 0 notes/reviews and cleared Anki entries. Registry publications stopped between changes; no React update loop was observed.
- Narrow-view visual inspection caught toolbar crowding; the controls now wrap and remain visible. The final structural message and interrupted-run UI were rechecked after reload.
- The browser error log contained only Babel's existing large-file deoptimization notice, not an application exception.

These are software checks against deliberately seeded examples. The synthetic response's numeric discrepancy and different-answer collision were intentional test defects; they are not measurements of Gemini's clinical quality or adherence.

## Completed paired live pilot

The user supplied the exact KB path on 2026-09-11. `tools/anki-pilot-spec.js` inspected that JSON with the shipped packet/chunk functions: **40 conditions, 328 facts, eight chunks**. The exact source path, source/packet hashes, chunk sizes, both prompt hashes and pre-edit application snapshot are in gitignored `scratch/anki-pilot/`. No source text or clinical facts are included in this report.

The user approved both runs using `gemini-3.8-flash`, low thinking, blank Outcomes/Points/Additional Context, unchanged chunking, a 65,536-token output ceiling, and the existing streaming transport. The source hash was rechecked; applying the actual import normalizer preserved the exact planned packet hash. The UI imported 40 conditions and 328 facts with zero schema validation errors. Both tabs used the specified model and settings.

Each run completed **eight logical generation calls**: **16 total**, with **zero additional audit calls**. The approval allowed at most 48 HTTP attempts under the unchanged two-retry policy. Actual HTTP retries and token usage were not independently instrumented; do not equate logical calls with measured HTTP attempts. No further calls are authorized by this completed pilot.

Baseline ran 15:01:03–15:02:12 and revised ran 15:10:26–15:11:30 on 2026-09-11, America/New_York (UTC−04:00). Neither reported truncation, cancellation or an API error. No note edits, manual exclusions or tier filtering preceded capture.

| Measurement | Baseline examples | Revised examples |
| --- | ---: | ---: |
| Parsed / post-dedupe notes | 315 / 315 | 311 / 311 |
| Structurally invalid notes | 0 | 147 |
| Current eligible kept notes | 315 | 164 |
| Current cloze reviews | 560 | 278 |
| Current linked facts / total | 328 / 328 | 170 / 328 |
| Tier 1 notes / reviews | 222 / 405 | 124 / 213 |
| Tier 2 notes / reviews | 92 / 154 | 40 / 65 |
| Tier 3 notes / reviews | 1 / 1 | 0 / 0 |
| Front-anchor warnings / Text rows | 1 / 315 | 0 / 311 |
| Unmapped notes | 3 | 0 |
| Partial mappings / invalid edges | 0 / 0 | 0 / 0 |
| Same-answer / different-answer collision groups | 0 / 0 | 0 / 0 |
| Collision-affected reviews | 0 | 0 |
| Numeric checked notes / tokens | 31 / 44 | 18 / 29 |
| Numeric warned notes (unsupported notation) | 47 | 25 |
| Numeric discrepancies / quote-only findings | 0 / 0 | 0 / 0 |
| Numeric not-checked notes | 3: no mapping | 147: structural failure |
| Fictional-example contamination | 0 | 0 |

### Failure analysis and manual review

All **147 revised structural failures** had the shape `Text||Extra|Tags`: four fields instead of three. They occupied every note in chunks 1, 4, 5 and 7 (44, 27, 40 and 36 notes). Existing structural checks correctly excluded them. Copying the empty-Extra separator pattern into rows with populated Extra is a plausible explanation, but one paired run does not establish causation.

All **26 notes in revised chunk 8** instead used `Text||Explanation followed by tags`. They have three fields, an empty Extra, and explanation prose in Tags. They pass the current field-count/tier checks and are included in the 164 eligible notes. This is a confirmed generation field-assignment defect, not a study-ready export. No rows were silently repaired and no validator was weakened.

The smaller anchor and numeric-warning counts do not outweigh these failures. In particular, 147 revised notes skipped numeric checking because of structural errors. There were no numeric-discrepancy or different-answer-collision findings requiring individual adjudication. Unsupported notation remains a source-review warning; zero discrepancy findings do not demonstrate clinical correctness.

A deterministic spread of **20 unflagged notes per run** was reviewed against mapped facts. The baseline sample contained two source-support concerns: one strengthened “commonly” to “most commonly”; another added a drug-class detail in Extra that was absent from its mapped fact. These are source-grounding observations, not claims that the latter detail is clinically false. Two sampled revised notes were among the 26 explanation-in-Tags defects. This small sample is not an accuracy estimate. Private adjudication retains note and fact identifiers without putting course text in Git.

The baseline's **three unmapped notes** were legitimate additional notes from facts whose other content was already mapped to another note. The ledgers otherwise used valid chunk-local lines and IDs; this was not an absent ledger or parser failure. This supports Stage D's proposed one-to-many mapping contract. The adapter still requires each supplied fact exactly once, even when multiple notes need that association. A separate adapter diff and authorized bounded live measurement remain necessary; neither an adapter edit nor another live run occurred here.

### Evidence capture and export checks

The in-app browser did not complete Blob downloads, including a manual user click. The baseline's **original response bytes were not saved**. All 315 unedited rows, the complete visible coverage ledger, per-chunk note counts and original diagnostics were saved from the rendered UI. Reconstructing only these note/map blocks through the actual application helpers reproduced every diagnostic exactly. That evidence is explicitly labeled **rendered UI notes and coverage, not original response bytes**. The baseline tab is retained for inspection, but its unsaved response bytes depend on that session remaining open.

For the revised run, only the temporary server's served copy of the download handler was changed to expose Blob text in a read-only textarea. Generation inputs, prompts and transport were unchanged; the canonical HTML was not edited. This captured the complete diagnostics file, all eight original responses, and the actual current export. No key is in the export shape; temporary key fields were cleared after both runs.

The actual revised export is **34,238 characters / 164 note rows**, byte-identical to the live-helper replay (SHA-256 `654349091814d21f5cd143b354495937099cc0ffe14aee66a5da0d2c20c4797e`). Baseline replay exports **315 note rows / 74,553 characters**; it is derived from captured UI rows, not a recovered browser download. Plain and HTML source-reference exports have exactly three fields per row, preserve the Tags column, and have matching note counts. Source-mode headers remain `#separator:Pipe`, `#html:true`, `#notetype:Cloze`, and `#tags column:3`.

The private specification, capture files, replay script/results, exports, hashes and adjudication are in gitignored `scratch/anki-pilot/`. No KB, original response, generated note text or API key is committed. Native Anki control is unavailable in this session, so actual import, template rendering and c1/c2/c3 review in Anki remain outstanding. No bridge or new dependency was installed.

### Decision and approved rollback

The revised example candidate was rejected for adoption based on this pilot. The user then explicitly approved `ANKI-v15.17-example-rollback.diff`, and it was applied on 2026-09-11. The reviewed patch's context and hunk counts were checked against the candidate before exact-match replacement; it restored the exact historical declaration and Anki hash `353471cbee66c759341ad8f4d857fa75ea4051744a52771ce780fcf172efc548`. All reliability code and the other ten frozen prompts remain intact. Only the explanatory comment outside the prompt was updated to record why the experiment was rolled back.

The Anki documentation body/character count and only its baseline hash were deliberately restored under that approval. The generated prompt appendix was regenerated and all 904 assertions and repository gates passed. The restored prompt matches the baseline arm already measured in the pilot; no additional live call was made or claimed. Mapping correction and actual Anki import remain separate unfinished work. No release was published or pushed.

## Historical examples and limits

`tools/anki-example-proposal.js` reproduces the historical candidate diff from either side; the harness extracts and validates its five complete example rows as regression fixtures. Their structure, supplied fictional tags, numeric consistency, style findings and collision checks pass despite the measured generation regression. The two-location experiment is preserved in `ANKI-v15.17-example-proposal.diff` for evidence, not authorization to reapply it.

The user's one-time approval on 2026-09-11 covered the original example edit. Separate explicit approvals covered the completed 16-call pilot and then the exact rollback. These do not authorize further prompt edits or more API calls. `DEVELOPMENT.md` requires explicit authorization for live-material API checks.

Numeric matching checks token occurrence, not clinical entailment. Reversed comparators and swapped roles of two supported values are deliberately tested limits. Equivalent notation includes leading/trailing zeros, valid grouped numbers, microgram aliases, spelled-out supported units, U/IU/units and declared compound units such as mcg/kg/min, mg/dL and mL/hr. Fractions, blood-pressure ratios, scientific notation, unknown units and bare numerals requiring context are reported for review; the scanner does not convert units or certify an unflagged note. There is no reliable per-fact quote-verification flag to promote quote-only support into verified fact support.

Exact collisions do not detect semantic leakage, synonyms or near-duplicate retrieval tasks. Source links are associations, not proof of an edit's correctness. Review-card totals do not predict daily FSRS workload. No new clinical corrections, reverse cards, quotas, media, templates, dependencies, backend or runtime were introduced.
