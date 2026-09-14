#!/usr/bin/env node
'use strict';

// Optional acceptance with synthetic notes and mocked receipts only. No real API
// calls, uploaded material, credentials or repository directory serving.
const assert=require('assert/strict'),http=require('http'),fs=require('fs'),path=require('path');
const {page:basePage}=require('./anki-browser-fixture');
const {interceptContext}=require('./remediation-browser-tests');
const {validReceipt}=require('./fixtures/anki-audit-response');
function once(text,old,next){if(text.split(old).length!==2)throw Error('v16.6 fixture anchor must occur once: '+old.slice(0,80));return text.replace(old,()=>next);}
function page(){
  let html=basePage();
  html=once(html,'const fixtureData=ankiSyntheticFixture();',String.raw`const fixtureData=ankiSyntheticFixture();
fixtureData.kb={metadata:{schemaVersion:'1.0'},conditions:[{name:'Synthetic Validation',aliases:[],facts:['Choose alpha or beta.','Terms include Delta and Echo.','Risks include warmth, pressure, and motion.','Synthetic action may require adjustment.'].map((text,i)=>({id:'fact-'+(i+1),text,sourceQuote:text,tier:1,latteBucket:'Look',sources:[{filename:'Synthetic validation fixture',location:'item '+(i+1)}]}))}]};
window.__ankiV166Fixture={generationCalls:[],auditCalls:[],exports:[],partial:true};`);
  const a=html.indexOf('callGemini=async()=>{'),b=html.indexOf('\ndownloadBlob=async blob=>fixtureExport(await blob.text());',a);
  if(a<0||b<=a)throw Error('v16.6 mocked transport anchors moved.');
  html=once(html,html.slice(a,b),validReceipt.toString()+String.raw`
callGemini=async(apiKey,model,parts,options={})=>{
  const probe=window.__ankiV166Fixture;
  if(parts?.[0]?.text?.includes('AUDIT PACKET:')){
    const packet=JSON.parse(parts[0].text.split('AUDIT PACKET:')[1]),receipt=validReceipt(packet);
    probe.auditCalls.push({model,level:options.thinkingLevel,packet});
    const byLine=line=>packet.notes.find(note=>note.sourceLine===line),fact=id=>receipt.factReviews.find(review=>review.factId===id);
    const context=(start,end,reason)=>({sourceRef:{start,end},role:'context',reason}),target=(start,end)=>({sourceRef:{start,end},role:'target',reason:'Synthetic recall target.'});
    if(fact('fact-1')){
      const n1=byLine(1),n2=byLine(2);if(!n1||!n2)throw Error('Synthetic linked notes must remain in their shared packet.');
      fact('fact-1').inventory=[context(1,1,'Instructional connective.'),target(2,2),context(3,3,'Conjunction.'),target(4,4)];
      fact('fact-1').targets=[{sourceRef:{start:2,end:2},status:'tested',noteRefs:[{noteId:n1.id,clozeIndices:[1]}],contextRefs:[]},{sourceRef:{start:4,end:4},status:'extra-only',noteRefs:[],contextRefs:[{noteId:n1.id,field:'text'},{noteId:n2.id,field:'extra'}]}];
    }
    if(fact('fact-2')){
      const n3=byLine(3);fact('fact-2').targets[0].noteRefs=[{noteId:n3.id,clozeIndices:[1]},{noteId:n3.id,clozeIndices:[2]}];
      const noteReview=receipt.noteReviews.find(review=>review.noteId===n3.id);
      for(const field of ['text','extra'])noteReview[field]={status:'supported',evidence:[{factId:'fact-2',sourceRef:{start:3,end:3}}]};
    }
    if(fact('fact-3')){
      fact('fact-3').inventory=[context(1,2,'Risk-list introduction.'),target(3,3),context(4,6,'Pressure and motion are supporting context.')];
      fact('fact-3').targets[0].sourceRef={start:3,end:3};
    }
    if(fact('fact-4')&&probe.partial)fact('fact-4').inventory[0].sourceRef.start=2;
    options.onMeta?.({usage:{totalTokenCount:42}});return JSON.stringify(receipt);
  }
  probe.generationCalls.push({model,level:options.thinkingLevel});
  const notes=[
    '[Synthetic] Choice: {{c1::alpha}} or beta.||Nursing::LATTE::Look Condition::SyntheticValidation Tier::1',
    '[Synthetic] Reminder: {{c1::gamma}}.|beta|Nursing::LATTE::Look Condition::SyntheticValidation Tier::1',
    '[Synthetic] Definition: {{c1::Delta}} means a {{c2::complex state}}.|Delta means a complex state.|Nursing::LATTE::Look Condition::SyntheticValidation Tier::1',
    '[Synthetic] Risk: {{c1::warmth}}, pressure, and motion.||Nursing::LATTE::Look Condition::SyntheticValidation Tier::1',
    '[Synthetic] Action: {{c1::adjustment}} is required.||Nursing::LATTE::Look Condition::SyntheticValidation Tier::1'
  ];
  return String.fromCharCode(96).repeat(3)+'text\n'+notes.join('\n')+'\n'+String.fromCharCode(96).repeat(3)+'\n'+String.fromCharCode(96).repeat(3)+'text\n'+['fact-1 -> line #1','fact-1 -> line #2','fact-2 -> line #3','fact-3 -> line #4','fact-4 -> line #5'].join('\n')+'\n'+String.fromCharCode(96).repeat(3);
};`);
  html=once(html,'downloadBlob=async blob=>fixtureExport(await blob.text());',String.raw`downloadBlob=async(blob,name)=>{const text=await blob.text();window.__ankiV166Fixture.exports.push({name,text});fixtureExport(text);};`);
  html=once(html,"const cfg=useMemo(()=>({apiKey:'synthetic-only',forTool:()=>({model:'synthetic-fixture',level:'low'}),autoProfile:true}),[]);","const cfg=useMemo(()=>({apiKey:'synthetic-only',flashModel:'synthetic-flash',proModel:'synthetic-pro',forTool:id=>({model:TOOL_PROFILE_DEFAULTS[id].m==='pro'?'synthetic-pro':'synthetic-flash',level:TOOL_PROFILE_DEFAULTS[id].lv}),autoProfile:true}),[]);");
  return html;
}

async function main(){
  const html=page(),output=path.join(__dirname,'../scratch/anki-next/browser-v166');fs.mkdirSync(output,{recursive:true});
  const server=http.createServer((req,res)=>{if(req.method!=='GET'||req.url!=='/'){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(html);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port+'/',{chromium}=require('playwright');
  let browser,context,view,network;const checks=[],errors=[],resourceErrors=[];
  const check=(name,value)=>{assert(value,name);checks.push(name);};
  try{
    browser=await chromium.launch(process.env.REMEDIATION_BROWSER_EXECUTABLE?{executablePath:process.env.REMEDIATION_BROWSER_EXECUTABLE,headless:true}:{channel:'chrome',headless:true});
    context=await browser.newContext({serviceWorkers:'block',acceptDownloads:false});network=await interceptContext(context,url,html);
    view=await context.newPage();view.setDefaultTimeout(20000);view.on('pageerror',error=>errors.push(error.message));view.on('requestfailed',request=>resourceErrors.push({url:request.url(),error:request.failure()?.errorText}));
    await view.goto(url,{waitUntil:'load',timeout:45000});
    const download=async name=>{const count=await view.evaluate(()=>window.__ankiV166Fixture.exports.length);await view.getByRole('button',{name,exact:true}).click();await view.waitForFunction(n=>window.__ankiV166Fixture.exports.length>n,count);return view.evaluate(()=>window.__ankiV166Fixture.exports.at(-1));};
    await view.getByRole('button',{name:'▶ Generate Cards',exact:true}).click();
    const fields=view.getByLabel('Text for note ',{exact:false});await fields.nth(4).waitFor();
    check('five synthetic notes remain editable',await fields.count()===5);
    const original=(await download('⬇ Export .txt')).text;
    await view.getByText('Optional · Check against KB',{exact:true}).click();
    await view.getByLabel('Source checker thinking',{exact:true}).selectOption('low');
    await view.getByRole('button',{name:'Prepare review packet — no AI check yet',exact:true}).click();
    await view.getByText(/^Prepared — no AI check yet/).waitFor();
    check('preparing remains local',await view.evaluate(()=>window.__ankiV166Fixture.auditCalls.length)===0);
    await view.getByRole('button',{name:/^Run \d+ source check/}).click();
    await view.getByRole('button',{name:/^Retry \/ resume \d+ source check/}).waitFor();
    const report=JSON.parse((await download('Download source-check report')).text);
    check('strict inventory failure leaves an honest partial run',report.status==='partial'&&!report.metadata.checkComplete&&report.metadata.unresolvedRecords.some(r=>r.factId==='fact-4'));
    check('partial run retains all five valid note records',report.results.flatMap(r=>r.noteReviews).length===5);
    check('normalizations are exported separately from citation recoveries',report.metadata.referenceNormalizations===2&&report.metadata.recoveredCitations===0);
    const result=report.results.find(r=>r.factReviews.some(f=>f.factId==='fact-1'));
    const mixed=result.factReviews.find(f=>f.factId==='fact-1').targets.find(t=>t.sourceRef.start===4);
    check('captured mixed target retains both locations and stays untested',mixed.status==='visible-only'&&mixed.noteRefs.length===0&&mixed.contextRefs.length===2);
    check('mocked check captures Flash Low without a live request',await view.evaluate(()=>window.__ankiV166Fixture.auditCalls.every(c=>c.model==='synthetic-flash'&&c.level==='low')));
    await view.getByText('Checked targets and note fields ·',{exact:false}).first().click();
    await view.getByText('Text and Extra',{exact:false}).first().waitFor();
    const normalizations=view.locator('[data-anki-reference-recoveries]');await normalizations.locator('summary').click();
    check('normalization details expose original and recorded reference shapes',(await normalizations.innerText()).includes('Returned:')&&(await normalizations.innerText()).includes('Recorded:')&&(await normalizations.innerText()).includes('merged-disjoint-cloze-references'));
    check('mixed receipt gives distinct visible Text and Extra navigation',await view.getByRole('button',{name:/ · visible Text$/}).count()>=1&&await view.getByRole('button',{name:/ · Extra$/}).count()>=1);
    const queue=view.locator('[data-anki-review-queue]');await queue.locator('summary').click();
    check('mixed target reaches the advisory queue',await queue.getByRole('button',{name:/^visible-only ·/}).count()===1);
    const evidenceButtons=queue.getByRole('button',{name:/^receipt-evidence-review ·/});
    check('Text and Extra weak-evidence advisories remain separate',await evidenceButtons.count()===2);
    check('context classification and source qualifier advisories reach the queue',await queue.getByRole('button',{name:/^inventory-context ·/}).count()>=1&&await queue.getByRole('button',{name:/^source-qualifier-review ·/}).count()>=1);
    await evidenceButtons.nth(0).click();await view.getByLabel('Review reason',{exact:true}).fill('Synthetic Text-only decision; no claim of semantic accuracy.');await view.getByRole('button',{name:'Save review decision',exact:true}).click();
    check('reviewing one field does not resolve the other field',await queue.getByRole('button',{name:/^receipt-evidence-review ·/}).count()===1);
    check('partial results and advisories preserve exact export bytes',(await download('⬇ Export .txt')).text===original);
    const rows=view.getByRole('table',{name:'Editable Anki notes',exact:true}).locator('tbody tr');
    check('review decisions preserve each manually checked note',await rows.getByRole('checkbox').evaluateAll(elements=>elements.every(input=>input.checked)));
    await view.setViewportSize({width:360,height:900});
    check('expanded mixed receipts, normalization details and decision panel reflow at 360px',await view.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
    await view.screenshot({path:path.join(output,'mixed-partial-mobile.png'),fullPage:true});
    await view.locator('[data-anki-review-decision]').screenshot({path:path.join(output,'review-decision-mobile.png')});
    await view.setViewportSize({width:1280,height:900});
    await view.evaluate(()=>{window.__ankiV166Fixture.partial=false;});
    await view.getByRole('button',{name:/^Retry \/ resume \d+ source check/}).click();await view.getByText(/^Completed — review findings and target records/).waitFor();
    const complete=JSON.parse((await download('Download source-check report')).text);
    check('explicit retry resolves only the pending protocol obligation',complete.status==='complete'&&complete.metadata.checkComplete&&complete.results.flatMap(r=>r.factReviews).length===4);
    check('retry deduplicates normalization history and preserves attempts',complete.metadata.referenceNormalizations===2&&complete.responses.length===2);
    check('retry and accepted receipts still preserve export bytes',(await download('⬇ Export .txt')).text===original);
    check('synthetic diagnostics never contain the fixture credential',!JSON.stringify(complete).includes('synthetic-only'));
    check('no uncaught browser errors occurred',errors.length===0);check('no unapproved browser network requests occurred',network.unexpected.length===0);
    const acceptance={status:'pass',checks,errors,resourceErrors,network,limitations:'Synthetic UI acceptance only; no live Gemini requests, private source material, or native Anki import.'};
    fs.writeFileSync(path.join(output,'acceptance.json'),JSON.stringify(acceptance,null,2)+'\n');
    fs.writeFileSync(path.join(output,'partial-report.json'),JSON.stringify(report,null,2)+'\n');fs.writeFileSync(path.join(output,'complete-report.json'),JSON.stringify(complete,null,2)+'\n');
    console.log('PASS '+checks.length+' Anki v16.6 browser checks. No live Gemini calls.');
  }catch(error){
    const state=await view?.evaluate(()=>({body:document.body.innerText.slice(-4000),calls:window.__ankiV166Fixture?.auditCalls.length})).catch(()=>null);
    fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({checks,errors,resourceErrors,network,state,error:error.stack||String(error)},null,2)+'\n');
    if(view)await view.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});throw error;
  }finally{await context?.close();await browser?.close();await new Promise(resolve=>server.close(resolve));}
}
module.exports={page,main};
if(require.main===module)main().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
