'use strict';

// Synthetic, offline checks against shipped helpers; no private material or API calls.
function runAnkiMappingUpdateTests({ S, t, section }) {
  section('Anki source snapshot and many-to-many mapping');
  const start = 'function parseKBCoverage(', end = '// v15.17: only equivalent valid Text, Extra, effective tags and keep choices may merge sources.';
  const a = S.indexOf(start), b = S.indexOf(end, a + start.length);
  if (a < 0 || b < 0 || S.indexOf(start, a + start.length) >= 0 || S.indexOf(end, b + end.length) >= 0) throw new Error('Anki mapping helper extraction anchors must occur exactly once');
  const H = new Function(S.slice(a, b) + ';return {parseKBCoverage,ankiSourceSnapshot,ankiChunkFactIds,attachCoverageToCards};')();
  const kb = { conditions: [{ name: 'Synthetic condition', aliases: ['SC', 'Test condition'], facts: [
    { id: 'fact-1', text: 'Target one and target two.', subtype: 'monitoring', latteBucket: 'T', tier: 1, sourceQuote: 'Quote context.', sources: [{ filename: 'synthetic.pdf', location: 'p. 1' }] },
    { id: 'fact-2', text: 'Related source context.', latteBucket: 'T', tier: 1 },
    { id: 'fact-3', text: 'A separate target.', latteBucket: 'E', tier: 2 },
    { id: 'fact-4', text: 'Other chunk.', latteBucket: 'L', tier: 2 }
  ] }] };
  const snapshot = H.ankiSourceSnapshot(kb), chunks = [['fact-1', 'fact-2', 'fact-3'], ['fact-4']];
  t('snapshot captures supplied aliases and subtype', snapshot.byId['fact-1'].aliases.join('|') === 'SC|Test condition' && snapshot.byId['fact-1'].subtype === 'monitoring');
  t('snapshot freezes aliases as well as fact and source-pointer objects', Object.isFrozen(snapshot) && Object.isFrozen(snapshot.facts) && Object.isFrozen(snapshot.byId) && Object.isFrozen(snapshot.byId['fact-1']) && Object.isFrozen(snapshot.byId['fact-1'].aliases) && Object.isFrozen(snapshot.byId['fact-1'].sources[0]));
  kb.conditions[0].aliases[0] = 'mutated'; kb.conditions[0].facts[0].subtype = 'changed'; kb.conditions[0].facts[0].sources[0].location = 'changed';
  t('captured aliases, subtype and pointers survive later KB mutations', snapshot.byId['fact-1'].aliases[0] === 'SC' && snapshot.byId['fact-1'].subtype === 'monitoring' && snapshot.byId['fact-1'].sources[0].location === 'p. 1');
  const sparse = H.ankiSourceSnapshot({ conditions: [{ facts: [{ id: 'FACT-8', text: 'Sparse source.' }] }] });
  t('old KB facts without aliases or subtype get safe snapshot defaults', sparse.byId['fact-8'].aliases.length === 0 && sparse.byId['fact-8'].subtype === '' && sparse.byId['fact-8'].sources.length === 0);
  t('chunk IDs retain stable order and discard repeated packet labels', H.ankiChunkFactIds('FACT fact-2 | first\nFACT FACT-1 | other\nFACT fact-2 | repeated').join(',') === 'fact-2,fact-1');
  const refs = H.parseKBCoverage('fact-1 -> line #1\nfact-1 -> line #2\nfact-2 -> line #2', 2);
  t('one edge per line supports one-to-many and many-to-one with caller chunk identity', refs.length === 3 && refs.every(x => x.chunk === 2) && refs.map(x => x.id + ':' + x.line).join(',') === 'fact-1:1,fact-1:2,fact-2:2');
  t('multi-destination ledger lines remain invalid instead of choosing one edge', Number.isNaN(H.parseKBCoverage('fact-1 -> line #1, #2')[0].line));

  const makeCards = () => [
    { id: 'a', chunk: 1, sourceLine: 1, keep: true, factIds: ['old'], mappingIssues: ['old'] },
    { id: 'b', chunk: 1, sourceLine: 2, keep: false, factIds: ['old'], mappingIssues: ['old'] },
    { id: 'c', chunk: 1, sourceLine: 3, keep: true, factIds: ['old'], mappingIssues: ['old'] },
    { id: 'd', chunk: 2, sourceLine: 1, keep: true, factIds: ['old'], mappingIssues: ['old'] }
  ];
  const ledger = (text, chunk = 1) => ({ text, chunk });
  const has = (issues, code, id) => issues.some(x => x.code === code && (!id || x.id === id));
  const count = (issues, code) => issues.filter(x => x.code === code).length;
  const clean = [ledger('fact-1 -> line #1\nfact-1 -> line #2\nfact-2 -> line #2\nfact-3 -> line #3'), ledger('fact-4 -> line #1', 2)];
  const cards = makeCards(), cleanIssues = H.attachCoverageToCards(cards, clean, snapshot, chunks);
  t('valid many-to-many associations produce no mapping diagnostics', cleanIssues.length === 0);
  t('one fact can support several notes without a repeated-ID warning', cards[0].factIds.join(',') === 'fact-1' && cards[1].factIds.includes('fact-1'));
  t('one note retains every distinct supporting fact', cards[1].factIds.join(',') === 'fact-1,fact-2');
  t('same local note number stays isolated by chunk', cards[0].factIds.join(',') === 'fact-1' && cards[3].factIds.join(',') === 'fact-4');
  t('attachment clears prior links and diagnostics without changing manual selection', cards.every(x => !x.factIds.includes('old') && x.mappingIssues.length === 0) && cards.map(x => x.keep).join(',') === 'true,false,true,true');

  const duplicated = makeCards(), dupIssues = H.attachCoverageToCards(duplicated, [ledger(clean[0].text + '\nfact-1 -> line #1\nfact-1 -> line #2'), clean[1]], snapshot, chunks);
  t('duplicate edges are diagnosed without conflating distinct destinations', count(dupIssues, 'duplicate-edge') === 2);
  t('duplicate valid edges keep one source link and preserve manual exclusions', duplicated[0].factIds.join(',') === 'fact-1' && duplicated[1].factIds.join(',') === 'fact-1,fact-2' && duplicated[1].keep === false);
  t('duplicate diagnostics attach only to affected note edges', duplicated[0].mappingIssues[0].code === 'duplicate-edge' && duplicated[1].mappingIssues[0].code === 'duplicate-edge' && duplicated[2].mappingIssues.length === 0);
  t('duplicate valid edges do not become unmapped notes or missing IDs', !has(dupIssues, 'no-mapping') && !has(dupIssues, 'missing-id'));

  for (const zeroFirst of [true, false]) {
    const contradictory = makeCards();
    const text = zeroFirst ? 'fact-1 -> line #0\n' + clean[0].text : clean[0].text + '\nfact-1 -> line #0';
    const issues = H.attachCoverageToCards(contradictory, [ledger(text), clean[1]], snapshot, chunks);
    t('line #0 conflict is diagnosed once when zero comes ' + (zeroFirst ? 'first' : 'last'), count(issues, 'conflicting-omission') === 1 && has(issues, 'omitted', 'fact-1'));
    t('line #0 never erases valid support when zero comes ' + (zeroFirst ? 'first' : 'last'), contradictory[0].factIds.includes('fact-1') && contradictory[1].factIds.includes('fact-1') && contradictory[0].mappingIssues.some(x => x.code === 'conflicting-omission') && contradictory[1].mappingIssues.some(x => x.code === 'conflicting-omission'));
  }
  const omitted = makeCards(), omissionIssues = H.attachCoverageToCards(omitted, [ledger('fact-1 -> line #1\nfact-2 -> line #2\nfact-3 -> line #0\nfact-3 -> line #0'), clean[1]], snapshot, chunks);
  t('repeated zero edges report duplication and one explicit omission', count(omissionIssues, 'omitted') === 1 && count(omissionIssues, 'duplicate-edge') === 1 && !has(omissionIssues, 'conflicting-omission') && !has(omissionIssues, 'missing-id', 'fact-3'));
  t('an omitted fact cannot acquire the next note accidentally', omitted[2].factIds.length === 0 && omissionIssues.some(x => x.code === 'no-mapping' && x.noteId === 'c'));

  const bad = makeCards(), badIssues = H.attachCoverageToCards(bad, [ledger('fact-1 -> line #1\nfact-1 -> line #99\nfact-2 -> nowhere\nfact-999 -> line #1\nfact-4 -> line #2'), ledger('fact-3 -> line #1', 2)], snapshot, chunks);
  t('unknown and out-of-chunk IDs never become source support', has(badIssues, 'unknown-id', 'fact-999') && count(badIssues, 'out-of-chunk') === 2 && bad[0].factIds.join(',') === 'fact-1' && bad[1].factIds.length === 0 && bad[3].factIds.length === 0);
  t('invalid destinations are diagnostic while another valid edge stays attached', count(badIssues, 'invalid-destination') === 2 && bad[0].factIds.includes('fact-1'));
  t('an ID mentioned only in the wrong chunk is still missing from its supplied chunk', has(badIssues, 'missing-id', 'fact-3') && has(badIssues, 'missing-id', 'fact-4'));
  t('malformed destinations count as declared IDs and keep their specific diagnostic', !has(badIssues, 'missing-id', 'fact-2') && has(badIssues, 'invalid-destination', 'fact-2'));
  const missingIssues = H.attachCoverageToCards(makeCards(), [], snapshot, [['fact-1', 'fact-1', 'fact-2'], ['fact-4']]);
  t('absent ledgers report each supplied ID once per chunk', count(missingIssues, 'missing-id') === 3);
  const multiChunk = makeCards(), multiIssues = H.attachCoverageToCards(multiChunk, [ledger('fact-1 -> line #1'), ledger('fact-1 -> line #1', 2)], snapshot, [['fact-1'], ['fact-1']]);
  t('the same fact and local line in different supplied chunks are distinct edges', !has(multiIssues, 'duplicate-edge') && !has(multiIssues, 'missing-id') && multiChunk[0].factIds[0] === 'fact-1' && multiChunk[3].factIds[0] === 'fact-1');
  const preserved = makeCards(); H.attachCoverageToCards(preserved, [], snapshot, chunks);
  t('mapping warnings never delete or deselect received notes', preserved.length === 4 && preserved.map(x => x.keep).join(',') === 'true,false,true,true');
  // Non-vacuous tail assertion: exercises the final no-mapping/return path of the extracted span.
  t('extracted mapping-helper tail returns diagnostics for every unlinked note', count(missingIssues, 'no-mapping') === 4 && missingIssues[missingIssues.length - 1].noteId === 'd');
}

module.exports = { runAnkiMappingUpdateTests };
