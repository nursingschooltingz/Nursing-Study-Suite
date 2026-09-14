# Anki v16.6 implementation and verification

The user approved implementation as v16.6 after independent review of four v16.5 exports and their Flash/Low audit reports, followed by comparison with an external assessment. The user subsequently authorized committing, pushing and publishing v16.6 as the latest release. This record documents implementation verification, not measured improvement from a new model run.

## Resulting behavior

- Audit decoding retains every valid Text/Extra context location. Cited Text takes precedence over Extra-only status without creating hidden coverage. Repeated references to one note with disjoint valid cloze indices merge; repeated indices, unknown handles and invalid eligibility still fail.
- Reference normalization has its own original/canonical history in partial results, retry merges, UI and private schema-4 reports. It is separate from historical citation recovery. Invalid JSON, conflicting citation coordinates, out-of-range tokens and invalid inventory roles remain unresolved; accepted neighboring records survive.
- Source packets supply an exact canonical Condition token computed by the existing safe identity registry and formatter. Condition splitting retains it. The adapter requests verbatim copying; conservative mapping and manual-selection safeguards remain intact.
- Bounded advisory checks review selected potentially substantive context spans in mixed inventories, short or list-only citations attached to added definitions/relations, and possible qualifier/action strengthening. They preserve note fields, model verdicts, selection and export bytes. Text and Extra findings have separate decision identities. A category that was not searched does not display a misleading zero hidden-candidate count.
- The runtime adapter and checker distinguish source support, useful Extra, independent recall targets and unnecessary captions. They emphasize full propositions, target preservation after splitting, and source-supported paraphrases. All eleven frozen constants and their baseline are unchanged. Flash / Medium remains the generation default.

Exact approved runtime changes: [adapter](../history/ANKI-v16.6-adapter.diff), [source serializer](../history/ANKI-v16.6-serializer.diff), [audit builder](../history/ANKI-v16.6-audit-builder.diff).

## Verification

- `node verify-repo.js`: **2,564 assertions passed**, including **299 additional assertions** compared with v16.5; full JSX Babel transformation, LF/version agreement, generated prompt documentation and all eleven frozen hashes pass.
- New modules test reference decoding, canonical packet generation, metadata/UI contracts and **36 invented quality cases**. Fixtures include legitimate paraphrases, supplied parenthetical definitions, necessary conditions, grammatical fragments, supported Extra, same-cloze equivalents, conflicting coordinates, stale audits and unchanged exports. Quality tests use live extracted functions and include an explicit semantic-limit counterexample.
- `node tools/anki-v166-browser-tests.js`: **22 synthetic browser checks passed**, covering mixed locations, normalization history, separate field decisions, strict partial retention, explicit retry, unchanged Keep/export behavior and 360px reflow. The mobile decision panel was visually inspected.
- The existing `tools/anki-source-review-browser-tests.js` lifecycle suite passes, including cancellation, source replacement, stale evidence, source-link edits and quarantine/resume. Browser requests use mocked Gemini and synthetic material; only pinned startup CDN resources are fetched.
- All **eight script resources and both PDF worker CDN copies** match their SHA-384 pins. No application resource URLs or pins changed.

Private logs, screenshots and raw replay evidence remain under ignored scratch directories. No course excerpts, private KBs, generated decks, API keys or downloaded reports are included in the tracked fixtures or documentation.

## Saved-response replay and limits

Replaying the supplied responses through the updated parser recovers 13 rejected records: OB improves from 32/41 to 37/41 complete groups, and med-surg from 21/26 to 24/26. Pharm 14/14 and mental 15/15 remain complete. Eight unresolved records and one malformed JSON packet remain; both larger audits truthfully stay partial.

The quality checks surface the reviewed source-support and target-classification counterexamples while preserving source data, receipts, selection and export bytes. They also retain known limitations: some grammatical/context false positives remain, and valid-length evidence can fail to entail a claim without triggering a local warning. Counts of warnings are not counts of confirmed errors. Literal related answers are review candidates, never automatic semantic clearance.

No live Gemini comparison or native Anki import was performed. A future controlled measurement should check the same frozen decks at Low and Medium, scoring known true positives, false positives and false negatives independently of protocol completion. The implementation does not certify the underlying KB or guarantee future model adherence.
