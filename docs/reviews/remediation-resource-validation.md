# Remediation resource validation

Measured 2026-09-11T23:41:16.043Z against `Nursing-Study-Suite v15.17.html`. No private course files or Gemini requests were used.

## Public resource pins

All eight existing script resources matched their SHA-384 pins. The PDF worker is a separate resource with two independently fetched, matching CDN copies.

| Resource | Bytes | SHA-384 integrity |
|---|---:|---|
| [script: 18.2.0/umd/react.production.min.js](https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js) | 10,737 | `sha384-tMH8h3BGESGckSAVGZ82T9n90ztNXxvdwvdM6UoR56cYcf+0iGXBliJ29D+wZ/x8` |
| [script: 18.2.0/umd/react-dom.production.min.js](https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js) | 131,882 | `sha384-bm7MnzvK++ykSwVJ2tynSE5TRdN+xL418osEVF2DE/L/gfWHj91J2Sphe582B1Bh` |
| [script: babel-standalone/7.23.9/babel.min.js](https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.9/babel.min.js) | 2,849,480 | `sha384-ku9eM40vVDsFUiERorrdlHlF0LIhdfn716M7TntM72Uo98T7LWiogD3hNenPx8Q0` |
| [script: marked/11.1.1/marked.min.js](https://cdnjs.cloudflare.com/ajax/libs/marked/11.1.1/marked.min.js) | 35,141 | `sha384-zbcZAIxlvJtNE3Dp5nxLXdXtXyxwOdnILY1TDPVmKFhl4r4nSUG1r8bcFXGVa4Te` |
| [script: dompurify/3.4.15/purify.min.js](https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.4.15/purify.min.js) | 29,369 | `sha384-uUMu9JDY09vBzRf9SPcK2VgUj+W/70J6Soc+Dded5P474ElQ63iv9j5N3DE7Kp3N` |
| [script: dompurify@3.4.15/dist/purify.min.js](https://cdn.jsdelivr.net/npm/dompurify@3.4.15/dist/purify.min.js) | 29,369 | `sha384-uUMu9JDY09vBzRf9SPcK2VgUj+W/70J6Soc+Dded5P474ElQ63iv9j5N3DE7Kp3N` |
| [script: pdf.js/3.11.174/pdf.min.js](https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js) | 320,004 | `sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e` |
| [script: jszip/3.10.1/jszip.min.js](https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js) | 97,630 | `sha384-+mbV2IY1Zk/X1p/nWllGySJSUN8uMs+gUAN10Or95UBH0fpj6GfKgPmgC5EXieXG` |
| [worker: pdf.js/3.11.174/pdf.worker.min.js](https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js) | 1,087,212 | `sha384-SnzOobpRMLXZ52iJvZm/C0fYw0OQemTXzTjIsdsfMcrCtCEe9qgzxTd3RSklO5x2` |
| [worker: pdfjs-dist@3.11.174/build/pdf.worker.min.js](https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js) | 1,087,212 | `sha384-SnzOobpRMLXZ52iJvZm/C0fYw0OQemTXzTjIsdsfMcrCtCEe9qgzxTd3RSklO5x2` |

[DOMPurify 3.4.15](https://github.com/cure53/DOMPurify/releases/tag/3.4.15), published 2026-09-06, is the current verified release. Both sanitizer CDNs serve the same 29,369 bytes; the fallback never downgrades.

## Deterministic and browser acceptance

`node tools/remediation-resource-tests.js` passed 33 assertions against functions extracted from the shipped HTML. These cover the narrow output policy, print document CSP, iframe sandbox/cleanup, native-integrity request configuration, concurrent worker initialization, independent document lifetime, failure cleanup, retry and cancellation.

The browser run used an existing external Playwright installation, headless Chrome and disposable browser contexts:

```powershell
$env:NODE_PATH='C:\Users\<user>\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
node tools/remediation-pdf-browser-tests.js
```

All five PDF/card browser groups passed:

- Loopback: verified worker bytes executed through a Blob; two generated two-page PDFs shared one worker; whole-document and page-range text extraction passed; cancellation stopped before page 2; destroying one PDF left the other readable; cleanup revoked the Blob.
- `file://`: the actual App fixture started with the same verified worker, extraction and independent document lifetime checks.
- A deliberately corrupted primary worker response failed native fetch integrity; the separately pinned fallback read the generated PDF.
- Corrupting both worker responses created no native or fake worker. Removing the test corruption and explicitly retrying succeeded.
- An actual additional `worker-src 'none'` CSP blocked worker startup. Initialization failed, the Blob was revoked, and PDF.js never entered its fake-worker path.

The loopback run also exercised the actual unchanged `cardFilePayload`: a generated 4000×3000 PNG below the size threshold passed through unchanged; a valid synthetic PNG with trailing bytes above the threshold decoded through `createImageBitmap` and became a 3000×2250 JPEG. This checks decoding and resizing, not OCR accuracy or HEIC behavior.

The fixture routes browser-context requests across tabs, workers and frames; unexpected remote requests fail the test. Generated PDFs and images contain only synthetic text.

Native print-dialog appearance, physical printing and PDF save UI were not tested by this headless run. Separate output-policy browser acceptance covers sanitized popup/iframe content and parent-triggered print invocation; it must not be described as native print-dialog verification.

## Worker ownership and conditional major migration

Inspection of the [PDF.js 3.11.174 display API](https://github.com/mozilla/pdf.js/blob/v3.11.174/src/display/api.js) confirmed that `PDFWorker({port})` initializes from the provided port and bypasses the fake-worker loader. Passing that worker explicitly to `getDocument` prevents the document loading task from owning and destroying the shared worker. The application retains `isEvalSupported:false`.

The current supported PDF.js release is [v6.3.289](https://github.com/mozilla/pdf.js/releases/tag/v6.3.289), published 2026-08-29. Its [documented distribution](https://mozilla.github.io/pdf.js/getting_started/) uses `pdf.mjs`/`pdf.worker.mjs`. A major migration remains conditional: ESM bootstrap ordering, file-origin CORS, verified module-worker and fallback behavior, text-layout/quote compatibility, and additional decoder/font resources require their own complete acceptance matrix. These results validate the retained pinned 3.11.174 worker path; they do not establish compatibility for an unimplemented v6 migration.

## Anki desktop acceptance attempt

The desktop app is installed at `C:\Program Files\Anki\anki.exe`, with executable product version `26.5`. `Get-Command anki,anki-console` found no PATH command. Conventional x86 and per-user `Programs\Anki` executable paths were absent. No existing Anki profile, collection or media directory was inspected.

The bundled `@oai/sky` native runtime initialized and discovered Anki. The installed app was launched with the [documented `-b` option](https://docs.ankiweb.net/files.html#startup-options), using the new temporary base `codex-anki-remediation-4f9e1bdfe8d94169a7f06dc11dd9ba85`. The visible `User 1` profile contained an empty Default deck. Both synthetic fixtures were generated directly from the shipped `ankiExportText` helper: three equal-Text notes with meaningful Extra/tier differences, two cloze indices per note, a cloze hint, literal `<`, `>`, `&`, entity-looking text, tags and source pointers. The live deduper retained all three notes; six cards per import are the expected count, not an observed desktop result.

Desktop import acceptance remains incomplete. The native file picker returned `element 156 is not available in cached app state for Anki.exe`; its accessibility click also computed a point outside the captured window. Refresh/reselection did not resolve the modal cache/focus problem. A subsequent [supported CLI file-open handoff](https://github.com/ankitects/anki/blob/main/qt/aqt/__init__.py) into the same isolated base displayed a blank Import File window with no import controls. The attempt stopped without importing either fixture. Successful plain/headered field mapping, imported note/card counts, rendered clozes/entities and source-footer display are therefore not claimed.

The [Anki text-import manual](https://docs.ankiweb.net/importing/text-files.html#duplicates-and-updating) says first-field matches normally update existing notes; preserving equal-Text variants requires choosing to import duplicates as new notes. The installed dialog's exact option label was not observed. A future desktop check must select that behavior, map Text/Extra/Tags, disable HTML for the plain fixture and enable HTML for the headered fixture, then verify three notes and six cards for each fixture in isolation.
