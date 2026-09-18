# Production-review fixes — 2026-09-18

Implemented after the user's instruction to fix the findings in the [production review](production-review-2026-09-18.md). Changes are uncommitted working-tree changes to `Nursing-Study-Suite v16.7.html`, based on revision `95bd91c990d3914644b69334f752b13dc84567a5`. No version bump, commit, push or release was performed.

All thirteen actionable review findings are addressed within their stated scope. This does not establish clinical correctness or eliminate the wider architecture and acceptance limits in the original review.

## Changes and evidence

| Review issue | Implemented behavior | Regression evidence |
| --- | --- | --- |
| 1. Case unit-prefix grounding (High) | Threshold parsing rejects complete unsupported unit expressions instead of accepting a supported prefix. Supported thresholds and pH remain usable; deterioration outside supported thresholds remains warning-only. | Complete-unit edge cases and whole-case validation in `tools/production-correctness-tests.js`. |
| 2. NCLEX chunk coverage | Advance from the actual newline-adjusted end, preserve overlap, guarantee progress and respect the size bound. | Synthetic boundary, coverage and termination assertions against the live function. |
| 3. Corrupt fallback recovery | Preserve exact malformed bytes as recovery evidence alongside readable durable data. Archive every available copy before resuming saves. Inaccessible storage remains paused with explicit restore-access/reload guidance. | Live hydration/save/recovery assertions plus native IndexedDB/localStorage export, archive, reload and access-failure checks. |
| 4. Failed card retranscription | Publish the latest failed attempt as incomplete, retain the previous transcript for inspection and block Build until a successful transcription. | Live handler assertions plus a browser rerun that fails both requested attempts and checks the exported failure/retained evidence. |
| 5. Priority source ownership | Capture the KB snapshot, cancel on replacement, reject stale callbacks and handle the promise-completion/effect timing race. Retained output and downloads identify the earlier source. | Live operation tests and native source replacement during synthesis. |
| 6. Priority usable evidence/completeness | No selected facts means no request. All failed/empty harvests stop before synthesis; usable partial results retain failed/truncated chunk notices. Reset clears previous truncation metadata. | Live tests and native empty-selection, failed-harvest and truncated-export flows. |
| 7. Sixth NCLEX choice | Parse A–F consistently so F remains a distinct answer choice. | Live parsing/repair assertions for six-choice inputs. |
| 8. Invalid browser fixture | Add the required root `sources` array; validate the fixture through the saved-KB normalizer; fail the benchmark promptly when restore does not succeed. | Full verifier and the browser suites now restore the shared fixture successfully. |
| 9. Anki edit cost | Mount 50 notes per page in Table/List/Preview. Cache style results by immutable note identity, count exact duplicates without cloning them and defer receipt indexing when a local check does not use it. | 27 live regression assertions, 19 browser checks and measured rendering/edit costs below. |
| 10. Retry floors | Parse complete RetryInfo durations and numeric/date Retry-After values, preserving the longest applicable floor. A request needing more than 60 seconds surfaces a deferred-retry error instead of retrying early. | Fractional/date/malformed hints, competing floors, abortable normal waits and long-wait request behavior. |
| 11. PPTX resource use | Limit compressed input, entries, actual expanded member/aggregate bytes, slide references and extracted text; propagate cancellation. Reject nested text elements before descendant text amplification, and count text before joining it. | Budget boundaries, cancellation, errors, legitimate ordered/repeated slides and notes; actual JSZip checks; native DOM nested-text rejection. |
| 12. Print opener authority | Clear the popup's opener synchronously while retaining the parent's print handle and blocked-popup iframe fallback. | Live function checks and actual sanitized browser preview followed by a synthetic external destination. |
| 13. Privacy wording | Document selected card-image transmission and API-key authentication, browser KB storage and provider-dependent processing terms. | Documentation compared with the source's request and storage paths. |

Native card acceptance also exposed a separate file-picker defect: clearing a file input emptied its live `FileList` before a deferred React updater consumed it. Both Knowledge and NCLEX now copy the selection during the event. Four live-function assertions cover deferred consumption, unsupported-file filtering and existing-file deduplication; the card flow passes with a native file selection.

The independent patch review identified the PPTX nested-text amplification bypass; it was fixed before final acceptance. A separate correctness review identified Priority's completion/effect race and stale reset metadata; both have regression assertions.

## Verification

`node verify-repo.js` passes **2,974 assertions**, up from 2,820. The 154 new assertions extract live shipped functions and handlers: 67 correctness, 29 Priority, 27 Anki and 31 resource/transport assertions. Existing assertions whose source anchors moved were updated to the actual code. The verifier also passes all eleven frozen hashes, generated prompt documentation, LF/version/file checks and the full JSX Babel transform. No gate was removed or weakened.

`node tools/production-resource-transport-tests.js --jszip` passes **34 assertions**, including three actual JSZip cases beyond the mandatory 31. JSZip and Playwright are supplied by the external test runtime; no application dependency or repository package installation was added.

Synthetic Chrome acceptance produced **47 reported checks**:

| Suite | Checks | Principal coverage |
| --- | ---: | --- |
| Priority | 4 | Empty selection, all-failed harvest, source replacement and retained truncation notice. |
| Anki | 19 | All three page views, caret/edit continuity, Edit in Table navigation, selection, filtering and full-deck/tier exports. |
| Recovery | 3 | Damaged raw export, archive-before-replacement, reload, and denied fallback access. |
| Cards | 1 | Native file selection, failed retranscription, blocked Build and exported latest-attempt evidence. |
| Resource/output additions | 2 | Actual JSZip/DOM extraction and opener isolation across navigation. |
| Existing storage | 12 | Concurrent writers, tombstones, delayed hydration and preservation during conflicts. |
| Existing operation ownership | 2 | Replacement and cancellation ownership. |
| Existing source replacement | 3 | Stale generated output/source handling. |
| Existing output policy | 1 | Sanitized preview and iframe fallback; opener assertion added. |

The browser fixture loads pinned CDN resources, intercepts Gemini, uses synthetic storage and fictional inputs, and rejects unexpected requests. No live Gemini requests or course files were used. Recovery tests exercise native browser storage; extraction tests exercise actual JSZip and DOM parsing. The card test replaces the transcription boundary and does not test image decoding or model quality.

The new browser modules can be run individually with an external Playwright installation and Chrome available:

```text
node tools/production-priority-browser-tests.js
node tools/production-anki-browser-tests.js
node tools/production-recovery-browser-tests.js
node tools/production-resource-browser-tests.js
node tools/remediation-browser-tests.js --output-policy
```

Full run logs and machine-readable observations remain in ignored `scratch/production-review-2026-09-18/`. They contain synthetic data only. The permanent test modules and this record capture the regression contracts and results.

## Performance observations

Measured with the shared synthetic app fixture in headless Chrome on this host. The baseline used one observation per deck size; post-fix results use three observations at 315 and 1,000 notes and one at 3,000. Render timing includes mocked generation and browser scheduling; edit timing measures an Extra-field edit reaching the rendered state. These are not p95 targets or cross-device guarantees.

| Notes | Before render | After render | Before edit | After edit | Before DOM elements | After DOM elements |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 315 | 793 ms | 202 ms median | 194 ms | 79 ms median | 8,463 | 2,637 |
| 1,000 | 1,777 ms | 239 ms median | 801 ms | 97 ms median | 25,584 | 4,690 |
| 3,000 | Not measured | 383 ms | Not measured | 122 ms | Not measured | 10,692 |

All post-fix runs mounted 50 note rows. A single edit added one numeric-audit execution and did not rebuild the original batch diagnostics. Whole-deck summaries and review metadata still scale with deck size; pagination does not make every operation constant-time. The 19 browser checks confirm that paging and display filters do not narrow exports or discard off-page selection.

## Compatibility and remaining limits

- The single-file application, model profiles, token ceilings, warning tiers, eleven frozen prompt constants and `prompt-baseline.json` are unchanged. Existing study export formats are preserved; Priority exports add source/completeness notices and card failure receipts add latest-attempt metadata. Dependency/CDN pins are unchanged. No runtime dependencies or historical files were removed.
- Recovery continues using the existing archive/storage mechanism; malformed copies are now represented explicitly. Export the active KB and recovery evidence before downgrading. Recovery cannot repair damaged JSON or recover bytes the browser refuses to expose.
- PPTX inputs now reject above 64 MiB compressed, 10,000 entries, 4 MiB expanded XML per member, 32 MiB expanded XML in total, 2,000 slides/references or 4,194,304 output UTF-16 code units. Decks above these limits must be split or converted. No partial text is silently returned. JSZip's bounded metadata parsing is synchronous and cannot be interrupted mid-call.
- Unsupported compound-unit thresholds previously accepted by mistake now surface grounding errors. Existing warnings are not promoted to errors. Historical generated artifacts are not retroactively repaired.
- Priority artifacts from an earlier KB remain inspectable with notices; they do not silently become current-source results. Failed/partial harvest notices travel with exports.
- Retry deferral applies to the failed request, not an account-wide cooldown. Other queued jobs can still execute; the UI tells the user to wait before explicitly retrying the failed request.
- Print navigation acceptance used the synthetic HTTP-origin fixture. File-URL behavior across every supported browser, native print output and native Anki import remain unmeasured.
- No live-provider quota behavior, Gemini output quality, private source ingestion or clinical correctness claim follows from these checks. No API/model upgrade was necessary to fix the validated findings; broader API migrations remain separate work.

The original release-blocking defects have focused fixes and regression coverage. A published release still needs its normal version/documentation/CDN-pin verification procedure and any separately authorized live acceptance. These changes have not been published.
