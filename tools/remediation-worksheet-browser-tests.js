#!/usr/bin/env node
'use strict';
const assert=require('assert/strict');
const {withFixture}=require('./remediation-browser-tests');
const {syntheticKB}=require('./remediation-browser-fixture');

function worksheet(types=['MCQ','MCQ','MCQ','MCQ','MCQ']){
  const options=['First marker','Second marker','Third marker','Fourth marker'];
  const questions=types.map((type,i)=>'  '+(i+1)+'. '+(type==='Ordering'?'Place the synthetic actions in order.':'Which synthetic marker should be selected for scenario '+(i+1)+'?')+'\n'+(type==='Ordering'?'     ___ Second step\n     ___ First step':options.map((s,j)=>'     '+'ABCD'[j]+'. '+s).join('\n')));
  const keys=types.map((type,i)=>'  '+(i+1)+'. ANSWER: '+(type==='Ordering'?'2 → 1\n     1. First step — complete reasoning. (Source: C1)\n     2. Second step — complete reasoning. (Source: C1)':'A\n'+options.map((s,j)=>'     Why '+'ABCD'[j]+' is '+(j?'wrong':'correct')+': Fictional marker A is present. (Source: C1)').join('\n'))+'\n     Strategy: Read the synthetic source.\n     Tags: Tier 1');
  const counts=Object.entries(types.reduce((o,x)=>(o[x]=(o[x]||0)+1,o),{})).map(([type,n])=>type+':'+n).join(' ');
  return 'PART 1 — INVENTORY\nC1 | Synthetic marker [fact-1] | ANCHOR: "Fictional marker A is present." |\nPART 2 — AUDIT\n'+types.map((_,i)=>'Q'+(i+1)+' cites C1').join('\n')+'\nPART 3 — QUESTIONS\n'+questions.join('\n\n')+'\nPART 4 — KEY\n'+keys.join('\n\n')+'\nDISTRIBUTION: Tier [1:'+types.length+' 2:0 3:0] | Types ['+counts+']';
}

async function prepare(page,text,responses=[]){
  await page.waitForFunction(()=>window.__remediation?.state?.knowledgeBase?.conditions.length===1);
  await page.getByTitle('NCLEX Question Generator',{exact:true}).click();
  const panel=page.locator('.tool-panel').filter({has:page.getByRole('heading',{name:/NCLEX Question Generator/})});
  await panel.locator('input[type=number][min="5"]').fill('5');
  await panel.locator('select').filter({has:page.locator('option[value="5"]')}).selectOption('5');
  await page.getByRole('checkbox',{name:/Fact allocation/}).uncheck();
  await page.evaluate(({text,responses})=>{window.__remediation.queueGemini(text);responses.forEach(r=>window.__remediation.queueGemini(r.text,r));},{text,responses});
  await page.getByRole('button',{name:'▶ Generate 5 Questions (1 batch)',exact:true}).click();
}
async function exportView(page,view='worksheet'){
  await page.getByRole('button',{name:view==='worksheet'?'📝 Worksheet':'🔍 Audit Trail',exact:true}).click();
  const before=await page.evaluate(()=>window.__remediation.exports.length);
  await page.getByRole('button',{name:'⬇ .md',exact:true}).click();
  await page.waitForFunction(n=>window.__remediation.exports.length>n,before);
  return page.evaluate(()=>window.__remediation.exports.at(-1).text);
}
async function waitIdle(page){await page.getByRole('button',{name:'▶ Generate 5 Questions (1 batch)',exact:true}).waitFor();}
const hasVerdict=(text,num,status)=>text.includes('- Q'+num+': **'+status+'**');
async function cancelAudit(page){
  await page.getByRole('button',{name:'Cancel',exact:true}).click();await waitIdle(page);
}

async function worksheetTests(browser,report=console.log){
  await withFixture(browser,{indexed:syntheticKB('A')},async({page})=>{
    await prepare(page,worksheet(),Array.from({length:5},()=>({text:'PASS',defer:true,abortOnSignal:true})));
    await page.waitForFunction(()=>window.__remediation.geminiCalls.length===3);
    await page.getByRole('heading',{name:'5 Questions · 1 concepts',exact:true}).waitFor();
    await cancelAudit(page);
    const md=await exportView(page);assert(md.includes('Item quality audit: interrupted.'));
    assert(md.includes('Completeness: 5 of 5 requested questions'));assert(md.includes('Which synthetic marker should be selected for scenario 1?'));
    assert(md.includes('ANSWER: A'));assert(!md.split('## Answer Key')[0].includes('ANSWER: A'));
    assert.equal(await page.evaluate(()=>window.__remediation.geminiCalls.length),3,'abort during first two lanes cannot schedule later audits');
  });report('PASS worksheet remains exportable when cancelled during the first audit');
  await withFixture(browser,{indexed:syntheticKB('A')},async({page})=>{
    await prepare(page,worksheet(),Array.from({length:5},()=>({text:'PASS',defer:true,abortOnSignal:true})));
    await page.waitForFunction(()=>window.__remediation.geminiCalls.length===3);
    await page.evaluate(()=>window.__remediation.resolveGemini('gemini:2','PASS'));
    await page.waitForFunction(()=>window.__remediation.geminiCalls.length===4);
    const running=await exportView(page,'working');assert(running.includes('PASS 1'));assert(hasVerdict(running,1,'PASS'));
    await page.evaluate(()=>window.__remediation.resolveGemini('gemini:3','REVIEW — Synthetic wording needs review.'));
    await page.waitForFunction(()=>window.__remediation.geminiCalls.length===5);
    await cancelAudit(page);
    const md=await exportView(page);assert(md.includes('Item quality audit: interrupted.'));assert(md.includes('PASS 1'));assert(md.includes('REVIEW 1'));
    const trail=await exportView(page,'working');assert(hasVerdict(trail,1,'PASS'));assert(hasVerdict(trail,2,'REVIEW'));assert(!hasVerdict(trail,3,'PASS'));
  });report('PASS audit verdicts publish before completion and remain retained after cancellation');
  await withFixture(browser,{indexed:syntheticKB('A')},async({page})=>{
    await prepare(page,worksheet(),Array.from({length:5},()=>({text:'PASS',defer:true,abortOnSignal:true})));
    await page.waitForFunction(()=>window.__remediation.geminiCalls.length===3);
    await page.evaluate(()=>window.__remediation.rejectGemini('gemini:2','429 synthetic quota exhausted'));
    await page.waitForFunction(()=>window.__remediation.geminiCalls.length===4);
    await page.evaluate(()=>window.__remediation.rejectGemini('gemini:3','429 synthetic quota exhausted'));
    await page.waitForFunction(()=>window.__remediation.geminiCalls[2].status==='rejected');
    await page.evaluate(()=>window.__remediation.resolveGemini('gemini:4','PASS'));await waitIdle(page);
    const md=await exportView(page);assert(md.includes('Item quality audit: interrupted.'));assert(md.includes('ERROR 1'));assert(md.includes('PASS 1'));
    const trail=await exportView(page,'working');assert(hasVerdict(trail,1,'ERROR'));assert(hasVerdict(trail,3,'PASS'));
    assert.equal(await page.evaluate(()=>window.__remediation.geminiCalls.length),4,'quota stop cannot schedule another audit after the surviving lane completes');
  });report('PASS quota interruption retains completed and in-flight verdicts without being restamped complete');
  await withFixture(browser,{indexed:syntheticKB('A')},async({page})=>{
    await prepare(page,worksheet(Array(5).fill('Ordering')));await waitIdle(page);
    const md=await exportView(page);assert(md.includes('Item quality audit: complete. N/A 5.'));assert(!md.includes('incomplete'));
    const trail=await exportView(page,'working');for(let n=1;n<=5;n++)assert(hasVerdict(trail,n,'N/A'));
    assert.equal(await page.evaluate(()=>window.__remediation.geminiCalls.length),1,'N/A audit items must not issue model requests');
  });report('PASS all-Ordering worksheet reports complete N/A audit without audit requests');
  const malformed={stem:'REPLACEMENT MUST NOT APPEAR',options:[null]};
  const ungrounded={stem:'REPLACEMENT MUST NOT APPEAR',options:['First marker','Second marker','Third marker','Fourth marker'].map((text,i)=>({label:'ABCD'[i],text})),correctLabel:'A',rationales:['A','B','C','D'].map(label=>({label,text:'A complete explanation.',source:'C999'}))};
  for(const [kind,repair] of [['malformed',malformed],['ungrounded',ungrounded]]){
    await withFixture(browser,{indexed:syntheticKB('A')},async({page})=>{
      await prepare(page,worksheet(['MCQ','Ordering','Ordering','Ordering','Ordering']),[{text:'FAIL — Stem construction'},{text:JSON.stringify(repair)}]);await waitIdle(page);
      const md=await exportView(page);assert(md.includes('Which synthetic marker should be selected for scenario 1?'));assert(!md.includes('REPLACEMENT MUST NOT APPEAR'));
      assert(md.includes('FAIL 1'));assert(md.includes('N/A 4'));assert(md.includes('Unresolved item findings remain'));
      const trail=await exportView(page,'working');assert(hasVerdict(trail,1,'FAIL'));assert(!trail.includes('REPAIRED'));
      assert((await page.locator('body').innerText()).includes('(original kept)'));assert.equal(await page.evaluate(()=>window.__remediation.geminiCalls.length),3);
    });report('PASS '+kind+' worksheet repair preserves the original and exports the unresolved audit failure');
  }
}
async function main(){
  const {chromium}=require('playwright'),browser=await chromium.launch(process.env.REMEDIATION_BROWSER_EXECUTABLE?{headless:true,executablePath:process.env.REMEDIATION_BROWSER_EXECUTABLE}:{headless:true,channel:'chrome'});
  try{await worksheetTests(browser);}finally{await browser.close();}
  console.log('Worksheet browser acceptance passed. Synthetic generation only.');
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});
module.exports={worksheet,worksheetTests};
