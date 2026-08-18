# v16 — Selective Multimodal Ingestion (design spec)

**Status: NOT APPROVED FOR BUILD.** This architecture is settled but rests on an assumption nobody has measured — that text-layer extraction is losing clinically meaningful content in *your* textbooks at a rate worth this complexity. Run the benchmark in §11 first. If the numbers don't justify it, the correct outcome is to build nothing, or to build only §10's v16a subset.

Baseline: v15.4 (`Nursing-Study-Suite-7-24-26_v15.4.html`). Every claim about current behavior below was verified against that file, not recalled.

---

## 1. What v15.4 already does

- **`pdfLayoutText(textContent)`** — coordinate-aware page assembly: line breaks from y-deltas, spaces from x-gaps, column wraps from large negative x-jumps. Shared by the Knowledge Base and the NCLEX Extractor.
- **`kbTextQuality(units)`** — text-layer probe returning `{pages, empty, total, avg}`. The builder warns when `avg < 100` chars/page **or** `empty >= ceil(pages * 0.6)`, where a page counts as empty at `< 50` chars. Page markers are excluded from the count.
- **Two quote policies, deliberately asymmetric** (this is load-bearing — see §4):
  - *Pass 1 (primary extraction):* a `sourceQuote` that fails `kbQuoteInSource` increments `quoteMiss` and **the fact is kept.** Code comment: *"pdf.js mangles spacing, so a failed match is weak evidence — and dropping a primary fact would cause the very omission this whole feature exists to prevent."*
  - *Pass 2 (Pro audit, additive):* a failed quote match **discards** the fact. Code comment: *"Additive content gets the strict rule; the risk profile is inverted from pass 1."*
- **`kbQuoteInSource(quote, sourceNorm)`** — normalized substring match. `kbNormForMatch` lowercases, replaces non-alphanumerics with spaces, collapses whitespace. Therefore: **whitespace-insensitive and punctuation-insensitive, but order-sensitive.** Minimum quote length 10 normalized chars.
- **Per-chunk diagnostics already exist.** `stats[]` carries `{tag, file, label, chars, facts, recovered, discarded, quoteMiss, failed}` for every chunk, and `kbFlagUnderextraction` marks each with a `flag` boolean. The Extraction diagnostics panel renders all chunks, flagged ones in amber. **No instrumentation is needed for the §11 benchmark.**
- **Fact schema fields relevant here:** `factType` ∈ `mechanism | symptom | assessment | test | medication | intervention | education | threshold | contraindication | other`, plus `safetyCritical: boolean`, `tier`, `latteBucket`, `sourceQuote`. `buildFactIndex(kb)` maps `factId → {condition, fact}`, so validators already reach every field.

## 2. The problem

Text extraction is structurally blind to a category of high-yield nursing content: ECG rhythm strips, ACLS and triage flowcharts, anatomical and procedure diagrams, wound/pressure-ulcer staging photographs, tables embedded as raster images, and layout-isolated Safety Alert callouts. `pdfLayoutText` recovers *row structure* from real tables; it cannot recover anything that was never text.

**How much this costs you is unmeasured.** Do not put a percentage in this document until §11 produces one.

## 3. Six invariants

1. **Text first.** `pdfLayoutText` remains the primary, default extraction path.
2. **Selective page vision.** Vision runs on flagged or manually selected pages, never blindly across a document.
3. **Co-supplied context.** When vision is invoked, the model receives the page image **and** that page's `pdfLayoutText` output together, with instructions to quote the supplied text whenever the information exists there.
4. **Explicit evidence states** that survive into Anki, NCLEX, and Cases.
5. **Deterministic safety gate.** Visual-only actionable numbers cannot drive dosage math or high-risk items until student-confirmed.
6. **Two-signal routing.** The router detects visual *content*, not merely missing text.

Invariant 3 is the one that makes the rest affordable: because `kbQuoteInSource` is whitespace-blind, a value that vision reads out of a table can often still be quoted from the text layer and pass deterministic verification. Vision repairs *relationships*; the text layer keeps supplying *provenance*.

## 4. Evidence model (5 states)

| State | Meaning | Set when |
|---|---|---|
| 🟢 `textVerified` | Claim's own words found in the source text layer | `kbQuoteInSource` passes |
| ⚪ `textUnverified` | Text-derived, quote didn't match | Pass-1 quote miss — **fact retained** |
| 🔵 `visualGrounded` | Derived from the rendered page; page recorded, claim not mechanically verified | Vision route, quote anchor fails |
| 🟣 `visualConfirmed` | Student opened the source page and confirmed it | Manual action only |
| 🔴 `ungrounded` | No defensible text or visual support | Audit-pass discard; rejected content |

**⚪ is not a new state — it is a state the app already has and currently hides.** Every pass-1 `quoteMiss` fact lives here today, indistinguishable in the UI from a verified one. Naming it is most of the value.

**⚪ is not merely cosmetic — it needs a downstream policy.** Introducing the badge without one would improve visual provenance while leaving today's *hidden* text-verification weakness exactly as it is. Rule:

> ⚪ facts are used normally for non-numeric study content. Any ⚪ fact that is `HIGH_RISK`, or that supplies a correctness-determining numeric operand, takes the same caution path as 🔵.

⚪ also has a remediation path 🔵 does not — the source text is still available, so some ⚪ facts can be promoted to 🟢 by improving the matcher rather than by adding vision. That split is worth understanding before building anything:

- **Safely fixable by normalization:** hyphenation across line breaks (`hypo-\nkalemia` normalizes to `hypo kalemia` and fails a `hypokalemia` quote), ligatures, and superscript/footnote characters injected mid-token. These are *local* failures — joining hyphen-newline pairs and normalizing ligatures in `kbNormForMatch` promotes them with no loss of rigor. This is a plausible v15.5, and it may resolve a meaningful share of `quoteMiss` with zero vision work.
- **Not safely fixable:** column-major reading order. Those tokens genuinely sit hundreds of characters apart in the text stream, so any matcher loose enough to accept them is also loose enough to accept a row recombined from two different drugs — precisely the failure mode that matters most for doses. **Loosening the matcher cannot solve reading-order scrambling; only seeing the page can.** That is an argument *for* v16, and §11's `quoteMiss` breakdown will show which of the two populations dominates.

**A quote-match failure is not a hallucination.** `kbNormForMatch` is order-sensitive, and real PDFs emit column-major streams, split header/body content streams, and superscript-interrupted token runs. A legitimate claim can fail the test on reading order alone. Reserve 🔴 for genuinely unsupported content; anything else conflates "unverifiable" with "false" and would reverse the deliberate pass-1 policy in §1.

## 5. Evidence propagation (dual-track)

Do not compute `min()` over all cited facts — a soft distractor would downgrade a question whose answer is fully verified. Store two fields on every generated artifact:

```js
{
  evidenceSummary: { textVerified: 8, visualConfirmed: 0, visualGrounded: 1, textUnverified: 0 },
  criticalEvidence: 'textVerified'   // weakest state among ANSWER-BEARING facts only
}
```

`criticalEvidence` covers only what determines correctness: stem clinical findings, the correct answer, the correct answer's rationale, calculation operands and results, and priority conclusions. UI reads: *"🟢 Core answer text-verified · 🔵 1 distractor uses visual-grounded evidence."*

`evidenceSummary` drives display; `criticalEvidence` drives the §6 gate. Anki's `Evidence::Visual` tag is an **export of** this metadata, never the source of truth.

Headline counts must never merge states: `1,202 text-verified · 180 visual-grounded · 0 ungrounded`, not `1,382 verified`.

## 6. Deterministic safety gate

A 🔵 fact carrying a clinically actionable number is blocked from generating dosage math or critical-value items until it reaches 🟣.

Do **not** ask a model whether a drug has a narrow therapeutic index — that needs external clinical knowledge. The gate maps onto fields the extractor already emits:

```js
const HIGH_RISK = f => f.safetyCritical ||
  ['medication','threshold','contraindication'].includes(f.factType);
```

Two halves, both required:
- **KB side:** `HIGH_RISK(fact) && evidence ∈ {visualGrounded, textUnverified}` → blocked as a source for calculation items.
- **Generator side:** the artifact validator inspects **any numeric operand regardless of `factType`**, then checks the supporting fact's evidence state.

The second half is not redundant. `factType: 'test'` carries clinically actionable numbers constantly — potassium 2.8, INR 6.0, glucose 42 — and blanket-blocking every visual-grounded test fact from all downstream use would be far too broad. The gate belongs where the number is *used as a correctness-determining operand*, which is a property of the question, not of the fact.

This half reuses machinery that already exists: `CASE_CLINICAL_TOKEN_RE` already detects unit-bearing values in generated content for the entailment audit, so the gate is "value matches that regex **and** its supporting fact is 🔵 or ⚪" — no new detection logic.

Allowed at 🔵: *"Atrial fibrillation shows irregular R-R intervals."* Blocked at 🔵: *"Administer 0.125 mg."*

## 7. The router (two signals)

A sparse-text probe alone is insufficient. A page with 500 words of prose **and** a full-width ECG strip passes `kbTextQuality` cleanly while the rhythm stays invisible forever. Trigger vision on any of:

- sparse or empty text layer (existing `kbTextQuality` thresholds)
- **significant raster content** — `page.getOperatorList()`, count `OPS.paintImageXObject`, `paintJpegXObject`, `paintImageMaskXObject`, `paintInlineImageXObject`
- **significant vector content** — path-op density (`OPS.constructPath` and stroke/fill) relative to text density. **This signal is not optional:** ACLS algorithms, triage trees, and sepsis pathways are typically drawn as vector paths with zero raster images, and a raster-only probe calls those pages clean.
- audit trouble on that chunk (high `recovered` or `quoteMiss`)
- **manual override** — an "Analyze this page visually" control, which ships regardless of router quality. No heuristic catches every meaningful diagram.

API surface verified present in the pinned pdf.js 3.11.174 build: `getOperatorList`, `OPS`, `fnArray`, `argsArray`, and all four paint operators above.

**Route on a visual-complexity score, not a binary op count.** `if (constructPathCount > 25) useVision()` will fire on decorative borders, table rules, background shapes, and publisher ornamentation. Frame it as a weighted score instead:

```
visualScore = rasterArea + pathDensity + largeConnectedRegion
            + sparseText + auditTrouble − repetitiveDecoration
```

The exact formula does not matter initially; the framing does, because it keeps the eventual code tunable rather than brittle.

One cheap implementation of `repetitiveDecoration`: page furniture repeats *across* pages, so subtract a per-document baseline (e.g. the median path-op count over all pages) before scoring. Running heads, borders, and logos cancel themselves out without any per-page decoration detection.

Thresholds for "significant" are unknown and must be calibrated against real chapters — see §11's staged calibration set.

## 8. Page rendering

Client-side canvas only. Do **not** upload documents: the app already loads pdf.js and caches the document, per-page rendering sends only flagged pages instead of an entire textbook, it avoids the Files API and its 48-hour retention question, and it matches the client-side-extraction position the codebase already documents for PPTX.

```
page.getViewport({scale}) → canvas → page.render() → canvas.toBlob()
  → measure blob.size → adjust → base64 only at the end
```

- **`toBlob()`, not `toDataURL()`.** `toDataURL` materializes a large base64 string immediately and forces size *estimation* (`length * 0.75`); `toBlob` gives real encoded bytes and keeps memory sane for 500–1000-page textbooks. Convert to base64 once, after the encoding is settled.
- **Resolution has a floor, not just a ceiling.** Scale 1.5 is roughly 108 DPI — marginal for 7–8 pt pharmacology table print, which is the content the whole feature exists to recover. Benchmark 1.25× / 1.5× / 2.0× / 2.5× against real tables. A page that fits the budget but can't be read is worse than not sending it.
- **Exhaust quality before downscaling.** Resolution determines legibility; JPEG quality mostly determines size.
- **PNG for line art, JPEG for photographic/scanned pages.** JPEG artifacts are worst-case on thin lines — i.e. on ECG strips and vector diagrams specifically.
- **Enforce the budget in a loop**, re-measuring after each adjustment. The governing constraint is Google's **inline-image request limit** — ~20 MB for the whole request including instructions, text, and image bytes. Read that narrowly: it is the limit for the inline-image pattern v16 uses, *not* a universal Gemini payload cap (inline PDFs, which v16 deliberately does not send, are documented at a higher ceiling). Any per-page byte cap is an application choice, not an API limit.

## 9. Schema and migration

New per-fact field: `evidence` ∈ the five §4 states, plus `visualAnchor: {filename, page}` for 🔵/🟣.

- Facts imported from a pre-v16 KB have no `evidence` field. Treat absent as **legacy/neutral** — do not retroactively claim 🟢. Optionally re-derive on import by re-running `kbQuoteInSource` when source text is available.
- 🟣 **is an attestation, not provenance.** If a KB is exported and shared, one student's confirmations travel to a user who verified nothing. Export must either downgrade 🟣 → 🔵 or stamp confirmations with their origin. This matters because the suite is distributed publicly.
- 🟣 needs friction to stay meaningful: require that the source page render actually opened, and scope confirmation to Tier 1 / artifact-cited facts rather than offering bulk-confirm. A student rubber-stamping 400 facts produces a badge that means nothing.
- **"View Source Page" is mandatory, not optional.** It is what moves verification from machine to student. Shipping 🔵 without it produces a colored assertion, not a provenance system.
- Scanned-source KBs need a **file-level** banner, not only per-fact badges: *"428 facts · 0 text-verified · 428 visual-grounded."* Every fact from a scanned source is necessarily 🔵 — that is categorically weaker and should be visible at a glance.

## 10. Build order

**v16a — most of the value, a fraction of the surface area.** Ship and use before building anything in v16b.

1. ⚪ `textUnverified` badge — displays a state already tracked as `quoteMiss`. Nearly free.
2. Manual "Analyze this page visually" control (§7's override).
3. 🔵 `visualGrounded` + `visualAnchor` + **View Source Page**.
4. Co-supplied image + text request (§3 invariant 3).
5. Safety gate blocking 🔵 actionable numbers from calculation items (§6, KB half).

**v16b — only what v16a's real usage proves necessary.**

6. Automatic two-signal router with calibrated thresholds.
7. 🟣 `visualConfirmed`, with the §9 friction and export handling.
8. Full dual-track `criticalEvidence` / `evidenceSummary` across all three generators.

The v16a/v16b boundary is an experiment: if you press the manual button on every third page, the router earns itself. If you press it twice a chapter, it doesn't.

## 11. Decision gate — the 20-page benchmark

Run one dense pharmacology or cardiac chapter through v15.4 and read the Extraction diagnostics panel. Inspect 20 representative pages: **5 prose, 5 drug/lab tables, 5 diagram/ECG-heavy, 5 mixed-layout with callout boxes.**

| Measurement | Source | Tells you |
|---|---|---|
| First-pass fact count | log / `stats[].facts` | baseline |
| Audit recovery, prose chunks | `stats[].recovered` | is first-pass extraction complete on easy pages |
| Audit recovery, table chunks | `stats[].recovered` | is layout flattening still causing omissions |
| `quoteMiss` rate by chunk type | `stats[].quoteMiss` | provenance difficulty; **prevalence of reading-order scrambling** |
| Discarded audit facts | `stats[].discarded` | strict-rule rejections |
| Pages flagged sparse | v15.4 warning | missing text layer |
| Image-heavy pages *not* flagged | manual | blind spot of the current probe → sizes invariant 6 |
| **Facts visible on the page but absent from the KB** | manual | **the actual multimodal opportunity** |

The last row is the decision. Everything else is diagnosis.

**Twenty pages is a go/no-go pilot, not a calibration set.** Router thresholds cannot be derived from five examples per category. Stage it:

```
20-page benchmark → is multimodal worth building?
       ↓ yes
v16a (manual visual analysis) → collect real usage + false positives
       ↓
50–100 pages across 2–3 source types → calibrate
       ↓
v16b (automatic router)
```

**Decision rule:**
- Manual review finds essentially no clinically meaningful facts missing → **build nothing.** Consider the v15.5 normalization pass instead.
- Missing content is rare and concentrated → **build v16a only.**
- Missing content is frequent across tables, figures, and mixed pages, *and* you find yourself using manual visual analysis often → **build v16a, then collect data for v16b.**

Rough reading: audit recovery near zero on prose and >15% on table chunks indicates layout is still the bottleneck. A high `quoteMiss` concentrated in table chunks tells you what fraction of vision-recovered facts would land 🔵 rather than 🟢 — the single number that determines whether invariant 3 delivers.

## 12. Claims rejected during design

Recorded so they don't get re-imported later:

- *"A text-only parser cuts you off from 25–40% of highest-yield clinical content."* — No source, no method. §11 measures it or it stays out.
- *"Gemini 3.7's GDP.pdf benchmark (34.0% vs 22.0%) shows how much the pipeline improved."* — That eval measures the **native PDF path**, which this app does not use. It is an argument *for* v16, not evidence about v15.4. (3.7 Flash remains the right default on other grounds.)
- *"Most table facts will still come out 🟢."* — Proven as a mechanism, not a prevalence. §11 decides.
- *"~200 KB per rendered page."* — Depends on dimensions, scale, and content. Enforce a measured budget (§8) instead of assuming.
- *"Scale 1.5× is optimal."* — A starting point, and probably too low for 8 pt tables. Benchmark it.
- *"Quote-match failure means the fact is ungrounded."* — Would invert the deliberate pass-1 policy and reintroduce omissions. See §4.
- *"Artifact evidence = min(all cited facts)."* — Over-taints; use dual-track (§5).

## 13. Provenance

Derived from a multi-model design review (Claude, ChatGPT, Gemini) across several sessions, with every disputed claim adjudicated against the v15.4 source rather than against consensus. The corrections that most shaped this spec: the pass-1/pass-2 quote asymmetry and the ⚪ state; the router's blind spot for text-rich pages containing figures; dual-track evidence instead of `min()`; and per-page client-side rendering instead of document upload.
