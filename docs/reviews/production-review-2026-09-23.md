# Production readiness review — v17.2

**Implementation follow-up (2026-09-23, v17.3):** findings 1, 2, 3, 4, 6, 8, 9, 10, 13, 14, 15 and 17 are fixed and 11, 12 and 19 are partly addressed (plan steps 1–3 and 5–10); see the [release verification record](v17.3-release.md). Finding 5 is **withdrawn**: with the boot timer cut to 1 second and a 2.9 s compile the app mounted with no error, because the Babel compile runs synchronously inside DOMContentLoaded and a pending timer cannot fire during it. Finding 16 is **withdrawn**: the nested-run rejection is the v16.7 amplification guard and is pinned by a real-DOM browser test. Finding 7's retention of raw responses is intentional evidence; only its per-render stringify was removed. Still open: the inline-style half of 12, the harness assertion total in 18, and the PDF.js migration in 19 (planned separately). Line numbers below refer to the reviewed v17.2 file.

Reviewed 2026-09-23 at commit `255f30c` (clean tree). Scope: the complete shipped application `Nursing-Study-Suite v17.2.html` (11,208 lines), `verify-repo.js`, `latte-tests.js`, the `tools/` modules and the two live measurement tools. The eleven byte-frozen prompt constants were not reviewed for content because the project contract freezes them.

**Recommendation: ship a patch release for the settings-drawer focus defect (High), then work the Medium items in the order below.** Findings: **0 Critical, 1 High, 6 Medium, 12 Low.** No shipped code, prompt, baseline, dependency pin or test was changed by this review. No private course material, live Gemini call or native Anki import was used.

## Evidence and limits

- `node verify-repo.js` passes: **3,281 assertions / 0 failed**, all eleven frozen prompt hashes, generated prompt documentation, LF/version checks and the full JSX Babel transform.
- The High finding was **reproduced in a real browser** on a loopback copy of the shipped HTML: typing `x` in the Flash model field moved focus to the API key field; the next keystroke `y` landed in the API key field.
- Performance numbers below were measured in the same browser on this Windows desktop with a synthetic 12-condition / 2,400-fact Knowledge Base seeded through the app's own fallback-restore path. They are single-machine observations, not cross-device measurements.
- Dead-CSS detection used a script that matches every `.class` selector against the JSX and print stylesheet.
- Not verified: mobile devices, native Anki import, live provider behavior, the pinned CDN builds themselves.

## Findings

Line numbers refer to `Nursing-Study-Suite v17.2.html`.

### 1. Typing in the settings drawer steals focus into the API key field

**Severity:** High · **Category:** Bug / Regression (introduced in v17.0, commit `3f4c755`)

**Location:** `ConfigSidebar` effect, lines 10899–10904; `App.closeSettings`, line 11056; `<ConfigSidebar onClose={closeSettings}/>`, line 11178.

**Problem:** The drawer's "entry focus" effect depends on `onClose`, and `closeSettings` is a fresh arrow function on every `App` render. Any `App` state change while the drawer is open re-runs the effect, which calls `document.getElementById('suite-api-key')?.focus()`. Typing in the Flash or Pro model field changes `App` state on every keystroke, so focus jumps to the API key after each character. The same happens on every `persistenceStatus` transition during a build and on every profile pill click.

**Impact:** Model names cannot be edited in place; stray characters land in the API key field (verified). This is the only High finding and it shipped through v17.0, v17.1 and v17.2 because no test exercises keyboard interaction in the presentation layer.

**Recommendation:** Give the effect mount-only semantics and read the close callback through a ref, and memoize `closeSettings` in `App`.

**Improved code:**

```js
// ConfigSidebar
const onCloseRef=useRef(onClose);
useEffect(()=>{onCloseRef.current=onClose;},[onClose]);
useEffect(()=>{
  const onKey=e=>{if(e.key==='Escape'){e.preventDefault();onCloseRef.current();}};
  document.addEventListener('keydown',onKey);
  document.getElementById('suite-api-key')?.focus();
  return()=>document.removeEventListener('keydown',onKey);
},[]);
// App
const closeSettings=useCallback(()=>{setShowConfig(false);settingsTrigger.current?.focus();},[]);
```

**Regression assertion:** a browser check that opens settings, types three characters into `#suite-flash-model`, and asserts `document.activeElement.id==='suite-flash-model'` and an unchanged API key value. Add it to `tools/visual-browser-tests.js`, and add a harness assertion that the effect's dependency array is `[]`.

**Expected benefit:** correctness; the fix costs nothing at runtime.

### 2. Every save and every fallback store the Knowledge Base twice

**Severity:** Medium · **Category:** Performance / Architecture

**Location:** `kbCreateSaveQueue.save`, line 2285 (`bytes:JSON.stringify(copy)`); `kbStoredRecord`, lines 2203–2207; `kbReadFallbacks`, line 2260; `App` `writeFallback`, line 11040.

**Problem:** `meta.bytes` carries the complete serialized KB as an integrity witness. The KB is therefore written twice to IndexedDB (`record.kb` plus `meta.bytes`), and the localStorage fallback record is the KB twice over. Each save also deep-clones the KB, serializes it twice, reads the previous KB back from IndexedDB and serializes that too, only to compare strings.

**Measured:** a 932,612-byte KB produces a 1,956,693-byte fallback record (2.1×). CPU cost on this desktop is small (0.7 ms per stringify, 3.6 ms per clone), so the real cost is storage: the localStorage fallback can hold only about half the KB size the browser quota would otherwise allow.

**Recommendation:** Replace `bytes` with a short digest of the serialization (a synchronous 53-bit hash such as cyrb53 works in the synchronous `kbReadFallbacks` path; SHA-256 via `crypto.subtle` is available on the async save path). Accept legacy records that still carry `bytes` so existing saved data restores unchanged, and write the digest form on the next save.

**Expected benefit:** halves persisted bytes, doubles the fallback's effective capacity, removes three full serializations per save.

**Compatibility risk:** older builds cannot read digest-only records; the existing fallback/tombstone metadata already has that property and is documented in `CURRENT_STATE.md`.

### 3. Every App re-render re-parses and re-sanitizes study markdown

**Severity:** Medium · **Category:** Performance

**Location:** `KnowledgeBaseBuilder`, line 3593 (`mdToSafeHtml(renderKBMarkdown({...kb,conditions:[sel]}))` inline in JSX); `PriorityAnalyzer`, lines 4053–4058 (four `mdToSafeHtml` calls inline); `App` `cfg` memo, line 11126 (includes `activeTool`); tool mounting, line 11195.

**Problem:** All six tools stay mounted and receive new elements on every `App` render, and `cfg` is invalidated by `activeTool`, so a tab switch, an API-key keystroke or a persistence status change re-renders all six tools. The KB study view and the Priority tiers run marked plus DOMPurify inline in JSX, so that work repeats on each of those renders.

**Measured (2,400-fact KB, desktop):** one API-key keystroke costs about 16 ms of synchronous work, of which 4.6 ms is `marked.parse` and 5.0 ms is `DOMPurify.sanitize` for a view that did not change. A tab switch also re-parses the KB view. On a phone this is the difference between responsive and laggy typing.

**Recommendation:** `useMemo` the KB study HTML on `[sel,kbView]`; `useMemo` the four Priority tier fragments on `[tiers]`; remove `activeTool` from `cfg` and pass it to `ConfigSidebar` as a prop; wrap the six tool components in `React.memo` so they re-render only on context changes.

**Expected benefit:** about 60% of the per-keystroke cost with a large KB disappears; tab switches stop touching the markdown pipeline.

### 4. Extraction pipelines are strictly serial while the audit pool already has two lanes

**Severity:** Medium · **Category:** Performance

**Location:** KB build loop, lines 3196–3321; Priority harvest, lines 3954–3972; NCLEX inline/split, lines 7071–7079 and 7151–7168; Anki chunk loop, lines 6440–6481; `itemRunPool`, lines 10276–10307.

**Problem:** A 100-chunk book with the omission audit on is 200 sequential model calls with a 500–900 ms pause between them. The per-item audit already uses a bounded two-lane pool (`AUDIT_POOL_WIDTH=2`) with the same quota reasoning that would apply here.

**Recommendation:** Add an opt-in "parallel lanes" setting (default off, width 2) that runs pass 1 of chunk N+1 while pass 2 of chunk N is in flight, assembling `parts` and `stats` in original chunk order. Keep truncation splitting per lane. Measure against free-tier limits before changing the default.

**Expected benefit:** roughly halves wall-clock build time on long sources without raising peak request rate above what the audit pool already uses.

### 5. The boot timeout fires during a normal compile on slower devices

**Withdrawn 2026-09-23** — not reproducible; see the implementation follow-up note at the top. The text below is retained as written.

**Severity:** Medium · **Category:** Bug

**Location:** boot script, lines 693–703; mount, line 11205.

**Problem:** The 12-second timer replaces `#root` with "could not start ... CDN dependencies may have failed" unless `__latteMounted` is set. That flag is set only after Babel compiles the 900 KB script. On this desktop `domContentLoaded` (which includes the compile) is 4.6 s with warm CDN resources; a mid-range phone is typically three to five times slower, which crosses 12 s. React then clears the false error when it mounts, so users see an error flash followed by the app.

**Recommendation:** Mark the compile as started (Babel standalone is loaded, `window.Babel` exists) and clear the timer at the top of the Babel script, or raise the timeout and reword the message to "still starting" when `window.Babel` is present.

**Expected benefit:** no false startup failure on the device class students actually use.

### 6. Model-generated links can navigate the study tab away

**Severity:** Medium · **Category:** Security / UX

**Location:** `STUDY_OUTPUT_POLICY`, lines 819–823 (`href` allowed, `target`/`rel` not); rendered through `dangerouslySetInnerHTML` at 3593, 4053–4058, 4064.

**Problem:** DOMPurify blocks `javascript:` URLs, but any `https:` link the model emits renders as a live anchor inside the app. One click navigates the tab, and every unsaved artifact (Anki edits, cases, transcripts, review decisions) is lost, because only the KB is persisted. It is also a phishing vector from untrusted output.

**Recommendation:** Either drop `href` from `ALLOWED_ATTR` for in-app rendering, or add a DOMPurify `afterSanitizeAttributes` hook that forces `target="_blank"` and `rel="noopener noreferrer"` on anchors. The print document already isolates its opener.

**Expected benefit:** no session loss from a misclick; no in-tab navigation from untrusted content.

### 7. Diagnostics keep every raw model response in React state

**Severity:** Medium · **Category:** Performance (memory)

**Location:** KB `stats` entries with `primaryResponse`/`auditResponse`, lines 3252 and 3320, published into `diag` at 3333; Anki batch diagnostics `<pre>{JSON.stringify(diagnostics,null,2)}</pre>`, line 6689.

**Problem:** A long book retains two full raw responses per chunk (each up to 65,536 tokens) for the session, and the Anki diagnostics object is stringified on every `AnkiGenerator` render while a batch exists.

**Recommendation:** Keep raw responses in a ref or Blob outside React state, expose them to the export functions, and stringify the Anki diagnostics only when the details element opens.

**Expected benefit:** bounded memory on long builds; fewer allocations per edit.

### 8. Model names and manual thinking levels are not persisted

**Severity:** Low · **Category:** Bug

**Location:** `App`, lines 11013–11020 versus 11024–11030.

**Problem:** `autoProfile` and the profile table persist to localStorage; `flashModel`, `proModel`, `thinkingMode`, `flashLevel` and `proLevel` do not. A user who edits a model name loses it on reload while their per-tool profile survives.

**Recommendation:** Persist the five values under one versioned key with the same try/catch pattern.

### 9. Saved profiles are not validated on read

**Severity:** Low · **Category:** Bug

**Location:** `App` profile loader, line 11029; `forTool`, lines 11118–11124; `cardTranscribe`, line 2825; `nclexCallGemini`, line 7043.

**Problem:** A stored profile row with an unexpected `lv` or a non-object row is spread into state unchanged. `callGemini` falls back to `'low'`, but `cardTranscribe` and `nclexCallGemini` pass the level straight into `thinkingConfig`.

**Recommendation:** Validate `m ∈ {flash,pro}` and `lv ∈ {low,medium,high}` per row on read and fall back to the default row.

### 10. Recovery archives accumulate in IndexedDB forever

**Severity:** Low · **Category:** Maintainability

**Location:** `kbArchiveRecovery`, lines 2270–2275.

**Problem:** Each recovery choice writes a `recovery-*` key that nothing lists, exports or prunes.

**Recommendation:** Keep the last N archives, or surface them in the recovery panel with an explicit delete.

### 11. Duplicated helpers that have already drifted

**Severity:** Low · **Category:** Maintainability

**Location:** `ankiDecimal` 4964 and `caseDecimal` 9340 (identical); `ANKI_SUPPORTED_UNIT` 4974 versus `CASE_SUPPORTED_UNIT` 9349 (different vocabularies; v16.9 had to add cm/mm to one side); HTML escapers at 698, 1376 and 5070; abortable-promise helpers `pptxAwait` 901, `_sleep` 1017, `pdfWorkerReady` 1222; six copies of the capped log setter; two copies of the NCLEX grounding adapter text (8500–8512 and 8560–8572); three focus-block builders (1985, 6405, 8384) with different wording; three different operation-ownership patterns (`createOperationSlot` in four tools, `activeRun` refs in Anki, a bare `abortRef` in the extractor).

**Recommendation:** One decimal normalizer; one unit vocabulary object that both validators derive their regexes from (the comments say the two policies differ on *what* they check, not on *which units exist*); one `escHtml`; one `abortable(promise|ms,signal)` helper; one `useCappedLog` hook; one adapter constant. Do this in small, harness-covered steps because `latte-tests.js` anchors on several of these spans.

### 12. Dead CSS and inline styling

**Severity:** Low · **Category:** Style

**Location:** stylesheet lines 82–688.

**Problem:** Eleven class selectors are unused (`action-row badge-req ext-toggle ext-viewer fo-desc fo-head format-opt output-toolbar-actions priority-layout retry-banner setup-stack`, about 2.4 KB). The JSX carries 483 `style={{...}}` attributes, so the v17.0 token stylesheet governs only part of the presentation.

**Recommendation:** Delete the eleven rules; migrate the repeated inline patterns (dim caption, mono caption, warning line, banner boxes) into classes as UI files are touched.

### 13. Anki numeric checks rebuild work per note

**Severity:** Low · **Category:** Performance

**Location:** `ankiNumericTokens`, line 4981 (`new RegExp` per call); `ankiNumericAudit`, lines 5004–5009 (re-tokenizes each linked fact per note); `ankiAuditGroups`, lines 5250–5258 (re-serializes the candidate packet per unit).

**Recommendation:** Hoist the regex to module scope (`matchAll` clones it, `replace` resets it); cache fact tokenization per batch snapshot in a `WeakMap`; keep the packet-size loop but reuse the serialized prefix.

### 14. Duplicate React keys for same-named card photos

**Severity:** Low · **Category:** Bug

**Location:** line 3406, `identityConflicts.map(e=><details key={e.file}>`.

**Problem:** Two photos with the same basename (the exact case `cardFileId` was introduced for) produce duplicate keys.

**Recommendation:** Carry the id through `cardCurrentEntries` and key on it.

### 15. `extractJSON` anchors on the first brace in prose

**Severity:** Low · **Category:** Bug

**Location:** lines 1185–1198.

**Problem:** After the single fenced-block attempt, the scanner starts at the first `{` or `[` anywhere in the text, so a preamble containing a brace mis-anchors. JSON MIME mode makes this rare.

**Recommendation:** Try every fenced block, then scan from the last preamble line that starts with `{` or `[`.

### 16. One odd text run rejects an entire deck

**Withdrawn 2026-09-23** — the rejection is the v16.7 amplification guard; see the follow-up note at the top.

**Severity:** Low · **Category:** Robustness

**Location:** `_pptxRunText`, line 873.

**Recommendation:** Skip the run and record a diagnostic instead of throwing for the whole file.

### 17. Side effects during render in `AnkiGenerator`

**Severity:** Low · **Category:** Maintainability

**Location:** lines 6212, 6214, 6238 (`currentKB.current=...`, `auditInputs.current={...}` assigned in the render body).

**Problem:** Correct today, but render-phase ref writes break under StrictMode double rendering and React's concurrent features.

**Recommendation:** Move them into `useEffect`/`useLayoutEffect` or derive them with `useMemo` where consumers can accept a value.

### 18. Presentation layer has no keyboard-interaction regression test

**Severity:** Low · **Category:** Testing

**Location:** `latte-tests.js` (`EXPECTED_ASSERTIONS=3281`), `tools/visual-browser-tests.js`.

**Problem:** 3,281 assertions and twelve browser runners passed while finding 1 shipped through three releases. The harness extracts pure functions by string anchor; it cannot see effects, focus or event wiring. The hard-coded assertion total must also be bumped on every test addition, which is friction that discourages adding tests.

**Recommendation:** Add a small Playwright interaction suite for the drawer, the tab rail and one edit flow per tool; replace the exact assertion total with a minimum plus a per-module count check.

### 19. Dependency currency

**Severity:** Low · **Category:** API

- React 18.2.0 → 18.3.1 still ships UMD builds, so it fits the single-file contract and surfaces React 19 deprecations. Re-pin SRI on upgrade.
- pdf.js 3.11.174: CVE-2024-4367 is mitigated by `isEvalSupported:false`; the upgrade path is ESM-only and is separate work, as the previous review said.
- Babel standalone 7.23.9: newer 7.x builds may shorten the 4.6 s compile; measure before pinning.
- `document.execCommand('copy')` is a deprecated but justified fallback for `file://`.
- Gemini: direct `v1beta` REST with `thinkingConfig.thinkingLevel`, header auth, SSE framing, retry floors and safety settings are all current. Two things to verify against the current model cards rather than assume: that every configured model accepts `thinkingLevel:'medium'` (the profile UI offers it for Pro), and the per-model output ceiling behind the universal 65,536. Structured-output schema enforcement remains deliberately deferred per `DECISIONS.md`.

## API, security and architecture assessment

Security posture is appropriate for a bring-your-own-key, no-backend page: SRI on every script, a verified Blob worker for PDF.js, a narrow CSP (no `script-src` is a documented consequence of in-browser Babel), DOMPurify with an explicit allowlist, key redaction in exported evidence, prototype-key filtering on imports, bounded PPTX expansion, an opener-free print window. No injection, path, SSRF, CSRF, authorization or secret-leak defect was found. The two residual items are finding 6 and the Google Fonts request, which sends the viewer's IP to a third party on every load of an otherwise local app; embedding the fonts is the only single-file remedy and costs about 100 KB.

Architecture: the validation and provenance model (frozen prompts, packet-scoped fact IDs, deterministic validators, source-snapshot ownership, honest partial states) is the strongest part of the codebase and is consistently applied in five of six tools. The liabilities are structural: one 11,208-line file with six large components, duplicated helpers that have already diverged, presentation state mixed with pipeline state, and a test harness that can only see pure functions. None of that argues for a bundler or module split under the project's contract; it argues for consolidating the shared helpers inside the file and adding one interaction-level test surface.

## Scores

| Dimension | Score / 100 | Main deductions |
| --- | ---: | --- |
| Production readiness | **74** | Verified settings focus defect; false boot timeout on slow devices; link-driven session loss |
| Maintainability | **55** | Duplicated and drifting helpers, 483 inline styles, string-anchored tests, no interaction tests |
| Security | **84** | Untrusted links navigate the app; third-party font request; no `script-src` by design |
| Performance | **66** | Serial pipelines, repeated markdown work per keystroke, doubled persistence, retained raw responses |

Technical debt / dead code / dependencies removed by this review: **none** (review only). Removable on implementation: the eleven CSS rules, one duplicate decimal normalizer, one duplicate adapter block, two redundant abortable-promise helpers.

## Ordered implementation plan

1. Fix the settings focus effect and memoize `closeSettings` (finding 1); add the interaction check; release as v17.3 following the release checklist.
2. Memoize the KB study view and Priority tier HTML; drop `activeTool` from `cfg`; `React.memo` the tools (finding 3).
3. Replace `meta.bytes` with a digest while accepting legacy records (finding 2); regression: restore a `bytes` record, save, restore the digest record, conflict detection unchanged.
4. Guard the boot timeout against an in-progress compile (finding 5).
5. Neutralize anchors in sanitized output (finding 6).
6. Add opt-in two-lane chunk processing with ordered assembly (finding 4); measure on a long synthetic source.
7. Persist and validate model settings (findings 8, 9).
8. Consolidate duplicated helpers and the unit vocabulary; delete dead CSS (findings 11, 12); move each anchor the harness depends on deliberately.
9. Move raw responses out of React state; Anki micro-optimizations; the remaining Lows (findings 7, 10, 13–17).
10. Pin React 18.3.1 with fresh SRI; plan the pdf.js ESM migration as its own change (finding 19).

Every step needs a non-vacuous assertion in the harness, `node verify-repo.js` green, and the release-checklist items for any version bump. None of the steps touches a frozen prompt or a warning tier.
