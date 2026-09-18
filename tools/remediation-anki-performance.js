#!/usr/bin/env node
'use strict';
// Browser measurements only. All notes are generated here from fictional labels;
// the real App and AnkiGenerator mount under the same isolated network fixture.
const assert=require('assert/strict');
const {withFixture}=require('./remediation-browser-tests');
const {syntheticKB}=require('./remediation-browser-fixture');

function syntheticNotes(count,mode){
  const rows=Array.from({length:count},(_,i)=>'[Synthetic '+(mode==='single'?'marker':'group '+Math.floor(i/3))+'] Finding: {{c1::answer-'+i+'}}|Synthetic explanation|Nursing::LATTE::Look Condition::Synthetic Tier::1');
  return '```text\n'+rows.join('\n')+'\n```\n```text\nfact-1 -> line #1\n```';
}
async function waitForSyntheticKnowledge(page){
  // v16.7: an invalid saved fixture enters recovery; report that failure instead of timing out waiting for notes.
  await page.waitForFunction(()=>{const state=window.__remediation?.state;return state&&state.persistenceStatus!=='loading';},null,{timeout:15000});
  const state=await page.evaluate(()=>({conditions:window.__remediation.state.knowledgeBase?.conditions?.length||0,status:window.__remediation.state.persistenceStatus,error:window.__remediation.state.persistenceError}));
  assert.equal(state.conditions,1,'Synthetic Knowledge Base did not restore: '+state.status+'; '+(state.error||'no source condition'));
}
async function measure(browser,count,mode){
  let result;
  await withFixture(browser,{indexed:syntheticKB('A')},async({page})=>{
    await waitForSyntheticKnowledge(page);
    await page.getByTitle('LATTE Anki Generator',{exact:true}).click();
    await page.evaluate(text=>window.__remediation.queueGemini(text),syntheticNotes(count,mode));
    const begin=await page.evaluate(()=>performance.now());await page.getByRole('button',{name:'▶ Generate Cards',exact:true}).click();
    // v16.7: pagination bounds mounted rows while generation and export retain the requested deck.
    await page.waitForFunction(n=>document.querySelectorAll('.anki-tbl-wrap tbody tr').length===Math.min(n,50),count,{timeout:45000});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    result=await page.evaluate(({count,mode,begin})=>({count,mode,renderMs:Math.round(performance.now()-begin),domElements:document.querySelectorAll('*').length,mountedRows:document.querySelectorAll('.anki-tbl-wrap tbody tr').length,
      renderedMembers:[...document.querySelectorAll('div')].filter(e=>[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.includes(' · expected: '))).length,
      beforeEdit:{...window.__remediation.perf}}),{count,mode,begin});
    const extra=page.locator('.anki-tbl-wrap tbody tr').first().locator('td').nth(3).locator('textarea');
    const editStart=await page.evaluate(()=>performance.now());await extra.fill('Synthetic edited explanation');
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    result.editMs=await page.evaluate(start=>Math.round(performance.now()-start),editStart);
    result.afterEdit=await page.evaluate(()=>({...window.__remediation.perf}));
    assert.equal(await extra.inputValue(),'Synthetic edited explanation');
  });return result;
}
async function main(args=process.argv.slice(2)){
  const count=Number(args[0]||315),mode=args[1]||'single';
  if(![315,1000,3000].includes(count)||!['single','small'].includes(mode)||args.length>2)throw Error('Usage: node tools/remediation-anki-performance.js [315|1000|3000] [single|small]');
  const {chromium}=require('playwright'),browser=await chromium.launch(process.env.REMEDIATION_BROWSER_EXECUTABLE?{headless:true,executablePath:process.env.REMEDIATION_BROWSER_EXECUTABLE}:{headless:true,channel:'chrome'});
  try{console.log(JSON.stringify(await measure(browser,count,mode)));}finally{await browser.close();}
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});
module.exports={syntheticNotes,waitForSyntheticKnowledge,measure};
