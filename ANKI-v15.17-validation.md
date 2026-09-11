# v15.17 text-only Anki implementation and validation

Prepared 2026-09-11. This reports the local implementation and subsequently approved example edit, not live-generation or clinical-validation results.

## Baseline and scope

- Starting checkout: `21fb5980f796649d3cb7f53f2f919e8b93e2136b`, clean `main`, canonical `Nursing-Study-Suite v15.16.html`.
- Starting unified verifier: 761 assertions passed; all frozen hashes, prompt documentation, LF/version checks and full JSX Babel transform passed.
- Working branch: `codex/text-only-anki`. Final canonical file: `Nursing-Study-Suite v15.17.html`.
- Stages A0–A5 and B are implemented. Stage C now has a source-specific private comparison specification awaiting live-call approval. D has no measured justification. E's exact example diff was applied under the user's one-time approval on 2026-09-11. F's local version/docs/file checks are done; actual Anki import and public publication are not done.
- The user explicitly scoped one KB on 2026-09-11; it was read only to prepare the pilot specification. No unrelated course files were read. No live Gemini requests, manual quota-consuming test scripts, API keys in files, push, merge, or publication occurred.

All eleven hashes remained unchanged through the code-only checkpoint `1da58a3`. The subsequently approved `ANKI-v15.17-example-proposal.diff` changes only `ANKI_MASTER_PROMPT`, from `353471cbee66c759341ad8f4d857fa75ea4051744a52771ce780fcf172efc548` to `9d6c99229af067191df7b34d92c8ad98ff569870dd8f3be88634a5eb1a378b83`. Only that baseline hash was deliberately updated, with the approval recorded in its description. The other ten frozen constants retain their baseline. `Prompts.md` contains the actual new source bytes.

The user approved applying the example edit before a live baseline existed. The pre-edit application was preserved privately and remains recoverable at `1da58a3`, so the planned comparison can still use the original prompt with the same implementation and generation settings. No baseline generation is claimed here.

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

`node verify-repo.js` passes **904 assertions**: 143 added to the original 761. All prior meaningful coverage remains. Extraction anchors were updated where needed, with non-vacuous helper-tail assertions. The old assertion that repairs forcibly recheck notes was replaced with the new, tested requirement that manual choice survives repairs. The five example rows are now extracted directly from the shipped prompt; additional assertions verify exact recovery of the historical hash, diff reproducibility from either side, and rejection of partially applied examples.

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

## Pending live pilot: source scoped, call approval required

The user supplied the exact KB path on 2026-09-11. `tools/anki-pilot-spec.js` inspected that JSON with the shipped packet/chunk functions: **40 conditions, 328 facts, eight chunks**. The exact source path, source/packet hashes, chunk sizes, both prompt hashes and pre-edit application snapshot are in gitignored `scratch/anki-pilot/`. No source text or clinical facts are included in this report.

The prepared `scratch/anki-pilot/comparison-spec.json` proposes two runs of the same KB using `gemini-3.8-flash`, low thinking, blank Outcomes/Points/Additional Context, unchanged chunking, a 65,536-token output ceiling, and the existing streaming transport. Each run expects **eight generation calls**, with at most **24 attempts** under the unchanged two-retry policy: **16 calls / at most 48 attempts total**, plus **zero additional audit calls**. No live calls are authorized or made by this specification.

Remaining procedure:

1. Obtain approval for this concrete comparison. Before executing, recheck the source hash and verify the actual model, focus and generation settings match the specification. If they differ, amend the specification before approval. Keep credentials in the existing session/process mechanisms.
2. Use the preserved pre-example application for the baseline run and the current application for the second run. Their only generation-input difference must be the exact approved example diff. The pre-edit application remains available in Git at `1da58a3`; its private snapshot is `scratch/anki-pilot/before-examples.html`.
3. Save each run's original diagnostics/responses and source snapshot in `scratch/anki-pilot/` before editing, exclusions or tier selection. Record truncation/cancellation and inspect the actual exported bytes. Keep every generated artifact private and out of Git.
4. Record front-anchor warnings / parsed Text rows; unmapped notes and partial/invalid edges; raw same/different-answer collision groups and affected review cards; numeric warned/checked notes and tokens, quote-only/unsupported findings, and not-checked reasons. Also retain raw/post-dedupe/invalid/kept counts, reviews by tier and global linked facts.
5. Adjudicate every numeric discrepancy and different-answer collision as defect, false alarm or unresolved, and sample unflagged notes. A lower warning rate alone is not improvement. A single before/after is a pilot, not causal evidence.
6. Consider Stage D only if the evidence isolates an actual one-to-many mapping-contract limitation. The parser already accepts repeated fact IDs on separate lines. Absent maps, bad row numbers and invalid IDs require separate diagnoses. No adapter change is currently proposed.
7. Compare the two runs using the same KB, model, thinking, focus, chunking and selection. Check for fictional-example contamination. The exact example edit is already approved and applied; no further prompt or adapter changes are authorized by that one-time approval. Any calls beyond the specified comparison need authorization.
8. Import the actual pilot `.txt` into an isolated Anki test deck using the student's established compatible cloze note type. Check note/review counts, c1/c2/c3 behavior, Extra/source display, comparators and tag-column mapping. No Anki import was performed here; no bridge or dependency was installed.

## Approved examples and limits

`tools/anki-example-proposal.js` reproduces the approved diff from either the original or applied prompt; the harness extracts and validates the five complete example rows directly from the shipped HTML. Structure, supplied fictional tags, numeric consistency, style findings and collision checks pass. The edit changes two example locations only and explicitly says the examples are fictional format demonstrations, never source material. See `ANKI-v15.17-example-proposal.diff` for the exact applied diff.

The user's one-time approval on 2026-09-11 satisfies `AGENTS.md` invariant 1 for this exact example diff only. It does not authorize additional prompt edits or live API calls. Stage C's remaining live-call boundary follows `DEVELOPMENT.md`: “Run live-material checks only when the changed pipeline requires them and the user explicitly authorizes the API calls.”

Numeric matching checks token occurrence, not clinical entailment. Reversed comparators and swapped roles of two supported values are deliberately tested limits. Equivalent notation includes leading/trailing zeros, valid grouped numbers, microgram aliases, spelled-out supported units, U/IU/units and declared compound units such as mcg/kg/min, mg/dL and mL/hr. Fractions, blood-pressure ratios, scientific notation, unknown units and bare numerals requiring context are reported for review; the scanner does not convert units or certify an unflagged note. There is no reliable per-fact quote-verification flag to promote quote-only support into verified fact support.

Exact collisions do not detect semantic leakage, synonyms or near-duplicate retrieval tasks. Source links are associations, not proof of an edit's correctness. Review-card totals do not predict daily FSRS workload. No new clinical corrections, reverse cards, quotas, media, templates, dependencies, backend or runtime were introduced.
