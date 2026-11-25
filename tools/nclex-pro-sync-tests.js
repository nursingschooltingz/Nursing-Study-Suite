'use strict';

const { webcrypto } = require('crypto');

module.exports = async function runNclexProSyncTests(S, t) {
  const start = S.indexOf('const NCLEX_PRO_DEFAULT_URL=');
  const end = S.indexOf('</script>\n<script type="text/babel"', start);
  const helperSrc = S.slice(start, end);

  const ngStart = S.indexOf('function ngSplitNumbered(');
  const ngEnd = S.indexOf('// v15.17: immutable arrays retain', ngStart);
  const ngSrc = S.slice(ngStart, ngEnd);
  const ngLabelsStart = S.indexOf('function ngAnswerLabels(');
  const ngLabelsEnd = S.indexOf('\nfunction ngWorksheetQuestionIssues(', ngLabelsStart);
  const ngLabelsSrc = S.slice(ngLabelsStart, ngLabelsEnd);

  const loadEnv = (mockFetch) => {
    const lsMap = new Map();
    const mockStorage = {
      getItem: k => (lsMap.has(String(k)) ? lsMap.get(String(k)) : null),
      setItem: (k, v) => { lsMap.set(String(k), String(v)); },
      removeItem: k => { lsMap.delete(String(k)); },
    };
    const fn = new Function(
      'fetch', 'crypto', 'TextEncoder', 'TextDecoder', 'URL', 'atob', 'btoa', 'Uint8Array', 'localStorage',
      ngSrc + '\n' + ngLabelsSrc + '\n' + helperSrc + '\nreturn { NCLEX_PRO_DEFAULT_URL, nclexProNormalizeUrl, nclexProLoadUrl, nclexProSaveUrl, nclexProClearVaultKeyCache, nclexProConvertWorksheet, nclexProConvertCaseStudy, nclexProConvertCasePacket, nclexProConvertAnkiDeck, nclexProBuildExportJson, nclexProFetch, nclexProSyncToCloud, nclexProSyncFlashcardsToCloud };'
    );
    return fn(
      mockFetch || (() => { throw new Error('unexpected fetch'); }),
      webcrypto, TextEncoder, TextDecoder, URL,
      s => Buffer.from(s, 'base64').toString('binary'),
      s => Buffer.from(s, 'binary').toString('base64'),
      Uint8Array, mockStorage
    );
  };

  const env = loadEnv();
  const sampleKb = {
    metadata: { course: 'NURS 305', exam: 'Exam 2', concepts: ['Perfusion'] },
    conditions: [
      { id: 'c1', name: 'Heart Failure', concept: 'Perfusion', aliases: ['CHF'] },
      { id: 'c2', name: 'Digoxin Toxicity', concept: 'Perfusion', aliases: [] },
    ],
  };

  // 1. Worksheet conversion (MCQ + SATA + Calculation)
  const ws = {
    questions: [
      '1. A client with Heart Failure receives digoxin. Which finding requires holding the dose?\nA. Apical pulse 52/min\nB. Blood pressure 128/78 mmHg\nC. Potassium 4.2 mEq/L\nD. SpO2 97%',
      '2. Which findings indicate Digoxin Toxicity? Select all that apply.\nA. Yellow-green halos\nB. Bradycardia\nC. Nausea\nD. Hypertension',
      '3. Calculate the hourly IV infusion rate for 1000 mL over 8 hours.\nAnswer: ____ mL/hr',
    ],
    answers: [
      '1. ANSWER: A\nWhy A is correct: Hold digoxin for apical pulse < 60/min (Source: C1).\nWhy B is wrong: Normal blood pressure.\nStrategy: Check apical pulse for 1 full minute.\nTags: Tier 1 | Analyze Cues',
      '2. ANSWER: A, B, and C\nWhy A is correct: Visual halos are classic toxicity.\nWhy B is correct: Bradycardia occurs.\nWhy C is correct: GI symptoms are early cues.\nWhy D is wrong: Not typical.\nTags: Tier 1 | Recognize Cues',
      '3. ANSWER: 125 mL/hr\nWhy A is correct: 1000 / 8 = 125 mL/hr.\nTags: Tier 2 | Take Action',
    ],
  };
  const wsOut = env.nclexProConvertWorksheet(ws, [], sampleKb);
  t('nclexProConvertWorksheet parses MCQ, SATA, and Calculation items with KB concepts/conditions and rationales',
    wsOut.items.length === 3 &&
    wsOut.items[0].t === 'mcq' && wsOut.items[0].cor === 0 && wsOut.items[0].conditionNames.includes('Heart Failure') &&
    wsOut.items[1].t === 'sata' && JSON.stringify(wsOut.items[1].cor) === '[0,1,2]' &&
    wsOut.items[2].t === 'fill_blank' && wsOut.items[2].cor === '125' && wsOut.items[2].unit === 'mL/hr' &&
    wsOut.items[0].tip.includes('apical pulse'));

  // 2. Unfolding Case Study conversion (Bowtie + Matrix multi + Cloze + Trend)
  const sampleCase = {
    title: 'Acute Decompensated Heart Failure',
    condition: 'Heart Failure',
    difficulty: 'Hard',
    patient: { age: 72, sex: 'M', background: 'History of HFrEF' },
    debrief: { priorityProblem: 'Fluid volume overload & hypoxemia' },
    stages: [{
      stageNumber: 1, title: 'ED Arrival', narrative: 'Client arrives dyspneic.',
      data: [{ label: 'SpO2', value: '88% on room air' }, { label: 'BNP', value: '1420 pg/mL' }],
      questions: [
        {
          type: 'Bowtie', stem: 'Complete the bow-tie.', cjmmSkill: 'Generate Solutions',
          options: [
            { label: 'A1', group: 'actions', text: 'Apply O2' }, { label: 'A2', group: 'actions', text: 'Give IV furosemide' }, { label: 'A3', group: 'actions', text: 'Give NS bolus' },
            { label: 'C1', group: 'condition', text: 'Pulmonary edema' }, { label: 'C2', group: 'condition', text: 'DKA' },
            { label: 'P1', group: 'parameters', text: 'SpO2' }, { label: 'P2', group: 'parameters', text: 'Urine output' }, { label: 'P3', group: 'parameters', text: 'Hearing' },
          ],
          correctAnswers: ['A1', 'A2', 'C1', 'P1', 'P2'],
          rationales: [{ option: 'A1', text: 'Treats hypoxemia.' }],
        },
        {
          type: 'Matrix', stem: 'Select all anticipated findings.',
          matrix: { mode: 'multiple', columns: [{ id: 'col1', label: 'Expected' }, { id: 'col2', label: 'Unexpected' }], rows: [{ id: 'R1', text: 'Crackles' }, { id: 'R2', text: 'Flat neck veins' }] },
          correctAnswers: ['R1:col1', 'R2:col2'], rationales: [{ option: 'R1', text: 'Pulmonary congestion.' }],
        },
        {
          type: 'Cloze', stem: 'The nurse anticipates {{D1}} because of {{D2}}.',
          options: [
            { label: 'A', group: 'D1', text: 'furosemide' }, { label: 'B', group: 'D1', text: 'saline' },
            { label: 'C', group: 'D2', text: 'fluid overload' }, { label: 'D', group: 'D2', text: 'hypoglycemia' },
          ],
          correctAnswers: ['A', 'C'], rationales: [{ option: 'A', text: 'Loop diuretic.' }],
        },
        {
          type: 'Trend', stem: 'Evaluate the 2-hour response.',
          trendTable: { timepoints: ['0800', '1000'], rows: [{ label: 'SpO2', values: ['88%', '95%'] }] },
          options: [{ label: 'A', text: 'Condition improving' }, { label: 'B', text: 'Worsening' }],
          correctAnswers: ['A'], rationales: [{ option: 'A', text: 'Oxygenation improved.' }],
        },
      ],
    }],
  };
  const csOut = env.nclexProConvertCaseStudy(sampleCase, sampleKb);
  t('nclexProConvertCaseStudy converts Bowtie, Multi-Matrix, Cloze, and Trend with cumulative vitals/labs/trend exhibits',
    csOut.items.length === 4 &&
    csOut.items[0].t === 'ngn_bowtie' && JSON.stringify(csOut.items[0].cor) === '{"actions":[0,1],"condition":0,"parameters":[0,1]}' &&
    csOut.items[1].t === 'ngn_matrix' && csOut.items[1].matrix.multi === true && JSON.stringify(csOut.items[1].cor) === '[[0],[1]]' &&
    csOut.items[2].t === 'ngn_cloze' && JSON.stringify(csOut.items[2].cor) === '[0,0]' &&
    csOut.items[3].t === 'mcq' && Boolean(csOut.items[3].cd && csOut.items[3].cd.trend && csOut.items[3].cd.vitals && csOut.items[3].cd.labs));

  // 3. User-configured Vault URL & untrusted origin refusal in nclexProFetch
  const testVaultUrl = 'https://vault.example.test';
  let blockedOrigin = false, blockedHttp = false, blockedCreds = false, blockedMismatch = false, missingUrlErr = '';
  try { env.nclexProFetch('https://evil.example/api/ai-bank'); } catch (e) { blockedOrigin = /untrusted/i.test(e.message); }
  try { env.nclexProNormalizeUrl('http://evil.example'); } catch (e) { blockedHttp = /HTTPS required/i.test(e.message); }
  try { env.nclexProNormalizeUrl('https://user:pass@vault.example.test'); } catch (e) { blockedCreds = /credentials/i.test(e.message); }
  try { env.nclexProFetch('https://other.example/api/meta', {}, testVaultUrl); } catch (e) { blockedMismatch = /untrusted/i.test(e.message); }
  try { await env.nclexProSyncToCloud(csOut, { passphrase: 'SecretTestPhrase!99' }); } catch (e) { missingUrlErr = e.message; }
  t('nclexProNormalizeUrl & nclexProFetch remove hardcoded personal URL, require HTTPS/localhost, and enforce exact configured origin',
    env.NCLEX_PRO_DEFAULT_URL === '' &&
    env.nclexProNormalizeUrl('https://vault.example.test/some/path?x=1#h') === testVaultUrl &&
    env.nclexProNormalizeUrl('http://localhost:8787/api') === 'http://localhost:8787' &&
    blockedOrigin && blockedHttp && blockedCreds && blockedMismatch &&
    /Configure your NCLEX Pro Vault URL/i.test(missingUrlErr));

  // 4. End-to-end E2E-encrypted sync roundtrip + HTTP 409 Conflict merge-retry + expectedRev + redirect:'error'
  let storedPayload = null;
  let remoteRev = 1;
  let putCalls = 0;
  let sawRedirectError = false;
  let sawExpectedRev = [];
  const authSalt = Buffer.from('0123456789abcdef').toString('base64');
  const encSalt = Buffer.from('fedcba9876543210').toString('base64');
  const mockEnv = loadEnv(async (url, opts = {}) => {
    if (opts.redirect === 'error') sawRedirectError = true;
    if (url.endsWith('/api/meta')) {
      return { ok: true, status: 200, json: async () => ({ configured: true, iterations: 1000, authSalt, encSalt }) };
    }
    if (url.endsWith('/api/ai-bank') && (!opts.method || opts.method === 'GET')) {
      return { ok: true, status: 200, json: async () => storedPayload ? { rev: remoteRev, payload: storedPayload } : { empty: true, rev: 0, payload: null } };
    }
    if (url.endsWith('/api/ai-bank') && opts.method === 'PUT') {
      putCalls++;
      const b = JSON.parse(opts.body);
      sawExpectedRev.push(b.expectedRev);
      if (putCalls === 1) {
        // Simulate concurrent writer bumping rev before our first PUT lands
        remoteRev = 2;
        return { ok: false, status: 409, json: async () => ({ error: 'Conflict', currentRev: 2 }) };
      }
      storedPayload = b.payload;
      remoteRev = b.expectedRev + 1;
      return { ok: true, status: 200, json: async () => ({ ok: true, rev: remoteRev }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  });
  const syncRes = await mockEnv.nclexProSyncToCloud(csOut, { url: testVaultUrl, passphrase: 'SecretTestPhrase!99' });
  t('nclexProSyncToCloud E2E-encrypts with AES-256-GCM, sends expectedRev + redirect:error, and auto-recovers from HTTP 409 Conflict',
    syncRes.ok === true && syncRes.syncedCount === 4 && syncRes.totalAiCount === 4 &&
    putCalls === 2 && sawRedirectError &&
    sawExpectedRev[0] === 0 && sawExpectedRev[1] === 0 &&
    typeof storedPayload === 'string' && !storedPayload.includes('furosemide') && !storedPayload.includes('Pulmonary edema'));

  // 5. Fail-closed NGN & Ordering converters report skipped count instead of fabricating index-0 / identity answers
  const badCase = {
    title: 'Malformed NGN Case',
    condition: 'Heart Failure',
    stages: [{
      stageNumber: 1, title: 'S1', narrative: 'Arrives.',
      data: [],
      questions: [
        { type: 'Bowtie', stem: 'Incomplete bowtie', options: [{ label: 'A1', group: 'actions', text: 'Act1' }, { label: 'A2', group: 'actions', text: 'Act2' }, { label: 'C1', group: 'condition', text: 'Cond1' }, { label: 'P1', group: 'parameters', text: 'P1' }, { label: 'P2', group: 'parameters', text: 'P2' }], correctAnswers: ['A1', 'C1', 'P1'], rationales: [] },
        { type: 'Matrix', stem: 'Unmapped row matrix', matrix: { mode: 'single', columns: [{ id: 'c1', label: 'Yes' }, { id: 'c2', label: 'No' }], rows: [{ id: 'r1', text: 'Row 1' }, { id: 'r2', text: 'Row 2' }] }, correctAnswers: ['r1:c1'], rationales: [] },
        { type: 'Cloze', stem: 'Missing blank {{D1}} and {{D2}}', options: [{ label: 'A', group: 'D1', text: 'One' }, { label: 'B', group: 'D1', text: 'Two' }, { label: 'C', group: 'D2', text: 'Three' }, { label: 'D', group: 'D2', text: 'Four' }], correctAnswers: ['A'], rationales: [] },
        { type: 'Ordering', stem: 'Incomplete order', options: [{ label: 'A', text: 'First' }, { label: 'B', text: 'Second' }], correctAnswers: ['A'], rationales: [] },
        { type: 'Calculation', stem: 'Range calc', options: [], correctAnswers: ['120 to 130 mL/hr'], rationales: [] },
      ],
    }],
  };
  const badWs = {
    questions: ['1. Put these steps in the correct clinical order:\n____ Step alpha\n____ Step beta\n____ Step gamma'],
    answers: ['1. ANSWER:\n1. Unmatched completely unrelated answer text\nTags: Tier 1 | Take Action'],
  };
  const badCaseOut = env.nclexProConvertCaseStudy(badCase, sampleKb);
  const badWsOut = env.nclexProConvertWorksheet(badWs, [], sampleKb);
  t('nclexProConvertCaseStudy & nclexProConvertWorksheet fail closed on unmapped NGN/Ordering items, report skipped counts, and preserve range calculations',
    badCaseOut.items.length === 1 &&
    badCaseOut.items[0].t === 'fill_blank' && badCaseOut.items[0].cor === '120 to 130' && badCaseOut.items[0].unit === 'mL/hr' &&
    badCaseOut.skipped === 4 &&
    badWsOut.items.length === 0 && badWsOut.skipped === 1);

  // 5b. v23.3: nclexProConvertWorksheet grades canonical arrow-separated and sequential 1..n ordering answers in exact step order (not index 0)
  const ordWs = {
    questions: [
      '1. Sequence the pediatric physical examination:\n   ___ Begin at extremities.\n   ___ Perform otoscopic inspection.\n   ___ Perform hand hygiene.\n   ___ Build trust before touching.',
      '2. Sequence the pediatric physical examination:\n   ___ Begin at extremities.\n   ___ Perform otoscopic inspection.\n   ___ Perform hand hygiene.\n   ___ Build trust before touching.',
    ],
    answers: [
      '1. ANSWER: Perform hand hygiene. → Build trust before touching. → Begin at extremities. → Perform otoscopic inspection.\n   Why Step 1 is first: Clean hands. (Source: C1)\n   Tags: Tier 1 | Generate Solutions',
      '2. ANSWER: 1. Perform hand hygiene. -> 2. Build trust before touching. -> 3. Begin at extremities. -> 4. Perform otoscopic inspection.\n   Why Step 1 is first: Clean hands. (Source: C1)\n   Tags: Tier 1 | Generate Solutions',
    ],
  };
  const ordWsOut = env.nclexProConvertWorksheet(ordWs, [], sampleKb);
  t('v23.3: nclexProConvertWorksheet resolves arrow-separated and sequential 1..n ordering answers to exact 0-based indices',
    ordWsOut.skipped === 0 &&
    ordWsOut.items.length === 2 &&
    ordWsOut.items[0].t === 'ordering' &&
    JSON.stringify(ordWsOut.items[0].cor) === '[2,3,0,1]' &&
    ordWsOut.items[1].t === 'ordering' &&
    JSON.stringify(ordWsOut.items[1].cor) === '[2,3,0,1]');

  // 6. Passphrase scrubbing (raw + URI-encoded) on error + sessionStorage-only persistence in HTML
  const trickyPass = 'Secret Test/Phrase!99';
  const errEnv = loadEnv(async () => { throw new Error('Network leaked ' + trickyPass + ' and ' + encodeURIComponent(trickyPass)); });
  let scrubbedErr = '';
  try { await errEnv.nclexProSyncToCloud(csOut, { url: testVaultUrl, passphrase: trickyPass }); } catch (e) { scrubbedErr = e.message; }
  t('nclexProSyncToCloud scrubs raw & URI-encoded passphrase from errors and HTML keeps passphrase strictly in sessionStorage',
    !scrubbedErr.includes(trickyPass) && !scrubbedErr.includes(encodeURIComponent(trickyPass)) && scrubbedErr.includes('[redacted]') &&
    S.includes("sessionStorage.getItem('suite_nclex_pass')") &&
    !S.includes("localStorage.setItem('suite_nclex_pass'"));
};
