#!/usr/bin/env node
'use strict';
// Synthetic real-App acceptance. Existing external Playwright only; no Gemini requests.
const assert=require('node:assert/strict');
const {withFixture}=require('./remediation-browser-tests');
const {syntheticKB}=require('./remediation-browser-fixture');
const {fixture,question}=require('./case-remediation-tests');
const clone=x=>JSON.parse(JSON.stringify(x));
function caseFixture(){const cs=fixture();cs.condition='Synthetic condition A';for(const q of cs.stages[0].questions)for(const r of q.rationales)r.factIds=['fact-1'];return cs;}
async function prepare(page,cs,{audit=true,responses=[]}={}){
  await page.waitForFunction(()=>window.__remediation?.state?.knowledgeBase?.conditions.length===1);
  await page.evaluate(()=>{window.__caseAuditPrompts=[];window.__casePdfInput=[];const nativeCall=callGemini,nativePdf=exportAsPdf;callGemini=(...args)=>{window.__caseAuditPrompts.push(args[2][0].text);return nativeCall(...args);};exportAsPdf=(...args)=>{window.__casePdfInput.push(args[0]);return nativePdf(...args);};});
  await page.getByTitle('Clinical Case Study Generator',{exact:true}).click();
  if(!audit)await page.getByRole('checkbox',{name:/Run the item-quality audit/}).uncheck();
  await page.evaluate(({cs,responses})=>{window.__remediation.queueGemini(JSON.stringify(cs));responses.forEach(r=>window.__remediation.queueGemini(r.text||'PASS',r));},{cs,responses});
  await page.getByRole('button',{name:'▶ Generate Case Study',exact:true}).click();
  await page.getByRole('heading',{name:cs.title,exact:true}).waitFor();
}
async function copy(page,json=true){if(json)await page.getByRole('button',{name:'{ } JSON',exact:true}).click();else await page.getByRole('button',{name:'🩺 Case',exact:true}).click();await page.getByRole('button',{name:'📋 Copy',exact:true}).click();return page.evaluate(()=>window.__remediation.copies.at(-1));}
async function idle(page){await page.getByRole('button',{name:'▶ Generate Case Study',exact:true}).waitFor();}
async function main(){
 const {chromium}=require('playwright');const browser=await chromium.launch({channel:'chrome',headless:true});let checks=0;
 const report=s=>{checks++;console.log('PASS '+s);};
 try{
  for(const unsupported of [false,true]){
    const measureKB=syntheticKB('A');measureKB.conditions[0].facts[0].text='Synthetic size 2 cm to 6 cm; interval 4–6 minutes; duration 70–80 seconds.';
    await withFixture(browser,{indexed:measureKB},async({page})=>{
      const cs=caseFixture();cs.stages[0].data=[{label:'Size',value:'4 cm',supportType:'instantiated',availability:'revealed',factIds:['fact-1']},{label:'Duration',value:'72 seconds',supportType:unsupported?'direct':'instantiated',availability:'revealed',factIds:['fact-1']}];
      await prepare(page,cs,{responses:unsupported?[]:[{text:'PASS'}]});await idle(page);
      const out=JSON.parse(await copy(page)),errors=out._suiteReview.validation.filter(i=>i.severity==='error');
      assert.equal(errors.length,unsupported?1:0);if(unsupported)assert(errors[0].message.includes('does not appear'));
      assert.equal(await page.evaluate(()=>window.__remediation.geminiCalls.length),unsupported?1:2);
      assert.equal(await page.evaluate(()=>window.__remediation.state.artifactRegistry.caseStudies.length),unsupported?0:2);
      assert.equal(out._suiteReview.itemAudit[0].status,unsupported?'UNSCORED':'PASS');
      const md=await copy(page,false);assert.equal(md.includes('FAILED VALIDATION'),unsupported);
      report(unsupported?'unsupported direct duration remains blocked and exported with its error':'length and later duration range reach audit and Fact Inspector registration');
    });
  }
  const weightKB=syntheticKB('A');weightKB.conditions[0].facts[0].text='Synthetic weight change is 3–5 pounds.';
  await withFixture(browser,{indexed:weightKB},async({page})=>{
    const cs=caseFixture();cs.stages[0].data=[{label:'Weight change',value:'4 lb',supportType:'instantiated',availability:'revealed',factIds:['fact-1']}];
    cs.stages[0].questions[0].rationales[0].text='This assessment occurs during stage 2 labor.';
    await prepare(page,cs,{responses:[{text:'PASS'}]});await idle(page);
    const out=JSON.parse(await copy(page));assert.equal(out._suiteReview.validation.filter(i=>i.severity==='error').length,0);assert.equal(out._suiteReview.itemAudit[0].status,'PASS');
    assert.equal(await page.evaluate(()=>window.__remediation.geminiCalls.length),2);
    const linked=await page.evaluate(()=>window.__remediation.state.artifactRegistry.caseStudies);assert.equal(linked.length,2);assert(linked.some(e=>e.id.endsWith(':1:data')));assert(linked.some(e=>e.id.endsWith(':1:q1')));assert(linked.every(e=>e.factIds.includes('fact-1')));
    assert.equal(out.stages[0].questions[0].options.find(o=>out.stages[0].questions[0].correctAnswers.includes(o.label)).text,'Assess');
    assert(!(await page.locator('body').innerText()).includes('Case failed validation'));
    report('pound threshold and numbered labor prose permit audit and Fact Inspector registration with intact answer mapping');
  });
  await withFixture(browser,{indexed:syntheticKB('A')},async({page})=>{
    const cs=caseFixture();cs.stages[0].questions.push({...clone(cs.stages[0].questions[0]),id:'q2',type:'Ordering',correctAnswers:['B','A','C','D']});
    await prepare(page,cs,{responses:[{defer:true,abortOnSignal:true}]});
    await page.waitForFunction(()=>window.__remediation.geminiCalls.length===2);
    assert((await page.locator('body').innerText()).includes('0 of 1 eligible MCQs reviewed · 1 pending'));
    await page.getByRole('checkbox',{name:/Run the item-quality audit/}).uncheck();
    let exported=JSON.parse(await copy(page));assert.equal(exported._suiteReview.itemAudit[0].status,'PENDING');assert.equal(exported._suiteReview.itemAudit[1].status,'N/A');
    const order=JSON.stringify(exported.stages);await page.getByRole('button',{name:'🩺 Case',exact:true}).click();
    await page.getByRole('button',{name:'Show answer & rationale',exact:true}).first().click();
    assert(await page.getByRole('button',{name:'Hide answer & rationale',exact:true}).first().isVisible());
    await page.getByRole('button',{name:'Hide answer & rationale',exact:true}).first().click();
    await page.evaluate(()=>window.__remediation.resolveGemini('gemini:2','PASS'));await idle(page);
    exported=JSON.parse(await copy(page));assert.equal(JSON.stringify(exported.stages),order);assert.equal(exported._suiteReview.itemAudit[0].status,'PASS');
    assert(!exported._suiteReview.notice.includes('disabled'));
    const md=await copy(page,false);assert(md.indexOf('## Review appendix')>md.indexOf('## Answer Key'));assert(md.includes('Q1.1 (q1): **PASS**'));assert(md.includes('Q1.2 (q2): **N/A**'));for(const i of exported._suiteReview.validation)assert(md.includes(i.message));
    const popupPromise=page.waitForEvent('popup');await page.getByRole('button',{name:'🖨 PDF',exact:true}).click();const printPage=await popupPromise;await printPage.waitForLoadState();await printPage.emulateMedia({media:'print'});
    assert.equal(await printPage.locator('.pagebreak').evaluate(el=>getComputedStyle(el).breakBefore),'page');assert(await printPage.getByRole('heading',{name:'Review appendix',exact:true}).isVisible());
    await printPage.screenshot({path:'scratch/case-print-preview.png',fullPage:true});await printPage.close();await page.waitForFunction(()=>window.__casePdfInput.length>0);
    const pdf=await page.evaluate(()=>window.__casePdfInput.at(-1));assert(pdf.includes('## Review appendix'));assert(pdf.includes('<div class="pagebreak"></div>'));
    const payload=await page.evaluate(()=>window.__caseAuditPrompts[1]);assert(!payload.includes('Review appendix'));assert(!payload.includes('[fact-1]'));assert(payload.includes('KEYED ANSWER: '+exported.stages[0].questions[0].correctAnswers[0]));
    report('pending/N/A, stable reveals and JSON/Markdown/PDF input agree; audit labels match and review appendix stays private');
  });
  for(const kind of ['unchanged','contract','changed'])await withFixture(browser,{indexed:syntheticKB('A')},async({page})=>{
    await prepare(page,caseFixture(),{responses:[{text:'FAIL — Stem clarity'},{defer:true,abortOnSignal:true}]});await page.waitForFunction(()=>window.__remediation.geminiCalls.length===3);
    const before=JSON.parse(await copy(page));const fixed=clone(before.stages[0].questions[0]);fixed.repairNote='Synthetic repair';if(kind==='contract')fixed.options.pop();if(kind==='changed')fixed.stem='Which synthetic action is appropriate now?';
    await page.evaluate(text=>window.__remediation.resolveGemini('gemini:3',text),JSON.stringify(fixed));await idle(page);
    const after=JSON.parse(await copy(page));assert.equal(after._suiteReview.itemAudit[0].status,kind==='changed'?'REPAIRED':'FAIL');if(kind!=='changed')assert.equal(JSON.stringify(after.stages),JSON.stringify(before.stages));else assert.equal(after.stages[0].questions[0].stem,fixed.stem);
    const md=await copy(page,false);assert(md.includes(kind==='changed'?'not re-audited':'Repair attempt:'));report(kind+' repair retains honest content, verdict and exported details');
  });
  await withFixture(browser,{indexed:syntheticKB('A')},async({page})=>{
    const cs=caseFixture();cs.stages[0].questions[0].stem='Which action for BP 82/50 mm Hg?';await prepare(page,cs);await idle(page);const md=await copy(page,false);assert(md.includes('FAILED VALIDATION'));assert(md.includes('## Review appendix'));assert.equal(await page.evaluate(()=>window.__remediation.geminiCalls.length),1);assert.equal(await page.evaluate(()=>window.__remediation.state.artifactRegistry.caseStudies.length),0);report('failed numeric case remains inspectable/exportable and is excluded from audit and registry');
  });
  await withFixture(browser,{indexed:syntheticKB('A')},async({page})=>{
    await prepare(page,caseFixture(),{responses:[{defer:true,abortOnSignal:true}]});await page.waitForFunction(()=>window.__remediation.geminiCalls.length===2);await page.getByRole('button',{name:'Cancel',exact:true}).click();await idle(page);const json=JSON.parse(await copy(page));assert(json._suiteReview.notice.includes('interrupted'));assert.equal(json._suiteReview.itemAudit[0].status,'UNSCORED');report('cancelled audit exports interrupted and unscored status');
  });
  await withFixture(browser,{indexed:syntheticKB('A')},async({page})=>{
    const cs=caseFixture();const q=cs.stages[0].questions[0];cs.stages[0].questions=['MCQ','Prioritization','Education','SATA','Ordering','Calculation'].map((type,i)=>({...clone(q),id:'q'+i,type,correctAnswers:type==='SATA'?['A','C']:type==='Ordering'?['B','A','C','D']:type==='Calculation'?['140 mg']:['A']}));
    const calc=cs.stages[0].questions[5];calc.options=[];calc.rationales=[{option:'Answer',text:'2 mg/kg multiplied by 70 kg gives 140 mg',supportType:'direct',factIds:['fact-1']}];cs.stages[0].data=[{label:'Weight',value:'70 kg',supportType:'neutral-framing',availability:'revealed',factIds:[]}];
    await page.waitForFunction(()=>window.__remediation?.context);await page.evaluate(()=>{const kb=JSON.parse(JSON.stringify(window.__remediation.state.knowledgeBase));kb.conditions[0].facts[0].text='Dose is 2 mg/kg.';kb.conditions[0].facts[0].sourceQuote='Dose is 2 mg/kg.';window.__remediation.context.setKnowledgeBase(kb);});
    await prepare(page,cs,{audit:false});await idle(page);await page.getByText('70 kg (assumed for calculation; subject to validation)',{exact:false}).waitFor();
    const json=JSON.parse(await copy(page));assert.equal(json._suiteReview.validation.filter(i=>i.severity==='error').length,0);assert.equal(json.stages[0].questions.length,6);assert.equal(json._suiteReview.itemAudit.length,0);
    const md=await copy(page,false);assert(md.includes('assumed for calculation'));assert(md.includes('Item quality audit: disabled.'));assert(md.includes('Answer: 140 mg'));
    report('all six question formats and assumed calculation weight work with disabled audit and exports');
  });
  await withFixture(browser,{indexed:syntheticKB('A')},async({page})=>{
    await prepare(page,caseFixture(),{responses:[{defer:true,abortOnSignal:true}]});await page.waitForFunction(()=>window.__remediation.geminiCalls.length===2);const before=JSON.parse(await copy(page));
    await page.evaluate(kb=>window.__remediation.context.setKnowledgeBase(kb),syntheticKB('B'));await idle(page);const after=JSON.parse(await copy(page));assert.equal(JSON.stringify(after.stages),JSON.stringify(before.stages));assert(after._suiteReview.notice.includes('earlier Knowledge Base'));assert(after._suiteReview.notice.includes('interrupted'));assert.equal(after._suiteReview.itemAudit[0].status,'UNSCORED');await copy(page,false);assert(await page.getByText('fact-1 (earlier source)',{exact:true}).count()===0);report('source replacement retains captured case with stale/interrupted export and no late audit verdict');
  });
  await withFixture(browser,{indexed:syntheticKB('A')},async({page})=>{
    const cs=caseFixture();cs.stages[0].questions.push({...clone(cs.stages[0].questions[0]),id:'q2'});await prepare(page,cs,{responses:[{defer:true,abortOnSignal:true},{defer:true,abortOnSignal:true}]});await page.waitForFunction(()=>window.__remediation.geminiCalls.length===3);await page.evaluate(()=>{window.__remediation.rejectGemini('gemini:2','429 synthetic quota exhausted');window.__remediation.rejectGemini('gemini:3','429 synthetic quota exhausted');});await idle(page);const after=JSON.parse(await copy(page));assert(after._suiteReview.notice.includes('interrupted'));assert(after._suiteReview.itemAudit.some(r=>r.status==='ERROR'));assert(after._suiteReview.itemAudit.some(r=>r.status==='UNSCORED'));report('case quota stop retains ERROR and unscored rows with interrupted state');
  });
 }finally{await browser.close();}
 console.log(checks+' browser scenarios passed; no live model calls. PDF assertions inspect print input, not a native print dialog.');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
