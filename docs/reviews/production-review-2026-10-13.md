# Production review — v17.14 (2026-10-13)

**Follow-up:** C1, all eleven High findings (H1–H11), and M3, M7, M8, M10, M11, M14, M15 and M17 are fixed in v17.15 (steps 1–5 of the plan). M4, M5, M6, M9, M21, M22 and L31 (step 6), M23–M28 and M33 (step 7), M29–M32 and L45 (step 8), M1, M12, M18, L17, L27 and L40 (step 9), and the remaining Low findings except L30 and L38 (step 10) are fixed in v18.0; see the [v18.0 record](v18.0-release.md). Two are partial: H5 keeps and reports the text rather than splitting chapters, and H7/H8 are disclosed as warnings, with no new units or error tier; see the [release verification record](v17.15-release.md). Every other finding is open.

Reviewed `Nursing-Study-Suite v17.14.html` (13,344 lines) at commit `6388ef6`, clean tree, together with `verify-repo.js`, `latte-tests.js`, `tools/` and the two live measurement tools (read only).

**How it was done**
- Eight parallel reviewers each read one slice of the file in full:
  - A: transport and security
  - B: Knowledge Base pipeline and persistence
  - C: Priority and the Anki helpers
  - D: AnkiGenerator and the NCLEX extractor
  - E: NCLEX to Anki
  - F: NCLEX Generator
  - G: cases, the item audit, settings and App
  - H: tests and tooling
- Each finding was tried against callers, `DECISIONS.md` and the earlier reviews before it was reported.
- The lead reviewer then re-ran the reproduction, or read the code, for every Critical and High finding and most Medium ones.
- An independent Gemini review (12 items) was checked against the same code. Its items are merged below; the disposition table is in the appendix.

**Evidence labels**
- **Reproduced:** a Node script extracted the shipped function from the HTML, ran it on synthetic input, and showed the wrong output. Scripts are in the session scratchpad, not in the repo; they can be turned into harness assertions.
- **Read-verified:** the code path was traced by reading.
- **Plausible:** depends on model or browser behaviour that could not be exercised.

**Limits**
- No live Gemini calls and no private course material.
- No native Anki import and no non-Chrome browser.
- marked 11.1.1 was not run offline, so its rendering was inferred from CommonMark.
- Performance figures are Node/V8 on this Windows desktop.
- How often each model-dependent trigger occurs in real output is **not measured**.

**Baseline:** `node verify-repo.js` passes (3,595 assertions, all eleven frozen prompt hashes, Babel transform). This review changed no code, prompt, baseline, pin or test; it adds only this file.

**Severity scale**

| Severity | Meaning |
|---|---|
| Critical | A wrong answer key or silent data loss that the checks report as clean, in a path the app runs by default |
| High | Wrong study content shown as correct, a crash or hang in normal use, or silent loss of work |
| Medium | Wrong in plausible edge cases, a false failure that blocks the audit, or a measurable performance cost at realistic sizes |
| Low | Rare edge cases, diagnostics or maintainability |

| Severity | Count |
|---|---:|
| Critical | 1 |
| High | 11 |
| Medium | 33 |
| Low | 45 |

None of the fixes below needs a frozen-prompt edit.

**Deliberate decisions and deferred items.** Choices recorded in `DECISIONS.md` are not reported as defects. Items already deferred by the owner are not re-proposed: R08 PDF budgets, the PDF.js ESM migration, inline styles, and assertion-total bookkeeping.

---

## Critical

### C1. A stray "part 4" before the real PART 4 heading silently mis-keys every shuffled item in the batch

- **Severity:** Critical
- **Category:** Bug / Regression (v17.12 shuffle; the repair path has had the same defect since v15.8)
- **Location:**
  - `ngSplitParts`, 9858–9869. The PART 4 regex at 9864 is unanchored and case-insensitive.
  - `ngSpliceSection`, 10233–10237.
  - `ngShuffleWorksheetOptions` return, 10412.
  - Repair candidate splice, 10813.
- **Problem:**
  - `raw.match(/PART\s*4\b[^\n]*\n([\s\S]*?)(?=DISTRIBUTION:|$)/i)` starts PART 4 at the first "part 4" anywhere in the response, so PART 4's text also contains PART 3.
  - The shuffle splices PART 3 first. It then searches for the old PART 4 text, which no longer exists, and `ngSpliceSection` returns the document unchanged.
  - Result: the choices are shuffled, but the ANSWER and "Why X" lines are not.
- **Realistic triggers** (all reproduced):
  - PART 2 restating the batch rule the app itself sends at 10525: "PART 3 and PART 4 must each contain exactly N numbered entries".
  - The frozen prompt's own phrase "Part 4 'Why' lines" (9314).
  - A source called "…Part 4.pdf" in a PART 1 anchor.
  - "apply to the affected part 4 times daily".
- **Impact:**
  - Every shuffled MCQ and SATA item in the batch carries a wrong key, and `validateNCLEXWorksheet` reports **0 errors**. The worksheet exports unstamped, and so do the NCLEX→Anki cards built from it.
  - The optional Argon audit may catch an MCQ on answer accuracy. SATA items are never audited.
  - The repair path accepts a repaired stem and options while keeping the old ANSWER and Why lines, and marks the item REPAIRED.
- **Evidence:** Reproduced and re-run by the lead (`F/overlap.js`, `F/overlap2.js`). Example: keyed choices "Assess the airway / Elevate the head of bed / Give insulin" became "Document the finding / Apply restraints / Recheck in 1 hour".
- **Recommendation:**
  1. Splice PART 3 and PART 4 by index from one original text, and refuse when the two sections overlap. Use this in the shuffle, the repair and `ngLetterNumberedOptions`.
  2. Root cause: match `PART n` and `DISTRIBUTION:` headings only at line starts.
  3. Add a regression test with "PART 3 and PART 4" inside PART 2.
- **Improved code** (reviewer F's patched copy passes all 103 worksheet assertions; `ngSpliceParts` must be added to the harness helper lists):
  ```js
  function ngSpliceParts(doc,P,np3,np4){
    const s=String(doc),i3=s.indexOf(P.p3),i4=s.indexOf(P.p4);
    if(!P.p3||!P.p4||i3<0||i4<0||(i3<i4+P.p4.length&&i4<i3+P.p3.length))return null;
    const [a,b]=i3<i4?[[i3,P.p3,np3],[i4,P.p4,np4]]:[[i4,P.p4,np4],[i3,P.p3,np3]];
    return s.slice(0,a[0])+a[2]+s.slice(a[0]+a[1].length,b[0])+b[2]+s.slice(b[0]+b[1].length);}
  // shuffle: const spliced=ngSpliceParts(text,P,p3,p4); if(spliced===null)return {...none,kept:[...kept,...shuffled].sort((x,y)=>x-y)}; return {text:spliced,shuffled,kept};
  // repair:  const candidate=ngSpliceParts(workRaw,parts,newP3,newP4); if(candidate===null)throw new Error('could not locate the item unambiguously — worksheet left untouched');
  ```
- **Expected benefit:** correctness. Wrong keys become impossible: an ambiguous layout keeps the original order.

---

## High

### H1. NCLEX to Anki turns a real worksheet .md/.txt/Copy into a single card

- **Severity:** High
- **Category:** Bug (v17.9 port, with the Generator's export format)
- **Location:**
  - Converter: `n2aSplitBlocks`, 7930–7950 (the indentation lock at 7939–7941).
  - Generator side: `ngSplitParts` trims PART 3 (9860); `ngRenumber` keeps each block's own indent (10449); `ngRenderQuestionBlock` writes repaired items as `'  '+num` (10201). The prompt template indents questions `  1.` (9502).
- **Problem:** the converter accepts a question header only when its indentation matches the first question's.
  - In a real export, each batch's first question is flush-left (trimmed) and the rest keep the template's two spaces.
  - Every later header therefore fails, and the rest of the worksheet folds into question 1.
- **Evidence:** Reproduced end to end by the lead (`lead/e1-end-to-end.js`). Two batches of five questions in the template's shape went through the Generator's real assembly functions and then `n2aConvertText`. Result:
  - 10 questions in, **1 card** out;
  - its front holds all ten questions, with Q1's answer on the back;
  - it is not tagged NeedsReview;
  - the only signal is a warning: "answer key entries with no question: 2…10".

  PDF input is unaffected, which is why the v17.11 real-PDF check passed.
- **Impact:** the converter's "most exact" input (.md) is unusable for normal Generator output and produces wrong, unflagged cards.
- **Recommendation:**
  - Accept a numbered header that follows a blank line; questions are joined by blank lines.
  - Compare the parsed count with the export's own "**N questions**" line and flag every card on a mismatch.
  - Optionally normalise indentation in `ngRenumber`, so new exports are uniform.
- **Improved code** (reviewer E's prototype; all 69 nclex-to-anki assertions pass; its own repro gives 5/5):
  ```js
  head=(l,prevBlank)=>{const m=l.match(N2A_NUM_HEAD);return m&&(m[1]===indent||prevBlank)?parseInt(m[2],10):null;};
  const blocks=[];let cur=null,last=null,prevBlank=true;
  for(const line of lines){const n=head(line,prevBlank);prevBlank=!line.trim(); /* …existing body… */}
  ```
  GUIDs and card HTML are unchanged for files that already parse.
- **Expected benefit:** correctness; restores the .md, .txt and Copy inputs.

### H2. Ordering answers are rewritten into a wrong order that then passes validation

- **Severity:** High
- **Category:** Bug / Regression (v17.8)
- **Location:** `ngCanonicalOrderingAnswers`, 10293–10339: `lineStep` 10312–10316, `fromLines` 10322, `evidence` 10323, `seq=evidence` 10330.
- **Problem:** step lines are matched to steps after their leading number is discarded, and then their line order is taken as the sequence. Lines that list ranks beside the presented steps are therefore read as the order itself. Examples: "2. Alpha / 3. Beta / 1. Gamma", "Step 2: Alpha", and unnumbered "Alpha step: second…".
- **Evidence:** Reproduced and re-run by the lead (`F/ordering.js`). The correct order was Gamma → Alpha → Beta. The ANSWER became "Alpha step → Beta step → Gamma step"; the item had 2 errors before the rewrite and **0** after.
- **Impact:** a failing ordering item becomes a passing item with the wrong sequence printed as its key. Ordering items are N/A to the audit, so nothing flags it.
- **Improved code** (reviewer F verified: every shipped v17.8 shape is still rewritten with 0 errors, and the bad shapes are declined). Replace line 10323:
  ```js
  const nums=body.filter(j=>lineStep(keyLines[j])).map(j=>(keyLines[j].match(/^[ \t]*(?:why[ \t]+)?(?:step[ \t]*)?(\d{1,2})[ \t]*[:.)]/i)||[])[1]).filter(Boolean).map(Number).slice(0,n);
  const ranked=nums.length===n&&nums.some((x,i)=>x!==i+1),identity=a=>!!a&&a.every((l,i)=>l===steps[i].label);
  const evidence=fromText||(fromLines&&!ranked&&!identity(fromLines)?fromLines:null);
  ```
- **Expected benefit:** correctness. Uncertain entries keep their validation errors instead of being "fixed" wrongly.

### H3. The worksheet shuffle moves "All of the above" and "None of the above" choices

- **Severity:** High (it needs the model to break the prompt's prohibition at 9509)
- **Category:** Bug
- **Location:** `ngShuffleWorksheetOptions` → `refersByLetter`, 10356–10368. Compare `caseShuffleQuestion`, 12195.
- **Problem:** "above/below" counts as a reference only when followed by option, choice or answer, so an option *text* such as "All of the above" is shuffled like any other choice.
- **Evidence:** Reproduced and re-run by the lead (`H/aota.js`). "All of the above" moved to C, with "Muscle weakness" now at D; ANSWER C; 0 validator errors. "None of the above", "All of these" and "Both of the above" behave the same. The case shuffler keeps these items in place.
- **Recommendation:** keep the original order when any prose or option matches `\b(?:all|none|both|neither)\s+of\s+(?:these|them|those|the\s+above)\b`, or a bare `above/below` that is **not** followed by a number. The number exception also stops threshold wording ("below 60") from blocking the case shuffle (see M8). Add a test.
- **Expected benefit:** correctness.

### H4. The NCLEX extractor merges question k+1 into a run of k numbered choices

- **Severity:** High
- **Category:** Bug
- **Location:** `nclexDropOptionRuns`, 7247–7262, which feeds `nclexSplitByQNum` and `nclexPairQA`.
- **Problem:** a numbered choice run keeps growing while numbers go up by one.
  - In Davis-style books (bare "N." questions, choices numbered 1–4), question 5 after a 4-choice question 4 is absorbed into Q4's choices. With 5-choice questions, Q6 is absorbed.
  - Every pair still "matches", so the AI fallback never runs and the summary says Complete.
  - The choice repair can then append the whole of Q5 as a "restored verbatim" fifth choice of Q4.
- **Evidence:** Reproduced and re-run by the lead (`D/d1-option-run-absorbs-question.js`): question numbers found 1, 2, 3, 4, 6, 7, 8. The harness Davis fixture has only 3 questions.
- **Improved code** (reviewer D verified against all six choice-run assertions and the split fixtures):
  ```js
  function nclexStartsRun(p,k){let n=0;while(k+n<p.length&&n<NCLEX_OPTION_RUN_MIN&&p[k+n].num===n+1&&(n===0||p[k+n].index-p[k+n-1].index<=NCLEX_OPTION_GAP))n++;return n>=NCLEX_OPTION_RUN_MIN;}
  // in nclexDropOptionRuns, immediately before runs.push:
  if(j-i>=NCLEX_OPTION_RUN_MIN&&positions[j].num===positions[i-1].num+1&&nclexStartsRun(positions,j+1))j--;
  ```
  Add a Davis fixture with at least 6 questions.
- **Expected benefit:** correctness; no lost questions.

### H5. Split mode silently drops a second chapter, and a wrapped line truncates a question

- **Severity:** High
- **Category:** Bug / data loss
- **Location:** `nclexSliceByQNum`, 7265–7269; `runSplit` joins all ranges (7583/7586). README line 250 recommends "+ Range for multiple spans".
- **Problem:** each slice ends at the next number marker, and a slice whose number was already used is discarded.
- **Evidence:** Reproduced and re-run by the lead.
  - **Two ranges whose numbering restarts** (20 + 25 questions): 25 pairs, all "matched". Chapter 2's Q1–Q20 are gone, and the summary says Complete.
  - **A wrapped line starting "7."**: Q20 becomes "…rates incisional pain at". Its real stem and choices exist nowhere.
- **Recommendation:**
  - Never discard text: append a repeated-number slice to the previous item (reviewer D's mitigation).
  - Count repeated numbers into `track.notes` so the run cannot report Complete.
  - Owner decision: split each side at numbering restarts and pair segment k with segment k.
- **Expected benefit:** no silent loss of whole chapters.

### H6. The Study view files unclassified treatments under "Dependent / Collaborative Orders" and unstaged findings under LATE/EMERGENCY

- **Severity:** High
- **Category:** Bug (wrong study content)
- **Location:** `renderKBMarkdown`, 2517–2525. It feeds the Study view, the Study View .md and the PDF.
- **Problem:**
  - `dep=treatment.filter(f=>f.subtype!=='independent')`. The frozen prompt's subtype enum (1966) is `early|late|independent|dependent|acute|discharge|null`, so `acute`, `discharge` and null treatment facts are all printed as dependent orders.
  - Look facts that are neither early nor late are appended after the LATE bullets, separated only by a blank line. Under CommonMark that is the same (loose) list, so they render as LATE/EMERGENCY signs, or as EARLY when there are no late facts.
- **Evidence:** Reproduced and re-run by the lead (`B/b9-treatments-default.js`, `B/b9b-look-grouping.js`). Example: "Reposition the client at least every 2 hours" (subtype null) is printed under Dependent / Collaborative Orders.
- **Impact:** independent vs dependent, and early vs late, are tested NCLEX distinctions. The main study surface and its printed PDF teach the wrong classification. The Facts view is correct.
- **Improved code** (changes output only for unclassified facts):
  ```js
  const dep=treatment.filter(f=>f.subtype==='dependent'),unk=treatment.filter(f=>!['independent','dependent'].includes(f.subtype));
  // Look: ${other.length?((early.length||late.length)?'**OTHER FINDINGS (not staged)**\n':'')+other.map(bullet).join('\n'):(!early.length&&!late.length?'_No findings extracted._':'')}
  // Treatments, after the Dependent block: ${unk.length?'\n\n**Other Treatments (not classified)**\n'+unk.map(bullet).join('\n'):''}
  ```
- **Expected benefit:** correctness of the primary study view.

### H7. The case validator never checks numbers in the keyed answer option

- **Severity:** High
- **Category:** Bug (validator false negative)
- **Location:** `validateCaseStudy`, 11938–12012. Options only get the terminology lint (11968–11969). The claim "Every clinical value, answer and rationale is checked against real fact IDs" is at 12951.
- **Evidence:** Reproduced and re-run by the lead (`G/t2-key-option.js`).
  - Keyed option "Potassium chloride 40 mEq/L infused over 4 hours", whose rationale cites facts with no such values: **0 errors, 0 warnings**, and the case is linked into the Fact Inspector.
  - The same values in the rationale: 2 errors.
- **Recommendation:** audit **keyed** options numerically against their own rationale's cited facts and validated case data. Distractors stay exempt, as the B3 plan decided.
  - An error tier is a new gate (owner approval). Shipping it as a warning first is reasonable.
  - Reviewer G's one-line insertion after 11969 passes the harness (3,595/0) and turns the repro into 2 errors.
- **Expected benefit:** a fabricated dose in the correct answer can no longer pass as verified.

### H8. Case numeric grounding can't see temperatures, pH, INR, unitless labs, cell counts, ng/mL, pg/mL, ug or gtt

- **Severity:** High
- **Category:** Bug (validator false negative)
- **Location:** `CASE_CLINICAL_TOKEN_RE` 11349, `CASE_SUPPORTED_UNIT` 11456, `caseAuditDatumValues` 11604–11612, `scanUncitedProse` 11354.
- **Problem:** only the fixed unit vocabulary is tokenized. The datum guard fires only when the whole value is exactly a number plus an unknown unit.
- **Evidence:** Reproduced and re-run by the lead (`G/t3-units.js`).
  - These give NO FINDING in narrative and in a keyed rationale citing an unrelated fact: "Temperature 39.4°C", "102.9 °F", "pH 7.21", "INR 4.8", "WBC 18,000/mm3", "platelets 40,000/µL", "troponin 2.3 ng/mL", "BNP 1,250 pg/mL", "fentanyl 50 ug", "21 gtt/min", "glucose 45", "HR 132".
  - "SpO2 86%", "K+ 2.9 mEq/L" and "BP 82/50" are caught.
- **Impact:** the v15.2 fabrication pattern (a value pinned to a "monitor X" fact) passes for core vitals and labs, while the UI says every value is checked.
- **Recommendation:**
  - (a) Now, with no new gate: warn on any non-neutral datum or prose value that contains a digit but yields no token and no unsupported entry. Reviewer G tested this: harness 3,595/0.
  - (b) Add °C/°F, ng, pg, ug and count units, with no conversion.
  - (c) Add dimensionless analytes (pH, INR, specific gravity) named by label.
  - (b) and (c) need paired regression tests.
- **Expected benefit:** honest disclosure, then real coverage.

### H9. Image to Anki: a continuation block is merged into the wrong question

- **Severity:** High (the image path has never had a live run)
- **Category:** Bug
- **Location:** `i2aAssemble`, 8805–8817.
- **Problem:** a "continuation" at the top of an image is always merged into the last question read anywhere, not into the item the previous image ended with. When an answer-page explanation runs onto the next answer page, it is attached to the last question from the question pages.
- **Evidence:** Reproduced and re-run by the lead (`E/t08b…`, `E/t07…`). The chest-pain card got the calcium rationale ("neuromuscular irritability from low calcium…"), with no warning and no NeedsReview tag.
- **Recommendation:** track the previous image's last item. A continuation merges into that item: into the key entry if it was an answer, into the question only if that question ended the previous image. Optionally flag merges into questions not marked `cut_off`.
- **Expected benefit:** correctness for review-book answer pages.

### H10. The quote-location guard accepts a dropped leading "0." (10× and 1000× dose errors)

- **Severity:** High
- **Category:** Bug (grounding evidence)
- **Location:** `kbNormForMatch` (2709) runs before `kbQuoteNumericBoundedMatch` (2726–2734) and `kbQuoteInSource` (2735–2740). Pass-2 admission is at 3530.
- **Problem:** normalisation turns "." into a space before the adjacent-digit check, so "0.5" becomes "0 5" and its "5" is a whole token.
- **Evidence:** Reproduced and re-run by the lead (`B/b2-decimal-boundary.js`). All three of these are ACCEPTED:
  - quote "5 mg PO daily" against source "Digoxin 0.5 mg PO daily";
  - "125 mg PO daily" against "0.125 mg";
  - "maximum daily dose is 2" against "2.5 g".

  Controls behave correctly: "60" inside "600" is rejected, and a decimal in the middle of a quote is protected.
- **Impact:** a pass-2 fact carrying the classic decimal dose error is admitted as source-located, and pass 1 counts it as matched. This falls within the v16.7 rule's intent ("a partial numeric token cannot prove a source location").
- **Recommendation** (owner approval: it narrows pass-2 admission, as v16.7 did): for the boundary test only, treat `digit[.,]digit` as a joiner that counts as a digit. Precompute it once per chunk and add the three cases as assertions.
- **Expected benefit:** clinical safety of grounding evidence.

### H11. A build can save a Knowledge Base that the next reload refuses to restore

- **Severity:** High (catastrophic for a non-developer when it happens; frequency unmeasured; not yet reported)
- **Category:** Bug (data availability)
- **Location:**
  - `mergeLatteParts` 2208–2238: no bucket or type check; `cid=kbSlug(c.name)` at 2220.
  - `kbValidateExtractionEnvelope` 2743–2760.
  - Restore checks in `kbNormalizeImported` (2260, 2277, 2290).
  - Hydration, 13217–13219.
- **Problem:** the build path does not enforce the invariants the restore path enforces:
  - `latteBucket` must be in the enum;
  - `subtype` and `factType` must be strings;
  - the condition id must be non-empty. `kbSlug('Σήψη')===''`.
- **Evidence:** Reproduced and re-run by the lead (`B/b1b-save-then-hydrate.js`, through the real save queue and restore). A KB with one fact whose bucket is "Treatment" saves with status `saved`. On reload it goes to RECOVERY MODE: every tool sees an empty KB and saving is paused. Re-importing the app's own export fails the same way.
- **Recommendation:**
  - Validate enum and type at build time, either by quarantining the chunk (consistent with the v16.7 envelope rule) or by dropping the fact with a counted diagnostic. Never auto-map "Treatment" to "Treatments".
  - Run `kbNormalizeImported(structuredClone(kb),{restore:true})` before `K.setKnowledgeBase(kb)`, so the problem shows at build time.
  - Slug fallback: `const base=kbSlug(c.name)||'condition'`.
  - Structured output (`responseSchema` with the bucket enum) would prevent this at the source; it is an owner decision.
- **Expected benefit:** a paid build can never become unloadable.

---

## Medium

Each entry gives location, problem, evidence and fix. Severities reflect impact when triggered.

**M1. Boot compiles the 992 KB app with Babel preset-env and inline source maps**
- **Category:** Performance
- **Location:** line 758: `<script type="text/babel">` has no `data-presets`.
- **Problem:** without `data-presets`, @babel/standalone 7.23.9 compiles with `["react","env"]`, plus three plugins and `sourceMaps:"inline"` (babel.js 124432–124453).
- **Evidence:** lead measurement on the transform alone.

  | Configuration | Time | Output |
  |---|---|---|
  | Default (what the browser runs) | 4.2–5.1 s | 4.72 MB, 143 regenerator refs |
  | `react` only | 0.78–0.80 s | 3.79 MB |

  The gate already checks only `react`, so users run ES5-transpiled code that is not what is tested.
- **Fix:**
  - `<script type="text/babel" data-presets="react">`.
  - Update `verify-repo.js` `extractBabelScript` (line 49) to the new marker, and assert the attribute.
  - Do it together with M29 (V8 compile and boot smoke), then run the browser smoke check: native `let`/`const` brings TDZ semantics back.
  - Reviewer A's static scan found no top-level TDZ hazards.
- **Benefit:** about 3.5–4 s off every page load; runtime semantics match the tests.

**M2. PPTX text: every formatting run becomes its own trimmed line**
- **Category:** Bug
- **Location:** `_pptxRunText` 955–970; joins at 1061 (`\n`) and 1072 (`' '`).
- **Problem:** subscripts, superscripts, bold, hyperlinks and spell-check marks split runs, so "SpO₂", "K⁺", "10³/mm³" and "hypo|kalemia" reach the model in pieces, and quote checks fail.
- **Evidence:** Reproduced (reviewer A, with the real quote functions).
- **Fix:** build one line per `<a:p>`: concatenate its `a:t` texts untrimmed (`a:br` becomes `\n`), trim the paragraph, and join paragraphs with `\n`. Keep the existing guards and budgets, and add a regression with baseline runs.

**M3. Card transcription and the KB audit pass ignore the v17.4 halting rule**
- **Category:** Bug / API
- **Location:** `transcribeCards` 3301–3326; KB audit catch 3544–3552.
- **Problem:** a 429, a deferred retry, or a 400/403 (bad key) keeps sending one request per remaining card × runs. Previously good cards are republished as blocked.
- **Evidence:** Read-verified by the lead.
- **Fix:** on `geminiHaltsBatch(e)`, publish the current card's failure and stop. The audit pass needs an owner choice, because a stopped build commits nothing.

**M4. Case validator: false errors on elapsed time in prose**
- **Category:** Bug
- **Location:** `scanUncitedProse` 11354; prompt builder text 11244–11246.
- **Problem:** "2 hours later", "30 minutes later", "At 1400 hours" and the stage title "6 hours after surgery" are errors, while the prompt tells the model clock times are fine. A good case fails validation, its audit is skipped, and it is not linked.
- **Evidence:** Reproduced and re-run by the lead.
- **Fix:**
  - Update the unfrozen `caseBuildPrompt` to list time, length and weight units.
  - Exempt 24-hour clock times written with hours/hrs: `String(text||'').replace(/\b((?:[01]\d|2[0-3])[0-5]\d)\s*(?:hours|hrs?)\b/gi,'$1')`.

**M5. Case validator: "8/10" pain scores are errors even when the cited fact says 8/10; "q4h" cannot support "every 4 hours"**
- **Category:** Bug
- **Location:** `caseNumericTokens` fraction guard 11479–11483; error at 11582.
- **Evidence:** Reproduced and re-run by the lead.
- **Fix:** let a fraction be supported by the identical verbatim fraction in a cited fact, and add a qNh → "every N hr" alias pre-pass. Needs regression tests.

**M6. Case calculator: thousands separators break derivation**
- **Category:** Bug
- **Location:** `caseCalculationEvidence` 11622; the answer test at 11959.
- **Problem:** "25,000 units divided by 250 mL = 100 units/mL" produces no derivation, so it is a false error; a bare "7,000" answer "disagrees".
- **Evidence:** Reproduced by the lead.
- **Fix** (reviewer G verified; a wrong "7,500" still errors):
  - `num='[+-]?(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?|[+-]?\\.\\d+'`
  - answer test `/^[+−-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+)$/`

**M7. "Export invalid response" corrupts the raw JSON it exists to preserve**
- **Category:** Bug
- **Location:** 12891 calls `exportAsTxt`, which runs `markdownToPlainText` (1506–1510).
- **Evidence:** Reproduced by the lead: the exported JSON no longer parses.
- **Fix:** `downloadBlob(new Blob(['VALIDATION FAILED\n'+invalidCaseRaw],{type:'text/plain'}),'LATTE-Case-Study-invalid.txt')`.

**M8. The case shuffle is blocked by ordinary prose, so answer-position bias survives**
- **Category:** Bug (Gemini #1, reviewer G3)
- **Location:** `caseShuffleQuestion` 12193–12200.
- **Problem:** any standalone capital letter that matches a choice label, or any bare "above"/"below", keeps the original order and adds a warning. Triggers include "A client…", "38.5 °C", "vitamin D", "hepatitis B", "below 60/min" and "vitamin K.".
  - Gemini's claim that the next line is unreachable is **wrong**: it fires for letters outside the label set ("(see Table E)").
  - The v17.12 worksheet detector already handles the article A, hepatitis B and vitamin D; the case path never got that refinement.
- **Evidence:** Reproduced by the lead.
- **Fix:** one shared detector, the worksheet's, used by both shufflers, with these additions:
  - a letter right after "°" is not a reference;
  - organism names such as "C. difficile" are not references;
  - a bare above/below followed by a number is not a reference;
  - the "all/none of the above" rule from H3.

  **Do not adopt Gemini's `itemRefersByLetter`.** The lead ran it against the shipped detector: it stops catching "B is wrong because…", "D delays oxygenation." and "C. This delays care." Those items would be shuffled while the prose still names the old letter. It also still blocks "Hepatitis B and C". Also sort mapped SATA keys.

**M9. "Why B is incorrect" fails the whole batch**
- **Category:** Bug (Gemini #3)
- **Location:** `ngParseKeyItem` 9988; `ngLetterNumberedOptions` (two regexes); `ngShuffleWorksheetOptions` WHY 10351.
- **Problem:** "Why B is incorrect:" lines are folded into A's rationale, giving 3 validation errors. The batch's audit is skipped and the worksheet is stamped FAILED VALIDATION.
  - The frozen prompt asks for "is wrong" (9582), so this needs the model to deviate. The NCLEX to Anki converter, ported from the owner's own scripts, already accepts "incorrect".
- **Evidence:** Reproduced by the lead.
- **Fix:**
  - Accept `incorrect` as a synonym of `wrong` and normalise `kind` to 'wrong'.
  - Update the v17.12 assertion that keeps "Why B is incorrect" items unshuffled. That is a deliberate behaviour change.

**M10. Shuffle letter-reference check misses many phrasings**
- **Category:** Bug (reviewer F3)
- **Location:** `refersByLetter` 10355–10368.
- **Problem:** about 30 tested phrasings are missed, including "(see C)", "compared with C", "instead of C", "same as C", "letter C", "Options B through D", lowercase "choice c" and "less urgent than A".
  - The item is shuffled and the prose then names the wrong choice. The Why lines themselves stay correctly bound.
- **Evidence:** Reproduced and re-run by the lead (`F/refs.js`).
- **Fix:**
  - Check `prev` against `LISTED` before applying the article rule.
  - Extend `LISTED` with prepositions, conjunctions and option nouns.
  - Make the plural keywords case-insensitive.
  - Reviewer F's prototype closes 29 of 30; the residue is "A takes priority".

**M11. The shuffle runs on misnumbered batches**
- **Category:** Bug (reviewer F4)
- **Location:** 10353, 10370–10374.
- **Problem:** with the v17.11 Generator numbering slip, each key entry is permuted by the wrong question. The slip can then no longer be realigned by `n2aRealignKey`.
- **Evidence:** Reproduced by reviewer F.
- **Fix:** shuffle only when the PART 3 numbers and the PART 4 ANSWER numbers are both exactly 1..n.

**M12. ReDoS in `ngSplitParts` (FINAL VERIFY cut)**
- **Category:** Performance
- **Location:** 9865.
- **Problem:** three overlapping quantifiers.
- **Evidence:** lead measured 133 ms at 1,000 leading spaces; reviewer F measured 8.5 s at 4,000 and 76 s at 8,000. Ordinary text is 0 ms. It runs at least 6 times per batch.
- **Fix** (reviewer F: 0 differences over 300k strings; 100k spaces takes 0.3 ms): `/\n[^\S\n]*(?:[^\w\s][^\S\n]*)*FINAL[^\S\n]*(?:[—–-][^\S\n]*)?VERIFY\b|\n[^\S\n]*Q\d{1,3}[^\S\n]*:[^\S\n]*topic[^\S\n]*=/`

**M13. "Raw output kept" / "see Raw view" point to a view that does not exist**
- **Category:** Bug
- **Location:** 10697–10701, 10879; the only views are worksheet and working (11028–11029).
- **Problem:** a paid batch whose numbering the parser misses is unreachable and unexportable.
- **Evidence:** Read-verified.
- **Fix:** export `b.raw` in the Audit Trail, or add the Raw view.

**M14. NCLEX extractor (split mode) sends unmatched questions with no answer**
- **Category:** Bug (answer provenance)
- **Location:** fallback threshold 7593; `nclexPairsToText` 7401.
- **Problem:** at 30–99% matched, unmatched questions go to the frozen split prompt, which still asks for `correct_answer`. A model-written answer is then shown as CORRECT and in the Answer Key, with no flag.
- **Evidence:** read-verified; the model's behaviour is plausible.
- **Fix:** carry an `answer_unmatched` flag through `nclexAdmitRecord`, warn on the card and in exports, and add the count to `track.notes`.

**M15. NCLEX extractor dedupe keeps the first, possibly answerless, copy**
- **Category:** Bug
- **Location:** `nclexAccumulate` 7193.
- **Problem:** chunk overlap can extract a question twice; the first copy may lack its answer. Exports then print "Answer: undefined / Rationale: undefined".
- **Evidence:** Reproduced by the lead.
- **Fix:** fill missing fields from the later copy, and print "(not extracted)" instead of `undefined`.

**M16. AI pairing fallback: one failing window discards all earlier paid windows**
- **Category:** Bug
- **Location:** 7595–7634. Requests are also sent when the question text is empty.
- **Evidence:** Read-verified.
- **Fix:** catch per window, merge the windows that succeeded, and skip the fallback when there is no question text.

**M17. "Generate Cards" wipes the deck before the new run succeeds**
- **Category:** Bug (data loss)
- **Location:** `AnkiGenerator.run` 6848–6849 (NCLEX extractor: 7667).
- **Problem:** manual Text/Extra/tag/link edits, Keep choices, review decisions and source-check reports are lost if the new run fails or is cancelled. A KB change makes the old deck non-exportable, and regenerating is the only remedy offered.
- **Evidence:** Read-verified by the lead.
- **Fix:** keep the previous deck until the new batch completes and restore it on failure, or ask for confirmation when edits exist.

**M18. Per-keystroke whole-deck recomputation in Anki, and sanitizing on every render in NCLEX to Anki**
- **Category:** Performance
- **Location:** AnkiGenerator memos 6642–6689; `lintAnkiCard` called about 7,000 times per edit at 1,000 notes; NCLEX to Anki preview 9234–9238.
- **Evidence:** measured in Node.

  | Notes | Median per keystroke |
  |---|---|
  | 1,000 | 26–72 ms |
  | 2,000 | 43–94 ms |

  NCLEX to Anki runs up to 80 `DOMPurify.sanitize` calls per render.
- **Fix:**
  - `useDeferredValue(cards)` for the advisory analyses, keeping one array per render pass;
  - a WeakMap lint cache (reviewer C: about 39 ms per edit, harness green);
  - memoize sanitized previews on `[shown]`.

**M19. One unlinked note breaks "Prepare source check" for the whole deck**
- **Category:** Bug
- **Location:** `ankiAuditGroups` 5661–5662, 5679.
- **Problem:** the V4 packet carries the whole chunk as support for the unlinked note, so it exceeds 24,000 characters at about 30–35 facts per chunk and preparation throws. The message says to split source facts, which the Anki tool cannot do.
- **Evidence:** Reproduced by the lead.
- **Fix:**
  - Name the unlinked notes and point to "Edit source links".
  - Structural (owner approval): compact `sourceTokens` on the wire.

**M20. Anki numeric check: "q4h" against a source saying "q6h" is reported clean**
- **Category:** Bug
- **Location:** `ankiNumericText` 5362–5375; leftover scan 5405.
- **Problem:**
  - A number attached to a letter is never tokenized or reported.
  - Plural units ("5 days") are never compared.
- **Evidence:** Reproduced by the lead ("No numeric mismatch detected").
- **Fix** (reviewer C verified, harness green): map `q4h` and `q15min` to "every N hr/min", and singularize day/week/month/year.

**M21. Priority synthesis loses streamed text on a failed retry, or shows an empty results view**
- **Category:** Bug
- **Location:** `runAnalysis` 4369–4398, together with `geminiRequest`'s `onUpdate('')` at retry (1206).
- **Problem:** this breaks the v17.4 R09 decision ("streamed text survives any failure").
- **Evidence:** Reproduced by the lead (current vs proposed).
- **Fix:** keep `lastText`, and use `texts[k]=err.partialText||lastText`. Show the error view when no text was ever streamed.

**M22. Priority multi-part merge drops lines**
- **Category:** Bug (reviewers C4 and H8, Gemini #10)
- **Location:** `paMergeTopics` 4187–4205.
- **Problem:**
  - Indented sub-bullets are de-duplicated across items, e.g. a repeated "→ Testable angle: <category>".
  - Bullets before any heading in a later part are misplaced.
  - Text before a part's first tier heading is dropped.
- **Evidence:** Reproduced by reviewers.
- **Fix:** de-duplicate whole item blocks (the top-level bullet plus its indented lines). Reviewer C verified this with the harness green.

**M23. NCLEX to Anki PDF: page-edge "chrome" stripping deletes content lines that start with "88/50", "8/10" or "1/2"**
- **Category:** Bug
- **Location:** `N2A_PDF_CHROME` 8466.
- **Evidence:** Reproduced by the lead. The card front loses its vital signs and the question sentence, with no warning.
- **Fix:** treat a page counter as chrome only when it stands alone or is followed by a date: `^(?:page\s+)?\d+\s*(?:\/|of)\s*\d+\s*(?:$|\d{1,2}\/\d{1,2}\/\d{2,4})`.

**M24. Decimal answers are read as choice labels**
- **Category:** Bug
- **Location:** `n2aAnswerLabels` 8018; `X2A_LABEL_ONE` 8288; `i2aAnswerLabels` 8839.
- **Problem:** "1.5 mL" reads as choice 1. In a calculation item with a numbered lab list, the labs get a fake ✓.
- **Evidence:** Reproduced by reviewer E.
- **Fix:** use the lookahead `(?=$|[ \t:—–(\-]|\.(?!\d))`, and skip label matching for Calculation items.

**M25. `n2aStripSources` deletes everything after "sources:" in prose**
- **Category:** Bug
- **Location:** 8014.
- **Problem:** "good sources: bananas…" becomes "good".
- **Evidence:** Reproduced by reviewer E.
- **Fix:** `\bSources?\s*:\s*C\d+\b.*$`.

**M26. PDF choice split cuts a choice at "vitamin D." or "hepatitis B."**
- **Category:** Bug
- **Location:** `n2aPdfChoiceLines` 8518; the inline variant in `n2aSplitStemOptions`.
- **Problem:** the card shows a truncated key, and its GUID differs from the .md import, so re-importing creates a duplicate note.
- **Evidence:** Reproduced by reviewer E.
- **Fix:** prefer a next-label mark that follows sentence punctuation.

**M27. A bare digit-list ordering answer is rendered with no flag even when its meaning is ambiguous**
- **Category:** Bug (plausible)
- **Location:** `n2aConvertText` 8170–8186.
- **Fix:** flag Ordering cards whose answer is a bare digit list.

**M28. PDF fallback with a count mismatch folds every later question after the first printed-number gap**
- **Category:** Bug
- **Location:** `n2aPdfToWorksheetText` 8591–8597.
- **Problem:** the cards are all NeedsReview, so this is lost work rather than silently wrong content.
- **Evidence:** Reproduced by reviewer E: 6 cards out of 11.
- **Fix:** write questions sequentially and renumber keys through a printed→sequential map.

**M29. The required gate cannot detect an app that fails to boot**
- **Category:** Testing (reviewer H1)
- **Location:** `verify-repo.js` 48–56, 93–94.
- **Problem:** Babel *parses* the block but V8 never compiles it, so a bad regex body passes; the top level is never evaluated, so TDZ errors pass; and the gate's config differs from the browser's.
- **Evidence:** Reproduced by reviewer H: copies with `/[z-a]/` or a top-level TDZ read passed every gate.
- **Fix:** after the transform, add `new vm.Script(code)` (about 12 ms) and a stubbed top-level evaluation. Reviewer H's code is in its report.

**M30. The v17.13 KB truncation split/requeue has only source-string pins in the gate**
- **Category:** Testing
- **Location:** HTML 3468–3486; pins in `tools/transport-regression-tests.js` 114–116.
- **Fix:** add the behavioural test below (it passes 2/2 on v17.14).

**M31. `.gitignore` misses current export names that carry course or publisher content**
- **Category:** Security / privacy
- **Location:** `.gitignore`.
- **Problem:** these names are not ignored: `nclex_questions*.md/.txt`, `*_anki*.txt`, `nclex_images_anki_transcripts*.json`, `latte_anki_import*.txt`, `anki-source-*.json`, `LATTE-Knowledge-Base-recovery-*.txt`, `LATTE-Case-Study*.txt`. A `git add -A` would push them to the public repository.
- **Evidence:** Reproduced with `git check-ignore`.
- **Fix:** add the patterns, plus a harness assertion that every literal download name in the HTML is ignored.

**M32. NCLEX to Anki GUIDs are not pinned to golden values**
- **Category:** Testing
- **Location:** `tools/nclex-to-anki-tests.js`.
- **Problem:** a parser tweak can silently change GUIDs, so re-imports create duplicate notes and split review history.
- **Fix:** pin today's GUIDs, confirm them once against the Python scripts, and add one non-ASCII stem.

**M33. Plain-text exports delete `*` multiplication signs**
- **Category:** Bug (reviewers A4, F7, E)
- **Location:** `markdownToPlainText` 1509.
- **Problem:**
  - "2 mg/kg * 70 kg * 2 doses" becomes "2 mg/kg  70 kg  2 doses" in the worksheet, Priority and case .txt exports, and NCLEX to Anki then puts that on cards.
  - The code-fence rule is dead because the inline-code rule runs first.
- **Evidence:** Reproduced by reviewers.
- **Fix:** strip emphasis only with non-space delimiters, e.g. `/(^|[^\w*])\*(?=\S)([^*\n]*?\S)\*(?![\w*])/gm` → `'$1$2'`, and remove fence lines before inline code.

---

## Low

| ID | Area | Location | Finding (evidence) | Fix |
|---|---|---|---|---|
| L1 | PPTX | `_zipNormalizePath` 971–978 | Absolute OPC targets drop speaker notes and slides, and renumber slides (reproduced; PowerPoint writes relative targets) | Reset base for leading `/` |
| L2 | Transport | `callGemini` 1311 | `thinkingLevel||'low'` bypasses the Argon no-level refusal (latent; every caller passes a level) | Set only when given |
| L3 | Transport | `accept` 1215–1222 | Mid-stream `{"error":…}` is ignored; a mid-stream 429 loses its status (plausible) | Throw with status |
| L4 | Settings | 13032, 13049–13053; no NCLEX to Anki profile row | Badge shows Flash·low for NCLEX to Anki, which always uses Flash low/high; "six tools" copy | Label or row |
| L5 | Settings | 13088–13089, 833 | Model ID saved raw, validated only on reload (silent revert); unencoded in URL; same host, user's own value, not a security issue (Gemini #7) | Trim; `MODEL_ID_RE` before send |
| L6 | Cards | `cardTranscribe` 3051–3057 | `numerics`/`title` not shape-checked; null crashes the KB tool (reproduced) | Validate like sections |
| L7 | Quotes | `kbDehyphNormForMatch` 2817–2827 | Soft hyphen at line end not joined (reproduced) | Strip `­` plus newline first |
| L8 | KB merge | `mergeLatteParts` 2212–2224 | Alias merging depends on chunk order (reproduced) | Record matched name as alias |
| L9 | KB split | `kbSplitChunk` 2660 | Nested splits mislabel halves (reproduced) | Base label on chunk label |
| L10 | Cards | 3126, 3350 | Blocker says numbers changed when a comparison merely failed | Separate counts |
| L11 | KB stat | 3780 | "Chunks" double-counts recovered parts | Count distinct chunks |
| L12 | KB lanes | 3560–3564; 3541–3542 | Sibling lane runs on after a halt; dead truncated-audit branch | Shared AbortController |
| L13 | KB validate | 2508 | Critical-fact regex misses "5mg" (reproduced) | Drop leading `\b` on units |
| L14 | Anki audit | `ankiParseSourceAuditV4` 6047–6054 | Allowed `contextRefs` are treated as hidden refs, so groups stay partial and retries spend quota (reproduced) | Apply rules to hidden refs only |
| L15 | Priority | `paParseTiers` 4137–4142 | Bold or other-emoji tier heading puts Tier 2 inside Tier 1 (plausible) | Allow `**` and emoji |
| L16 | Inputs | 4438, 7763, 7791, 7407, 3704 | Number fields clamp on every keystroke | Clamp on blur |
| L17 | NCLEX ext. | 7271–7272 | Quadratic `(?:^|\n)\s*` (100k whitespace takes 9.3 s; realistic input is fine) | `[^\S\n]*` |
| L18 | NCLEX ext. | 7624 | Window merge can replace a matched row with an unmatched one (reproduced) | Never downgrade |
| L19 | NCLEX ext. | 7377, 7385 | False "numbering collision" count (reproduced) | Strip leading number |
| L20 | NCLEX ext. | `nclexSplitStemOptions` 7336–7352 | Inline "101.3 F." breaks choice detection (reproduced) | Look ahead for next letter |
| L21 | NCLEX ext. | 7652–7653 | Choice repair trusts the model's question number | Check stem prefix |
| L22 | Lifecycle | NCLEXExtractor, NCLEXToAnki | No abort on unmount (matters after a ToolBoundary reset); file × enabled mid-run (Gemini #8) | Cleanup effect; disable × |
| L23 | NCLEX ext. | 7572–7573 | Non-array JSON counted as success | Treat as failed |
| L24 | Print | `nclexToMd` 7712; `caseToMarkdown` 12102 | Lettered choices run together in PDF (plausible; marked not run) | Hard breaks |
| L25 | N2A | `n2aEsc` | Bare `\r` can reach an Anki field (plausible) | Normalise `\r\n?` |
| L26 | N2A | 7913, 7955 | U+FEFF is trimmed in JS, not Python, so GUID parity breaks | Exclude FEFF from strip class |
| L27 | N2A | `n2aReadPdfPages` 9024–9029 | Second `getTextContent` per page; no abort signal (Gemini #8) | Pass `tc` through `pdfWalkPages` |
| L28 | N2A | `i2aNaturalCompare` | macOS 12-hour screenshot names misorder | Parse AM/PM |
| L29 | N2A | `i2aAssemble` 8829 | Duplicate key numbers warn only | Add NeedsReview |
| L30 | N2A | 8766, PDF page-break choices | "(A" cosmetic; page-break choice paragraph (flagged, safe) | — |
| L31 | Worksheet | `ngAnswerLabels` 10004 | Oxford-comma key "A, C, and E" gives 4 false errors and fails the batch (reproduced) | Extend separator grammar |
| L32 | Worksheet | 9867 | `DISTRIBUTION:` read from the first occurrence; a pharmacology "Distribution:" anchor downgrades the error (reproduced) | Last line-start match |
| L33 | Worksheet | 10614, 10637 | Short last batch is allocated a full batch of target facts (reproduced) | Scale `want` by size |
| L34 | Lifecycle | 10581–10583, 12552, 12787 | "Cancelled." never logged; run looks complete (both generators) | Log with raw `log` when owned |
| L35 | Worksheet | `ngCanonicalOrderingAnswers` 10293–10339; `ngOrderingAnswers` 10009–10017 | Arrow inside a step text: a valid digit answer becomes invalid after the v17.8 rewrite (Gemini #4; its blank-lines half is refuted) | Skip rewrite or prefix-match |
| L36 | Worksheet | `refersByLetter` | False positives keep the order: °C, sentence-initial "C. difficile", "hepatitis B and C", "A ≥3 cm" (Gemini #2; safe direction) | Covered by M8 detector |
| L37 | Cases | 12549, 12784, 12917 | Early returns leave audit state "running" (never displayed); skipped audit shows a ✓ glyph while the panel and exports say incomplete (Gemini #5) | Glyph from `auditUnresolved` |
| L38 | Cases | `caseShapeIssues` 11819–11833 | Numeric scalar (`correctAnswers:[140]`) discards the whole case (reproduced) | Coerce finite numbers (owner call) |
| L39 | Cases | 12651–12721 | Repairs still run after the audit stops for quota (reproduced) | Skip when interrupted |
| L40 | Cases | 11464, 11533–11541 | Quadratic numeric parsing on long fields (64k chars takes 1.8 s) | Sticky regex |
| L41 | Cases | 12644 | Audit error detail exported without key redaction (the Anki path redacts) | Redact |
| L42 | Cases | `selectCaseFacts` 11085–11088 | Calculation top-up adds nothing (reproduced) | Filter before slice |
| L43 | Cases | 11546–11547 | "no less than 90%" parsed as `<90` (reproduced; warn-only) | Handle negation |
| L44 | Security | Line 9 CSP; `buildPrintDoc` 1572 | No `style-src`/`font-src` (defence in depth only); print links styled as plain text (Gemini #12) | Add directives; underline on screen |
| L45 | Tooling | `latte-tests.js` IIFE; helpers | A throwing module exits 0 under `--unhandled-rejections=warn` (reproduced); permissive `t`/`throws`; key placement untested; `--out` path unconstrained | `.catch(…exit(1))`; `cond===true`; header assertion |

**Dead code that can be removed now:**
- `n2aConvertSources` and `x2aConvertSources` (8193, 8428): unused by the app since v17.11; tests still call them.
- The post-await `cut` / `last.truncated` branches in `nclexCallGemini` and `runImages`: unreachable since v17.13 (Gemini #9; its claimed consequences are wrong).
- The truncated-audit branch at 3541–3542.
- `ngParseFactIds` (9852).
- `ITEM_AUDIT_STATUS` (12340).
- `ankiChunkText`'s page path (5094–5100).
- The duplicated comment block at 4123–4133.
- The dead fence regex in `markdownToPlainText`.
- `NCLEX_CATEGORY_LABELS`: read only by a test.

---

## Missing tests (highest value first)

1. **Worksheet shuffle invariants beyond clean fixtures:**
   - "PART 3 and PART 4" inside PART 2 (C1);
   - "All of the above" (H3);
   - the M10 phrasings;
   - misnumbered keys (M11).
2. **Generator export → NCLEX to Anki round trip:** batches in the prompt's own `  1.` shape through `ngSplitParts`, `ngRenumber` and the .md export into `n2aConvertText`. Assert `cards.length === questions` (H1). The lead's `e1-end-to-end.js` is ready to adapt.
3. **Ordering canonicalisation negatives:** ranked and presented-order lines must stay invalid (H2).
4. **NCLEX extractor:** a Davis section of 6 or more questions with choices numbered 1–4 (H4), and two ranges with restarted numbering (H5).
5. **`renderKBMarkdown` grouping** (H6); **keyed-option numbers** (H7); **°C, pH and INR datum disclosure** (H8); **decimal quote boundary** (H10); **build → save → restore round trip** with an off-enum bucket (H11).
6. **Boot smoke** (M29), **KB truncation split** (M30), **golden GUIDs** (M32), **Priority merge line conservation** (M22).

Example: the H1 round trip, in the harness style.

```js
const W=new Function('neiaTerminologyScan','itemHeuristics',span('function ngSplitParts(','function ngRenumber(')+';return {ngSplitParts,ngSplitNumbered};')(()=>[],()=>[]);
const R=new Function(span('function ngRenumber(','function ngStem(')+';return {ngRenumber,ngMdLiteralNumbers};')();
// Two model batches in NCLEX_GEN_PROMPT's own PART 3/4 shape ("  1. stem", choices at 5 spaces) → ws assembly → .md → converter.
let n=1;const qs=[],ks=[];
for(const raw of [batchOf(5),batchOf(5)]){const P=W.ngSplitParts(raw);const bk=W.ngSplitNumbered(P.p4);
  for(const q of W.ngSplitNumbered(P.p3)){const k=bk.find(x=>x.num===q.num);qs.push(R.ngRenumber(q.text,n));ks.push(R.ngRenumber(k.text,n));n++;}}
const md='## Questions\n\n'+qs.map(R.ngMdLiteralNumbers).join('\n\n')+'\n\n## Answer Key\n\n'+ks.map(R.ngMdLiteralNumbers).join('\n\n');
t('a Generator worksheet in the prompt\'s own layout converts to one card per question',M.n2aConvertText(md,'w').cards.length===10);
```

Example: the KB truncation split under the v17.13 contract (reviewer H; passes 2/2 on v17.14; for `anki-integrity-source-regression.js`).

```js
const cut=Object.assign(Error('Output hit the 65,536-token ceiling before the JSON was complete.'),{isFatal:true,truncated:true,finishReason:'MAX_TOKENS',partialText:'{"conditions":[{"name":"Signal","facts":['});
state=await build({pages:[p1,p2],responses:[cut,primary([fact({text:p1,sourceQuote:p1})]),primary([fact({text:p2,sourceQuote:p2})])]});
t('a chunk whose JSON hits the ceiling is split by page and both halves are kept',state.requests===3&&state.published[0].conditions[0].facts.map(f=>f.text).sort().join('|')===[p1,p2].sort().join('|'));
```

---

## Backwards compatibility and migration

| Change | Effect on users | Migration |
|---|---|---|
| M1 `data-presets="react"` | Code runs natively: ES2020+, TDZ restored | Land M29's boot smoke first; browser check at 4 widths |
| C1, H3, M8, M10, M11 shuffle changes | More items kept in written order, each with a log note; never a wrong key | Update the v17.12 assertions that pin current behaviour |
| M9 "incorrect" accepted | Those batches validate and get audited | Change the v17.12 `keep('Why B is incorrect')` assertion deliberately |
| H6 Study view headings | Study View .md/PDF text changes for unclassified facts | None; no stored data changes |
| H7, H8 case validator | New warnings; an error tier needs owner approval | Ship as warnings first |
| H10 decimal boundary | Narrows pass-2 admission; a few facts move from admitted to discarded (counted) | Owner approval per `DECISIONS.md` |
| H11 build-time validation | A chunk or fact with an invalid bucket is quarantined instead of saved | None for existing valid KBs |
| M2 PPTX paragraphs | Rebuilt KBs from decks get better quotes; facts may differ | Rebuild affected decks if wanted |
| H1, M23–M26 converter fixes | GUIDs unchanged for items that already parsed. Items that were mis-split (M26) get the .md GUID, so one re-import creates the corrected note | Delete the stale note once |
| M31 `.gitignore` | None | — |

---

## Appendix: Gemini's 12-item review

| Gemini # | Gemini's severity | Verdict | Here |
|---|---|---|---|
| 1 | Critical | Confirmed. The "unreachable line" claim is wrong. Its fix is unsafe (misses "B is wrong because…") | M8 |
| 2 | High | Partly confirmed; safe direction | L36 |
| 3 | High | Confirmed | M9 |
| 4 | High | Arrow half confirmed; blank-lines half refuted | L35 |
| 5 | High | Confirmed in code; mostly invisible | L37 |
| 6 | High | Confirmed and worse: real exports collapse to one card. Its fix (drop the lock) is risky for .txt | H1 |
| 7 | Medium (security) | Confirmed; usability, not security | L5 |
| 8 | Medium | Confirmed | L22, L27 |
| 9 | Low | Dead code confirmed; claimed consequences wrong | Dead-code list |
| 10 | Medium | Confirmed, minor. The progress bar is static during synthesis while the phase text and part list still update (cosmetic, not listed separately). The audit-count overcount is folded into the merge finding | M22 |
| 11 | Medium | One real (NCLEX to Anki previews), one negligible (Anki snapshot) | M18 |
| 12 | Low | Confirmed; defence in depth | L44 |

## Final report

### Critical issues

C1: the worksheet section splice can silently mis-key every shuffled item in a batch.

### High priority

1. **H1.** NCLEX to Anki collapses real .md worksheets into one card.
2. **H2.** Ordering rewrite produces a wrong order that passes.
3. **H3.** "All/None of the above" are shuffled.
4. **H4.** Davis-style choice runs swallow the next question.
5. **H5.** Split mode drops a restarted chapter and truncates wrapped questions.
6. **H6.** The Study view mislabels unclassified treatments and findings.
7. **H7.** Keyed case options are never numerically checked.
8. **H8.** Case grounding is blind to temperatures and many labs.
9. **H9.** Image continuations merge into the wrong question.
10. **H10.** Quote location accepts a dropped "0.".
11. **H11.** A build can save a KB that won't restore.

### Performance improvements

| Change | Effect |
|---|---|
| M1 Babel `data-presets="react"` | About 3.5–4 s off every boot |
| M18 Anki deferred or cached analyses | Typing at 1–2k notes drops from 26–94 ms toward under 40 ms |
| M18 memoized NCLEX to Anki previews | Up to 80 sanitize calls removed per keystroke |
| M12, L17, L40 linear regexes | No multi-second freezes on degenerate model output |
| L27 single `getTextContent` per page | Half the PDF text work in NCLEX to Anki |
| L12 abort the sibling lane after a halt | No wasted quota |

### Security improvements

- M31: close the `.gitignore` gaps (copyrighted exports and the public repo).
- L41: redact the key from audit error details.
- L44: CSP `style-src`/`font-src`.
- L5: validate model IDs before the URL is built.
- L45: test key placement and redaction.

Nothing script-executing was found:
- every model, PDF and import string reaches the DOM through DOMPurify or as React text;
- Anki exports escape every field;
- the key travels only in the `x-goog-api-key` header;
- SRI is present on every script;
- the print document is script-free.

### Technical debt / dead code

- Remove the dead-code list above.
- Consolidate the three letter-reference detectors (case, worksheet, and the converter's mark scans) into one shared detector with one shared test corpus.
- This review removed nothing; it changed no code.

### Dependencies that can be removed

None of the six runtime libraries; all are used. Google Fonts is optional, but removing it would mean self-hosting or system fonts.

### Deprecated APIs

These are all acceptable today:
- `document.write` in the DOMPurify fallback and halt banner;
- `document.execCommand('copy')` as the `file://` fallback;
- in-browser Babel, which is architecture-bound.

PDF.js 3.11.174 is mitigated by `isEvalSupported:false`; its migration is already planned and deferred.

### Modern API upgrades

- Optional `responseSchema` for JSON calls (KB extraction, NCLEX extraction, image transcription). It would enforce bucket enums and arrays at the source (H11, L23); owner decision, with measurement.
- `useDeferredValue` for the Anki advisory analyses.
- `AbortSignal.any` to link lane cancellation.
- Handle mid-stream error frames (L3).
- Keep shared prompt prefixes first so Gemini's implicit caching can apply to repeated batches; unmeasured.
- Confirm `gemini-3.8-flash` and `gemini-4-argon` with one authorized live call.

### Architecture

The provenance, validation and run-ownership model is still the strongest part of the code: snapshots, honest partial states, quarantine, and halting.

The weakness this review found is structural. Free-form model text is re-parsed by many independent regex pipelines:
- the PART 1–4 splitter;
- three letter-reference detectors;
- the worksheet ↔ converter round trip;
- PDF geometry rebuilds.

Each pipeline is tested on clean, self-made fixtures. The two highest findings (C1, H1) are producer/consumer format mismatches between pipelines in the same file.

Within the single-file contract, the most valuable structural change is to make the Generator's parsed items the source of truth:
- render every export from them in one canonical layout;
- let NCLEX to Anki read that layout, or a JSON block embedded in the export, instead of re-deriving structure.

This is a post-semester change. The fixes above are small and local.

### Scores (engineering judgment, not measurements)

| Dimension | Score | Main deductions |
|---|---:|---|
| Production readiness | **60** | C1 plus 11 High wrong-content or silent-loss defects, concentrated in v17.7–v17.14 code and the validators |
| Maintainability | **55** | 13.3k-line file; duplicated, divergent heuristics; about 28% of code never compiled by the harness; about 10% source-pin tests |
| Security | **85** | Strong boundary; `.gitignore` gaps, one unredacted error path, no `style-src` |
| Performance | **65** | 4–5 s avoidable boot transform; keystroke latency at 1–2k notes; ReDoS on degenerate output |

### Ordered implementation plan

Each step is a small, separately verifiable release with regression assertions and `node verify-repo.js`. Steps 1–3 are wrong-answer and lost-question fixes, the kind the semester freeze allows.

1. **C1:** `ngSpliceParts` plus line-anchored PART headings, in both the shuffle and the repair.
2. **H3, M10, M11, M8:** one shared letter-reference detector, conservative by default. Do not adopt Gemini's version.
3. **H2, then H1 and H9, then H4 and H5:**
   - ordering evidence guard;
   - converter header rule plus count check, and image continuation tail tracking;
   - NCLEX extractor run guard and never-discard slicing.
4. **H6** Study view headings; **H7/H8** case validator disclosures (warn-first); **H10** decimal boundary (owner approval); **H11** build-time KB validation.
5. **Data safety:**
   - M17 keep the deck until the new run succeeds;
   - M7 raw invalid-case export;
   - M3 halting in cards and the KB audit;
   - M15 and M14 NCLEX answer provenance.
6. **False failures that block the audit:** M9 "incorrect", L31 Oxford comma, M4/M5/M6 case notation, M21 Priority retry text, M22 merge.
7. **Converter content fixes:** M23–M28, M33.
8. **Gates and tests:**
   - M29 V8 compile and boot smoke;
   - L45 `.catch` and strict `t`;
   - M31 `.gitignore` plus its assertion;
   - M32 golden GUIDs;
   - M30 truncation behaviour test.
9. **Performance:** M1 Babel presets (after step 8), M18 Anki caching and deferral, M12/L17/L40 regexes, L27.
10. **Remaining Low items:** opportunistically.
11. **After the semester:** structured Generator export as the converter's input; optional `responseSchema` for extraction; M2 PPTX paragraph extraction can come earlier if decks are in active use.
