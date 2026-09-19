'use strict';

// Regression contracts for the twelve defects found while reviewing the shipped v16.8 build.
// Every check extracts a live function or handler from the suite HTML; none reimplements it.
// Synthetic inputs only: no course material, no live Gemini call.
module.exports = async function productionReviewFollowupTests(S, t) {
  const span = (start, end) => {
    const a = S.indexOf(start), b = S.indexOf(end, a + start.length);
    if (a < 0 || b < 0 || S.indexOf(start, a + 1) >= 0) throw Error('Review-followup anchor missing or ambiguous: ' + start);
    return S.slice(a, b);
  };
  const DQ = String.fromCharCode(34);

  // ── 1. Case grounding: "per" divides units only before a real denominator ──
  const C = new Function(span('const CASE_CLINICAL_TOKEN_RE=', '// Every distinct fact id referenced anywhere in the case') +
    ';return {caseParseThreshold,caseAuditTextValues,validateCaseStudy,caseNumericTokens,caseNumericText};')();
  const errorsFor = (value, support) => {
    const issues = [];
    C.caseAuditTextValues(value, ['f1'], new Map([['f1', { fact: { text: support, sourceQuote: '' } }]]), 'Synthetic', issues, 'instantiated');
    return issues.filter(x => x.sev === 'error').length;
  };
  const PROSE_FACT = 'Notify the provider if the respiratory rate falls below 12 breaths per minute per shift.';
  t('case: a per-minute bound followed by prose still grounds its instantiated value', errorsFor('8 breaths/min', PROSE_FACT) === 0);
  t('case: that bound parses with its complete unit', JSON.stringify(C.caseParseThreshold(PROSE_FACT)) === JSON.stringify({ op: '<', value: 12, unit: '/min' }));
  t('case: "per shift" is not folded into the unit', !C.caseNumericText(PROSE_FACT).includes('/shift'));
  for (const suffix of ['/min/kg', '/min/banana', '/min / kg', '/min·kg'])
    t('case: a per-minute prefix cannot be borrowed from ' + suffix, C.caseParseThreshold('Below 12 ' + suffix + '.') === null && errorsFor('8 breaths/min', 'Below 12 ' + suffix + '.') >= 1);
  for (const suffix of ['mg/(kg min)', 'mg²', 'mg·kg', 'mg * kg', 'mg^', 'mg%', 'mg5', 'mg/µL'])
    t('case: an unsupported compound still cannot donate a plain prefix: ' + suffix, errorsFor('4 mg', 'Below 5 ' + suffix + '.') >= 1);
  t('case: plain and compound supported bounds remain accepted',
    errorsFor('4 mg', 'Below 5 mg.') === 0 && errorsFor('4 mcg/kg/min', 'Below 5 mcg / kg / min.') === 0 &&
    errorsFor('50 mg/dose', 'Give at most 60 mg per dose.') === 0 && errorsFor('40 mL/hr', 'Maintain output above 30 mL per hour.') === 0);
  t('case: the dimensionless pH range is unchanged', JSON.stringify(C.caseParseThreshold('Normal pH 7.35-7.45.')) === JSON.stringify({ op: 'range', lo: 7.35, hi: 7.45, unit: '' }));
  t('case: an arithmetic factor after a complete unit is still not a compound unit', C.caseParseThreshold('Below 5 mg × 2 doses.').unit === 'mg');
  const deteriorated = [];
  C.caseAuditTextValues('20 breaths/min', ['f1'], new Map([['f1', { fact: { text: PROSE_FACT, sourceQuote: '' } }]]), 'Synthetic', deteriorated, 'instantiated');
  t('case: a value outside the recovered bound stays warning-only', deteriorated.some(x => x.sev === 'warn') && !deteriorated.some(x => x.sev === 'error'));

  // ── 2. Case validation: a present-but-blank correct answer ──
  const calcCase = answers => ({
    condition: 'Synthetic',
    stages: [{
      stageNumber: 1, data: [], questions: [{
        id: 'q1', type: 'Calculation', stem: 'Calculate the hourly rate.',
        options: [{ label: 'Answer', text: 'Answer' }], correctAnswers: answers,
        rationales: [{ option: 'Answer', text: 'Synthetic rationale.', factIds: ['f1'] }], factIds: ['f1'],
      }],
    }],
  });
  const calcIndex = new Map([['f1', { fact: { text: 'Infuse 1000 mL over 8 hr.', sourceQuote: '' } }]]);
  const calcErrors = answers => C.validateCaseStudy(calcCase(answers), calcIndex, new Set(['f1']), 'Synthetic').filter(x => x.sev === 'error');
  t('case: a blank calculation answer is rejected', calcErrors(['']).some(x => /correct answer is blank/.test(x.msg)));
  t('case: a whitespace-only calculation answer is rejected', calcErrors([' ']).some(x => /correct answer is blank/.test(x.msg)));
  t('case: a real computed value and the placeholder-option form still pass', calcErrors(['5 mg']).length === 0 && calcErrors(['7000']).length === 0);
  t('case: a missing answer array keeps its original error', calcErrors([]).some(x => /no correct answer/.test(x.msg)));

  // ── 3/4. NCLEX option marks: Fahrenheit prose cannot break or extend a choice run ──
  const N = new Function(span('function nclexKey(', 'const NCLEX_OPTION_GAP=') +
    span('const NCLEX_OPTION_GAP=', '// Page range picker sub-component') +
    ';return {nclexSplitStemOptions,nclexSplitByQNum,nclexPairQA,nclexAccumulate,nclexConditions,nclexPairsToText};')();
  const labels = text => N.nclexSplitStemOptions(text).options.map(o => o.label).join('');
  const FAHR_FIRST = 'Which value is abnormal?\nA. Temperature 101.2 F. and rising\nB. Heart rate 92\nC. Respirations 16\nD. BP 118/70';
  const FAHR_LAST = 'Which finding requires action?\nA. HR 92\nB. BP 120/76\nC. RR 20\nD. SpO2 95%\nE. Temperature 100.4 F. Notify the provider.';
  t('nclex: a Fahrenheit reading inside the first option does not erase the choice list', labels(FAHR_FIRST) === 'ABCD');
  t('nclex: a Fahrenheit reading inside the last option does not fabricate a sixth choice', labels(FAHR_LAST) === 'ABCDE');
  t('nclex: that last option keeps its unit verbatim', N.nclexSplitStemOptions(FAHR_LAST).options[4].text === 'Temperature 100.4 F. Notify the provider.');
  t('nclex: fully indented options with a Fahrenheit reading still parse',
    labels('Which value is abnormal?\n   A. Temp 98.6 F. at rest\n   B. Pulse 78\n   C. Respirations 16\n   D. BP 118/70') === 'ABCD');
  t('nclex: a mixed-indentation choice list is unchanged', labels('Which finding?\nA. One\n  B. Two\nC. Three\nD. Four') === 'ABCD');
  t('nclex: numbered stem clues do not outrank inline lettered choices',
    labels('Vitals: 1. HR 110\n2. BP 88/50\n3. RR 24\nWhich action is first? A. Give fluids B. Call the provider C. Reassess D. Document') === 'ABCD');
  t('nclex: six lettered options remain distinct in both cases',
    labels('Select all that apply.\nA. C1\nB. C2\nC. C3\nD. C4\nE. C5\nF. C6') === 'ABCDEF' &&
    labels('Select all that apply.\na. C1\nb. C2\nc. C3\nd. C4\ne. C5\nf. C6') === 'abcdef');
  t('nclex: inline, one-line and numeric choice layouts are unchanged',
    labels('Which action is first? (a) Assess (b) Call (c) Document (d) Reassess') === 'abcd' &&
    labels('Which is correct? A. First B. Second C. Third D. Fourth') === 'ABCD' &&
    labels('Which dose?\n1. 5 mg\n2. 10 mg\n3. 15 mg\n4. 20 mg') === '1234' &&
    labels('Vitals: 1. HR 110 2. BP 88/50 3. RR 24\nWhich action is first?\nA. Give fluids\nB. Call the provider\nC. Reassess\nD. Document') === 'ABCD');

  // ── 5. Split extraction: explicit headings beat numbered choices inside them ──
  const numberedChoices = n => 'Question ' + n + ': Which action is first?\n1. First choice\n2. Second choice\n3. Third choice\n4. Fourth choice\n';
  const headedText = [1, 2, 3].map(numberedChoices).join('\n');
  t('nclex: explicit question headings survive numbered choices inside their blocks',
    JSON.stringify(Object.keys(N.nclexSplitByQNum(headedText))) === JSON.stringify(['1', '2', '3']));
  const paired = N.nclexPairQA(headedText, 'Question 1: A\nRationale one.\n\nQuestion 2: B\nRationale two.\n\nQuestion 3: C\nRationale three.');
  t('nclex: the recovered questions pair with their own answers',
    paired.length === 3 && paired.every(p => p.matched) && paired[0].question.startsWith('Question 1:'));
  const davis = [1, 2, 3].map(n => n + '. Which action is first?\nA. One\nB. Two\nC. Three\nD. Four\n').join('\n');
  t('nclex: bare question numbering with lettered choices is unchanged',
    JSON.stringify(Object.keys(N.nclexSplitByQNum(davis))) === JSON.stringify(['1', '2', '3']));
  const mostlyBare = Array.from({ length: 40 }, (_, i) => (i < 3 ? 'Question ' + (i + 1) + ': Stem.\n' : '') + (i + 1) + '. Stem ' + (i + 1) + '\nA. One\nB. Two\nC. Three\n').join('\n');
  t('nclex: a few labelled questions cannot discard a larger bare-numbered set',
    Object.keys(N.nclexSplitByQNum(mostlyBare)).length === 40);
  const allHeaded = Array.from({ length: 12 }, (_, i) => numberedChoices(i + 1)).join('\n');
  t('nclex: every labelled question is kept when all of them carry choices',
    Object.keys(N.nclexSplitByQNum(allHeaded)).length === 12);

  // ── 6. Split extraction: equal-count AI recovery is merged, not discarded ──
  const pairSource = span('        const aiResult=[...byNum.values()]', '      }catch(e){if(e.name===\'AbortError\')throw e;addLog(');
  const mergePairs = (pairs, recovered) => new Function('byNum', 'pairs', 'addLog', pairSource + ';return pairs;')(
    new Map(recovered.map(r => [r.number, r])), pairs, () => { });
  const regexPairs = [1, 2, 3].map(n => ({ number: n, question: 'q' + n, answer: '', matched: false }));
  const sameCount = mergePairs(regexPairs.map(p => ({ ...p })), [1, 2, 3].map(n => ({ number: n, question: 'q' + n, answer: 'Answer ' + n + '.', matched: true })));
  t('nclex: equal-count answer recovery reaches the formatting stage',
    sameCount.length === 3 && sameCount.every(p => p.matched) && N.nclexPairsToText(sameCount).includes('Answer #1'));
  t('nclex: recovered answers keep the questions the regex already found', sameCount.every((p, i) => p.question === 'q' + (i + 1)));
  const alreadyMatched = mergePairs([{ number: 1, question: 'q1', answer: 'kept', matched: true }], [{ number: 1, question: 'q1', answer: 'replacement', matched: true }]);
  t('nclex: an already-matched pair is not overwritten by recovery', alreadyMatched[0].answer === 'kept');
  const moreQuestions = mergePairs(regexPairs.map(p => ({ ...p })), [1, 2, 3, 4].map(n => ({ number: n, question: 'q' + n, answer: 'a', matched: true })));
  t('nclex: a larger AI result still replaces the pairing outright', moreQuestions.length === 4);

  // ── 7. NCLEX accumulation: scalar condition metadata is normalized once ──
  t('nclex: a scalar condition string becomes a one-element array', JSON.stringify(N.nclexConditions('Synthetic condition')) === JSON.stringify(['Synthetic condition']));
  t('nclex: an array of conditions is preserved and trimmed', JSON.stringify(N.nclexConditions([' A ', 'B', '', 7])) === JSON.stringify(['A', 'B']));
  t('nclex: absent or null metadata normalizes to an empty array',
    JSON.stringify(N.nclexConditions(undefined)) === '[]' && JSON.stringify(N.nclexConditions(null)) === '[]' && JSON.stringify(N.nclexConditions(7)) === '[]');
  const admitted = N.nclexAccumulate(new Set(), [], [{ question: 'Which action?\nA. One\nB. Two\nC. Three', diseases_conditions: 'Synthetic condition' }])[0];
  let renderOk = true;
  for (const read of [q => q.diseases_conditions.map(d => d), q => q.diseases_conditions.some(d => d.toLowerCase().includes('syn')), q => q.diseases_conditions.join(', ')])
    try { read(admitted); } catch (e) { renderOk = false; }
  t('nclex: the card render, disease filter and Markdown export all survive scalar metadata', renderOk);
  t('nclex: accumulation still deduplicates and preserves the question text',
    N.nclexAccumulate(new Set(), [], [{ question: 'Same' }, { question: 'Same' }]).length === 1);

  // ── 8. Anki export: CSV-significant fields are quoted ──
  const A = new Function('ankiSelection', 'ankiSourcePointers',
    span('function ankiExportText(', '// v16.0: actual review fronts can reveal') + ';return {ankiExportText};')(cards => ({ kept: cards }), () => []);
  const csvParse = (text, delim) => {
    const rows = []; let row = [], field = '', quoted = false, i = 0;
    while (i < text.length) {
      const ch = text[i];
      if (quoted) {
        if (ch === DQ) { if (text[i + 1] === DQ) { field += DQ; i += 2; continue; } quoted = false; i++; continue; }
        field += ch; i++; continue;
      }
      if (ch === DQ && field === '') { quoted = true; i++; continue; }
      if (ch === delim) { row.push(field); field = ''; i++; continue; }
      if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
      field += ch; i++;
    }
    row.push(field); rows.push(row); return rows;
  };
  const anote = (text, extra = '', tags = 'Tier::1') => ({ text, extra, tags, keep: true });
  const quoteDeck = [
    anote(DQ + '{{c1::Hypoxia}}' + DQ + ' is the priority'),
    anote('[Shock] sign: {{c1::tachycardia}}', 'He said ' + DQ + 'give fluids' + DQ + ' first'),
    anote('#{{c1::Hashtag}} leads the field'),
  ];
  const quoted = csvParse(A.ankiExportText(quoteDeck, null, true, 'all', false, false), '|');
  t('anki: every note stays one record with three fields', quoted.length === 3 && quoted.every(r => r.length === 3));
  t('anki: literal quotes survive a CSV round-trip', quoted[0][0] === quoteDeck[0].text && quoted[1][1] === quoteDeck[1].extra);
  t('anki: a leading hash is delivered as field content', quoted[2][0] === quoteDeck[2].text);
  const unbalanced = [anote(DQ + '[Shock] sign: {{c1::tachycardia}}'), anote('[MI] sign: {{c1::chest pain}}'), anote('[CHF] sign: {{c1::dyspnea}}')];
  const unbalancedRows = csvParse(A.ankiExportText(unbalanced, null, true, 'all', false, false), '|');
  t('anki: an unmatched quote cannot swallow the following notes',
    unbalancedRows.length === 3 && unbalancedRows.every(r => r.length === 3) && unbalancedRows[0][0] === unbalanced[0].text);
  const clean = anote('[Shock] sign: {{c1::tachycardia}}', 'Context', 'Tier::1 Nursing::LATTE::Look');
  t('anki: a note with no CSV-significant character exports exactly as before',
    A.ankiExportText([clean], null, true, 'all', false, false) === clean.text + '|' + clean.extra + '|' + clean.tags);
  t('anki: the header directives are still emitted unquoted',
    A.ankiExportText([clean], null, true, 'all', true, false).startsWith('#separator:Pipe\n#html:true\n#notetype:Cloze\n#tags column:3\n'));

  // ── 9. Worksheet parsing: a wrapped option keeps its qualifier ──
  const NG = new Function(span('function ngParseItem(', 'function ngParseKeyItem(') + ';return {ngParseItem};')();
  const AP = new Function(span('function itemAuditPayload(', 'function caseAuditPayload(') + ';return {itemAuditPayload};')();
  const wrapped = NG.ngParseItem({ num: 1, text: '1. Which action is first?\nA. Select the first marker\n   only after the second marker is present.\nB. Call the provider\nC. Document the finding\nD. Reassess in one hour' });
  const oneLine = NG.ngParseItem({ num: 1, text: '1. Which action is first?\nA. Select the first marker only after the second marker is present.\nB. Call the provider\nC. Document the finding\nD. Reassess in one hour' });
  t('nclexgen: a wrapped option parses to the same text as its one-line equivalent',
    wrapped.options.length === 4 && JSON.stringify(wrapped.options) === JSON.stringify(oneLine.options));
  t('nclexgen: the audit payload carries the complete option the worksheet shows',
    AP.itemAuditPayload('', { stem: wrapped.stem, options: wrapped.options, correctAnswers: ['A'] }).includes('only after the second marker is present.'));
  t('nclexgen: the stem and type are unaffected', wrapped.type === 'MCQ' && wrapped.stem === 'Which action is first?');
  const wrappedStep = NG.ngParseItem({ num: 2, text: '2. Place the steps in order.\n__ Don the gown\n   before entering the room.\n__ Don the gloves\n__ Enter the room' });
  t('nclexgen: a wrapped ordering step also keeps its qualifier',
    wrappedStep.type === 'Ordering' && wrappedStep.steps[0].text === 'Don the gown before entering the room.');
  const calc = NG.ngParseItem({ num: 3, text: '3. Calculate the hourly rate.\nAnswer: ____\n   (round to the nearest whole number)' });
  t('nclexgen: a calculation item absorbs no trailing prose', calc.type === 'Calculation' && !calc.options.length && !calc.steps.length);
  const trailing = NG.ngParseItem({ num: 4, text: '4. Which action is first?\nA. One\nB. Two\nC. Three\nD. Four\nSelect all that apply.' });
  t('nclexgen: a flush-left trailing line is still not appended to an option', trailing.options[3].text === 'Four');

  // ── 10/11. Card transcription: malformed sections and cancelled comparisons ──
  const admit = new Function('extractJSON', 'getExt', 'CARD_MIME', 'cardFilePayload', 'geminiRequest', 'CARD_TRANSCRIBE_PROMPT',
    span('async function cardTranscribe(', '// Pairing key. A BACK face does not carry the condition name') + ';return cardTranscribe;')(
      raw => raw, () => 'png', { png: 'image/png' }, async () => ({ mimeType: 'image/png', data: '' }), async () => admitPayload, '');
  let admitPayload = null;
  const tryAdmit = async payload => { admitPayload = payload; try { return { ok: true, value: await admit('k', 'm', 'low', { name: 'c.png' }, {}) }; } catch (e) { return { ok: false, message: e.message }; } };
  const nullSection = await tryAdmit({ title: 'Synthetic', sections: [null] });
  t('cards: a null section is refused instead of throwing later', !nullSection.ok && /sections are malformed/.test(nullSection.message));
  const stringBullets = await tryAdmit({ title: 'Synthetic', sections: [{ heading: 'Assessment', bullets: 'Observe response.' }] });
  t('cards: string bullets are refused instead of becoming one bullet per character', !stringBullets.ok && /sections are malformed/.test(stringBullets.message));
  t('cards: an ordinary transcript, an omitted bullet list and a front-only card are still admitted',
    (await tryAdmit({ title: 'Synthetic', sections: [{ heading: 'Assessment', bullets: ['Observe response.'] }] })).ok &&
    (await tryAdmit({ title: 'Synthetic', sections: [{ heading: 'Assessment' }] })).ok &&
    (await tryAdmit({ title: 'Synthetic', sections: [] })).ok);
  t('cards: a non-array sections field keeps its original message', !(await tryAdmit({ title: 'Synthetic', sections: 'none' })).ok);

  const CARD = new Function('cardIsImage', 'cardFileId',
    span('function createOperationSlot(){', 'function KnowledgeBaseBuilder(){') +
    span('function cardKey(', '// Compact, inspectable fact rows') +
    ';return {cardMergeFaces,cardChunkBlockers,cardIdentityConflict,cardKey,cardPublishTranscript};')(() => true, f => f.name);
  const file = { name: 'synthetic-card.png' };
  const goodTranscript = { face: 'front', title: 'Synthetic', category: 'Synthetic', cardNumber: '1', sections: [], numerics: [], overallLegibility: 'clean' };
  const previous = { file: file.name, transcript: goodTranscript, runs: [{ kind: 'earlier run' }], agreement: null, comparisonIncomplete: false };
  const transcribeSource = span('  const transcribeCards=async()=>{', '  // v15.14: tag each transcript');
  const runTranscribe = async impl => {
    const state = { transcripts: { [file.name]: previous }, error: '', txAbortRef: { current: null } };
    const fn = new Function('files', 'cardIsImage', 'cfg', 'txAbortRef', 'setTxBusy', 'setTxErr', 'setTxReviewed', 'addLog', 'txRuns',
      'cardTranscribe', 'cardFileId', 'cardCompareRuns', 'cardKey', 'setTranscripts', 'cardPublishTranscript', 'currentFiles',
      transcribeSource + ';return transcribeCards;')(
        [file], () => true, { apiKey: 'synthetic', forTool: () => ({ model: 'mock', level: 'low' }) },
        state.txAbortRef, () => { }, v => { state.error = v; }, () => { }, () => { }, 2,
        (...args) => impl(state, ...args), f => f.name, () => ({ runs: 2, numericsUnstable: [], bulletsUnstable: [], facesDisagree: false, idsDisagree: false }),
        CARD.cardKey, fn2 => { state.transcripts = fn2(state.transcripts); }, CARD.cardPublishTranscript, { current: [file] });
    await fn();
    return state;
  };
  let calls = 0;
  const cancelled = await runTranscribe(async state => {
    calls++;
    if (calls === 1) return goodTranscript;
    state.txAbortRef.current.abort();
    throw new (typeof DOMException === 'function' ? DOMException : Error)('Aborted', 'AbortError');
  });
  const afterCancel = cancelled.transcripts[file.name];
  t('cards: a cancelled comparison publishes the attempt as incomplete', calls === 2 && afterCancel.comparisonIncomplete === true && afterCancel.requestedRuns === 2);
  t('cards: a cancelled comparison retains the earlier transcript for inspection', afterCancel.retainedTranscript === previous);
  t('cards: a cancelled comparison blocks the build gate', CARD.cardIdentityConflict(afterCancel) &&
    CARD.cardChunkBlockers(CARD.cardMergeFaces([afterCancel.transcript])[0], 1).length > 0);
  calls = 0;
  const completed = await runTranscribe(async () => { calls++; return goodTranscript; });
  t('cards: a completed comparison still clears the incomplete state',
    calls === 2 && completed.transcripts[file.name].comparisonIncomplete === false && !CARD.cardIdentityConflict(completed.transcripts[file.name]));

  // ── 12. Priority: an early return clears every notice input ──
  const clearSource = span('    const clearNotices=()=>{', '    if(!(K.knowledgeBase.conditions||[]).length){');
  const cleared = [];
  new Function('setResultSource', 'setHarvestState', 'setMeta', clearSource + ';clearNotices();')(
    ...['source', 'harvest', 'meta'].map(kind => value => cleared.push([kind, value])));
  t('priority: clearing notices resets source, harvest and truncation state',
    JSON.stringify(cleared) === JSON.stringify([['source', null], ['harvest', null], ['meta', null]]));
  t('priority: both early returns clear the notices before reporting the error',
    /clearNotices\(\);setError\('Build the LATTE Knowledge Base first\.'\)/.test(S) &&
    /clearNotices\(\);setError\('The current Knowledge Base filters contain no facts/.test(S));
  const notice = new Function(span('function paResultNotice(', 'function PriorityAnalyzer(') + ';return paResultNotice;')();
  t('priority: a cleared notice renders nothing while a real one still renders',
    notice({ source: null, activeKB: {}, harvest: null, meta: null, error: '', busy: false }) === '' &&
    notice({ source: null, activeKB: {}, harvest: { total: 3, successful: 2, failed: [{ chunk: 3 }], truncated: [] }, meta: null, error: '', busy: false }).includes('Missing source chunks: 3'));
};
