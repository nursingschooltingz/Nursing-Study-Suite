# AGENTS.md

Project operating contract for coding agents. Read this before proposing or making changes.

## What this is

A single-file, serverless HTML study suite for nursing students. It turns lecture PDFs and PPTX decks into a source-cited LATTE knowledge base, then generates prioritized study guides, Anki cloze cards, NCLEX practice questions, and unfolding clinical case studies. Everything runs client-side against the Gemini API with a user-supplied key.

Maintained by one working LPN in an LPN-to-RN bridge program between clinical shifts. Optimize for changes that are small, verifiable, and reversible.

## Hard invariants — explicit approval required to cross them

1. **The 11 prompt constants are byte-frozen.** `KB_EXTRACTION_PROMPT`, `KB_VERIFY_PROMPT`, `ANKI_MASTER_PROMPT`, `NCLEX_INLINE_PROMPT`, `NCLEX_SPLIT_PROMPT`, `NCLEX_AI_PAIR_PROMPT`, `NCLEX_GEN_PROMPT`, `NCLEX_DISTRACTOR_RULES`, `NCLEX_ANCHOR_RULES`, `NCLEX_RATIONALE_RULES`, `NCLEX_COMPLETENESS_RULES`. `prompt-baseline.json` enforces their source bytes. Never update the baseline merely to make a failure pass. For an approved prompt edit, state the need first, make the smallest possible change, show the exact diff, then update the baseline deliberately.
2. **Single file, no build pipeline.** The application remains one `.html`, loaded from fixed CDNs and compiled by in-browser Babel. Never introduce a bundler, npm build, TypeScript migration, module split, backend, or new application runtime dependency.
3. **The unified verifier must pass before any commit.** Do not weaken, skip, or replace a gate to obtain green output.
4. **New behavior gets a regression assertion.** The harness extracts live functions from the shipped HTML. If an extraction anchor moves, fix the anchor and preserve a non-vacuous tail assertion.

## Required verification

Run from the repository root:

```text
node verify-repo.js
```

On a machine without the scratch Babel tool, run once:

```text
node verify-repo.js --setup-babel
```

The setup installs `@babel/standalone` under the operating-system temp directory, never in this repository. The verifier requires one unambiguous suite HTML, rejects Proton Drive Name clash copies, checks LF bytes and version agreement, verifies all 11 frozen prompt hashes, checks `Prompts.md`, runs the regression harness with its enforced assertion total, and Babel-transforms the full JSX block with `presets:['react']`.

`neia-retest.js` and `davis-transcribe-test.js` make live Gemini API calls and consume quota. **Never run either without explicit user authorization for that run.** They are not repository gates and must never run in CI or through `verify-repo.js`.

## How to make changes

- Read the actual bytes before editing. The HTML is large and has near-duplicate strings.
- HTML edits use exact-match replacement: first prove the old string occurs exactly once, then replace it and fail loudly otherwise.
- Every non-obvious HTML change gets a `// vNN.N:` comment explaining why the previous behavior was wrong.
- Preserve unrelated work in a dirty tree. If a Proton Drive Name clash file appears, diff both copies before removing either; the fork may contain newer work.
- A version bump updates the HTML release comment, filename, `CHANGELOG.md`, and generated prompt documentation. Recheck every SRI pin against its CDN.

## Context routing

Read only the context relevant to the task, but do not skip a routed document:

| Task | Required context |
|---|---|
| Any application behavior, API, validation-tier, security, or architecture change | `DECISIONS.md` |
| Ingestion, quote verification, cards, NCLEX extraction/generation, case generation, model settings, or release planning | `CURRENT_STATE.md` |
| Prompt work | `Prompts.md`, `prompt-baseline.json`, and the prompt rules in `DEVELOPMENT.md` |
| v16 or PDF vision proposal | `Nursing-Study-Suite-v16-spec.md` plus the source-profile decision in `CURRENT_STATE.md`; nothing in the spec is approved |
| Repository workflow, version bump, or unfamiliar part of the HTML | `DEVELOPMENT.md` |
| End-user behavior | `README.md` |

`CHANGELOG.md` is the release record, not the place to infer current approval. `CURRENT_STATE.md` records the current evidence and open work.

## Data and external-action boundaries

Ignored PDFs, decks, card photos, transcripts, knowledge bases, diagnostics, and generated study artifacts may contain copyrighted or sensitive course material. Do not read, upload, quote, expose in tool output, or add them to Git unless the user explicitly places that material in scope. Never commit `*.pdf`, `*.pptx`, card images/transcripts, or `LATTE-Knowledge-Base*.json`. API keys remain in `sessionStorage` or the process environment and must never be written to a report or repository file.

## Conventions

- `CARD_TRANSCRIBE_PROMPT` is not one of the 11 byte-frozen constants, but its rules are load-bearing. Remeasure with two runs per card after an edit.
- Warn-tier validators remain warnings unless the user explicitly approves promotion.
- `Test Plan Alignment` can warn but never fail until the actual Test Plan activity statements are supplied to the generators.
- Scratch plans named `run-node-*.md` are gitignored.
- `neia-retest.js` and `davis-transcribe-test.js` are manual, quota-consuming measurement tools, never ordinary gates.
