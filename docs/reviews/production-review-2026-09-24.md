# Production review, second pass (2026-09-24)

A second reviewer examined the released v17.3 file (commit `e1f6b41`, SHA-256 `f96b9c9e…`) and reported eight Medium and four Low findings, R01–R12, with synthetic probes. Before anything was implemented, every finding was checked against the v17.3 source. This record keeps the verified version of each finding so the R-numbers used in `CHANGELOG.md` and `CURRENT_STATE.md` have a home. The reviewer's original scores (production readiness 70, maintainability 63, security 80, performance 70) are engineering judgments, not measurements, and are not reproduced further.

| Finding | Verdict | What the v17.3 source showed |
|---|---|---|
| R01 Calculation answers escape validation | Confirmed, Medium | `validateCaseStudy` checked a Calculation answer only when `caseCalculationEvidence` had verified an explicit equation. With no equation there was no error and no warning. Fixed in v17.4 with a disclosure warning; the bounded verifier is unchanged. |
| R02 Fallback hydration race | Overstated, Low | `kbReadFallbacks()` and `kbCaptureFallbacks()` were called synchronously, back to back, in one task. Browsers apply another tab's storage writes between tasks, not inside one, and the reviewer's interleaving was produced with a stubbed storage. Hardened in v17.4 to a single read. |
| R03 NCLEX pairing loses questions | Confirmed, Medium | A larger AI result replaced the regex set; an equal or smaller one only filled answers. Reached only when regex pairing was weak. Fixed with a union by question number. |
| R04 Batch runners bypass the retry floor | Confirmed, Medium | `geminiRequest` throws `RetryDeferredError` for waits over 60 s and nothing consumed it; the Knowledge Base build, the Priority harvest and both NCLEX extraction loops swallowed it and sent the next chunk after 500 ms; the NCLEX generator rethrew only permanent HTTP failures; Anki generation already stopped on the first failure. Fixed with one halting rule. |
| R05 NCLEX record shape unvalidated | Confirmed, Medium | Admission required only a truthy question; an object-valued question crashed the tool boundary, which remounts the tool and loses its state. Fixed with typed admission. |
| R06 Failed or cancelled runs look complete | Confirmed, Medium | Per-chunk failures were swallowed, the run set `done`, and exports carried no accounting. Fixed with a run summary in the view and every export. |
| R07 Factless Anki generation | Confirmed, Medium | The guard counted conditions, not facts, and the deck was cleared before the packet was built. Fixed with a fact count before any side effect. |
| R08 PDF ingestion has no budget | Confirmed as a gap, Medium | PPTX and KB JSON have byte limits; PDFs have none. Deferred: the limits are product decisions that need measurements first. |
| R09 Priority hides streamed output after failure | Confirmed, Low | Only a cancel kept the results view. Fixed: any failure keeps the text with an incomplete notice. |
| R10 Overlap cannot be zero | Confirmed, Low | `parseInt(value)||1500`. Fixed with `paParseOverlap`. |
| R11 Fixture leaks its server | Confirmed, Low, test-only | The context was created before the try block and a rejected `context.close()` skipped `server.close()`. Fixed. |
| R12 README overstates provenance | Fair, Low | A fact's location is its chunk's page or slide range. Wording corrected. |

Security notes verified at the same time: the two DOMPurify advisories the reviewer cited (GHSA-6688-9rhm-gjv2 and GHSA-p98j-92pf-mc4p) exist, were published on 2026-09-23 with low severity, and are fixed in 3.4.16, which cdnjs and jsDelivr serve with identical bytes. Both require the in-place sanitization mode, which the suite never uses. The v1beta endpoint choice is deliberate: it returns the retry delay in the error body and supports the thinking configuration the tools rely on; a v1 migration remains an untested modernization item.

The reviewer's proposed mandatory browser transport gate was not adopted: the required verifier runs without Playwright by repository rule, so browser acceptance stays optional and is recorded per release instead.
