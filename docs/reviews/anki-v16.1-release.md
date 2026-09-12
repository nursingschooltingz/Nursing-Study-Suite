# v16.1 Anki release verification

The user authorized the focused Extra prompt change, the v16.1 version bump, and publication as the latest release. This release also packages the Anki source/retrieval and review tools previously committed at `6941e03`.

## Focused change from the main-branch checkpoint

Only Phase 3.5 of `ANKI_MASTER_PROMPT` changes: Extra explicitly defaults to empty; a populated Extra must add a useful explanation or contrast explicitly supplied by the source; generic captions, restatements and inferred explanations are excluded. The six generic cue examples are removed. Source-supported explanations and contrasts remain available. No code strips existing Extras or automatically rewrites notes.

The [exact prompt diff](../history/ANKI-v16.1-extra-default.diff) is recorded separately from the [earlier source/retrieval revision](../history/ANKI-source-retrieval-update.diff). The prior main-branch Anki body hash was `00ad927f9df13bd487c916d35969c7babe69e927203a0610bbe8136166ecc781`; the v16.1 body hash is `80de5dccc4d39ff2bfefc36a9f998e970358f06155ecc2ac01e9e5b53096c65a`. Only this approved baseline hash changes. The other ten frozen constants retain their exact bytes.

The application remains one HTML file, now `Nursing-Study-Suite v16.1.html`, with an updated release comment and visible version label. Flash/Low, all warning tiers, source packet and mapping adapter, API transport, token ceilings, and import/export behavior remain unchanged from `6941e03`.

## Verification

- `node verify-repo.js`: **1,579 assertions passed, zero failed**, including all eleven approved prompt hashes, live documentation for all twelve constants, LF bytes, one canonical HTML with matching version, and full React JSX Babel transformation.
- `tools/anki-extra-default-tests.js`: **16 new assertions** exercise the explicit prompt contract, empty and populated Extra parsing, three-field round trips, literal replacement characters, Tags, HTML escaping, source-footer export, malformed-row rejection, and preservation of editable originals. These checks establish software compatibility and shipped instructions, not model adherence.
- `node tools/anki-source-review-browser-tests.js`: **passed** in isolated Chrome with synthetic notes and mocked Gemini. It covers warning/export isolation, source inspection, edit navigation, explicit audit preparation/run, suggested corrections and evidence export with intact originals, stale results, malformed evidence, cancellation/late replies, KB replacement, empty completed batches and the 360px layout. No live Gemini request was made.
- CDN integrity verification: **all ten resources match** their pinned SHA-384 values: React, ReactDOM, Babel, Marked, both DOMPurify CDN copies, PDF.js, JSZip, and both PDF worker CDN copies. Fresh response bytes were hashed against the final v16.1 resource declarations; no pin or dependency changed.
- The focused prompt diff and new tests received an independent review; no scope or contract issue was found.

## Evidence limits

The six user-supplied exports reviewed before this change came from the earlier main-branch generator: two matched Low/Medium pairs and unpaired pharmacology Low / mental-health Medium runs. They showed both improvements and regressions and continued unsupported Extra content. They motivated this refinement but do not measure the v16.1 prompt.

No new live Gemini generation or audit measurement was performed for this release. Prompt adherence, semantic completeness, source-check accuracy, and native Anki import/review remain unmeasured for the final artifact. The review tools remain advisory; source associations and additional review cards are not completeness certificates. No private course files, knowledge bases, exports, diagnostics, or per-card findings are part of this commit or release.

## Distribution

The release asset is `Nursing-Study-Suite.v16.1.html`, a byte-identical copy of the canonical HTML, accompanied by `SHA256SUMS.txt`. The release workflow checks uploaded asset digests and verifies that the latest release points to v16.1 after publication. Prior releases remain available.
