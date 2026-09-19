#!/usr/bin/env node
'use strict';

// Optional browser acceptance, never a live-API measurement. Uses an existing
// Playwright installation (NODE_PATH) and a disposable Chromium profile/context.
// It has no executable side effects when imported by ordinary repository gates.
const assert=require('assert/strict');
const {page:fixturePage,createServer,syntheticKB,once}=require('./remediation-browser-fixture');

function approvedResources(html){
  const scripts=new Set(Array.from(html.matchAll(/<script src=["'](https:[^"']+)["']/g),m=>m[1]));
  const workers=new Set(Array.from(html.matchAll(/https:\/\/[^'"\s<>]+\/pdf\.worker(?:\.min)?\.(?:js|mjs)/g),m=>m[0]));
  const styles=new Set(Array.from(html.matchAll(/<link[^>]+href=["'](https:[^"']+)["'][^>]+rel=["']stylesheet["']/g),m=>m[1].replace(/&amp;/g,'&')));
  return {scripts,workers,styles};
}

async function interceptContext(context,url,html){
  const allow=approvedResources(html),network={unexpected:[],scripts:[],workers:[],suppressedFonts:[]};
  // BrowserContext routing, unlike page routing or fetch patching, sees popup
  // first requests and subresources. Service workers are disabled on the context.
  await context.route('**/*',async route=>{
    const request=route.request(),target=request.url(),type=request.resourceType();
    if(target===url&&type==='document')return route.continue();
    if(allow.scripts.has(target)&&type==='script'){network.scripts.push(target);return route.continue();}
    if(allow.workers.has(target)&&(type==='script'||type==='fetch'||type==='other')){network.workers.push(target);return route.continue();}
    // Fonts do not affect correctness assertions. No remote font stylesheets or
    // descendant fonts are fetched during storage and resource-policy tests.
    if(allow.styles.has(target)&&type==='stylesheet'){network.suppressedFonts.push(target);return route.fulfill({status:200,contentType:'text/css',body:''});}
    network.unexpected.push({url:target,type});return route.abort('blockedbyclient');
  });
  return network;
}

async function selfTest(){
  const source=fixturePage({hold:['load'],local:syntheticKB('A')});
  assert(source.includes('<BootErrorBoundary><App/></BootErrorBoundary>'),'fixture must mount the shipped App');
  assert(!source.includes('SyntheticAnkiApp'),'real-App fixture may not substitute App');
  assert(source.includes('<RemediationProbe/>'),'the state probe must be mounted inside the live contexts');
  assert.throws(()=>once('duplicate duplicate','duplicate','replacement'),/exactly once/);
  assert.throws(()=>once('missing','absent','replacement'),/exactly once/);
  assert.equal(approvedResources(source).scripts.size,8,'every pinned CDN script, including sanitizer fallback, is accounted for');
  assert(!fixturePage({label:'</script><script>bad</script>'}).includes('const remediationConfig={"label":"</script>'));
  const {server,url}=await createServer();
  try{
    assert.equal((await fetch(url)).status,200);
    for(const suffix of ['AGENTS.md','latte-tests.js','private.pdf','?source=other','../README.md'])assert.equal((await fetch(url+suffix)).status,404);
    assert.equal((await fetch(url,{method:'POST'})).status,404);
  }finally{await new Promise(resolve=>server.close(resolve));}
  return 14;
}

async function withFixture(browser,config,run){
  const {server,url}=await createServer({config});
  const context=await browser.newContext({serviceWorkers:'block',acceptDownloads:false});
  let view;
  const errors=[];
  try{
    const network=await interceptContext(context,url,fixturePage(config));
    await context.addInitScript(()=>{window.confirm=()=>true;window.print=()=>{window.__remediationPrints=(window.__remediationPrints||0)+1;};});
    context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
    view=await context.newPage();
    await view.goto(url,{waitUntil:'load',timeout:45000});
    await view.waitForFunction(()=>window.__remediation?.state,{timeout:30000});
    await run({page:view,context,network,url});
    assert.deepEqual(errors,[],'browser must not report uncaught exceptions');
    assert.deepEqual(await view.evaluate(()=>window.__remediation.errors),[],'fixture must reject any unplanned Gemini operation');
    assert.deepEqual(network.unexpected,[],'no unapproved browser request may escape the output policy');
  }catch(e){
    if(view){let timer;const diagnostic=await Promise.race([view.evaluate(()=>({fixture:window.__remediation?.snapshot(),body:document.body.innerText.slice(-1400)})).catch(()=>null),new Promise(resolve=>{timer=setTimeout(()=>resolve('unresponsive'),1500);})]).finally(()=>clearTimeout(timer));throw new Error(e.message+'\nFixture diagnostics: '+JSON.stringify(diagnostic),{cause:e});}
    throw e;
  }finally{await context.close();await new Promise(resolve=>server.close(resolve));}
}

async function waitStatus(page,status){await page.waitForFunction(expected=>window.__remediation?.state?.persistenceStatus===expected,status);}
async function waitCourse(page,label){await page.waitForFunction(expected=>window.__remediation?.state?.knowledgeBase?.metadata?.course==='Synthetic course '+expected,label);}
async function currentCourse(page){return page.evaluate(()=>window.__remediation.state.knowledgeBase.metadata?.course||'');}
async function releaseFirst(page,kind,stage='before'){
  await page.waitForFunction(({kind,stage})=>window.__remediation.pending.some(x=>x.kind===kind&&x.stage===stage),{kind,stage});
  return page.evaluate(({kind,stage})=>{const p=window.__remediation.pending.find(x=>x.kind===kind&&x.stage===stage);window.__remediation.release(p.id);return p.id;},{kind,stage});
}

async function storageTests(browser,report){
  const A=syntheticKB('A'),B=syntheticKB('B'),C=syntheticKB('C');
  await withFixture(browser,{},async({page})=>{
    await waitStatus(page,'ready');assert.equal(await currentCourse(page),'');
    const stores=await page.evaluate(()=>window.__remediation.readStores());assert.deepEqual(stores.indexed,[]);
  });report('empty stores mount actual App without inventing a save');
  for(const config of [{indexed:A},{local:A},{indexed:A,local:A}]){
    await withFixture(browser,config,async({page})=>{await waitCourse(page,'A');await waitStatus(page,'ready');await page.reload();await waitCourse(page,'A');});
  }report('either legacy store and identical stores survive reload');
  await withFixture(browser,{indexed:A,local:B},async({page})=>{
    await waitStatus(page,'conflict');
    const before=await page.evaluate(()=>window.__remediation.readStores());
    assert.equal(before.indexed.find(x=>x.key==='active').value.metadata.course,A.metadata.course);
    assert.equal(JSON.parse(before.local.latte_knowledge_base_v1).metadata.course,B.metadata.course);
    const choices=await page.evaluate(()=>window.__remediation.state.recovery);assert.equal(choices.length,2);
    await page.evaluate(()=>window.__remediation.context.chooseRecovery(1));await waitStatus(page,'saved');await waitCourse(page,'B');
    const after=await page.evaluate(()=>window.__remediation.readStores());assert(after.indexed.some(x=>String(x.key).startsWith('recovery-')&&x.value.length===2),'both conflicting snapshots are archived before replacement');
    await page.reload();await waitCourse(page,'B');
  });report('legacy conflicts remain preserved until a recoverable choice, then reload chosen KB');
  await withFixture(browser,{indexed:A,hold:['load']},async({page})=>{
    const input=page.locator('input[type=file][accept=".json,application/json"]');
    await input.setInputFiles({name:'synthetic-b.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(B))});
    await waitCourse(page,'B');await releaseFirst(page,'load');await waitStatus(page,'saved');assert.equal(await currentCourse(page),B.metadata.course);
    await page.reload();await releaseFirst(page,'load');await waitCourse(page,'B');
  });report('actual JSON import during delayed hydration owns final KB and durable reload');
  await withFixture(browser,{},async({page})=>{
    await waitStatus(page,'ready');await page.evaluate(()=>window.__remediation.failNext('save'));
    await page.evaluate(kb=>window.__remediation.replace(kb),A);await waitStatus(page,'fallback');
    await page.evaluate(kb=>window.__remediation.replace(kb),B);await waitStatus(page,'saved');
    const stores=await page.evaluate(()=>window.__remediation.readStores());assert.equal(stores.indexed.find(x=>x.key==='active').value.metadata.course,B.metadata.course);assert.equal(stores.local.latte_knowledge_snapshot_v2,undefined);
    await page.reload();await waitCourse(page,'B');
  });report('failed save A followed by durable save B removes only obsolete fallback and reloads B');
  await withFixture(browser,{},async({page})=>{
    await waitStatus(page,'ready');await page.evaluate(kb=>window.__remediation.replace(kb),A);await waitStatus(page,'saved');
    await page.evaluate(()=>window.__remediation.failNext('save'));await page.evaluate(kb=>window.__remediation.replace(kb),B);await waitStatus(page,'fallback');
    await page.reload();await waitCourse(page,'B');
  });report('durable A followed by fallback B reloads newer fallback B');
  await withFixture(browser,{},async({page})=>{
    await waitStatus(page,'ready');await page.evaluate(()=>window.__remediation.hold('save','after'));
    await page.evaluate(kb=>window.__remediation.replace(kb),A);await page.waitForFunction(()=>window.__remediation.pending.some(x=>x.kind==='save'));
    await page.evaluate(kb=>window.__remediation.replace(kb),B);await waitCourse(page,'B');
    await page.evaluate(kb=>window.__remediation.replace(kb),C);await waitCourse(page,'C');
    assert.equal(await page.evaluate(()=>window.__remediation.events.filter(x=>x.kind==='save').length),1,'later writes must wait for prior completion');
    await releaseFirst(page,'save','after');await page.waitForFunction(()=>window.__remediation.events.filter(x=>x.kind==='save').length===2);
    assert.equal(await page.evaluate(()=>window.__remediation.state.persistenceStatus),'saving','older committed callback cannot report the current snapshot saved');
    await releaseFirst(page,'save','after');await page.waitForFunction(()=>window.__remediation.events.filter(x=>x.kind==='save').length===3);
    await page.evaluate(()=>window.__remediation.resume('save','after'));await releaseFirst(page,'save','after');await waitStatus(page,'saved');
    await page.reload();await waitCourse(page,'C');
  });report('A/B/C completion holds preserve serialized writes and current save status');
  await withFixture(browser,{},async({page})=>{
    await waitStatus(page,'ready');await page.evaluate(kb=>window.__remediation.replace(kb),A);await waitStatus(page,'saved');
    await page.evaluate(()=>{window.__remediation.failNext('delete');window.__remediation.clear();});await waitStatus(page,'fallback');
    await page.reload();await waitStatus(page,'ready');assert.equal(await currentCourse(page),'');
  });report('failed clear writes an ordered fallback tombstone and does not resurrect saved KB');
  await withFixture(browser,{},async({page,context,url})=>{
    await waitStatus(page,'ready');await page.evaluate(kb=>window.__remediation.replace(kb),A);await waitStatus(page,'saved');
    const other=await context.newPage();await other.goto(url);await waitCourse(other,'A');
    await page.evaluate(kb=>window.__remediation.replace(kb),B);await waitStatus(page,'saved');
    await other.evaluate(kb=>window.__remediation.replace(kb),C);await waitStatus(other,'error');
    assert.equal(await currentCourse(other),C.metadata.course,'conflicting in-memory work remains inspectable');
    const stores=await page.evaluate(()=>window.__remediation.readStores());assert.equal(stores.indexed.find(x=>x.key==='active').value.metadata.course,B.metadata.course);
    assert.equal(stores.local.latte_knowledge_snapshot_v2,undefined,'concurrent conflict cannot overwrite a recovery fallback');
    await other.close();
  });report('concurrent tab writers report a conflict and preserve the newer durable snapshot');
  await withFixture(browser,{},async({page,context,url})=>{
    await waitStatus(page,'ready');await page.evaluate(()=>window.__remediation.failNext('save'));await page.evaluate(kb=>window.__remediation.replace(kb),A);await waitStatus(page,'fallback');
    const other=await context.newPage();await other.goto(url);await waitCourse(other,'A');
    await page.evaluate(()=>window.__remediation.failNext('save'));await page.evaluate(kb=>window.__remediation.replace(kb),B);await waitStatus(page,'fallback');
    await other.evaluate(()=>window.__remediation.failNext('save'));await other.evaluate(kb=>window.__remediation.replace(kb),C);await waitStatus(other,'error');
    assert.equal(await currentCourse(other),C.metadata.course);
    const stores=await page.evaluate(()=>window.__remediation.readStores());assert.equal(JSON.parse(stores.local.latte_knowledge_snapshot_v2).kb.metadata.course,B.metadata.course);
    await other.close();
  });report('concurrent fallback writers preserve both saved and in-memory snapshots instead of silently replacing the fallback');
  await withFixture(browser,{fallback:{}},async({page})=>{
    await waitStatus(page,'conflict');const stores=await page.evaluate(()=>window.__remediation.readStores());
    assert.equal(stores.local.latte_knowledge_snapshot_v2,'{}');assert.deepEqual(stores.indexed,[]);
    assert((await page.evaluate(()=>window.__remediation.state.persistenceError)).includes('preserved'));
    assert.equal(await page.evaluate(()=>window.__remediation.state.recovery[0].raw),'{}');
  });report('malformed fallback metadata blocks migration and remains intact');
  await withFixture(browser,{hold:['load']},async({page})=>{
    await page.evaluate(()=>window.__remediation.unmount());await releaseFirst(page,'load');
    await page.waitForFunction(()=>window.__remediation.events[0].status==='resolved');
    assert.deepEqual((await page.evaluate(()=>window.__remediation.readStores())).indexed,[]);
  });report('unmount during hydration prevents publication and spurious persistence');
}

async function outputPolicyTests(browser,report){
  const markdown='# Synthetic output\n\nA < B and C > D & literal text.\n\n| Marker | State |\n| --- | --- |\n| A | present |\n\n'
    +'<style>@import url(https://unapproved.invalid/style);p{background:url(https://unapproved.invalid/background)}</style>'
    +'<img src="https://unapproved.invalid/image" srcset="https://unapproved.invalid/srcset 2x">'
    +'<picture><source srcset="https://unapproved.invalid/picture"></picture><audio src="https://unapproved.invalid/audio"></audio>'
    +'<video poster="https://unapproved.invalid/poster" src="https://unapproved.invalid/video"></video>'
    +'<svg><image href="https://unapproved.invalid/svg"></image></svg><iframe src="https://unapproved.invalid/frame"></iframe>'
    +'<p style="background:url(https://unapproved.invalid/inline)">Preserved words</p>';
  await withFixture(browser,{},async({page,context})=>{
    await waitStatus(page,'ready');
    const markup=await page.evaluate(md=>window.__remediation.renderMarkdown(md),markdown);
    assert(!/<(?:style|img|picture|source|audio|video|svg|iframe|object|embed)\b|\sstyle=|\ssrcset=/i.test(markup));
    assert(markup.includes('Preserved words'));assert(markup.includes('<table>'));assert(markup.includes('A &lt; B'));
    const popupPromise=context.waitForEvent('page');await page.evaluate(md=>window.__remediation.print(md),markdown);
    const popup=await popupPromise;await popup.waitForLoadState();
    assert.equal(await popup.evaluate(()=>window.opener),null,'print preview must not retain the study-window opener');
    assert((await popup.locator('body').innerText()).includes('Preserved words'));
    assert.equal(await popup.locator('img,picture,source,audio,video,svg,iframe,object,embed').count(),0);
    await page.evaluate(md=>window.__remediation.printIframe(md),markdown);
    await page.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.body?.textContent.includes('Preserved words'));
    const frame=page.frameLocator('iframe').first();assert((await frame.locator('body').innerText()).includes('Preserved words'));
    assert.equal(await frame.locator('img,picture,source,audio,video,svg,iframe,object,embed').count(),0);
    assert.equal(await page.locator('.nav-logo').count(),1,'trusted app remains mounted');
    assert(await page.locator('.rail svg').count()>0,'trusted application icons survive the output policy');
    await page.evaluate(()=>{const img=document.createElement('img');img.id='synthetic-csp-probe';img.src='https://unapproved.invalid/csp-probe';document.body.appendChild(img);});
    await page.waitForFunction(()=>window.__remediation.csp.some(x=>x.directive.startsWith('img-src')&&x.uri.includes('unapproved.invalid/csp-probe')));
    await page.locator('#synthetic-csp-probe').evaluate(node=>node.remove());
  });report('sanitized app, popup and iframe output retain text/tables without remote resource requests');
}

async function ownershipTests(browser,report){
  const A=syntheticKB('A'),B=syntheticKB('B'),C=syntheticKB('C');
  await withFixture(browser,{indexed:A,hold:['file']},async({page})=>{
    await waitCourse(page,'A');const input=page.locator('input[type=file][accept=".json,application/json"]');
    await input.setInputFiles({name:'synthetic-b.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(B))});
    await input.setInputFiles({name:'synthetic-c.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(C))});
    await page.waitForFunction(()=>window.__remediation.pending.filter(x=>x.kind==='file').length===2);
    await page.evaluate(()=>window.__remediation.release(window.__remediation.pending.find(x=>x.snapshot?.name==='synthetic-c.json').id));await waitCourse(page,'C');await waitStatus(page,'saved');
    await page.evaluate(()=>window.__remediation.release(window.__remediation.pending.find(x=>x.snapshot?.name==='synthetic-b.json').id));
    await page.waitForFunction(()=>window.__remediation.events.filter(x=>x.kind==='file').every(x=>x.status==='resolved'));
    assert.equal(await currentCourse(page),C.metadata.course);await page.reload();await waitCourse(page,'C');
  });report('two actual JSON imports completing in reverse retain the later accepted replacement');
  await withFixture(browser,{indexed:A},async({page})=>{
    await waitCourse(page,'A');await page.getByTitle('Pyramid Priority Analyzer',{exact:true}).click();
    await page.evaluate(()=>{window.__remediation.queueGemini('Synthetic harvest');window.__remediation.queueGemini('Synthetic completed analysis',{defer:true});});
    await page.getByRole('button',{name:'△ Analyze Knowledge Base',exact:true}).click();
    await page.waitForFunction(()=>window.__remediation.geminiCalls.length===2);
    await page.evaluate(()=>window.__remediation.streamGemini('gemini:2','Synthetic streamed analysis'));
    await page.getByRole('heading',{name:'Priority Analysis',exact:true}).waitFor();
    const busy=page.getByRole('button',{name:'⏳ Analyzing...',exact:true});assert.equal(await busy.isDisabled(),true);
    await busy.evaluate(button=>button.click());assert.equal(await page.evaluate(()=>window.__remediation.geminiCalls.length),2);
    await page.getByRole('button',{name:'↺ New',exact:true}).click();
    await page.evaluate(()=>{window.__remediation.streamGemini('gemini:2','Stale stream must remain hidden');window.__remediation.resolveGemini('gemini:2');});
    await page.waitForFunction(()=>window.__remediation.geminiCalls[1].status==='resolved');
    assert.equal(await page.getByRole('button',{name:'△ Analyze Knowledge Base',exact:true}).isEnabled(),true);
    assert.equal(await page.getByRole('heading',{name:'Priority Analysis',exact:true}).count(),0);
    assert(!(await page.locator('body').innerText()).includes('Stale stream must remain hidden'));
  });report('Priority results remain busy during streaming, and reset rejects late callbacks');
}

async function sourceTests(browser,report){
  const A=syntheticKB('A'),B=syntheticKB('B');
  const response={title:'Synthetic source case',condition:'Synthetic condition A',stages:[{stageNumber:1,title:'Synthetic stage',narrative:'A fictional observation.',
    data:[{label:'Marker',value:'Fictional marker A is present.',supportType:'direct',availability:'revealed',factIds:['fact-1']}],
    questions:[{id:'q1',type:'MCQ',stem:'Choose the fictional marker.',options:[{label:'A',text:'Marker A'},{label:'B',text:'Marker B'}],correctAnswers:['A'],rationales:[{option:'A',text:'Fictional marker A is present.',supportType:'direct',factIds:['fact-1']},{option:'B',text:'Fictional marker A is present.',supportType:'direct',factIds:['fact-1']}]}]}],debrief:{notes:'Synthetic source has fewer facts than the requested case size.'}};
  await withFixture(browser,{indexed:A},async({page})=>{
    await waitCourse(page,'A');await page.getByTitle('Clinical Case Study Generator',{exact:true}).click();
    await page.getByRole('checkbox',{name:/Run the item-quality audit/}).uncheck();
    await page.evaluate(text=>window.__remediation.queueGemini(text),JSON.stringify(response));
    await page.getByRole('button',{name:'▶ Generate Case Study',exact:true}).click();
    await page.getByRole('heading',{name:'Synthetic source case',exact:true}).waitFor();
    await page.getByTitle('Inspect fact-1',{exact:true}).first().click();
    assert((await page.locator('body').innerText()).includes('Fictional marker A is present.'));
    await page.evaluate(kb=>window.__remediation.replace(kb),B);await waitCourse(page,'B');
    const stale=page.getByTitle('Earlier Knowledge Base: this reference belongs to the original source',{exact:true});assert(await stale.count()>0);
    assert.equal(await stale.first().evaluate(node=>node.tagName),'SPAN','old references cannot open current KB fact IDs');
    assert.equal(await page.getByRole('button',{name:'fact-1',exact:true}).count(),0);
    assert.equal(await page.evaluate(()=>window.__remediation.state.artifactRegistry.caseStudies.length),0);
    await page.getByRole('button',{name:'⬇ .md',exact:true}).click();
    await page.waitForFunction(()=>window.__remediation.exports.length>0);
    const exported=await page.evaluate(()=>window.__remediation.exports.at(-1).text);
    assert(exported.includes('Source: earlier Knowledge Base.'));assert(exported.includes('Item quality audit: disabled.'));
    assert(exported.includes('Fictional marker A is present.'));assert(!exported.includes('Fictional marker B is present.'));
    await page.getByRole('button',{name:'{ } JSON',exact:true}).click();await page.getByRole('button',{name:'📋 Copy',exact:true}).click();
    const copied=await page.evaluate(()=>JSON.parse(window.__remediation.copies.at(-1)));
    assert.equal(copied.title,response.title);assert.deepEqual(copied.stages,response.stages);
    assert(copied._suiteReview.notice.includes('Source: earlier Knowledge Base.'));assert(copied._suiteReview.notice.includes('Item quality audit: disabled.'));
    assert(Array.isArray(copied._suiteReview.validation));assert.deepEqual(copied._suiteReview.itemAudit,[]);
  });report('case generated from A retains original evidence when B reuses fact IDs; links and export notices stay honest');
  await withFixture(browser,{indexed:A},async({page})=>{
    await waitCourse(page,'A');await page.getByTitle('Clinical Case Study Generator',{exact:true}).click();
    await page.evaluate(()=>window.__remediation.queueGemini('{"stages":[null]}'));
    await page.getByRole('button',{name:'▶ Generate Case Study',exact:true}).click();
    await page.getByText('Invalid case response',{exact:true}).waitFor();
    assert((await page.locator('body').innerText()).includes('{"stages":[null]}'));
    await page.getByRole('button',{name:'Export invalid response',exact:true}).click();
    await page.waitForFunction(()=>window.__remediation.exports.length>0);
    assert.equal(await page.evaluate(()=>window.__remediation.exports.at(-1).text),'VALIDATION FAILED\n{"stages":[null]}');
    assert.equal(await page.evaluate(()=>window.__remediation.geminiCalls.length),1,'malformed case must not consume an audit operation');
    assert.equal(await page.evaluate(()=>window.__remediation.state.artifactRegistry.caseStudies.length),0);
  });report('malformed case stays inspectable and exportable without crashing or invoking audit');
  await withFixture(browser,{indexed:A},async({page})=>{
    await waitCourse(page,'A');await page.getByTitle('LATTE Anki Generator',{exact:true}).click();
    await page.evaluate(()=>window.__remediation.queueGemini('```text\n[Synthetic] Marker: {{c1::present}}|Synthetic explanation|Nursing::LATTE::Look Condition::Synthetic Tier::1\n```\n```text\nfact-1 -> line #1\n```'));
    await page.getByRole('button',{name:'▶ Generate Cards',exact:true}).click();
    await page.waitForFunction(()=>document.querySelectorAll('.anki-tbl-wrap tbody tr').length===1);
    assert.equal(await page.getByRole('button',{name:/Identical-front group/}).count(),0);
    assert.equal(await page.getByRole('button',{name:'⬇ Export .txt',exact:true}).isEnabled(),true);
  });report('a note with no collision remains editable and exportable without a warning component crash');
}

async function main(args=process.argv.slice(2)){
  const supported=new Set(['--self-test','--output-policy','--lifecycle']);for(const arg of args)if(!supported.has(arg))throw Error('Unknown option: '+arg);
  const assertions=await selfTest();console.log('Fixture self-test: '+assertions+' assertions passed.');
  if(args.includes('--self-test'))return;
  let playwright;try{playwright=require('playwright');}catch{throw Error('Playwright is not available. Point NODE_PATH at an existing external installation; do not install repository dependencies.');}
  const browser=await playwright.chromium.launch(process.env.REMEDIATION_BROWSER_EXECUTABLE?{executablePath:process.env.REMEDIATION_BROWSER_EXECUTABLE,headless:true}:{channel:'chrome',headless:true});
  const report=message=>console.log('PASS '+message);
  try{if(!args.includes('--lifecycle'))await storageTests(browser,report);await ownershipTests(browser,report);await sourceTests(browser,report);if(args.includes('--output-policy'))await outputPolicyTests(browser,report);}
  finally{await browser.close();}
  console.log('Synthetic browser acceptance passed. No live Gemini requests or private materials.');
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});
module.exports={approvedResources,interceptContext,selfTest,withFixture,storageTests,ownershipTests,sourceTests,outputPolicyTests,main};
