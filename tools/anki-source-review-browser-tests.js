#!/usr/bin/env node
'use strict';

// Optional browser acceptance: synthetic fixture only, mocked Gemini, no course files.
const assert=require('assert/strict'),http=require('http'),fs=require('fs');
const {page:basePage}=require('./anki-browser-fixture');
const {interceptContext}=require('./remediation-browser-tests');
const {validReceipt}=require('./fixtures/anki-audit-response');
function page(){
  let html=basePage();
  const fixtureCfg="const cfg=useMemo(()=>({apiKey:'synthetic-only',forTool:()=>({model:'synthetic-fixture',level:'low'}),autoProfile:true}),[]);";
  if(html.split(fixtureCfg).length!==2)throw Error('Synthetic configuration anchor changed.');
  html=html.replace(fixtureCfg,"const cfg=useMemo(()=>({apiKey:'synthetic-only',flashModel:'synthetic-flash',proModel:'synthetic-pro',forTool:id=>({model:TOOL_PROFILE_DEFAULTS[id].m==='pro'?'synthetic-pro':'synthetic-flash',level:TOOL_PROFILE_DEFAULTS[id].lv}),autoProfile:true}),[]);");
  const old='callGemini=async()=>{';
  if(html.split(old).length!==2)throw Error('Synthetic transport anchor changed.');
  html=html.replace(old,()=>validReceipt.toString()+String.raw`
window.__ankiReviewFixture={calls:[],generationCalls:[],auditMode:'valid',pending:[]};
callGemini=async(apiKey,model,parts,options={})=>{
  const probe=window.__ankiReviewFixture;
  if(parts?.[0]?.text?.includes('AUDIT PACKET:')){
    const packet=JSON.parse(parts[0].text.split('AUDIT PACKET:')[1]);
    probe.calls.push({model,level:options.thinkingLevel,packet});
    const findings=probe.auditMode==='finding'?[{code:'missing-target',factIds:[packet.sourceFactIds[0]],noteIds:[],message:'Synthetic source target needs review.',suggestion:'Ask for the supplied timing without adding a new value.'}]:[];
    const response=probe.auditMode==='invalid'?'invalid audit response':probe.auditMode==='no-receipts'?'{"findings":[]}':JSON.stringify(validReceipt(packet,findings));
    if(probe.auditMode==='delay')return new Promise(resolve=>probe.pending.push(()=>resolve(response)));
    options.onMeta?.({usage:{totalTokenCount:123}});return response;
  }
  probe.generationCalls.push({model,level:options.thinkingLevel});
`);
  return html;
}
async function main(){
  const html=page(),server=http.createServer((req,res)=>{if(req.method!=='GET'||req.url!=='/'){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port+'/',{chromium}=require('playwright');
  let browser,context,view;
  const errors=[],resourceErrors=[];
  try{
    browser=await chromium.launch({channel:'chrome',headless:true});
    context=await browser.newContext({serviceWorkers:'block',acceptDownloads:false});
    const network=await interceptContext(context,url,html);view=await context.newPage();view.setDefaultTimeout(15000);
    view.on('pageerror',e=>errors.push(e.message));
    view.on('requestfailed',request=>{const entry={url:request.url(),error:request.failure()?.errorText};resourceErrors.push(entry);console.error('Browser resource failure: '+JSON.stringify(entry));});
    await view.goto(url,{waitUntil:'load',timeout:45000});
    const prepare=()=>view.getByRole('button',{name:'Prepare review packet — no AI check yet',exact:true}).click();
    const run=()=>view.getByRole('button',{name:/^Run \d+ source check/}).click();
    const download=async(status,prepared=false)=>{
      const previous=await view.getByLabel('Captured export',{exact:true}).inputValue();
      await view.getByRole('button',{name:prepared?'Download unrun review packet':'Download source-check report',exact:true}).click();
      await view.waitForFunction(({expected,previous})=>{try{const text=document.querySelector('textarea[aria-label="Captured export"]').value;return text!==previous&&JSON.parse(text).status===expected;}catch{return false;}},{expected:status,previous});
      return JSON.parse(await view.getByLabel('Captured export',{exact:true}).inputValue());
    };
    await view.getByRole('button',{name:'▶ Generate Cards',exact:true}).click();
    await view.getByLabel('Text for note ',{exact:false}).first().waitFor();
    assert((await view.evaluate(()=>window.__ankiReviewFixture.generationCalls)).every(c=>c.model==='synthetic-flash'&&c.level==='medium'),'new recommended Anki generation uses Flash Medium');
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
    assert.equal(await view.getByLabel('Source checker model',{exact:true}).inputValue(),'flash');
    assert.equal(await view.getByLabel('Source checker thinking',{exact:true}).inputValue(),'medium');
    await view.getByLabel('Source checker model',{exact:true}).selectOption('pro');
    await view.getByLabel('Source checker thinking',{exact:true}).selectOption('high');
    await prepare();
    assert.equal(await view.evaluate(()=>window.__ankiReviewFixture.calls.length),0,'preparation is local');
    await view.getByText(/^Prepared — no AI check yet/).waitFor();
    const packet=await download('prepared',true);
    assert.equal(packet.results.length,0);assert.equal(packet.responses.length,0);assert.equal(packet.metadata.checkComplete,false);assert.equal(packet.metadata.currentAtExport,true);
    assert.equal(packet.model,'synthetic-pro');assert.equal(packet.thinkingLevel,'high');assert.equal(packet.metadata.generation.thinkingLevel,'medium');
    assert.match(packet.metadata.sourceSnapshotSha256,/^[a-f0-9]{64}$/);assert.match(packet.metadata.cardSnapshotSha256,/^[a-f0-9]{64}$/);assert.match(packet.metadata.audit.builderSha256,/^[a-f0-9]{64}$/);
    assert.equal(packet.metadata.startedAt,null);assert.equal(packet.metadata.finishedAt,null);assert(packet.metadata.preparedAt,'local preparation gets its own timestamp');
    await view.getByLabel('Source checker model',{exact:true}).selectOption('flash');
    await view.getByLabel('Source checker thinking',{exact:true}).selectOption('low');
    await view.evaluate(()=>{window.__ankiReviewFixture.auditMode='finding';});
    const cardsBeforeAudit=await view.getByLabel('Text for note ',{exact:false}).evaluateAll(fields=>fields.map(f=>f.value));
    await run();
    await view.getByText(/^Completed — review findings and target records/).waitFor();
    await view.getByText('Suggested correction:',{exact:true}).first().waitFor();
    assert((await view.getByText(/Ask for the supplied timing without adding a new value/).count())>0,'proposed correction is visible');
    assert.deepEqual(await view.getByLabel('Text for note ',{exact:false}).evaluateAll(fields=>fields.map(f=>f.value)),cardsBeforeAudit,'suggestions preserve original cards');
    assert((await view.evaluate(()=>window.__ankiReviewFixture.calls.length))>0,'explicit run invokes mocked audit');
    assert((await view.evaluate(()=>window.__ankiReviewFixture.calls)).every(c=>c.model==='synthetic-pro'&&c.level==='high'),'prepared checker choice survives subsequent selector changes');
    const evidence=await download('complete');
    assert.equal(evidence.status,'complete');assert.equal(evidence.responses[0].usage.totalTokenCount,123);assert.equal(evidence.results[0].findings[0].suggestion,'Ask for the supplied timing without adding a new value.');assert(!JSON.stringify(evidence).includes('synthetic-only'),'saved evidence excludes API credential');
    assert.equal(evidence.metadata.checkComplete,true);assert.equal(evidence.metadata.currentAtExport,true);assert(evidence.metadata.startedAt&&evidence.metadata.finishedAt);
    assert.equal(evidence.metadata.sourceSnapshotSha256,packet.metadata.sourceSnapshotSha256);assert.equal(evidence.metadata.cardSnapshotSha256,packet.metadata.cardSnapshotSha256);
    assert(evidence.results.every(g=>Array.isArray(g.factReviews)&&Array.isArray(g.noteReviews)),'completed report retains every returned review receipt');
    await view.getByText('Checked targets and note fields ·',{exact:false}).first().click();
    await view.getByText("These are the checker's judgments.",{exact:false}).first().waitFor({state:'visible'});
    assert((await view.getByText('Text: supported',{exact:true}).count())>0);assert((await view.getByText('Extra: empty',{exact:true}).count())>0);

    // Source links are explicit user edits; they invalidate the old report while
    // keeping its captured evidence and the original response independent.
    const reviewSummary=view.getByText('Review and source ·',{exact:false}).first();
    if(await reviewSummary.locator('..').getAttribute('open')===null)await reviewSummary.click();
    await view.getByText('Edit source links',{exact:true}).first().click();
    const sourceInput=view.getByLabel('Source links for note ',{exact:false}).first(),oldLinks=await sourceInput.inputValue();
    await sourceInput.fill('fact-999999');await view.getByRole('button',{name:'Apply source links',exact:true}).first().click();
    await view.getByRole('alert').filter({hasText:'Unknown source IDs were not applied'}).waitFor();
    assert.equal((await download('complete')).metadata.currentAtExport,true,'rejected source links do not invalidate the completed report');
    await sourceInput.fill(oldLinks);
    await view.getByLabel('Source fact for note ',{exact:false}).first().selectOption('fact-3');
    await view.getByRole('button',{name:'Add to draft links',exact:true}).first().click();
    assert((await sourceInput.inputValue()).includes('fact-3'),'captured fact browser adds the selected fact to the draft');
    await view.getByRole('button',{name:'Apply source links',exact:true}).first().click();
    await view.getByText(/1 source-link edit\(s\) recorded/).first().waitFor();
    await view.getByText(/outdated for the current notes or source/).waitFor();
    const oldEvidence=await download('outdated');
    assert.equal(oldEvidence.runStatus,'complete');assert.equal(oldEvidence.metadata.checkComplete,false);assert.equal(oldEvidence.metadata.currentAtExport,false);
    assert.equal(oldEvidence.metadata.cardSnapshotSha256,evidence.metadata.cardSnapshotSha256,'outdated evidence retains the originally checked cards');
    assert.deepEqual(await view.getByLabel('Text for note ',{exact:false}).evaluateAll(fields=>fields.map(f=>f.value)),cardsBeforeAudit,'source-link edits preserve note wording');
    await prepare();
    const editedPacket=await download('prepared',true);
    assert.notEqual(editedPacket.metadata.cardSnapshotSha256,evidence.metadata.cardSnapshotSha256,'reprepared packet hashes the edited links');
    assert.equal(editedPacket.metadata.sourceSnapshotSha256,evidence.metadata.sourceSnapshotSha256,'editing links does not alter source facts');
    assert(editedPacket.noteEdits.some(c=>c.sourceLinkEdits.some(e=>e.after.includes('fact-3'))),'new packet records explicit link-edit provenance');
    await view.evaluate(()=>{window.__ankiReviewFixture.auditMode='valid';});await run();
    await view.getByText(/^Completed — review findings and target records/).waitFor();
    assert.equal((await download('complete')).metadata.currentAtExport,true,'a fresh run after source-link edits is current');
    await view.getByLabel('Text for note ',{exact:false}).first().fill('[Example] Timing: {{c1::9 minutes}}.');
    await view.getByText(/outdated for the current notes or source/).waitFor();
    await view.evaluate(()=>{window.__ankiReviewFixture.auditMode='invalid';});
    await prepare();await run();
    await view.getByText(/^Failed — check incomplete/).waitFor();
    assert.equal((await download('failed')).responses[0].raw,'invalid audit response');
    await view.evaluate(()=>{window.__ankiReviewFixture.auditMode='no-receipts';});await prepare();await run();
    await view.getByText(/^Failed — check incomplete/).waitFor();
    const incomplete=await download('failed');
    assert.equal(incomplete.results.length,0);assert.equal(incomplete.responses[0].raw,'{"findings":[]}');assert.equal(incomplete.metadata.checkComplete,false,'findings-only output cannot count as a completed source check');
    await view.evaluate(()=>{window.__ankiReviewFixture.auditMode='delay';});
    await prepare();await run();
    await view.waitForFunction(()=>window.__ankiReviewFixture.pending.length===1);
    assert(await view.getByLabel('Source checker model',{exact:true}).isDisabled());assert(await view.getByLabel('Source checker thinking',{exact:true}).isDisabled());
    await view.getByRole('button',{name:'Cancel source check',exact:true}).click();
    await view.evaluate(()=>window.__ankiReviewFixture.pending.splice(0).forEach(resolve=>resolve()));
    await view.getByText(/^Cancelled — check incomplete/).waitFor();
    assert.equal(await view.getByRole('button',{name:'Cancel source check',exact:true}).count(),0);
    await view.getByRole('button',{name:'Replace KB',exact:true}).click();
    await view.getByText(/These notes belong to an earlier Knowledge Base/).waitFor();
    assert(await view.getByRole('button',{name:'⬇ Export .txt',exact:true}).isDisabled());
    await view.setViewportSize({width:360,height:900});
    const overflow=await view.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);assert(!overflow,'mobile viewport does not overflow');
    fs.mkdirSync('scratch/anki-v16.2/browser',{recursive:true});
    await view.screenshot({path:'scratch/anki-v16.2/browser/mobile.png',fullPage:true});
    await view.getByLabel('Empty fixture response',{exact:true}).check();
    await view.getByRole('button',{name:'▶ Generate Cards',exact:true}).click();
    await view.getByText('Optional · Check against KB',{exact:true}).waitFor();
    assert.equal(await view.getByLabel('Text for note ',{exact:false}).count(),0);
    await view.getByText('Optional · Check against KB',{exact:true}).click();
    assert(await view.getByRole('button',{name:'Prepare review packet — no AI check yet',exact:true}).isEnabled(),'empty completed batch can still be audited for missing targets');
    assert.deepEqual(errors,[]);assert.deepEqual(network.unexpected,[]);
    console.log('PASS Anki browser: Medium default, warning/export isolation, source-link edits, independent captured checker, unrun packet, review receipts, current/outdated reports, malformed or missing receipts, cancellation, source replacement, mobile layout. No live Gemini calls.');
  }catch(e){
    const diagnostics=await view?.evaluate(()=>({body:document.body.innerText.slice(-2200),calls:window.__ankiReviewFixture?.calls.length})).catch(()=>null);
    throw new Error(e.message+'\nBrowser diagnostics: '+JSON.stringify({errors,resourceErrors,...diagnostics}),{cause:e});
  }finally{await context?.close();await browser?.close();await new Promise(resolve=>server.close(resolve));}
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});
module.exports={page,main};
