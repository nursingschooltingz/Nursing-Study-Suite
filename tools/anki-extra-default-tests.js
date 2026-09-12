'use strict';

// Offline contract and import/export compatibility checks. Prompt assertions show
// that the approved instruction is shipped; they do not measure model adherence.
function runAnkiExtraDefaultTests({ S, t, section }) {
  if (section) section('Anki empty Extra default and field preservation');
  const { extractPromptLiteral } = require('./repo-checks');
  const prompt = extractPromptLiteral(S, 'ANKI_MASTER_PROMPT').body;
  const phaseStart = prompt.indexOf('PHASE 3.5 — EXTRA FIELD RULES (LEAN BY DEFAULT)');
  const phaseEnd = prompt.indexOf('PHASE 3.75 — EXTRA FIELD GROUNDING TIERS', phaseStart);
  if (phaseStart < 0 || phaseEnd <= phaseStart) throw new Error('Anki Extra prompt section anchors moved');
  const phase = prompt.slice(phaseStart, phaseEnd);
  t('Anki Extra instructions explicitly default to empty before describing optional support', phase.indexOf('Default Extra to empty.') >= 0 && phase.indexOf('Default Extra to empty.') < phase.indexOf('Keep supporting mechanisms'));
  t('Anki optional Extra requires explicit source support beyond Text and rejects generic filler', phase.includes('Populate it only with a useful explanation or contrast explicitly stated in the supplied source and not already conveyed by Text.') && phase.includes('Do not fill an otherwise empty Extra with generic captions, restatements, or inferred nursing explanations.'));
  const oldCues = ['Bleeding risk', 'Monitor for sedation', 'Volume loss cue', 'Escalate worsening dyspnea', 'Teach home safety', 'Recheck labs'];
  t('Anki Extra style no longer supplies the six generic cue examples', oldCues.every(cue => !phase.split('\n').includes(cue)) && !phase.includes('Examples:\n'));
  t('Anki empty Extra retains the explicit two-separator and third-field Tags contract', prompt.includes('Keep the empty Extra field between the same two pipe separators; Tags remain the third field.'));
  t('Anki substantive mechanisms still require recall and supported contrasts remain allowed', phase.includes('also give it a dedicated recall note') && phase.includes('Both sides must be supported by the supplied facts.'));

  const start = 'function ankiParseCards(raw', end = 'function AnkiStyleBadges';
  const a = S.indexOf(start), b = S.indexOf(end, a + start.length);
  if (a < 0 || b < 0 || S.indexOf(start, a + start.length) >= 0 || S.indexOf(end, b + end.length) >= 0) throw new Error('Anki Extra helper extraction anchors missing or ambiguous');
  let sequence = 0;
  const H = new Function('uid', S.slice(a, b) + ';return {ankiParseCards,ankiSourceSnapshot,ankiExportText,lintAnkiCard};')(() => 'extra-test-' + ++sequence);
  const tags = 'Nursing::LATTE::Treatments Condition::Synthetic Tier::1';
  const literal = "Literal $& $` $' $$ ${marker} & < >";
  const literalTags = "Tier::2 Tag::$& Tag::$` Tag::$' Tag::$$";
  const rows = [
    '[Synthetic] Wait interval: {{c1::7 minutes}}.||' + tags,
    '[Synthetic] Container: {{c1::cool}}.|Heat changes the marker.|' + tags,
    '[Synthetic] Recorded label: {{c1::warning}}.|Bleeding risk|' + tags,
    '[Synthetic] Printed code: {{c1::A&B < C}}. ' + literal + '|' + literal + '|' + literalTags
  ];
  const cards = H.ankiParseCards(rows.join('\n'), 1).cards;
  const kb = { conditions: [{ name: 'Synthetic', facts: [
    { id: 'fact-1', text: 'Wait for 7 minutes.', sources: [{ filename: 'synthetic|sheet <one>.pdf', location: 'p. 1' }] },
    { id: 'fact-2', text: 'Use a cool container because heat changes the marker.', sources: [{ filename: 'synthetic.pdf', location: 'p. 2' }] },
    { id: 'fact-3', text: 'The warning label reads Bleeding risk.', sources: [] },
    { id: 'fact-4', text: literal, sources: [] }
  ] }] };
  const batch = { sourceKB: kb, snapshot: H.ankiSourceSnapshot(kb) };
  cards.forEach((c, i) => { c.factIds = ['fact-' + (i + 1)]; });
  t('empty and nonempty Extra rows parse as valid notes without shifting Tags', cards.length === 4 && cards.every(c => !H.lintAnkiCard(c).length) && cards[0].extra === '' && cards[0].tags === tags);
  const spaced = H.ankiParseCards('[Synthetic] Wait: {{c1::7 minutes}}.|   |' + tags).cards[0];
  t('whitespace-only Extra normalizes to empty without consuming the Tags field', spaced.extra === '' && spaced.tags === tags && !H.lintAnkiCard(spaced).length);
  const plain = H.ankiExportText(cards, batch, true, 'all', false, false);
  t('plain export preserves the complete three-field rows including empty Extra', plain === rows.join('\n') && plain.split('\n').every(row => row.split('|').length === 3));
  const roundTrip = H.ankiParseCards(plain).cards;
  t('empty Extra survives parser/export/parser round trip beside populated Extras', roundTrip.length === 4 && roundTrip.every((c, i) => c.text === cards[i].text && c.extra === cards[i].extra && c.tags === cards[i].tags) && roundTrip[0].extra === '');
  t('existing source-supported explanations and short captions are not automatically stripped', roundTrip[1].extra === 'Heat changes the marker.' && roundTrip[2].extra === 'Bleeding risk');
  t('literal replacement characters remain literal in Text, Extra and Tags', roundTrip[3].text.endsWith(literal) && roundTrip[3].extra === literal && roundTrip[3].tags === literalTags);
  const headerExport = H.ankiExportText(cards, batch, true, 'all', true, false);
  const headerRows = headerExport.split('\n').filter(row => row.includes('|'));
  t('header export keeps the empty middle field and escapes content without changing Tags', headerRows.length === 4 && headerRows[0] === rows[0] && headerRows[3].includes('A&amp;B &lt; C') && headerRows[3].endsWith('|' + literalTags) && headerRows.every(row => row.split('|').length === 3));
  const malformed = H.ankiParseCards('[Synthetic] Wait: {{c1::7 minutes}}.|' + tags + '\n[Synthetic] Wait: {{c1::7 minutes}}.||unexpected|' + tags).cards;
  t('missing middle separators and extra fields remain invalid and unexportable', malformed.length === 2 && malformed.every(c => H.lintAnkiCard(c).length > 0) && H.ankiExportText(malformed, batch, true, 'all', false, false) === '');

  const before = JSON.stringify(cards);
  const references = H.ankiExportText(cards, batch, true, 'all', false, true).split('\n').map(row => row.split('|'));
  t('source references occupy an empty Extra without adding a fourth field or leading separator', references[0].length === 3 && references[0][1] === 'Source: synthetic / sheet <one>.pdf, p. 1' && references[0][2] === tags);
  t('source references append to existing supported Extra and mark unavailable pointers', references[1][1] === 'Heat changes the marker. — Source: synthetic.pdf, p. 2' && references[2][1] === 'Bleeding risk — Source: unavailable');
  const referencedHtml = H.ankiExportText([cards[0]], batch, true, 'all', true, true).split('\n').find(row => row.includes('|'));
  // Non-vacuous tail assertion: exercises the complete live export formatter/return.
  t('HTML source export preserves the three-field tail and leaves editable Extra untouched', referencedHtml.split('|').length === 3 && referencedHtml.includes('|Source: synthetic / sheet &lt;one&gt;.pdf, p. 1|') && JSON.stringify(cards) === before && cards[0].extra === '');
}

module.exports = { runAnkiExtraDefaultTests };
