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
  // v17.7: two 25,000-character harvests exceed the 40,000-character part limit, so synthesis runs in two parts.
  const S=syntheticKB('S');
  S.conditions=[1,2].map(n=>({id:'condition-'+n,name:'Synthetic condition S'+n,aliases:[],facts:Array.from({length:6},(_,i)=>({
    id:'fact-'+n+'-'+(i+1),text:'Fictional marker S'+n+' item '+(i+1)+' '+'is present in the synthetic fixture only. '.repeat(4).trim(),
    sourceQuote:'Fictional marker S'+n+' item '+(i+1),tier:1,latteBucket:'Look',factType:'other',safetyCritical:false,
    sources:[{filename:'Synthetic S source',location:'page '+n}]}))}));
  await withFixture(browser,{indexed:S},async({page})=>{
    await page.getByTitle('Pyramid Priority Analyzer',{exact:true}).click();
    await page.locator('details:has(#priority-chunk-size) > summary').click();
    await page.locator('#priority-chunk-size').fill('2000');
    await page.evaluate(()=>{
      const R=window.__remediation,harvest=n=>('- **Synthetic harvest item '+n+'** [§ S'+n+'] | QUALIFIER: NONE | FLAGS: NONE\n').repeat(400).slice(0,25000);
      const guide=n=>`## TIER 1 — Must Know\n- **Fictional item ${n}a** [§ S${n}] — (R1 ABC) synthetic why.\n\n## TIER 2 — Should Know\n- **Fictional item ${n}b** [§ S${n}] — (R9) synthetic.\n\n## TIER 3 — Good to Know\n- **Fictional item ${n}c** [§ S${n}] — (R9) synthetic.\n\n---\n## Study Strategy\n- Drill synthetic part ${n}.\n\n*Audit: 3 items · 0 unverified · 1 inferred · 1/1 T1 rule-tagged*`;
      R.queueGemini(harvest(1));R.queueGemini(harvest(2));R.queueGemini(guide(1));R.queueGemini(guide(2),{defer:true});window.__splitGuide2=guide(2);
    });
    await page.getByRole('button',{name:'△ Analyze Knowledge Base',exact:true}).click();
    await page.waitForFunction(()=>window.__remediation.geminiCalls.length===4);
    await page.evaluate(()=>window.__remediation.streamGemini('gemini:4','## TIER 1 — Must Know'));
    await page.getByText('Synthesizing part 2 of 2...',{exact:true}).first().waitFor();
    await page.evaluate(()=>{const R=window.__remediation;R.metaGemini('gemini:4',{truncated:true,usage:{promptTokenCount:7,thoughtsTokenCount:9,candidatesTokenCount:5}});R.resolveGemini('gemini:4',window.__splitGuide2);});
    await page.getByText('Synthesis part 2 of 2 — Output hit the token ceiling (MAX_TOKENS)').first().waitFor();
    const tier1=await page.locator('.tier-section.t1').innerText();
    assert(tier1.indexOf('Fictional item 1a')>=0&&tier1.indexOf('Fictional item 2a')>tier1.indexOf('Fictional item 1a'));
    assert((await page.locator('body').innerText()).includes('6 items · 0 unverified · 2 inferred · 2/2 T1 rule-tagged'));
    await page.getByRole('button',{name:'⬇ .md',exact:true}).click();
    await page.waitForFunction(()=>window.__remediation.exports.some(e=>e.name==='priority-analysis.md'));
    const exported=await page.evaluate(()=>window.__remediation.exports.find(e=>e.name==='priority-analysis.md').text);
    assert(exported.startsWith('> Synthesis part 2 of 2 was truncated; review it before studying.\n> Synthesized in 2 parts to stay under the output limit;'));
    assert(exported.includes('**Part 1 of 2**')&&exported.includes('**Part 2 of 2**'));
    assert.equal(await page.evaluate(()=>window.__remediation.geminiCalls.length),4);
  });report('PASS Priority large inventory synthesizes in parts and exports one merged guide with its part notice');
}
module.exports={runTests};
if(require.main===module){
  (async()=>{const {chromium}=require('playwright');const browser=await chromium.launch({channel:'chrome',headless:true});try{await runTests(browser);}finally{await browser.close();}})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
}
