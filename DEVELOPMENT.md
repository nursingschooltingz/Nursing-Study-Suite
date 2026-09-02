# Development guide

This is the task map for maintainers and coding agents. `AGENTS.md` remains the binding operating contract.

## Repository shape

- `Nursing-Study-Suite v15.15.html` is the complete application.
- `latte-tests.js` is the deterministic regression harness and extracts live functions by anchor.
- `verify-repo.js` is the only ordinary repository verification entry point.
- `prompt-baseline.json` stores the 11 frozen prompt hashes.
- `tools/repo-checks.js` owns suite-file resolution and raw prompt extraction.
- `tools/check-prompts.js` enforces the frozen hashes.
- `tools/render-prompts.js` checks or regenerates the generated prompt appendix.
- `neia-retest.js` and `davis-transcribe-test.js` are explicitly authorized, live-API measurement tools.

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
- `Prompts.md` also documents dynamic prompt builders; the generated appendix guarantees that all 12 named constants appear verbatim.

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

## Release checklist

- Rename the one canonical suite file and update the matching top release comment.
- Add the Keep a Changelog entry.
- Regenerate/check `Prompts.md`; frozen hashes must remain unchanged unless an edit was explicitly approved.
- Re-hash all eight SRI-pinned CDN resources on any application version bump.
- Run `node verify-repo.js`.
- Run live-material checks only when the changed pipeline requires them and the user explicitly authorizes the API calls.
