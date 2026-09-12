#!/usr/bin/env node
'use strict';

// Optional browser acceptance: synthetic fixture only, mocked Gemini, no course files.
const assert=require('assert/strict'),http=require('http'),fs=require('fs');
const {page:basePage}=require('./anki-browser-fixture');
const {interceptContext}=require('./remediation-browser-tests');
function page(){
  let html=basePage();
  const old='callGemini=async()=>{';
  if(html.split(old).length!==2)throw Error('Synthetic transport anchor changed.');
  html=html.replace(old,()=>String.raw`window.__ankiReviewFixture={calls:[],auditMode:'valid',pending:[]};
callGemini=async(apiKey,model,parts,options={})=>{
  const probe=window.__ankiReviewFixture;
  if(parts?.[0]?.text?.includes('AUDIT PACKET:')){
    const packet=JSON.parse(parts[0].text.split('AUDIT PACKET:')[1]);
    probe.calls.push({model,level:options.thinkingLevel,packet});
    const findings=probe.auditMode==='finding'?[{code:'missing-target',factIds:[packet.sourceFactIds[0]],noteIds:[],message:'Synthetic source target needs review.',suggestion:'Ask for the supplied timing without adding a new value.'}]:[];
    const response=probe.auditMode==='invalid'?'invalid audit response':JSON.stringify({findings});
    if(probe.auditMode==='delay')return new Promise(resolve=>probe.pending.push(()=>resolve(response)));
    options.onMeta?.({usage:{totalTokenCount:123}});return response;
  }
`);
  return html;
}
async function main(){
  const html=page(),server=http.createServer((req,res)=>{if(req.method!=='GET'||req.url!=='/'){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port+'/',{chromium}=require('playwright');
  let browser,context;
  try{
    browser=await chromium.launch({channel:'chrome',headless:true});
    context=await browser.newContext({serviceWorkers:'block',acceptDownloads:false});
    const network=await interceptContext(context,url,html),view=await context.newPage(),errors=[];
    view.on('pageerror',e=>errors.push(e.message));
    await view.goto(url,{waitUntil:'load',timeout:45000});
    await view.getByRole('button',{name:'▶ Generate Cards',exact:true}).click();
    await view.getByLabel('Text for note ',{exact:false}).first().waitFor();
    const field=view.getByLabel('Text for note ',{exact:false}).first();
    await field.fill('[Example] Timing: {{c1::8 minutes}}; repeat at 8 minutes.');
    await view.getByRole('button',{name:'⬇ Export .txt',exact:true}).click();
    await view.waitForFunction(()=>document.querySelector('textarea[aria-label="Captured export"]').value.includes('8 minutes'));
    const before=await view.getByLabel('Captured export',{exact:true}).inputValue();assert(before.includes('8 minutes'));
    await view.getByLabel('Anki review findings',{exact:true}).selectOption('answer-visible');
    assert.equal(await view.getByLabel('Text for note ',{exact:false}).count(),1,'specific warning filter isolates exposed answer');
    await view.getByRole('button',{name:'⬇ Export .txt',exact:true}).click();
    assert.equal(await view.getByLabel('Captured export',{exact:true}).inputValue(),before,'review filter preserves export bytes');
    await view.getByText('Review and source ·',{exact:false}).first().click();
    await view.getByText('Source links identify supporting facts',{exact:false}).first().waitFor({state:'visible'});
    await view.getByRole('button',{name:'Preview',exact:true}).click();
    await view.getByRole('button',{name:'Edit in Table',exact:true}).first().click();
    await view.waitForFunction(()=>document.activeElement?.id?.startsWith('anki-text-'));
    assert.equal(await view.getByLabel('Anki review findings',{exact:true}).inputValue(),'all');
    await view.getByText('Optional · Check against KB',{exact:true}).click();
    assert.equal(await view.evaluate(()=>window.__ankiReviewFixture.calls.length),0);
    await view.getByRole('button',{name:'Prepare source check',exact:true}).click();
    assert.equal(await view.evaluate(()=>window.__ankiReviewFixture.calls.length),0,'preparation is local');
    await view.evaluate(()=>{window.__ankiReviewFixture.auditMode='finding';});
    const cardsBeforeAudit=await view.getByLabel('Text for note ',{exact:false}).evaluateAll(fields=>fields.map(f=>f.value));
    await view.getByRole('button',{name:/^Run \d+ source check/}).click();
    await view.getByText(/^complete ·/).waitFor();
    await view.getByText('Suggested correction:',{exact:true}).first().waitFor();
    assert((await view.getByText(/Ask for the supplied timing without adding a new value/).count())>0,'proposed correction is visible');
    assert.deepEqual(await view.getByLabel('Text for note ',{exact:false}).evaluateAll(fields=>fields.map(f=>f.value)),cardsBeforeAudit,'suggestions preserve original cards');
    assert((await view.evaluate(()=>window.__ankiReviewFixture.calls.length))>0,'explicit run invokes mocked audit');
    await view.getByRole('button',{name:'Save source-check evidence',exact:true}).click();
    await view.waitForFunction(()=>{try{return JSON.parse(document.querySelector('textarea[aria-label="Captured export"]').value).status==='complete';}catch{return false;}});
    const evidence=JSON.parse(await view.getByLabel('Captured export',{exact:true}).inputValue());
    assert.equal(evidence.status,'complete');assert.equal(evidence.responses[0].usage.totalTokenCount,123);assert.equal(evidence.results[0].findings[0].suggestion,'Ask for the supplied timing without adding a new value.');assert(!JSON.stringify(evidence).includes('synthetic-only'),'saved evidence excludes API credential');
    await view.getByLabel('Text for note ',{exact:false}).first().fill('[Example] Timing: {{c1::9 minutes}}.');
    await view.getByText(/outdated for the current notes or source/).waitFor();
    await view.evaluate(()=>{window.__ankiReviewFixture.auditMode='invalid';});
    await view.getByRole('button',{name:'Prepare source check',exact:true}).click();
    await view.getByRole('button',{name:/^Run \d+ source check/}).click();
    await view.getByText(/^failed ·/).waitFor();
    await view.getByRole('button',{name:'Save source-check evidence',exact:true}).click();
    await view.waitForFunction(()=>{try{return JSON.parse(document.querySelector('textarea[aria-label="Captured export"]').value).status==='failed';}catch{return false;}});
    assert.equal(JSON.parse(await view.getByLabel('Captured export',{exact:true}).inputValue()).responses[0].raw,'invalid audit response');
    await view.evaluate(()=>{window.__ankiReviewFixture.auditMode='delay';});
    await view.getByRole('button',{name:'Prepare source check',exact:true}).click();
    await view.getByRole('button',{name:/^Run \d+ source check/}).click();
    await view.waitForFunction(()=>window.__ankiReviewFixture.pending.length===1);
    await view.getByRole('button',{name:'Cancel source check',exact:true}).click();
    await view.evaluate(()=>window.__ankiReviewFixture.pending.splice(0).forEach(resolve=>resolve()));
    await view.getByText(/^cancelled ·/).waitFor();
    assert.equal(await view.getByRole('button',{name:'Cancel source check',exact:true}).count(),0);
    await view.getByRole('button',{name:'Replace KB',exact:true}).click();
    await view.getByText(/These notes belong to an earlier Knowledge Base/).waitFor();
    assert(await view.getByRole('button',{name:'⬇ Export .txt',exact:true}).isDisabled());
    await view.setViewportSize({width:360,height:900});
    const overflow=await view.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);assert(!overflow,'mobile viewport does not overflow');
    fs.mkdirSync('scratch/anki-update/browser',{recursive:true});
    await view.screenshot({path:'scratch/anki-update/browser/mobile.png',fullPage:true});
    await view.getByLabel('Empty fixture response',{exact:true}).check();
    await view.getByRole('button',{name:'▶ Generate Cards',exact:true}).click();
    await view.getByText('Optional · Check against KB',{exact:true}).waitFor();
    assert.equal(await view.getByLabel('Text for note ',{exact:false}).count(),0);
    await view.getByText('Optional · Check against KB',{exact:true}).click();
    assert(await view.getByRole('button',{name:'Prepare source check',exact:true}).isEnabled(),'empty completed batch can still be audited for missing targets');
    assert.deepEqual(errors,[]);assert.deepEqual(network.unexpected,[]);
    console.log('PASS Anki browser: warning/export isolation, source inspector, edit navigation, explicit audit, stale results, malformed evidence, cancellation, source replacement, mobile layout. No live Gemini calls.');
  }finally{await context?.close();await browser?.close();await new Promise(resolve=>server.close(resolve));}
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});
module.exports={page,main};
