'use strict';
const assert=require('node:assert/strict');
const {withFixture}=require('./remediation-browser-tests');
const {syntheticKB}=require('./remediation-browser-fixture');
async function runTests(browser,report=console.log){
  const A=syntheticKB('A'),B=syntheticKB('B');
  await withFixture(browser,{indexed:A},async({page})=>{
    await page.getByTitle('Pyramid Priority Analyzer',{exact:true}).click();
    await page.locator('#priority-condition').fill('No matching condition');
    await page.getByRole('button',{name:'△ Analyze Knowledge Base',exact:true}).click();
    await page.getByText(/The current Knowledge Base filters contain no facts/).first().waitFor();
    assert.equal(await page.evaluate(()=>window.__remediation.geminiCalls.length),0);
  });report('PASS Priority empty selection makes no browser generation request');
  await withFixture(browser,{indexed:A},async({page})=>{
    await page.getByTitle('Pyramid Priority Analyzer',{exact:true}).click();
    await page.evaluate(()=>window.__remediation.queueGemini('',{defer:true}));
    await page.getByRole('button',{name:'△ Analyze Knowledge Base',exact:true}).click();
    await page.waitForFunction(()=>window.__remediation.geminiCalls.length===1);
    await page.evaluate(()=>window.__remediation.rejectGemini('gemini:1','Synthetic harvest outage'));
    await page.getByText(/No source chunks were harvested successfully/).first().waitFor();
    assert.equal(await page.evaluate(()=>window.__remediation.geminiCalls.length),1);
    assert((await page.locator('body').innerText()).includes('Missing source chunks: 1'));
  });report('PASS Priority failed harvest stops before synthesis and retains completeness state');
  await withFixture(browser,{indexed:A},async({page})=>{
    await page.getByTitle('Pyramid Priority Analyzer',{exact:true}).click();
    await page.evaluate(()=>{window.__remediation.queueGemini('Captured A');window.__remediation.queueGemini('Late A',{defer:true});});
    await page.getByRole('button',{name:'△ Analyze Knowledge Base',exact:true}).click();
    await page.waitForFunction(()=>window.__remediation.geminiCalls.length===2);
    await page.evaluate(()=>window.__remediation.streamGemini('gemini:2','Retained partial source A'));
    await page.getByRole('heading',{name:'Priority Analysis',exact:true}).waitFor();
    await page.evaluate(kb=>window.__remediation.replace(kb),B);
    await page.getByText(/The earlier analysis was stopped/).waitFor();
    assert.equal(await page.evaluate(()=>window.__remediation.geminiCalls[1].signal.aborted),true);
    await page.evaluate(()=>{window.__remediation.streamGemini('gemini:2','Obsolete late streamed source A');window.__remediation.resolveGemini('gemini:2','Obsolete late final source A');});
    await page.waitForFunction(()=>window.__remediation.geminiCalls[1].status==='resolved');
    assert(!(await page.locator('body').innerText()).includes('Obsolete late'));
    // Target the unique Priority filename through the visible output toolbar.
    await page.getByRole('button',{name:'⬇ .md',exact:true}).click();
    await page.waitForFunction(()=>window.__remediation.exports.some(e=>e.name==='priority-analysis.md'));
    const exported=await page.evaluate(()=>window.__remediation.exports.find(e=>e.name==='priority-analysis.md').text);
    assert(exported.includes('Source: earlier Knowledge Base.'));
    assert(exported.includes('The earlier analysis was stopped.'));
    assert(exported.includes('Retained partial source A'));
    assert(!exported.includes('Obsolete late'));
  });report('PASS Priority source replacement aborts synthesis and exports retained earlier-source status');
  await withFixture(browser,{indexed:A},async({page})=>{
    await page.getByTitle('Pyramid Priority Analyzer',{exact:true}).click();
    await page.evaluate(()=>{window.__remediation.queueGemini('Partial harvested source',{defer:true});window.__remediation.queueGemini('Synthetic completed guide');});
    await page.getByRole('button',{name:'△ Analyze Knowledge Base',exact:true}).click();
    await page.waitForFunction(()=>window.__remediation.geminiCalls.length===1);
    await page.evaluate(()=>{window.__remediation.metaGemini('gemini:1',{truncated:true});window.__remediation.resolveGemini('gemini:1');});
    await page.getByRole('heading',{name:'Priority Analysis',exact:true}).waitFor();
    await page.getByRole('button',{name:'⬇ .txt',exact:true}).click();
    await page.waitForFunction(()=>window.__remediation.exports.some(e=>e.name==='priority-analysis.txt'));
    const exported=await page.evaluate(()=>window.__remediation.exports.find(e=>e.name==='priority-analysis.txt').text);
    assert(exported.includes('Truncated source chunks: 1'));
    assert(exported.includes('Synthetic completed guide'));
  });report('PASS Priority completed export retains truncated-harvest notice');
}
module.exports={runTests};
if(require.main===module){
  (async()=>{const {chromium}=require('playwright');const browser=await chromium.launch({channel:'chrome',headless:true});try{await runTests(browser);}finally{await browser.close();}})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
}
