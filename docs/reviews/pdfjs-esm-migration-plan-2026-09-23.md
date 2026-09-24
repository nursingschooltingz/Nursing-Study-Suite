# PDF.js ESM migration plan (2026-09-23)

Status: **plan only, nothing approved or implemented.** Written as step 10 of the 2026-09-23 production-review plan. The shipped pin remains PDF.js 3.11.174 with `isEvalSupported:false`, which is the vendor's stated mitigation for CVE-2024-4367; that pin is not an open vulnerability, it is maintenance debt.

## Why a separate change

PDF.js 4.0 and later ship only ES modules (`pdf.min.mjs`, `pdf.worker.min.mjs`); the UMD `pdf.min.js` the suite loads through a classic `<script>` tag with SRI no longer exists. Moving forward therefore changes how the library is loaded, how the worker is started and how the harness extracts the PDF helpers, all inside the single-file contract. It touches every PDF path (Knowledge Base ingestion, NCLEX extraction, page counting, the composition probe) and the verified-worker boundary, so it needs its own release with its own browser acceptance.

Current cdnjs versions at the time of writing: PDF.js 6.3.289 (ESM), React 19.2.x (UMD dropped; React stays on 18.3.1), Babel standalone 8.0.5 (7.29.9 is the newest 7.x and compiles the suite in the same time as 7.23.9, so it is not re-pinned).

## Target design

1. **Load the API as a module script.** Replace the classic tag with `<script type="module" src="…/pdf.min.mjs" integrity="sha384-…" crossorigin="anonymous"></script>` followed by an inline module that does `import * as pdfjsLib from '…/pdf.min.mjs'; window.pdfjsLib = pdfjsLib;`. Module scripts are deferred and execute before `DOMContentLoaded`, which is when Babel standalone compiles the suite, so `pdfjsLib` is a global by the time the app code runs. The CSP `connect-src` already allows both CDNs; module scripts are subject to the same SRI and `crossorigin` handling as classic scripts. On `file://`, a cross-origin module import from an `https:` CDN succeeds because cdnjs serves `Access-Control-Allow-Origin: *`; this must be verified in the browser acceptance for both loopback and `file://`, as the current PDF runner already does.
2. **Keep the verified Blob worker.** `pdf.worker.min.mjs` is a self-contained bundle. Fetch it with `integrity` exactly as today, create the Blob URL, and start it with `new Worker(url, {type:'module'})`. `worker-src blob:` stays sufficient. `PDFWorker({port})` still exists in 4.x–6.x; confirm the `ready` handshake message shape (`action`, `sourceName`, `targetName`) against the pinned build before relying on `pdfWorkerReady`.
3. **API surface to re-verify** in `getPdfDoc`, `pdfWalkPages`, `pdfLayoutText`, `kbPageComposition`: `getDocument({data, isEvalSupported:false, worker})`, `pdf.numPages`, `page.getTextContent()` item fields (`str`, `transform`, `width`), `page.getOperatorList()` and `pdfjsLib.OPS` names, `page.cleanup()`, `doc.destroy()`, `task.destroy()`. Text-item geometry changed subtly across major versions (`hasEOL`, `dir`), so the layout reconstruction in `pdfLayoutText` needs the same real-corpus check that v15.4 and v15.8 did.
4. **Harness.** `latte-tests.js` and the tools extract PDF helpers by anchors that include the comment naming CVE-2024-4367 and the worker integrity constant; those anchors move with the rewrite. The optional `tools/remediation-pdf-browser-tests.js` covers native worker integrity, both CDNs, failure/retry/cleanup, multi-document extraction on loopback and `file://`, and photo decoding; it is the acceptance gate for this change and must pass on both origins.
5. **Release mechanics.** New SRI pins for the API module and both worker copies, the CDN re-hash, `verify-repo.js` green, the changelog entry, and a note in `CURRENT_STATE.md` that `isEvalSupported:false` is retained even though the upgraded build no longer needs it for that CVE.

## Risks and how to bound them

- **Text-layer differences** change quote verification outcomes (`kbQuoteInSource`) and NCLEX choice parsing. Bound by re-running the quote-diagnostic build on the same cardiovascular chapter used for the v15.10/v15.11 measurements and comparing `quoteMiss` by reason before and after.
- **Module loading on `file://`** in browsers that block cross-origin module imports from opaque origins. Bound by the `file://` leg of the PDF runner; if it fails, the fallback is a classic-script bootstrap that fetches the module with `integrity` and evaluates it as a Blob module, which keeps the SRI guarantee.
- **Worker memory and startup** on phones. Bound by the existing 15 s worker-ready timeout and by measuring first-document open time before and after.

## Not part of this plan

React 19 (would require dropping the UMD architecture), marked 18 (major API and output changes; not required by any finding), and any change to the eleven frozen prompts.
