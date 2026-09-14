# v16.5 Anki generation and tag diagnostics

Implemented after the user approved the adjudicated four-subject v16.4 review. The canonical file is `Nursing-Study-Suite v16.5.html`; its visible sidebar and source-report version agree. The user subsequently authorized committing, pushing and publishing v16.5 as the latest release, with the matching `Nursing-Study-Suite.v16.5.html` attachment.

## Behavior

### Scoped structural tags

The structured-KB generation caller now captures `tagFormatContract: 'hierarchical-v1'` on each parsed note. Within that scope, every whitespace-separated tag must have nonempty `::`-separated segments. A stray bare word makes the note structurally ineligible for export until repaired.

This is a shape rule, not a nursing namespace whitelist or condition-name guess. Complete Topic and custom-domain hierarchies remain allowed, as do Unicode names. Existing records without this captured contract retain their prior behavior. Unknown canonical names and mixed source associations remain advisory findings.

The existing selection contract remains: `keep` records the student's choice; eligibility is derived separately. Repair restores structural eligibility without reversing manual exclusion. The contract travels through deduplication, existing alias normalization, edits, audit groups/packets, and the private evidence hash projection.

### Complete normalization diagnostics

The normalizer retains its existing conservative decision rules. It still repairs only unambiguous supplied names/aliases with reliable source associations, and it still declines mixed-condition mappings. There is no majority-condition fallback.

Every post-dedupe generation note now has an outcome: repaired, canonical, or review, with its existing reason code, source IDs, chunk/line location, original/resulting tags, and canonical candidate when known. Generation downloads retain those outcomes alongside existing successful-edit records and raw responses.

Source-check reports keep generation history separate from read-only checks of the captured audit notes. A later available alias is labeled `alias-available`, with unchanged tags, rather than being represented as an applied repair. Legacy history is explicitly unavailable; an empty `noteEdits` list never proves whether normalization ran or why it skipped a note.

### Approved prompt changes

Only `ANKI_MASTER_PROMPT` changes among the eleven frozen constants. Its three focused edits resolve the monitoring-list exception, preserve full source propositions including headings and timing origins, and distinguish source links from completed recall. The internal runtime adapter plans substantive targets before composing notes and reconciles their hidden destinations after compression. It also distinguishes equivalent representations from equal numbers serving different roles.

The exact [master diff](../history/ANKI-v16.5-target-allocation.diff) and [adapter diff](../history/ANKI-v16.5-adapter.diff) were recorded and shown before the deliberate Anki baseline update. The other ten frozen constants, transcription prompt, source packet, chunking and focus-block pins remain unchanged.

The two output blocks, three import fields and fact-to-note mapping syntax remain unchanged. Planning is internal; this implementation does not add an emitted target inventory, a new model call, a semantic export gate, or an automatic card rewrite. Flash / Medium remains the default.

## Verification

- `node verify-repo.js`: **2,265 assertions passed**, including **90 new assertions** (47 scoped tags, 31 normalization diagnostics, 12 allocation/protocol checks). Full JSX Babel transformation, LF/version agreement, prompt documentation, and all eleven deliberately maintained baseline hashes pass.
- Scoped offline replay of the four supplied v16.4 exports: **1,148 notes**, exactly **two tag-format findings**, both in the mental-health export; zero in the other three. This measures tag shape only. Private exports and detailed course evidence remain under ignored scratch paths.
- `node tools/anki-source-review-browser-tests.js`: synthetic Chrome acceptance passes Medium-default selection, advisory warning/export isolation, source edits, queue decisions, prepared packets, valid/partial/failed audits, explicit retry, cancellation, stale source handling, and mobile layout. All Gemini responses are mocked.
- `node tools/anki-generation-quality-browser-tests.js`: **25 focused browser checks passed**, covering malformed generated tags, repair with preserved manual selection, valid Topic/custom hierarchies, complete normalization downloads, and separate generation/prepared-audit diagnostics. The prepared audit makes no checker call.
- Actual App version acceptance at 1440px and 360px confirms the shared **16.5** version, existing responsive footer behavior, no horizontal overflow and zero Gemini calls. No unexpected console errors or resource requests occurred.
- All **eight script resources and both worker copies** were fetched from their existing CDNs and matched their pinned SHA-384 hashes. No dependency or integrity pin changed.
- Independent review of the combined prompt, tag and diagnostic changes found no actionable regression. Existing conservative-normalization and source-audit assertions remain intact.

The initial integration check caught a comment accidentally included by the chunking hash extraction boundary; moving the comment into its own function restored the unchanged chunking pin. Version assertions were updated to the actual 16.5 release identifier. No gate was weakened or skipped.

## Measurement limits

Deterministic checks establish the shipped instructions and software behavior, not model adherence or semantic completeness. A generator can still omit a target from its internal plan or misclassify it as context. The supplied v16.4 exports motivated these changes; they do not measure v16.5 quality.

New source-grounded generation/audit comparisons, latency and token measurements, and native Anki import/review remain unperformed. No live Gemini call was made during implementation. Existing private test decks were not rewritten or added to Git.

Private verification artifacts are in `scratch/anki-next/`: gate output, CDN hash receipts, exact prompt-before/after bytes, and browser evidence. The optional focused browser runner uses synthetic source material only.
