# CLAUDE.md

Project context for Claude Code. Read this before proposing changes.

## What this is

A single-file, serverless HTML study suite for nursing students. It turns lecture PDFs and PPTX decks into a source-cited LATTE knowledge base, then generates prioritized study guides, Anki cloze cards, NCLEX practice questions, and unfolding clinical case studies from it. Everything runs client-side against the Gemini API with a user-supplied key.

Maintained by one person — a working LPN in an LPN-to-RN bridge program — between clinical shifts. Optimize for changes that are small, verifiable, and reversible.

## Hard invariants — do not violate without explicit approval

1. **The 11 prompt constants are byte-frozen.** `KB_EXTRACTION_PROMPT`, `KB_VERIFY_PROMPT`, `ANKI_MASTER_PROMPT`, `NCLEX_INLINE_PROMPT`, `NCLEX_SPLIT_PROMPT`, `NCLEX_AI_PAIR_PROMPT`, `NCLEX_GEN_PROMPT`, `NCLEX_DISTRACTOR_RULES`, `NCLEX_ANCHOR_RULES`, `NCLEX_RATIONALE_RULES`, `NCLEX_COMPLETENESS_RULES`. These were tuned across many iterations; a "harmless" rewording is a silent regression with no test that catches it. If a change genuinely requires touching one, say so up front, make the smallest possible edit, and report the exact diff afterward.
2. **Single file, no build pipeline.** One `.html` containing everything, loaded from CDNs, compiled by in-browser Babel. This is a deliberate product constraint — the user opens the file by double-clicking it, on any machine, with no install. **Never propose** bundlers, npm builds, TypeScript migration, module splitting, or a backend. Reviews suggest these constantly; they are all out of scope.
3. **All three gates pass before any commit.** See Testing below.
4. **No new runtime dependencies.** The CDN list is fixed. `latte-tests.js` uses only built-in `fs`.

## Testing (required before every commit)

```
node latte-tests.js
```

Expect **69 passed · 0 failed**. The harness extracts live functions from the shipped HTML by anchor strings — it never copies code, so it fails loudly if a refactor moves an anchor. That failure is signal, not noise: fix the anchor reference, don't weaken the test.

Two more gates for changes touching the HTML:
- **Babel parse** — the whole `<script type="text/babel">` block must transform cleanly with `presets:['react']`.
- **Prompt byte-check** — extract all 11 constants and confirm they are unchanged.

New behavior gets a new assertion in `latte-tests.js`. A change without a test is not finished.

## How to make changes

Edits to the HTML are exact-match string replacements with an occurrence-count assertion — verify the old string appears exactly once before replacing, and fail loudly otherwise. Read the actual bytes before editing rather than reconstructing from memory; the file is large and near-duplicate strings are common.

Every non-obvious change carries a `// vNN.N:` comment explaining *why*, including what the previous behavior was and why it was wrong. Several past bugs were reintroduced by well-meaning "cleanups" of code that looked redundant.

## Deliberate decisions that look like bugs

Do not "fix" these:

- **`SAFETY_SETTINGS` all `BLOCK_NONE`.** Nursing content — overdose thresholds, self-harm risk assessment in psych, abuse/neglect scenarios — false-positives generic filters. Deliberate and documented.
- **API key held client-side in `sessionStorage`.** This is a local bring-your-own-key tool, not a hosted service. Not a vulnerability in this architecture.
- **`thinkingLevel` is lowercase.** Matches Google's documented REST format. Reviewers have claimed uppercase three times; they are wrong.
- **Pass-1 vs pass-2 quote policy is asymmetric.** Primary extraction *keeps* facts whose `sourceQuote` fails verification (counting `quoteMiss`); the audit pass *discards* them. The risk profiles are inverted — see the code comments. Making both strict reintroduces omissions.
- **`generateContent` (not the Interactions API).** Legacy but fully supported, and required for batch/caching.
- **Warn-tier validators.** Numeric entailment, qualitative term scanning, and missing-field checks warn rather than error, on purpose. Errors block registry inclusion; warnings inform. Don't escalate without asking.
- **`gemini-3.1-pro-preview` as the Pro default.** There is no stable Pro alias; this is the current Pro path.

## File map

| File | Purpose |
|---|---|
| `Nursing-Study-Suite-*.html` | The entire application |
| `latte-tests.js` | Regression harness, 69 assertions |
| `CHANGELOG.md` | Release summary (Keep a Changelog format) |
| `Nursing-Study-Suite-v16-spec.md` | Multimodal architecture spec — **build blocked** pending benchmark |
| `Prompts.md` | The three main prompts, extracted verbatim |
| `README.md` | End-user guide |

## Current state

Shipping v15.4. Open items:

- **SRI `integrity` attributes** not yet applied — `crossorigin` is present and hashes must be computed from live CDN bytes. Both DOMPurify tags need one, including the jsDelivr fallback inside `document.write`.
- **v16 multimodal ingestion** — architecture settled, build gated on the 20-page benchmark in the spec's §11. Do not start implementing it.
- **v15.5 candidate** — de-hyphenation and ligature normalization in `kbNormForMatch`, to promote quote-verification misses caused by line-break hyphenation. Cheap, may resolve much of `quoteMiss` without vision.

## Conventions

- Version bumps: update the top-of-file HTML comment, `CHANGELOG.md`, and the harness count if assertions changed.
- Scratch/plan files (`run-node-*.md`) are gitignored — don't commit them.
- Never commit `*.pdf`, `*.pptx`, or `LATTE-Knowledge-Base*.json`. These contain copyrighted textbook content.
- Prefer amber warnings over hard errors when a check could false-positive on legitimate authoring.
