# Independent source-to-KB re-audit evidence — 2026-09-18

Discovery used the shipped HTML, not earlier audit scripts/reports. Prior A-number titles were supplied afterward for reconciliation. No production, prior-audit or unrelated files were edited.

## Execution

From the repository root:

~~~text
node tools/reaudit-anki-source-tests.js
node tools/reaudit-anki-source-tests.js --json
~~~

Both final runs exit **1**, intentionally: **32 cases, 18 pass, 14 fail; 2/2 in-memory guard mutants killed**. Fourteen failed assertions are not fourteen distinct findings: they include separate A2 cap/restore examples, three A6 response shapes and one injected probe concern. Full commands and outputs are in [the command journal](anki-integrity-reaudit-source-commands.json). The complete final machine-readable result is [source-results.json](anki-integrity-reaudit-source-results.json).

HTML SHA-256 recorded by the script: 8524e35c8b3621e074a0499ba3857a672464b99721e4b502c381dfa29d0b9b12. The root audit owns the before/after comparison and verifier.

Real build/importJSON closures, source-unit/grouping/splitting, quote checks, merging, normalization, persistence save queue/reconciliation/transaction helper, serializer and Anki transformations execute. Native PDF/PPTX retrieval is mocked at its boundary. Gemini is a response queue. No network, private materials, browser or native Anki/IndexedDB runs occurred.

Every extracted span verifies unique start/end anchors, order and a non-vacuous tail. Every application external identifier and standard global is supplied to new Function. JSON retains source-derived rationales, traces, errors, anchors and mutant results even on failure. Frozen prompts are extracted live; request traces retain source/inventory bytes and hashes of repeated instruction text.

## Pipeline and safeguards

Line numbers refer to Nursing-Study-Suite v16.6.html.

| Definition / calls | Evidence and condition | Effect, failure and bypass |
|---|---|---|
| extractPptxText 682, _pptxRunText 655 → kbSourceUnits 1984 | Presentation relationships order slides; related notes and text runs | Trims runs, emits slide markers; missing library/slides throws. Native ZIP/XML read in code only. Image-only facts absent by text-only design. |
| pdfLayoutText 1013, pdfWalkPages 1052 → kbSourceUnits 1999 | PDF.js strings, coordinates, widths; abort before each page | Inserts whitespace heuristically; cleanup in finally. Visual reading order and native extraction not tested. |
| kbSourceUnits 1981, kbGroupUnits 2014, kbBuildSourceChunks 2070 → build 2708 | File extension, actual unit labels/text, group size/overlap | Reject unsupported extension. Executed PDF/PPTX boundary fixtures retain units/overlap. Large indivisible units may exceed target size, not get deleted. |
| kbTextQuality 1030 → 2074 → build 2712 | Text character totals, pages below 50 chars; avg<100 or empty>=ceil(60%) | Warns, does not block. Exceptions in quality/composition callbacks swallowed at 2074/2077. Only injected failure reproduced. |
| createOperationSlot 2525; build 2675, final 2846 | Run identity and abort signal | Guarded setters and final guard reject late publication; control passes, removed final guard mutant killed. |
| extractJSON 899 → build 2779–2785 | Response bytes; top-level conditions array | Per-chunk errors preserve successful chunks; nested shape escapes catch at 2786: A5. |
| kbSplitChunk 2034 → build 2770–2777 | Truncated metadata, units/text, depth<4 | Requeues halves; cannot split text<2000. Real build truncation control passes. |
| kbQuoteInSource 2097 → 2795–2797 / 2820 | ASCII-normalized quote, dehyphenation, normalized length>=10 | Primary skips absent quotes, counts present misses and retains facts. Omission discards unlocated quotes. Does not compare fact meaning with quote. |
| kbQuoteOperatorsAgree 2135 → 2798/2822 | Operator-preserving accepted quote vs source | Adds mismatch warning only; opposite comparator fixture retained with warning. Explicit policy. |
| omission parser 2812 | JSON missed field | Non-array becomes empty with no failure: A6. Actual thrown errors warn while retaining primary extraction. |
| mergeLatteParts 1677 → 2845 | Names/aliases; bucket/subtype/whitespace-normalized text; model pointer | Exact facts merge source pointers and get new IDs. Primary pointer trusted: A7. Omission pointer independently bound to actual file/range at 2826. |
| kbNormalizeImported 1720 → import 2584 / hydrate 10168 / recovery 10187 | Parsed/stored KB, no original source | Bad root shape rejects; prototype keys stripped; malformed rows counted. Valid caps and invalid enum coercions silently alter content: A2/N3. |
| importJSON 2575 | File size before reading, JSON, operation ownership | Oversize rejected before file.text, tested; warnings only from nonzero malformed-entry counts. Real closure executed, browser file events not. |
| validateLatteKnowledgeBase 1904 → builder 2900 / Anki 5769 | Published/normalized fields only | Structure/ID/tier/bucket errors and missing-quote warnings. Critical pointer checks only nonempty filename. Anki logs errors then continues at 5771; not a gate. |
| persistence 1798–1902 → App 10138,10163–10187 | Captured bytes, writer/sequence/parent, fallback copies | Queue copies and orders writes; unresolved writers retained; transaction waits/aborts/closes, tested. Subsequent hydrate normalizer truncates complete saved KB. Native scheduling untested. |
| kbForAnki 1949 → Anki 5768 | Fact text, IDs, tier/bucket/pointers, canonical condition index | Calls facts already grounded; original chunks absent. Source-poison chain demonstrates consequence. |

## A — reproduced defects

**QUOTE_PREFIX confirmed, P1 — partial numeric token accepted as a verbatim quote.** Independent extraction-stage review supplied the additional probe, now a standalone desired-behavior regression. Source: "The synthetic marker reads 600 units." Primary output: {"conditions":[]}. Omission output contains text "The synthetic marker reads 60 units." and sourceQuote "The synthetic marker reads 60". The actual matcher returns true, real build reports recovered=1/discarded=0/quoteMiss=0/opMismatch=0 and publishes the altered 60 fact. A sparse-source warning exists because the fixture is only 37 characters; no quote-specific warning occurs. Exact source numeric token 600 cannot support 60; this is a token-boundary defect in the existing verbatim quote admission rule, not a request for a new semantic gate. Root: unbounded normalized substring includes at 2100–2101, called by pass 2 at 2820. Smallest repair: require complete normalized token boundaries in both normal and dehyphenated paths while preserving legitimate substring phrases. QUOTE_PREFIX-numeric-token-boundary fails; quote-substring-control passes for "synthetic marker reads 600" and actual pass-2 recovery.

**A2 additional executed scope.** Fifty-one distinct per-fact source pointers become fifty silently in real import (1747), with no warning. Real mergeLatteParts retains a 4027-character fact, then the restore normalizer truncates it to 4000 with zero dropped counts. A2-per-fact-source-cap and A2-merge-restore-length fail. These strengthen the same lossy sanitizer finding; they are not separate defect counts.

**A2 confirmed, P1 — silent import/restore loss.** Fact input is "Read source carefully. " repeated 200 times plus "EXCEPTION: never enable red."; quote is "Source prefix " repeated 50 times plus that exception. Actual import changes **4628→4000** characters and **728→600**, losing the final exception without warning. 2001 distinct conditions become 2000; 5001 distinct facts become 5000, with dropped={conditions:0,facts:0}. Actual save queue preserves a 4716-character fact, then the same normalizer used by hydration returns 4000. Native reload was not run. Root: _kbStr 1715, limits 1726/1731/1746, hydrate 10168. Independent expectation: source exceptions and distinct facts remain or loss is disclosed. Smallest repair: reject or precisely report exceeded limits before publication; preserve app-created saved facts. Desired assertions A2-fact-quote-truncation, A2-condition-cap, A2-fact-cap and persistence-reload-loss fail.

**N3 confirmed, P1 — silent invalid tier/bucket coercion.** Otherwise valid safetyCritical=true fact with tier="safety", latteBucket="Pharm" imports as tier=3, latteBucket="Look". No dropped count/warning; validation returns []; real serializer supplies Tier:3. Neither invalid enum supplies evidence for its replacement. Numeric string "1" correctly converts in a passing control. Root: 1737/1741, before validation. Tier filtering consumes altered tier. Smallest repair: reject invalid enums or retain a specific correction diagnostic; no silent demotion. N3-invalid-tier-bucket fails.

**A5 confirmed, P1 — nested malformed primary response loses completed chunks.** Two source pages grouped separately; valid first response followed by {"conditions":[null]}. First chunk logs success; whole build errors "Cannot read properties of null (reading 'facts')", publishes zero KBs, loses accumulated diagnostics. Ordinary API-error second response instead publishes the first chunk with warning. Independent expectation comes from that existing per-chunk recovery contract. Reduction 2786 lies outside catch ending 2785. Error is visible; lost prior work is the defect. Smallest repair: validate nested containers inside per-chunk try and use its existing failure path. A5-nested-primary-shape fails; API-error control passes.

**A6 confirmed, P2 — malformed omission response treated completed-empty.** With valid primary extraction, {"missed":{}}, {"missed":null}, and {} each produce no warning/error, "audit: +0 recovered" and successful KB. Valid {"missed":[]} passes its control. Empty valid evidence differs from missing/malformed evidence. Root is fallback to [] at 2812. Smallest repair: reject wrong shape into existing audit-failure warning while preserving primary content. Three desired A6-omission-shape assertions fail.

**A7 confirmed, P1 — invented pointer reaches exported deck.** Actual runtime reads synthetic.pdf page 1. A safety-critical primary fact has a located true quote but sourcePointer={filename:"never-read.pdf",location:"page 999"}. Actual build quoteMiss=0; validation=[]; real serializer/snapshot/mapping/export retain Source: never-read.pdf, page 999. Actual read inventory is an independent provenance oracle. Root: top-level part source overwritten at 2800, individual model pointer trusted at 1697–1701. Pass 2 already sets actual pointer at 2826. Smallest repair: bind/verify primary pointer against runtime file/range. A7-fabricated-first-pass-pointer fails.

## B — limited code-path concern

quality-probe-failure injects an exception into the real chunker's kbTextQuality dependency. Build succeeds with empty quality data and no warning. Bare catches at 2074/2077 are demonstrated, but **no ordinary well-shaped input trigger was found**; the normal helper is pure. Keep this separate from reproduced user-input defects. Desired diagnostic assertion fails; no claim that normal PDF inputs routinely trigger it.

## C — policy and evidence limits

**A8 re-scoped.** Empty sourceQuote produces quoteMiss=0, but actual validation emits a missing-short-verbatim-anchor warning. Static JSX 3045–3047 selects green "Every first-pass quote was located..." wording at zero misses; browser rendering was not run. "No diagnostic anywhere" is refuted. Recommend checked/missing/failed counts to qualify the denominator, preserving retention policy.

**Executed source-poison chain.** Synthetic source says lamp **green**. Mock extraction returns false fact "The signal lamp is **red** during readiness" carrying a true quote saying green. Real build has zero quote misses. Real kbForAnki → ankiChunkText → synthetic generator response → parse → mapping → dedupe → normalization → lint/preview/export emits:

~~~text
Signal lamp during readiness is {{c1::red}}.|Source: synthetic.pdf, page 1|Nursing::LATTE::Look Condition::Signal Tier::1
~~~

Independent expected verdict is unsupported, since red contradicts green. Snapshot is built by real ankiSourceSnapshot with production-shaped sources:[{filename,location}]. Trace captures each changing stage, explicit no-edit state, masked/revealed preview, numeric status "No supported numeric values found", one linked fact of one, and export. This passing **limit reproduction** proves propagation, not a clinical pass or a proposed new gate. Quote location is not fact entailment; linked coverage and structural eligibility are not semantic approval. The full Anki handler is covered by the separate lifecycle suite; this chain calls live downstream functions directly.

**Approved quote policy.** Primary unmatched quotes retain facts and count misses; additive unmatched quotes are discarded. Opposite < versus > quote is retained with opMismatch=1 and warning, per explicit policy. No automatic correction, new model call or warning promotion proposed.

**IDs are snapshot-local.** Import rekeys fact-7/fact-42 to fact-1/fact-2 deliberately. External evidence needs source snapshot/hash, not only fact-N. In-memory source identity guards separately invalidate old links; no cross-snapshot browser corruption is claimed.

## Mutation and outcome interpretation

Only in-memory build source changes:

| Removed guard | Baseline expected result | Mutant result |
|---|---|---|
| Pass-2 quote discard | One primary fact; unsupported omission rejected | Two facts: killed |
| Final current-run publication | Cancelled response publishes zero KBs | One KB: killed |

Keep outcomes separate: valid controls pass; unsupported provenance exports (A7); semantic source poisoning is a measured policy limit; inconclusive omission evidence appears empty (A6); import changes content silently (A2/N3); malformed primary output loses completed chunks (A5). These counts are not a clinical pass rate.

No private sources, live Gemini, native Anki, browser acceptance, native IndexedDB/React timing, actual PDF/PPTX decoding or clinical validation ran. Native extraction code was inspected, not executed. No production fixes applied.
