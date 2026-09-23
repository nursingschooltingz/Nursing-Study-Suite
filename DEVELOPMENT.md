# Development guide

This is the task map for maintainers and coding agents. `AGENTS.md` remains the binding operating contract.

## Repository shape

- `Nursing-Study-Suite v17.1.html` is the complete application.
- `latte-tests.js` is the deterministic regression harness and extracts live functions by anchor.
- `verify-repo.js` is the only ordinary repository verification entry point.
- `prompt-baseline.json` stores the 11 frozen prompt hashes.
- `tools/repo-checks.js` owns suite-file resolution and raw prompt extraction.
- `tools/check-prompts.js` enforces the frozen hashes.
- `tools/render-prompts.js` checks or regenerates the generated prompt appendix.
- `neia-retest.js` and `davis-transcribe-test.js` are explicitly authorized, live-API measurement tools.
- The remediation regression modules under `tools/` are imported by `latte-tests.js` and exercise extracted shipped functions using synthetic data. Their assertions contribute to the enforced harness total.
- The 2026-09-18 integrity regression modules add source/build, import/restore, transform, lifecycle and evidence checks to that harness. The separate `audit-anki-*` and `reaudit-anki-*` scripts remain historical audit artifacts; their captured defect expectations and semantic-limit failures are not ordinary repository gates and must not be rewritten to manufacture a green audit.
- `docs/history/` preserves historical prompt diffs and the dormant v16 design/benchmark. These are reference records, not current implementation instructions.

## Safe workflow

1. Inspect `git status --short` and read the routed context in `AGENTS.md`.
2. Locate the exact live symbol with `rg`; do not reconstruct HTML bytes from memory.
3. For an HTML edit, prove the old text occurs exactly once before applying the replacement.
4. Add a non-vacuous assertion to `latte-tests.js` for new behavior.
5. Run `node verify-repo.js`.
6. Report deterministic results separately from any live-material validation still required.

## Prompt workflow

- A mismatch in `prompt-baseline.json` is a stop signal, not permission to refresh the hash.
- Editing any of the 11 frozen constants requires explicit approval and an exact prompt diff.
- After an approved prompt edit, regenerate the appendix with `node tools/render-prompts.js --write`, then deliberately update only the approved baseline hash.
- `CARD_TRANSCRIBE_PROMPT` is tunable but must preserve: never guess a number, never expand an abbreviation, preserve symbols exactly, and route unknown headings to `other`. Rerun two transcriptions per card after an edit.
- The approved v16.2 structured-KB adapter change is recorded in `docs/history/ANKI-v16.2-adapter.diff`; its harness pin is deliberately updated separately from the unchanged frozen baseline.
- The approved v16.3 dynamic source-check suggestion constraints are recorded in `docs/history/ANKI-v16.3-audit-builder.diff`; generation prompts and baseline are unchanged.
- The approved v16.4 dynamic source-check contract uses a source-first token inventory, exact note/source addresses and role-separated references. Its exact builder diff is `docs/history/ANKI-v16.4-audit-builder.diff`; the frozen constants and generation adapter remain unchanged. The legacy parser remains strict for historical regression checks; the new decoder validates independent records before retaining them.
- `Prompts.md` also documents dynamic prompt builders; the generated appendix guarantees that all 12 named constants appear verbatim.
- The focused v16.1 Extra change is recorded in `docs/history/ANKI-v16.1-extra-default.diff`; the preceding source/retrieval change is in `docs/history/ANKI-source-retrieval-update.diff`. These approved diffs do not authorize further prompt changes. Empty Extra must retain the same two pipe separators and third-field Tags.

The approved v16.5 Anki master and runtime adapter changes are recorded in `docs/history/ANKI-v16.5-target-allocation.diff` and `docs/history/ANKI-v16.5-adapter.diff`. Internal target planning and reconciliation keep the same two-block response contract. Prompt-contract assertions protect instructions and formatting, not model adherence.

The approved v16.6 changes leave all eleven frozen constants unchanged. Exact runtime changes are recorded in `docs/history/ANKI-v16.6-adapter.diff`, `docs/history/ANKI-v16.6-serializer.diff`, and `docs/history/ANKI-v16.6-audit-builder.diff`. The source packet supplies canonical Condition tokens; reference normalization is lossless and recorded; mixed-context and short-citation signals remain advisory.

The 2026-09-18 integrity changes ship in v16.7. They leave prompt bytes and CDN pins unchanged; the filename, release comment, visible version and generated prompt documentation identify the new release. See the [release verification record](docs/reviews/anki-v16.7-release.md). See [the implementation record](docs/reviews/anki-integrity-implementation-2026-09-18.md) and the current policy additions in `DECISIONS.md`. Deterministic acceptance is separate from unavailable browser/native import checks and from any separately authorized live-material measurement.

## Stable landmarks inside the HTML

| Area | Useful anchors |
|---|---|
| Gemini transport and profiles | `SAFETY_SETTINGS`, `callGemini`, profile registry |
| PDF/PPTX intake | `pdfLayoutText`, `kbSourceUnits`, scanned-file detection |
| Card intake | `CARD_TRANSCRIBE_PROMPT`, `cardFileId`, `cardMergeFaces`, resize constants |
| Knowledge Base | `KB_EXTRACTION_PROMPT`, `KB_VERIFY_PROMPT`, `kbQuoteInSource`, `mergeLatteParts` |
| Anki | `ANKI_MASTER_PROMPT`, Anki validation/export functions |
| NCLEX extraction | `NCLEX_INLINE_PROMPT`, `NCLEX_SPLIT_PROMPT`, `nclexSplitByQNum`, `nclexRepairOptions` |
| NCLEX generation | `NCLEX_GEN_PROMPT`, `validateNCLEXWorksheet`, worksheet repair helpers |
| Case studies | `caseBuildPrompt`, `validateCaseStudy`, case audit/repair helpers |
| Shared item audit | `itemBuildAuditPrompt`, `itemParseAuditVerdict`, `itemRunPool` |
| Persistence | IndexedDB transaction helper, artifact registry builders |

The harness comments identify its extraction anchors. If a refactor moves one, update the harness span and retain an assertion against something near the span's end so a truncated extraction cannot pass vacuously.

## Anki deterministic acceptance and pilot preparation

- `node tools/anki-browser-fixture.js 4173` serves only a synthetic fixture at `http://127.0.0.1:4173/`. It uses the shipped generator and the harness mini-KB, mocks generation, and blocks fetch. It never serves repository files. Stop it after checking the UI.
- `node tools/anki-pilot-spec.js <explicitly-authorized-KB.json>` computes the exact chunk/call count with the shipped packet and chunker. This reads the named KB and makes no API request. Obtain authorization for that material before running it; obtain separate authorization for the resulting live run.
- `node tools/anki-example-proposal.js` reproduces the historical example-only diff at `docs/history/ANKI-v15.17-example-proposal.diff` from the public `tools/fixtures/anki-v15.16-prompt.txt` fixture. Its helper accepts either historical side. That candidate failed its live pilot and was rolled back with explicit approval; the tool is retained for evidence, not authorization to reapply it. It rejects partially applied examples and never changes the app or prompt baseline. The harness validates all five historical examples and pins the measured original/candidate hashes separately from the approved current Anki prompt hash.
- `node tools/anki-source-review-browser-tests.js` checks source-review filters, note inspection/editing, and the optional source-check lifecycle with synthetic notes and mocked Gemini. It uses the existing external Playwright runtime and Chrome, sends no live Gemini requests, and leaves screenshots under ignored `scratch/anki-next/browser/`.
- `node tools/anki-generation-quality-browser-tests.js` checks scoped tag exclusion/repair, preserved manual selection, custom hierarchies, and generation-versus-audit normalization diagnostics in the live UI. It uses synthetic notes, mocked generation and the existing external Playwright/Chrome runtime; private evidence goes to ignored `scratch/anki-next/browser/`. Preparation makes no source-check call.
- Record the suite commit/prompt hash, source KB hash, model/thinking level, focus, and export filters for each live comparison. Match exports by source content as well as filename; the latest six-export review contained two matched pairs and two unpaired subject runs. Evaluate supplied facts, Text, Extra, actual hidden targets, and the intended tier subset separately. A linked-fact count or empty-Extra count cannot establish semantic accuracy.
- See `docs/history/ANKI-v15.17-validation.md` for the historical pilot, approved rollback, and capture limitations; `CURRENT_STATE.md` records the current mapping implementation and remaining live-pilot/native-import checks. Completed and interrupted generation diagnostics can be saved privately from the UI, including original responses and their source snapshot; keep these files out of Git.

## Offline measurement planning and synthetic acceptance

Both manual measurement tools now require `--live` to execute API calls, in addition to the project's explicit per-run human authorization. `--dry-run` needs no API key, sends nothing, reads no image payloads, and writes no measurement report. It prints the chosen model/profile, prompt hash, logical operations, and maximum attempts under retries. Actual HTTP calls can be fewer.

Examples: `node davis-transcribe-test.js --dry-run --app-profile --runs 2 synthetic.png` and `node neia-retest.js --dry-run --app-profile --runs 2`. Davis keeps original image bytes; this is distinct from the app's resize path. Neither tool measures accuracy merely by observing stable output. Invalid/missing option values and unknown flags fail before execution; incomplete measurements return nonzero status. Imported helpers have no executable-main side effects.

`node tools/remediation-browser-tests.js --self-test` verifies fixture isolation offline. Browser acceptance requires an existing external Playwright installation and Chrome, configured through `NODE_PATH` and optionally `REMEDIATION_BROWSER_EXECUTABLE`; it introduces no repository dependency. `node tools/remediation-browser-tests.js` mounts the real App on fresh loopback origins and tests mocked generation and isolated browser stores. Add `--output-policy` for popup/frame/resource checks. Only the fixture route is served, never the repository directory. Context-wide request interception blocks unexpected Gemini and resource requests. The browser needs network access for the pinned startup CDNs.

`node tools/remediation-pdf-browser-tests.js` exercises native worker integrity, both CDNs, failure/retry/cleanup, multi-document text extraction on loopback and `file://`, and actual synthetic photo decoding/resizing. `node tools/remediation-anki-performance.js 315 single` or `1000 small` measures the mounted Anki interface with synthetic collision groups. These are explicit browser checks, not live Gemini measurements or ordinary verifier dependencies. See the remediation validation records under `docs/reviews/` for measured results and native Anki/print limits.

`node tools/remediation-worksheet-browser-tests.js` covers interrupted/quota-stopped audits, immediate verdict updates, non-MCQ N/A outcomes, and malformed/ungrounded repair rejection using the same isolated App fixture and mocked responses.

## Release checklist

`node tools/case-remediation-browser-tests.js` checks the real case UI with synthetic facts and mocked generation/repairs, including stable option mappings, pending/interrupted review, JSON/Markdown/print output, print CSS page breaks and all six question types. It uses the same external Playwright runtime as the worksheet runner. The mandatory harness includes `tools/case-remediation-tests.js`, with extracted handler tests for concurrent repair completion and source cancellation.

`node tools/visual-browser-tests.js --screenshots scratch/visual-v17` checks the v17 interface on isolated real-App fixtures at 360, 768, 1024 and 1440 pixels. It uses the existing external Playwright runtime, synthetic sources and mocked generation; it never calls Gemini or serves the repository directory. The optional screenshot directory stays under ignored `scratch/`; the check report goes to standard output. This is optional browser acceptance, separate from the mandatory deterministic verifier.

- Rename the one canonical suite file and update the matching top release comment.
- Update `suiteVersion()` so the visible sidebar and private report versions agree with the filename.
- Add the Keep a Changelog entry.
- Regenerate/check `Prompts.md`; frozen hashes must remain unchanged unless an edit was explicitly approved.
- Re-hash all eight SRI-pinned script resources and both separately pinned worker CDN copies on any application version bump.
- Run `node verify-repo.js`.
- Run live-material checks only when the changed pipeline requires them and the user explicitly authorizes the API calls.
