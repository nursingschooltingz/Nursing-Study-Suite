# Post-v16.8 review follow-up fixes — 2026-09-19

Twelve defects found by two independent reviews of the shipped v16.8 build (`c0149f1`), then fixed and
released as **v16.9**. Code comments are labelled `v16.9:`. Release checks, hashes and the CDN recheck
are in the [release verification record](v16.9-release.md).

Only one of the twelve sits in code v16.8 itself changed (the cancelled-comparison gap in the new
failed-retranscription handler). The other eleven are older defects the v16.8 review surfaced. That
distinction matters for release planning, not for severity.

## Fixes

| # | Area | Defect | Fix |
| --- | --- | --- | --- |
| 1 | Case grounding | `caseNumericText` rewrote every `per` as `/`, so prose ("below 12 breaths per minute per shift") became an unsupported compound unit and v16.8's new tail check refused a bound the case legitimately instantiated — 1 grounding error where there should be 0, which also suppresses the optional item audit and Fact Inspector registration. | `per` divides units only before a known denominator (`kg ml l dl hr min sec day dose m2`). The v16.8 tail check is untouched, so every intended rejection is preserved by construction. |
| 2 | Case validation | A present-but-blank `correctAnswers` entry passed the length check, skipped the Calculation-exempt option-label match, and printed `Answer: —` in the worksheet key as though the item were complete. | A blank or whitespace-only answer is an explicit error. The Calculation/Ordering exemption from label matching is unchanged. |
| 3 | NCLEX extraction | Widening the option marker to A–F made `101.2 F.` inside an option body a rank-6 mark, which either broke the ascending run (every choice lost, and a misleading "No answer choices detected" banner) or extended it (a fabricated sixth choice, with the `F.` silently deleted from the exported question). | Line position is read from the text before the mark, so indentation counts; candidate runs are scanned within each line-position class and the longest still wins. |
| 4 | NCLEX split mode | `Question N:` blocks whose choices were numbered 1–4 produced more bare matches than headings, so the split returned the first question's choices as the questions and dropped the rest — and three plausible matches then bypassed the AI pairing fallback. | An explicit question marker wins, but only when every bare number sits inside one heading's block as a plausible choice run, so a book that numbers most questions bare and labels only a few still uses the bare count. |
| 5 | NCLEX split mode | The AI pairing fallback replaced the pairing only when it found *more* questions, so a run that recovered the missing answers for the same questions paid for the call and discarded them. | Recovered answers are merged into unmatched pairs by question number; already-matched pairs and every question already found are kept. A larger AI result still replaces the pairing outright. |
| 6 | NCLEX accumulation | `diseases_conditions` arrives as a bare string often enough to matter, and all three consumers call array methods on it — the expanded card render (`.map`), the disease filter (`.some`) and the Markdown export (`.join`) each threw. | Normalized once at admission: arrays are preserved and trimmed, a scalar string is wrapped, anything else becomes `[]`. |
| 7 | Anki export | Lint rejects pipes and newlines in a field but not quotes. A field holding a quote lost it on import, and an unmatched leading quote merged the following notes into one record; a leading `#` is an importer comment. | Fields containing a quote or starting with `#` are quoted with doubled inner quotes. Every other note exports byte-identically; the header directives stay unquoted. |
| 8 | NCLEX generator | Once the choices began, a wrapped option's continuation line was dropped, so the audit reviewed a shorter option than the worksheet and the export actually show, and repair received the truncated text. | An **indented** continuation line is appended to the current option or ordering step. A flush-left trailing line is still ignored, as before. |
| 9 | Card transcription | The admission gate checked only the outer `sections` array, so a null section threw while reading its heading and string `bullets` turned one sentence into one bullet per character in the source text. | Section shape is validated before admission; a malformed transcript routes through the existing failed-transcription path. |
| 10 | Card transcription | Cancelling partway through a requested comparison skipped the publish, so an earlier transcript stayed current with `comparisonIncomplete` false and remained buildable, under a message saying completed cards were kept. | A partial attempt is published as incomplete with the earlier transcript retained, exactly like a failed one. |
| 11 | Priority analyzer | The early returns left the previous run's source, harvest and truncation notices beside the new error, describing coverage the new attempt never had. | All three notice inputs are cleared before the error is reported. |
| 12 | Anki review queue | A source-check **finding** may reference a note outside the selected tier (unlike receipt targets, which are filtered to the selection), so Edit set a focus request for a row that never mounted and the request stuck. | The tier change is offered explicitly with a named button, because the tier filter also decides what exports. Nothing changes the selection on its own. |

## Two withdrawn fixes

The first proposals for #1 and #3 were both unsafe and were replaced after the second reviewer
supplied counterexamples. Recorded because the reasoning errors are instructive:

- Narrowing the threshold tail check accepted `Below 12 /min/kg.` as a plain `/min` bound and took
  the whole-case audit from 1 error to 0 — it reopened the prefix-borrow hole v16.8 had closed. The
  mistake was assuming `UNIT`'s trailing-denominator group absorbs every lowercase continuation;
  that holds for the `[a-z%]+` branch but not for `\/\s*min`, which is the same asymmetry that
  caused the false rejection.
- Filtering option marks down to the dominant line-position class read line position from `m[0]`,
  which for `\n  B. ` is `" B. "`, so an indented option was misclassified as mid-line and a
  mixed-indentation list lost all four choices. Discarding the inline class outright also turned
  three numbered stem clues followed by inline A–D choices into three fake choices.

## Verification

`node verify-repo.js` passes **3,045 assertions / 0 failed**, all eleven frozen prompt hashes,
generated prompt documentation, LF/version/file checks and the full JSX Babel transform. The
previous total was 2,974; the 71 added assertions live in
[`tools/production-review-followup-tests.js`](../../tools/production-review-followup-tests.js) (68)
and `tools/production-anki-performance-tests.js` (3). No gate was removed or weakened.

Every new assertion extracts a live function or handler from the shipped HTML. Run against the
pre-fix bytes the module fails, so the checks are coupled to the fixes rather than to their inputs.

Supporting sweeps, run against the patched build:

- Threshold parsing: 22,176 comparator × number × unit × tail combinations. **0 previously-parsed
  bounds became unparseable and 0 units changed silently**; 3,828 newly parse, all prose tails. All
  fourteen intended rejections hold, including `/min/kg`, `/min/banana`, `/min / kg`, `mg/(kg min)`,
  `mg²`, `mg·kg`, `mg * kg`, `mg^`, `mg%`, `mg5` and `mg/µL`.
- Option parsing: eleven layouts, covering both Fahrenheit failure modes, mixed and full
  indentation, numbered stem clues with inline choices, six lettered options in both cases, inline
  parenthesised and one-line choices, and numeric choices.
- `caseNumericText` reaches only `caseNormalizeClinical` and `caseParseThreshold`; the Anki numeric
  comparison path has its own `ankiNumericText`, so fix #1 cannot move Anki behavior.

## Limits

- Frozen prompts, `prompt-baseline.json`, model profiles, token ceilings, warning tiers, dependency
  pins and CDN/SRI pins are all unchanged. No warn-tier validator was promoted.
- Fixes #2 and #9 add rejections. Both close an incorrect acceptance rather than guard against a
  hypothetical: a blank answer printed as `—`, and a malformed section crashed or corrupted source
  text. No other rejection rule was added.
- Anki export bytes change only for a note whose field contains a quote or starts with `#`.
  Native Anki import was not run; the quoting follows the importer's documented CSV handling.
- Fix #4 still cannot separate a single question from a genuine three-item numbered list under one
  heading, and needs at least two explicit headings. Fix #8 recovers indented continuation lines
  only.
- No live Gemini call, private course material, real PDF/PPTX corpus, mounted-browser acceptance or
  native Anki import was part of this work. Actual-PDF prevalence for #3, #4 and #6 remains
  unmeasured.
- Not done deliberately: the 28 comments added in v16.8 that are labelled `v16.7:`. That is a
  mechanical relabel with no behavior change, and several test extraction anchors quote comment
  text, so it belongs in its own change.
