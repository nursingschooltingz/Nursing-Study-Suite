#!/usr/bin/env node
'use strict';
// Optional real-App acceptance. All source data and transcription results are synthetic.
// Uses the existing external Playwright runtime; no repository dependencies or live Gemini.
const assert=require('assert/strict');
const {withFixture}=require('./remediation-browser-tests');
const {syntheticKB}=require('./remediation-browser-fixture');

const FALLBACK='latte_knowledge_snapshot_v2';
const waitStatus=(page,status)=>page.waitForFunction(expected=>window.__remediation?.state?.persistenceStatus===expected,status);
const waitCourse=(page,label)=>page.waitForFunction(expected=>window.__remediation?.state?.knowledgeBase?.metadata?.course==='Synthetic course '+expected,label);
async function exported(page,click){
  const before=await page.evaluate(()=>window.__remediation.exports.length);
  await click();await page.waitForFunction(n=>window.__remediation.exports.length>n,before);
  return page.evaluate(()=>window.__remediation.exports.at(-1));
}
async function recoveryTests(browser,report=console.log){
  const A=syntheticKB('A'),B=syntheticKB('B');
  const raw='{malformed synthetic fallback\n  exact raw bytes: α\n';
  await withFixture(browser,{indexed:A},async({page})=>{
    await waitCourse(page,'A');await waitStatus(page,'ready');
    await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key:FALLBACK,raw});
    // Fixture session flag prevents reseeding; this reload reads the actual corrupted store.
    await page.reload();await waitStatus(page,'conflict');
    const state=await page.evaluate(()=>window.__remediation.state);
    assert.equal(state.recovery.length,2);
    assert(state.recovery.some(r=>r.kb?.metadata?.course==='Synthetic course A'));
    assert(state.recovery.some(r=>r.raw===raw&&r.recoveryError));
    await page.getByRole('button',{name:'Use this copy',exact:true}).waitFor();
    const download=await exported(page,()=>page.getByRole('button',{name:'Export raw copy',exact:true}).click());
    assert.equal(download.text,raw,'raw recovery export must not JSON-quote or normalize corrupted bytes');
    assert(download.name.endsWith('-raw.txt'));
    await page.evaluate(kb=>window.__remediation.replace(kb),B);await waitCourse(page,'B');
    assert.equal(await page.evaluate(()=>window.__remediation.events.filter(e=>e.kind==='save'||e.kind==='delete').length),0,'replacement cannot save while recovery remains pending');
    let stores=await page.evaluate(()=>window.__remediation.readStores());
    assert.deepEqual(stores.indexed.find(r=>r.key==='active').value,A);
    assert.equal(stores.local[FALLBACK],raw);
    await page.getByRole('button',{name:'Use this copy',exact:true}).click();
    await waitStatus(page,'saved');await waitCourse(page,'A');
    stores=await page.evaluate(()=>window.__remediation.readStores());
    assert.equal(stores.indexed.find(r=>r.key==='active').value.metadata.course,A.metadata.course);
    const archive=stores.indexed.find(r=>String(r.key).startsWith('recovery-'));
    assert(archive,'choosing durable copy must archive recovery records');
    assert(archive.value.some(r=>r.raw===raw));
    assert(archive.value.some(r=>r.kb?.metadata?.course===A.metadata.course));
    assert.equal(stores.local[FALLBACK],undefined);
    await page.reload();await waitStatus(page,'ready');await waitCourse(page,'A');
    assert.equal(await page.evaluate(()=>window.__remediation.state.recovery.length),0);
    assert((await page.evaluate(()=>window.__remediation.readStores())).indexed.some(r=>String(r.key).startsWith('recovery-')));
  });report('PASS corrupt fallback retains raw export and durable choice; paused replacement stays unsaved until archive-and-restore survives reload');

  await withFixture(browser,{indexed:A,fallback:{}},async({page})=>{
    await waitStatus(page,'conflict');
    const rawCopy=await exported(page,()=>page.getByRole('button',{name:'Export raw copy',exact:true}).click());
    assert.equal(rawCopy.text,'{}');
    await page.evaluate(kb=>window.__remediation.replace(kb),B);await waitCourse(page,'B');
    await page.getByRole('button',{name:'Use current workspace',exact:true}).click();await waitStatus(page,'saved');
    const stores=await page.evaluate(()=>window.__remediation.readStores());
    assert.equal(stores.indexed.find(r=>r.key==='active').value.metadata.course,B.metadata.course);
    assert(stores.indexed.some(r=>String(r.key).startsWith('recovery-')&&r.value.some(copy=>copy.raw==='{}')));
    await page.reload();await waitStatus(page,'ready');await waitCourse(page,'B');
  });report('PASS invalid fallback metadata is archived before explicit current-workspace replacement and reload');

  await withFixture(browser,{indexed:A},async({page})=>{
    await waitStatus(page,'ready');
    await page.addInitScript(()=>{
      const get=Storage.prototype.getItem;
      Storage.prototype.getItem=function(key){
        if(this===window.localStorage&&['latte_knowledge_snapshot_v2','latte_knowledge_base_v1'].includes(key))throw new DOMException('Synthetic blocked storage access','SecurityError');
        return get.call(this,key);
      };
    });
    await page.reload();await waitStatus(page,'conflict');
    const state=await page.evaluate(()=>window.__remediation.state);
    assert(state.recovery.some(r=>r.unavailable&&r.recoveryError.includes('reload')));
    assert(state.recovery.some(r=>r.kb?.metadata?.course===A.metadata.course));
    await page.getByRole('button',{name:'Use current workspace',exact:true}).click();
    await page.waitForFunction(()=>window.__remediation.state.persistenceError.includes('Restore browser storage access, then reload'));
    assert.equal(await page.evaluate(()=>window.__remediation.events.filter(e=>e.kind==='save'||e.kind==='delete').length),0);
    assert((await page.locator('body').innerText()).includes('then reload'));
  });report('PASS unavailable fallback reads stay paused with explicit reload guidance and no unsafe overwrite');
}

async function cardRetranscriptionTests(browser,report=console.log){
  await withFixture(browser,{},async({page})=>{
    await waitStatus(page,'ready');
    await page.evaluate(()=>{
      window.__syntheticCard={calls:0,fail:false};
      // Replace only the transcription boundary; the shipped component/gates/export remain live.
      cardTranscribe=async()=>{
        window.__syntheticCard.calls++;
        if(window.__syntheticCard.fail)throw new Error('Synthetic transcription unavailable');
        return{face:'front',title:'Synthetic card',category:'Synthetic',cardNumber:'1',sections:[{key:'other',heading:'Synthetic',bullets:['A fictional marker is present.']}],numerics:[],overallLegibility:'clean'};
      };
    });
    await page.getByLabel('Source files',{exact:true}).setInputFiles({name:'synthetic-card.png',mimeType:'image/png',buffer:Buffer.from('Synthetic placeholder; mocked transcription never decodes this file.')});
    const transcribe=page.getByRole('button',{name:'Transcribe 1 card image(s)',exact:true});
    await transcribe.click();await page.waitForFunction(()=>window.__syntheticCard.calls===1);
    const acknowledgement=page.getByRole('checkbox',{name:/I have checked the numbers above against the physical cards/});
    await acknowledgement.check();
    assert.equal(await page.getByRole('button',{name:'Build Knowledge Base',exact:true}).isEnabled(),true);
    await page.getByLabel('Runs per card',{exact:true}).fill('2');
    await page.evaluate(()=>{window.__syntheticCard.fail=true;});await transcribe.click();
    await page.waitForFunction(()=>window.__syntheticCard.calls===3);
    await page.getByText(/This card is blocked until transcription succeeds/).waitFor();
    await acknowledgement.check();
    assert.equal(await page.getByRole('button',{name:'No card clears the gate',exact:true}).isDisabled(),true);
    const download=await exported(page,()=>page.getByRole('button',{name:'Export JSON',exact:true}).click());
    const receipt=JSON.parse(download.text),entry=receipt.raw[0];
    assert.equal(entry.comparisonIncomplete,true);assert.equal(entry.requestedRuns,2);assert.deepEqual(entry.runs,[]);
    assert.equal(entry.retainedTranscript.runs.length,1);assert.equal(entry.transcript.title,'Synthetic card');
    assert(receipt.blocked.length>0);assert.equal(await page.evaluate(()=>window.__remediation.geminiCalls.length),0);
  });report('PASS failed card rerun retains the earlier transcript but blocks Build and exports the incomplete latest attempt');
}
async function main(){
  const {chromium}=require('playwright');
  const browser=await chromium.launch(process.env.REMEDIATION_BROWSER_EXECUTABLE?{headless:true,executablePath:process.env.REMEDIATION_BROWSER_EXECUTABLE}:{headless:true,channel:'chrome'});
  try{await recoveryTests(browser);await cardRetranscriptionTests(browser);}finally{await browser.close();}
  console.log('Production recovery browser acceptance passed. Synthetic only.');
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});
module.exports={recoveryTests,cardRetranscriptionTests};
