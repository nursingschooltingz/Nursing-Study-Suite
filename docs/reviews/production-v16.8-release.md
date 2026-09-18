# v16.8 release verification — 2026-09-18

The user authorized committing, publishing and updating releases after the production-review fixes. The canonical application is `Nursing-Study-Suite v16.8.html`; the downloadable asset is `Nursing-Study-Suite.v16.8.html`.

This release contains the thirteen fixes and additional file-picker correction documented in the [implementation record](production-fixes-2026-09-18.md). That record and the [original review](production-review-2026-09-18.md) retain their pre-release filenames, measurements and status as historical evidence.

## Changes

- Reject unsupported case-threshold unit prefixes and preserve NCLEX chunk coverage and all six A–F choices.
- Preserve damaged saved-KB copies during recovery; retain failed card-transcription evidence while blocking stale results from Build.
- Bind Priority analysis to its captured source and export incomplete, truncated or earlier-source notices.
- Keep file selections after input reset; bound PPTX expansion/text and propagate cancellation; preserve retry floors and isolate print-preview opener access.
- Render Anki in 50-note pages, cache repeated diagnostics and avoid copying/indexing unused data during editing.
- Repair browser-test fixtures and document actual API-key/image transmission, source limits and pagination.

All eleven frozen prompts, model defaults, warning tiers and dependency/CDN pins remain unchanged. Release preparation changes only the HTML release comment and `suiteVersion()` after the accepted implementation checkpoint; reversing those metadata edits reproduces the checkpoint exactly. The README download link, changelog, current state, developer file reference, generated prompt documentation and version-specific test expectations now identify v16.8.

## Verification

- `node verify-repo.js`: **2,974 passed / 0 failed**, all eleven frozen prompt hashes, generated prompt documentation, LF/version/file checks and complete JSX Babel transformation pass on the final v16.8 HTML.
- Eight SRI-pinned script resources and both separately pinned PDF-worker URLs were fetched again and their actual SHA-384 hashes matched every pin.
- The accepted implementation passed 34 resource/transport assertions including actual JSZip, 47 reported synthetic browser checks and the documented Anki benchmark. These behavior checks ran before the two release-metadata edits; they were not repeated as live-provider or native Anki acceptance.
- Existing historical release assets are retained. Unrelated untracked September 11 review documents and ignored scratch/private data are excluded from the release commit.

Final application SHA-256: `709d1b8f8f95b90401169210955eee653ceb59bec11f56d57f7f2a800df2a41e`.

The [machine-readable release checks](production-v16.8-release-checks.json) retain the identity check, verifier summary and all ten CDN hash results. The download asset is a byte-for-byte copy of the canonical HTML; its published bytes are checked after upload.

## Compatibility and acceptance limits

No new runtime dependencies, build pipeline, backend or frozen-prompt changes are introduced. Larger PPTX inputs can now fail with an explicit limit message instead of exhausting the tab; split or convert such decks. Long provider waits require a later retry instead of early automatic retries. Export active KB and recovery evidence before downgrading.

Anki pagination changes visible rows, not full-deck selection or export scope. On the measured host, the 1,000-note Extra edit improved from one baseline observation of 801 ms to a three-run post-fix median of 97 ms. These synthetic measurements are not cross-device performance guarantees.

No live Gemini calls, private course-material tests, clinical correctness certification, native Anki import or cross-browser native print acceptance were performed. See the implementation record for detailed remaining limits.
