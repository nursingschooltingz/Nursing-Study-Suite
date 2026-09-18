# v16.7 release verification — 2026-09-18

The user authorized committing and publishing the completed text-only Anki integrity implementation as v16.7. The canonical file is `Nursing-Study-Suite v16.7.html`; the release asset is `Nursing-Study-Suite.v16.7.html`.

This release contains the fixes and bounded policy changes documented in the [item-by-item implementation record](anki-integrity-implementation-2026-09-18.md). That record and both audit sets are preserved as historical checkpoints, including their pre-release filenames, hashes and status. Their standalone characterization scripts are evidence for the audited v16.6 state, not v16.7 repository gates.

## Changes

- Preserve full imported and restored KB data; reject invalid metadata and overflow explicitly, and keep malformed saved copies recoverable.
- Isolate malformed extraction chunks, retain raw failure diagnostics, bind pointers to actual inputs and report quote checks accurately.
- Preserve ambiguous generated fragments for repair; distinguish incomplete, unusable and complete generation.
- Correct numeric sign/unit comparisons and include visible hints as advisory checks.
- Preserve provenance through final exact deduplication, explicit merging after repairs and manual source-link review.

All eleven frozen prompts, model defaults, advisory warning tiers and the three-field Anki export contract remain unchanged. The release preparation changes only the HTML release comment and `suiteVersion()` after the accepted implementation checkpoint; that identity was verified by reversing those two metadata changes in memory and comparing SHA-256.

## Required verification

- `node verify-repo.js`: exit 0; **2,820 passed / 0 failed**, including 256 new integrity assertions. All eleven frozen hashes, generated prompt documentation, LF/version checks and full JSX Babel transformation pass.
- Updated release-version expectations in deterministic evidence/queue tests and the optional source-review browser suite. The browser suite itself was not run.
- All eight SRI-pinned scripts and both independently pinned worker URLs were fetched and rehashed; every SHA-384 matches. No pin or dependency version changed.
- All 38 previously recorded historical audit artifact hashes remain unchanged. Their original line endings and the implementation checkpoint formatting remain intact; Git whitespace warnings in those checkpoint artifacts are preserved rather than rewriting recorded evidence.

| Resource | Bytes | SHA-384 |
|---|---:|---|
| https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js | 10737 | `sha384-tMH8h3BGESGckSAVGZ82T9n90ztNXxvdwvdM6UoR56cYcf+0iGXBliJ29D+wZ/x8` |
| https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js | 131882 | `sha384-bm7MnzvK++ykSwVJ2tynSE5TRdN+xL418osEVF2DE/L/gfWHj91J2Sphe582B1Bh` |
| https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.9/babel.min.js | 2849480 | `sha384-ku9eM40vVDsFUiERorrdlHlF0LIhdfn716M7TntM72Uo98T7LWiogD3hNenPx8Q0` |
| https://cdnjs.cloudflare.com/ajax/libs/marked/11.1.1/marked.min.js | 35141 | `sha384-zbcZAIxlvJtNE3Dp5nxLXdXtXyxwOdnILY1TDPVmKFhl4r4nSUG1r8bcFXGVa4Te` |
| https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.4.15/purify.min.js | 29369 | `sha384-uUMu9JDY09vBzRf9SPcK2VgUj+W/70J6Soc+Dded5P474ElQ63iv9j5N3DE7Kp3N` |
| https://cdn.jsdelivr.net/npm/dompurify@3.4.15/dist/purify.min.js | 29369 | `sha384-uUMu9JDY09vBzRf9SPcK2VgUj+W/70J6Soc+Dded5P474ElQ63iv9j5N3DE7Kp3N` |
| https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js | 320004 | `sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e` |
| https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js | 97630 | `sha384-+mbV2IY1Zk/X1p/nWllGySJSUN8uMs+gUAN10Or95UBH0fpj6GfKgPmgC5EXieXG` |
| https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js | 1087212 | `sha384-SnzOobpRMLXZ52iJvZm/C0fYw0OQemTXzTjIsdsfMcrCtCEe9qgzxTd3RSklO5x2` |
| https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js | 1087212 | `sha384-SnzOobpRMLXZ52iJvZm/C0fYw0OQemTXzTjIsdsfMcrCtCEe9qgzxTd3RSklO5x2` |

Application SHA-256: `14cd9b998c7c3bfba6f216bd35be645a4214c79fcd70d0ee59696c4b2c58766c`.

The [machine-readable release checks](anki-v16.7-release-checks.json) preserve the final verifier output and CDN hash evidence.

## Acceptance limits

No live Gemini call, private source-material inspection, native PDF/PPTX decoding, native IndexedDB, browser event-interleaving acceptance or native Anki import/render was run. Deterministic checks do not establish clinical correctness or real-model quality. Existing v16.6 release assets remain intact.
