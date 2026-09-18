# Independent Anki lifecycle re-audit evidence

Audited production: `Nursing-Study-Suite v16.6.html`. This artifact is a fresh live-code investigation, not an extension or import of a prior audit harness. Synthetic material only; no live API calls or browser suites. The script imports only Node built-ins and the shared synthetic protocol response fixture `tools/fixtures/anki-audit-response.js`.

## Executed result

`node tools/reaudit-anki-lifecycle-tests.js --json > 'docs/reviews/anki-integrity-reaudit-lifecycle-results.json'` exited **1 intentionally**: **38 assertions, 36 pass, 2 desired-behavior failures, 0 unexpected errors, 1 killed mutant**. The initial development run had 35 assertions, 33 pass, the same 2 failures and no unexpected errors. The added controls check numeric-cache recomputation and source-check cancellation/edit interleaving. Every executed shell command/output/exit and every patch action is in `anki-integrity-reaudit-lifecycle-commands.json`.

The JSON contains each fixture's independent expected behavior, actual result, request body, backoff record, stage traces and preview/export snapshots. Traces wrap functions used by the **actual complete pre-JSX AnkiGenerator body**, preserving the shipped sequencing. The script does not reconstruct a generation pipeline. It extracts actual Gemini transport, actual App setKnowledgeBase/registerArtifact closures, actual prompt constant bytes and complete helper spans. All start/end anchors must be unique and tail checks fail loudly. Every snapshot is produced by actual `ankiSourceSnapshot`, including production `sources:[{filename,location}]`.

Preview traces contain actual `ankiPreviewText` front/back strings and editable Extra. They do not claim DOM or native Anki rendering. Header-off export equivalence is asserted for the intact fixture; header-on escaping and the real export download callback are executed. Other lifecycle snapshots also preserve previews and exports for independent inspection.

## Reproduced defects

### A9 — non-card STOP text receives successful completion status (P2)

Smallest input: a current KB with fact-0 `Observe alpha.`; mocked SSE terminal STOP with text `I cannot provide cards for this content.` and no pipe-bearing note line.

Expected: explicit empty/unusable generation outcome, without a green successful-completion label. The requested source had a fact to convert and no note was produced; successful HTTP/STOP transport is insufficient evidence of generation success.

Actual: parser returns zero notes; generation commits a current zero-note batch and logs `Complete! 0 received notes; 0 after dedupe; 0 kept notes → 0 review cards.` with type `ok`. The independent desired-behavior assertion fails. Later coverage is not falsely 100%: it reports 0/1, plus a missing-id mapping diagnostic. Thus the confirmed issue is the successful completion label/empty batch outcome, **not a claim that every missing-fact diagnostic disappears**.

Code chain: `ankiParseCards` HTML:4142–4151, `run` parse HTML:5817, normalization HTML:5826, final batch construction/publication HTML:5843–5847. No later guard rejects a nonempty response merely because all parsed-note counts are zero. `ankiExportText` returns empty, so this fixture exports no unsupported note.

Smallest repair: detect zero parsed notes for a supplied nonempty chunk; preserve raw response diagnostics and report an explicit failed/incomplete result. Keep valid independent chunks inspectable if partial-output policy is chosen. Regression target: fixture `non-card-stop`, assertion `A9 non-card response is not successful completion`.

### MAX_TOKENS — final successful-completion wording contradicts known truncation (P2)

Input: the same KB, one valid supported note and coverage map, mocked SSE finishReason MAX_TOKENS.

Expected: retain the available partial note for review and identify the batch as truncated/incomplete in final status. Actual: the available note remains exportable; `batch.truncated===true` and an explicit error log says cards are missing from the end, **but** the subsequent final `Complete!` line is green and unconditional. The desired final-label assertion fails; warning/retention controls pass.

This is scoped to inconsistent final status. **Truncation is not silent**, the metadata flag survives and raw output remains in batch evidence. No claim is made that retaining a structurally valid partial note itself violates project policy.

Code: transport HTML:844–861 accepts MAX_TOKENS only with nonempty text and publishes truncated metadata; generation callback HTML:5813 sets the flag/log; final publication HTML:5843–5847 ignores that flag in the completion label. Smallest repair: branch final status on the captured truncation flag; preserve diagnostics and partial notes. Regression target: `max-tokens-retention`, `truncated batch not labelled unqualified Complete`.

## Refuted/re-scoped candidate N2 and manual-repair duplicates

**N2's raw observation is reproduced, but the proposed semantic-overcoverage implementation claim is not supported by the current contract.** Actual `updateField` HTML:5861–5874 preserves factIds/mappingIssues while replacing the card object, recomputing lint and abbreviations. An unrelated manual Text edit retains one linked fact and eligibility. Numeric status correctly says `No supported numeric values found`; adding unrelated 9 mg on a subsequent edit recomputes `Numeric discrepancy`, showing the WeakMap does not reuse the prior result.

README's exact meaning of the visible metric is source association: “A link records a source association”; the following sentence disclaims meaning/detail coverage. DECISIONS explicitly separates traceability/accounting from semantic accuracy and prohibits automatic semantic clearance/deletion from advisory signals. The visible metric is “Facts linked to kept notes,” not “Facts semantically verified.” The captured prior source check becomes outdated, and the actual source-check handler refuses to send an old packet. Its currentness guard binds exact cards/batch/tier identity. This directly refutes a claim that the unchanged association automatically retains current semantic-audit approval.

A product proposal could warn that manually changing Text may warrant reviewing source links, or offer explicit relinking. Automatically erasing associations or promoting unsupported prose warnings to export gates changes policy and is not an implementation fix established here.

**Invalid-card repair duplicate observation:** two identical no-cloze notes both survive generation dedupe because invalid notes have null dedupe keys. Both are initially ineligible. Editing both Text fields into the same valid cloze retains two eligible notes and emits two identical lines. No post-edit dedupe occurs. This is observable, but manual edits can intentionally create duplicate notes; README preserves user Keep choices, and DECISIONS keeps duplicate review advisory. Record this as a code-path/policy concern, not a demonstrated violation requiring automatic deletion. The control asserts both repairable notes stay visible and manual exclusion survives subsequent edits.

## Safeguard inventory and executed controls

| Safeguard, definition and call | Evidence/predicate | Effect/error behavior | Later stage / executed result |
|---|---|---|---|
| `geminiRequest`, HTML:797; actual callGemini HTML:896 from generation HTML:5813 | HTTP status, SSE JSON/events, finish metadata, nonempty text, outer abort | 429/408/5xx retry; missing finish retries; STOP-empty retries; fatal HTTP stops; MAX_TOKENS returns text with explicit metadata; abort rejects | 429 + EOF-incomplete + STOP yielded 3 transport attempts and **one** committed response/note. Two backoffs recorded; RetryInfo 7s floor honored. Three empty STOP attempts fail without batch. HTTP400 makes one attempt. |
| `ankiRunIsCurrent`, HTML:4217; local isCurrent HTML:5764, before/after awaits and publication | active run identity, captured KB identity, non-aborted controller; App current-source predicate | stale run returns without publishing; errors retain interrupted evidence only for owned run | cancellation and overlapping runs keep no old cards; source replacement before child rerender is also blocked. Exact guard mutant killed by identity/source/abort matrix. |
| App `setKnowledgeBase`, HTML:10139; `registerArtifact`, HTML:10209 | synchronous currentKnowledge identity and entry kind | source replacement clears registry/inspector; old-source register returns; current Anki entries replace | Actual extracted setters execute. Completed batch becomes stale, export empty, registry empty; old-source registration cannot restore entries. |
| Anki publication effect, HTML:5623–5626; `ankiBatchSummary` HTML:4294 | current batch, current fields' structural eligibility, Keep selection across all tiers | computes association entries and replaces only Anki registry kind | Repeated user generation makes 2 requests but leaves one **new** note/entry, not accumulated duplicates. Edits/selection change live entries. |
| `updateField`, HTML:5861; numeric cache HTML:5607–5608 | changed card object; rechecks fields and independent Keep | lint/abbrev updated; associations stay; audit identity invalidated; per-object numeric recomputation | fixed invalid notes regain eligibility; manual unchecked note stays excluded; later unsupported 9mg edit yields numeric discrepancy. |
| `exportTxt`, HTML:5876; `ankiExportText` HTML:4473 | fresh structural lint, current batch identity, tier, selection | invalid/stale/unchecked excluded; optional escaping/sources | actual export callback creates one blob; header fields escape &, <; editable note remains unchanged. |
| `prepareSourceAudit` HTML:5656; `runSourceAudit` HTML:5665; `ankiSourceAuditPending` HTML:5373 | immutable captured requests, matching notes/batch/tier, complete accepted group IDs | prepare sends nothing; malformed group stays pending; valid records retained; transport failure stops; cancel clears active identity | multiple groups exercised: first valid, remaining malformed; resume requests only pending groups with byte-equal captured request bodies; complete check sends no more request. |
| audit guard HTML:5676; currentness effect HTML:5580; cancel HTML:5726 | active auditRun identity and exact captured inputs | outdated run aborts and becomes interrupted; explicit cancel stays cancelled; late response cannot publish | actual delayed fetch + manual Extra edit produces interrupted/no accepted records; actual cancel produces cancelled/no accepted records. |

## Mutation and coverage limits

Exact in-memory mutation `return run===active&&run.sourceKB===sourceKB&&!run.ctl.signal.aborted;` → `return true;` is uniquely anchored and **killed** by the desired source/run/abort predicate matrix. Full handler cancel/overlap/source-race controls execute separately. The mutation claim is specifically for the extracted predicate: transport abort handling and App source ownership can mask its removal in whole-handler races, so no stronger whole-handler mutant result is claimed.

The deterministic scheduler implements state, refs, dependency-aware memo/callbacks and effect cleanup. It is not React's event loop. Browser JSX/DOM, native Anki rendering/import, actual model quality, actual private source correctness, browser persistence and real quota behavior remain untested. The only two failing assertions are the stated completion-label defects; known failures are not converted to green characterization tests.
