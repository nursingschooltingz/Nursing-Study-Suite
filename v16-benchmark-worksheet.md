# v16 decision benchmark — worksheet

> **You do not need this right now.** v16 was decided against on 2026-08-28 without running the benchmark — the current sources are text-first specialized material with essentially no tables, diagrams or figures for vision to recover, which answers the decisive row directly. See the status block in `Nursing-Study-Suite-v16-spec.md`.
>
> **This is kept as a contingency.** Run it only if the source material changes — real publisher textbook chapters, or scanned pages. That is the one thing that puts v16 back on the table.

Template for the go/no-go pilot in `Nursing-Study-Suite-v16-spec.md` §11. Copy this file, fill the copy, and **do not commit the filled copy** — it quotes a copyrighted textbook. Name it something `.gitignore` already covers, or keep it outside the repo.

## Run settings

| Setting | Value | Why |
|---|---|---|
| Source | *(chapter, edition)* | One dense pharmacology or cardiac chapter |
| Pages | *(range)* | 20 representative pages, mix below |
| Chunk size | **6,000–8,000** | The 30,000 default spans 10–15 pages and averages prose, tables and diagrams into one meaningless number. Small chunks are what make "by chunk type" mean anything. |
| Overlap | 1 | Default |
| Audit pass | **on** | `recovered` is half the diagnostic value |
| Composition probe | **on** | Supplies the "image-heavy pages not flagged" row automatically |
| Model / level | *(record what the sidebar was set to)* | |

Export the diagnostics JSON when the build finishes — the panel is discarded by the next build.

## Page mix (§11)

| Type | Pages | Notes |
|---|---|---|
| Prose | | |
| Drug / lab tables | | |
| Diagram / ECG-heavy | | |
| Mixed layout with callout boxes | | |

## Measurements

| Measurement | Source | Value | Reading |
|---|---|---|---|
| First-pass fact count | `stats[].facts` | | baseline |
| Audit recovery, prose chunks | `stats[].recovered` | | near zero = first-pass extraction is complete on easy pages |
| Audit recovery, table chunks | `stats[].recovered` | | >15% = layout flattening is still causing omissions |
| `quoteMiss` rate, prose | `stats[].quoteMiss` | | |
| `quoteMiss` rate, tables | `stats[].quoteMiss` | | |
| **quoteMiss by reason** | `byReason` | | **the split that decides the approach** |
| Discarded audit facts | `stats[].discarded` | | strict-rule rejections |
| Pages flagged sparse | `quality.perPage` | | missing text layer |
| Image-heavy pages *not* flagged | `pageComposition.pages[].excessRaster` / `excessPath` | | blind spot of the current probe |
| **Facts visible on the page but absent from the KB** | manual, page by page | | **the decision. Everything else is diagnosis.** |

## Reading the reason split

| Dominant bucket | Means | Points to |
|---|---|---|
| `hyphenation` | Line breaks and ligatures, not lost content | Promote `kbDehyphNormForMatch` into `kbQuoteInSource`. Cheap. Re-measure after. |
| `reordered` | Column-major reading order — tokens are present but scrambled | The argument for v16. No matcher loose enough to accept these is safe for doses. |
| `partial` | Paraphrase, or a claim spanning a chunk seam | Check overlap setting before concluding anything |
| `absent` | Content genuinely not in the chunk | Not a vision signal — the model only ever saw text |
| `tooShort` | Model returned quotes under the 10-char floor | A prompt-adherence question, not an extraction one |

## Decision (§11)

- Essentially nothing clinically meaningful missing → **build nothing.** Consider the de-hyphenation promotion instead. This is a real outcome, not a failure.
- Missing content rare and concentrated → **v16a only**, in the spec's §10 order.
- Missing content frequent across tables, figures and mixed pages, *and* `reordered` is a large share of the misses → **v16a, then collect for v16b** using real usage plus this run's composition data as the start of the 50–100 page calibration set.

**Outcome:**

**Date run:**
