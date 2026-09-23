# Case remediation v17.1 — implementation and verification

Date: 2026-09-23. Status: software implemented; clinical content closure remains partial; unreleased.

The canonical application is `Nursing-Study-Suite v17.1.html`. This implements packages A–E of the user-supplied consolidated plan and the generic source-qualification clarification from F. It preserves the eleven frozen constants, source-only generation, model profiles, one-round repair policy, source replacement cancellation, warning tiers and single-file architecture.

## Changes and bounded claims

| Scope | Result |
|---|---|
| C01 | Stage titles use the uncited-prose scan. Stems ground numeric claims against supplied rationale facts and independently validated case data, including an explicit empty-evidence path. Incorrect distractor text is not asserted patient data. |
| C02 | Explicit quantity multiplication (`×`, `*`, `multiplied by`) and division (`÷`, `divided by`) with `=`, `gives` or `equals` can establish question-local derived values. Decimal cross-products use BigInt and dimensions must cancel exactly. No conversions, inferred rounding, arbitrary formulas or global exemptions. |
| C03–C04 | Shared ranges retain both signed endpoints once with their complete unit. Protocol/shift prose is excluded from units; unknown compound tails retain source review. Interior direct values do not inherit range support; threshold instantiation remains distinct. |
| C05–C06 | Repairs preserve id/type and exact option label set/count. Canonical substantive comparison ignores property ordering, rationale ordering and repair notes. Unchanged or rejected items retain FAIL and the attempted-repair reason. Accepted revisions publish matching findings before another asynchronous boundary. |
| R01 | Valid MCQ, Prioritization, Education and SATA records undergo one immutable Fisher–Yates transformation. Content, keys and rationale citations move together. Unambiguous singular label references are remapped; ambiguous references/order wording preserve order with an advisory. Ordering/Calculation remain unchanged. Repairs are checked for real change before shuffling only the changed item. |
| C07–C09 | Assumed weights retain visible qualification. Every validation message and per-item criterion/detail/warning/repair attempt appears in the review appendix after the answer key; JSON carries equivalent fields. Failure banners, requested/actual counts, source staleness and audit state remain. |
| C10 | Pending/unscored rows are explicit. Progress uses the captured run state, completed eligible-item count and repair phase. N/A and rewritten/not-re-audited outcomes do not imply PASS. |
| F prevention | Unfrozen builders prohibit inferring absent client findings/history from generic disease descriptions and strengthening qualified associations into absolute exclusions. This is prompt guidance, not a clinical guarantee. |

The item auditor still consumes only student-visible context and its keyed item. Its worksheet/answer-key cut excludes rationales, fact packets and the new appendix. The existing keyed-answer input is unchanged.

## Executed verification

- `node verify-repo.js`: **3,163 assertions, zero failures**, eleven unchanged frozen hashes, all named prompt documentation, LF/version agreement and full JSX Babel transform.
- The 112 new assertions in `tools/case-remediation-tests.js` extract shipped functions and the actual async generation/repair handler. They include valid neighboring inputs, exact arithmetic/negative examples, all correct-option destinations, citation/content mapping, nonstandard-label preservation, stable exports, warning-only fixtures with 14/23/19 messages, no-op/shape repairs, both concurrent completion orders, and cancellation/source replacement with current retained findings.
- Running the new regression module on pre-change v17.0 bytes executes defect reproductions with failures for the parser, omitted fields, calculation, assumption label, no-op/distractor repair and stale-findings paths. Feature-helper assertions also fail before implementation; tests requiring newly introduced helpers execute only on the new code. This is not a claim that all feature tests ran on the old build.
- The all-format browser check caught an implementation defect in BigInt exponentiation: default in-browser Babel transformed it to `Math.pow`, causing a runtime error. Decimal scales now use BigInt strings. The mandatory harness executes the extracted calculation after the browser's `env`/`react` transforms, using the verifier's configured scratch Babel runtime.
- `tools/case-remediation-browser-tests.js`: **nine scenarios passed** using the isolated real App, synthetic KB and mocked Gemini responses. Checks pending/N/A progress, captured audit settings, reveal/hide and stable mappings, JSON/Markdown/print input, actual print-preview DOM and print CSS page break, accepted/rejected/no-op repairs, failed numeric output, cancellation, all six formats and assumed weight, source replacement and quota interruption. A subsequent conservative guard for nonstandard option labels was verified in the mandatory extracted-function harness.
- `tools/remediation-worksheet-browser-tests.js`: all six existing worksheet scenarios pass after the compatible shared export metadata change.
- All eight script SRI resources and both worker CDN copies were fetched and SHA-384 verified with no pin changes.
- Print preview was visually inspected; its computed `.pagebreak` rule is `break-before: page`. No OS print dialog, physical print, or cross-device native PDF pagination is claimed.

Scratch logs, pin results and the synthetic print screenshot stay under ignored `scratch/`. No live Gemini request, manual quota-consuming measurement script, repository dependency installation, commit, push or publication was performed.

## Clinical evidence and remaining work

The user explicitly authorized the `Testing/v16.2 tests` folder. It contains four KB JSON files, with captured quotes and source pointers, but no generated case exports or original PDFs. Only the implicated condition/fact records were inspected. A private disposition and prepared omission/replacement wording are saved as `scratch/case-clinical-dispositions.md`; no private source content was added to tracked files.

The treatment concern is already present in the TCA captured quote, so it cannot be attributed solely to case generation. The Dermatitis captured quote has a qualified childhood association, which does not support an absolute exclusion or invented client history. The other cited records distinguish general recommendations from patient-specific findings. Original-page verification and generation-versus-repair attribution remain incomplete.

**C11/C12 are not marked closed.** Applying corrections to the affected case files, replaying their reported 56 validation warnings, classifying the 44 timing warnings, resolving the original teaching-source conflict and any separately authorized live regenerated-output acceptance require the missing material. The supplied plan's reported outputs were not recreated from memory or copied into Git.

Existing untracked `docs/reviews/case-study-remediation-plan-2026-09-23.md` was preserved untouched.
