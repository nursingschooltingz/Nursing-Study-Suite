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
  const ngLabelsEnd = S.indexOf('\nfunction ', S.indexOf('function ngRationaleText(') + 10);
  const ngLabelsSrc = S.slice(ngLabelsStart, ngLabelsEnd);

  const loadEnv = (mockFetch) => {
    const fn = new Function(
      'fetch', 'crypto', 'TextEncoder', 'TextDecoder', 'URL', 'atob', 'btoa', 'Uint8Array',
      ngSrc + '\n' + ngLabelsSrc + '\n' + helperSrc + '\nreturn { NCLEX_PRO_DEFAULT_URL, nclexProConvertWorksheet, nclexProConvertCaseStudy, nclexProConvertCasePacket, nclexProBuildExportJson, nclexProFetch, nclexProSyncToCloud };'
    );
    return fn(
      mockFetch || (() => { throw new Error('unexpected fetch'); }),
      webcrypto, TextEncoder, TextDecoder, URL,
      s => Buffer.from(s, 'base64').toString('binary'),
      s => Buffer.from(s, 'binary').toString('base64'),
      Uint8Array
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

  // 3. Untrusted origin refusal in nclexProFetch
  let blockedOrigin = false;
  try { env.nclexProFetch('https://evil.example/api/ai-bank'); } catch (e) { blockedOrigin = /untrusted/i.test(e.message); }
  t('nclexProFetch blocks untrusted origins outside NCLEX_PRO_ALLOWED_ORIGINS', blockedOrigin);

  // 4. End-to-end E2E-encrypted sync roundtrip + secret redaction on error
  let storedPayload = null;
  const authSalt = Buffer.from('0123456789abcdef').toString('base64');
  const encSalt = Buffer.from('fedcba9876543210').toString('base64');
  const mockEnv = loadEnv(async (url, opts = {}) => {
    if (url.endsWith('/api/meta')) {
      return { ok: true, status: 200, json: async () => ({ configured: true, iterations: 1000, authSalt, encSalt }) };
    }
    if (url.endsWith('/api/ai-bank') && (!opts.method || opts.method === 'GET')) {
      return { ok: true, status: 200, json: async () => storedPayload ? { rev: 1, payload: storedPayload } : { empty: true, rev: 0, payload: null } };
    }
    if (url.endsWith('/api/ai-bank') && opts.method === 'PUT') {
      const b = JSON.parse(opts.body);
      storedPayload = b.payload;
      return { ok: true, status: 200, json: async () => ({ ok: true, rev: 2 }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  });
  const syncRes = await mockEnv.nclexProSyncToCloud(csOut, { passphrase: 'SecretTestPhrase!99' });
  t('nclexProSyncToCloud E2E-encrypts AI bank payload with AES-256-GCM before PUT (zero plaintext in transit)',
    syncRes.ok === true && syncRes.syncedCount === 4 && syncRes.totalAiCount === 4 &&
    typeof storedPayload === 'string' && !storedPayload.includes('furosemide') && !storedPayload.includes('Pulmonary edema'));

  // 5. Passphrase scrubbing on error + sessionStorage-only persistence in HTML
  const errEnv = loadEnv(async () => { throw new Error('Network leaked SecretTestPhrase!99'); });
  let scrubbedErr = '';
  try { await errEnv.nclexProSyncToCloud(csOut, { passphrase: 'SecretTestPhrase!99' }); } catch (e) { scrubbedErr = e.message; }
  t('nclexProSyncToCloud scrubs passphrase from errors and HTML keeps passphrase strictly in sessionStorage',
    !scrubbedErr.includes('SecretTestPhrase!99') && scrubbedErr.includes('[redacted]') &&
    S.includes("sessionStorage.getItem('suite_nclex_pass')") &&
    !S.includes("localStorage.setItem('suite_nclex_pass'"));
};
