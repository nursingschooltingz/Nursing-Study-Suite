# Synthetic browser validation — v15.17 remediation

Date: 2026-09-11. These checks use the shipped application in headless Chrome with synthetic data. No private KB, course file, patient information, actual API credential or live Gemini request was used. This is local implementation evidence, not release authorization.

Final integration gate: `node verify-repo.js` passed **1,345 deterministic assertions**. After the last numeric and case-validation changes, `node tools/remediation-browser-tests.js --lifecycle --output-policy` passed again on the final canonical bytes, including original case preservation and JSON-copy metadata. Persistence and performance measurements were not repeated in that final focused smoke run.

Canonical file: `Nursing-Study-Suite v15.17.html`; SHA-256: `924accd6eb97d58728d83cd58617451ef569d7dde6cf88462e35630fa406fee5`.

## Reproduction

Use an existing external Playwright installation; no application or repository dependency is added. The Codex runtime used here provides it at:

```powershell
$env:NODE_PATH='C:\Users\<user>\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
node tools/remediation-browser-tests.js --self-test
node tools/remediation-browser-tests.js --output-policy
node tools/remediation-worksheet-browser-tests.js
node tools/remediation-anki-performance.js 315 single
node tools/remediation-anki-performance.js 315 small
node tools/remediation-anki-performance.js 1000 small
node tools/remediation-anki-performance.js 3000 small
```

`--lifecycle` restricts the ordinary browser run to replacement/source checks; it can be combined with `--output-policy`. `REMEDIATION_BROWSER_EXECUTABLE` can select an installed Chromium executable instead of the default Chrome channel. CDN downloads required network access outside the restricted sandbox in this environment.

The fixture serves only `GET /` on a randomly assigned loopback port. Every run creates a fresh browser context with service workers disabled. Browser-context routing covers the initial popup navigation, descendant frames and automatic resource requests. It permits exact shipped CDN script/worker URLs, fulfills the trusted font stylesheet locally with empty CSS, and fails the test on any other attempted network request. Gemini operations require an explicitly queued synthetic response; an unexpected operation or real Gemini fetch fails. The app itself, its storage effects and its generators mount unchanged. Test-only wrappers control actual storage/file-read completion and observe context state.

The fixture self-test passed 14 assertions covering real-App mounting, exact extraction anchors, script-injection-safe configuration, and refusal to serve repository paths or accept POST requests. Importing these tools does not start a server or browser.

## Completed browser evidence

The final `node tools/remediation-browser-tests.js --output-policy` run passed with no uncaught browser exception and no unapproved network request:

- Empty storage; either legacy store; identical legacy stores; persistence across reload.
- Conflicting legacy snapshots remain intact until a choice archives both. The chosen snapshot survives reload.
- An actual JSON import during delayed hydration remains current and survives reload.
- Failed save A then successful B; successful A then fallback B; controlled A/B/C completion ordering and current save status; failed clear retained as a tombstone; concurrent durable writers; unmount during hydration.
- Concurrent fallback writers preserve the saved fallback and the conflicting tab's inspectable snapshot. Malformed fallback metadata remains intact and blocks migration.
- Two actual JSON imports resolving in reverse preserve the later accepted replacement.
- Priority Analyzer remains busy while streaming into its results view. Reset rejects late stream/completion callbacks.
- A generated case retains source A when replacement B reuses `fact-1`. Old references become non-clickable, case registry entries clear, and exported Markdown retains A's evidence plus earlier-source and disabled-audit notices.
- Case JSON Copy preserves the original case fields and adds `_suiteReview` with source/audit notices, validation findings and item-audit outcomes. The test captures clipboard text in fixture memory; it does not write the system clipboard.
- Malformed `{ "stages": [null] }` remains inspectable and exportable as failed data. It neither crashes nor causes an audit operation.
- A non-collision Anki note remains editable and exportable without a warning-component crash.
- Untrusted style/media/resource markup is removed from rendered output and both print paths. Text, comparators and tables remain. No resource request reaches the network guard from app output, the popup or the iframe.
- Trusted application SVG icons remain present. An intentional remote-image probe produces an `img-src` CSP violation before any network request reaches interception.

The dedicated worksheet browser suite also passed these actual generator/audit flows:

- Cancellation during the first audit preserves all five generated questions and answers. Export marks the audit interrupted and keeps answers below the Answer Key boundary.
- PASS and REVIEW verdicts are visible while later audits remain pending, then survive cancellation with the completed worksheet.
- Two mocked quota failures stop further audit scheduling; the first ERROR and the surviving in-flight PASS remain exported, and the final audit notice stays interrupted.
- Five Ordering questions produce five explicit N/A outcomes and a complete audit notice, with zero audit model operations.
- Malformed and ungrounded repair candidates preserve the original usable question. Exports retain the unresolved FAIL and four N/A outcomes; rejected replacement text never appears in the worksheet.

## Anki performance

The same synthetic note generator, actual App/AnkiGenerator, default table view and first-note Extra edit were used before and after P13. Each case below is one measured browser run, not a statistical latency benchmark. A small group contains three notes; the 1,000-note case has one non-colliding remainder.

| Fixture | Rendered collision members, before → after | Total DOM elements, before → after | Render ms, before → after | Extra edit ms, before → after |
|---|---:|---:|---:|---:|
| 315 notes, one group | 99,225 → 315 | 107,604 → 7,439 | 1,253 → 263 | 447 → 84 |
| 315 notes, small groups | 945 → 315 | 9,013 → 7,752 | 315 → 254 | 92 → 91 |
| 1,000 notes, small groups | 2,997 → 999 | 27,500 → 23,503 | 708 → 728 | 213 → 161 |
| 3,000 notes, small groups | 9,000 → 3,000 | 81,508 → 69,507 | 1,750 → 1,420 | 590 → 333 |

The single-group member count changed from quadratic to linear. The small 1,000-note render sample was slightly slower; these measurements do not establish a universal render-speed improvement. The large single-group baselines at 1,000 and 3,000 notes were not run.

Before the change, every Extra edit reran original diagnostics once and performed two numeric-audit passes over all notes. After the change, original diagnostics did not rerun and only the changed note was audited: 630 → 631 cumulative calls at 315 notes, 2,000 → 2,001 at 1,000, and 6,000 → 6,001 at 3,000. Source-currentness changes still invalidate the cache and preserve the established stale `Not checked` status. Eighteen deterministic regressions exercise current counts, manual/structural eligibility, memo invalidation, semantic registry updates, captured source publication, all three note views and extraction-tail coverage.

## Limits

Print validation checks generated content, sanitization, frame/popup behavior and network requests. The fixture replaces the native `print()` call; no native printer dialog, print-layout visual review or physical/PDF printing is claimed.

Actual Anki import/review in a disposable profile, real-material generation/OCR acceptance and clinical correctness remain outside these synthetic checks. Existing prompt, model and resize-setting contracts are unchanged by the fixture. PDF worker/file-origin and decoder acceptance is recorded separately by the dedicated PDF browser runner.
