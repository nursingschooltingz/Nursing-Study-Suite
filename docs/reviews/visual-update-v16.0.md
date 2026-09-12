# v16.0 visual update and verification

Implemented 2026-09-11 from the user's `Visual Update.txt` brief. The scope is the light-theme visual/usability redesign and version bump. The archived v16 multimodal PDF spec is not part of this release.

## Design and structure

The single application stylesheet now uses centralized surface, blue/orange accent, semantic status, spacing, type, radius, shadow and focus tokens. Blue identifies primary actions and navigation; orange provides restrained identity and highlights. Warnings keep a separate mustard palette, errors red and success green. Body and evidence text use dark foregrounds on light surfaces.

The shell has named study-tool navigation, an active-location indicator, a keyboard skip link, a source summary and an API-key shortcut. Settings remain inline beside desktop content and collapse on demand; at initial widths below 801px they start closed. Closing settings restores focus to its trigger, and the API-key shortcut opens/focuses the concealed key field. All six tools stay mounted across navigation, preserving their state.

Responsive class hooks replace fixed form columns, the Knowledge condition/fact split and Priority control/output split. The phone view stacks content and keeps intentional table scrolling inside output panels. The Fact Inspector retains its existing focus trap, Escape behavior and source-link restoration. Forms have associated labels; selected modes, tiers and views, expandable answers, file removal and progress have accessible names and state. Dense helper, diagnostic and study text is larger; unchecked Anki notes remain readable.

## Files changed

- `Nursing-Study-Suite v15.18.html` renamed to `Nursing-Study-Suite v16.0.html`: CSS, shell and presentation/accessibility markup.
- `latte-tests.js` and new `tools/visual-regression-tests.js`: 27 additional required UI regression assertions; enforced total 1,372.
- New `tools/visual-browser-tests.js`: isolated real-App responsive and interaction acceptance.
- `README.md`, `DEVELOPMENT.md`, `CURRENT_STATE.md`, `CHANGELOG.md`, this report and regenerated `Prompts.md`: usage, release and verification documentation.

The prompt baseline is unchanged. No new application dependency or build pipeline was added. The two pre-existing untracked review documents were not edited.

## Verification evidence

- `node verify-repo.js`: 1,372 assertions, full JSX Babel transform, one canonical LF-only HTML, matching filename/release version, all eleven frozen prompt hashes and all twelve documented constants.
- `git diff --check`: no whitespace errors.
- CDN verification: all eight script resources and both independently pinned PDF-worker copies match their existing SHA-384 values. This includes both DOMPurify 3.4.15 copies.
- UI source audit: the non-render statements and JSX event handler expressions in all eleven audited tool UI components are identical to the previous release. No duplicate static JSX IDs, missing label targets, unlabeled form controls or undefined theme variables were found. Fact Inspector logic is unchanged.
- `node tools/visual-browser-tests.js --screenshots scratch/visual-v16`: empty and populated major-tool views at 360, 768, 1024 and 1440px; no page/panel horizontal overflow; settings and keyboard focus; fact-drawer bounds, reverse Tab trapping, Escape and focus restoration; synthetic JSON import; mocked Anki, Priority, worksheet and case generation; Anki editing/view switching/export and case answer reveal/export; state retained across navigation. Wide tables intentionally retain local horizontal scrolling.
- The six-tab matrix checks every input view; generated outputs cover Anki, Priority, NCLEX Generate and Case Studies. NCLEX Extract is checked as an input/configuration view, with PDF processing verified separately by the synthetic worker suite. It is not a live question-extraction acceptance run.
- `node tools/remediation-browser-tests.js --output-policy`: synthetic browser persistence/recovery, migration, hydration/save ordering, build/import ownership, source replacement, stale output, invalid responses and sanitized popup/iframe resource handling.
- `node tools/remediation-worksheet-browser-tests.js`: interrupted and quota-stopped audits, incremental verdicts, non-MCQ N/A status and malformed/ungrounded repair rejection.
- `node tools/remediation-pdf-browser-tests.js`: actual synthetic PDF extraction and photo decoding/resizing, loopback and file-URL startup, primary/fallback worker integrity, failure/retry and cleanup, including fail-closed worker CSP handling.
- Screenshots were visually reviewed at mobile, tablet/laptop and desktop sizes, including settings and Anki output. Found issues with faded diagnostics and excluded notes, control-border contrast, remove-button size, Anki header wrapping and a broken Preview label were corrected before the final check. Key token contrast checks included muted text on alternate surfaces (4.78:1), orange on its soft surface (4.86:1), warning text on its surface (5.61:1), and input borders on white (3.35:1).

Browser artifacts are synthetic and remain under ignored `scratch/visual-v16/`; they are not production study content. The optional browser runner uses the existing external Playwright runtime and temporary browser contexts. The fixture permits pinned startup resources, suppresses remote fonts, blocks unplanned external requests, and never serves the repository directory. Browser console checks reject application errors and unexpected warnings; Babel's known development/large-file advisory is reported separately.

## Limits

No live Gemini requests, private course files, patient data, or actual Anki import/review were used. Mocked generation tests rendering and interaction, not clinical correctness or prompt adherence. Native print dialogs and Firefox/Safari/Edge-specific behavior were not tested. Screenshot review used the browser's fallback fonts because the isolated fixture suppresses remote font stylesheets. After implementation, the user explicitly authorized committing, pushing and publishing the [v16.0 GitHub release](https://github.com/nursingschooltingz/Nursing-Study-Suite/releases/tag/v16.0).
