#!/usr/bin/env node
'use strict';

// Optional browser acceptance. Synthetic KB/notes, mocked generation, and only
// pinned startup CDNs; no course files, real API key, or Gemini request.
const assert=require('assert/strict'),http=require('http'),fs=require('fs'),path=require('path');
const {page:basePage}=require('./anki-browser-fixture');
const {interceptContext}=require('./remediation-browser-tests');

function once(source,old,next){
  if(source.split(old).length!==2)throw Error('Anki quality fixture anchor must occur once: '+old.slice(0,100));
  return source.replace(old,()=>next);
}
function page(){
  let html=basePage();
  html=once(html,'const fixtureData=ankiSyntheticFixture();',String.raw`const fixtureData=ankiSyntheticFixture();
fixtureData.kb={metadata:{schemaVersion:'1.0'},conditions:[{name:'Example Condition',aliases:['EC'],facts:['alpha','beta','gamma','delta','epsilon','zeta','eta'].map((value,i)=>({id:'fact-'+(i+1),text:'The synthetic target for item '+(i+1)+' is '+value+'.',sourceQuote:'The synthetic target for item '+(i+1)+' is '+value+'.',tier:1,latteBucket:'Look',sources:[{filename:'Synthetic hierarchy fixture',location:'item '+(i+1)}]}))}]};
window.__ankiQualityFixture={generationCalls:[],auditCalls:[],exports:[]};`);
  const start=html.indexOf('callGemini=async()=>{'),end=html.indexOf('\ndownloadBlob=async blob=>fixtureExport(await blob.text());',start);
  if(start<0||end<0)throw Error('Anki quality fixture mocked generation anchors moved.');
  const transport=html.slice(start,end);
  html=once(html,transport,String.raw`callGemini=async(apiKey,model,parts,options={})=>{
  const probe=window.__ankiQualityFixture;
  if(parts?.[0]?.text?.includes('AUDIT PACKET:')){probe.auditCalls.push({model,level:options.thinkingLevel});throw Error('This synthetic acceptance does not run a source check.');}
  probe.generationCalls.push({model,level:options.thinkingLevel});
  const notes=[
    '[Synthetic] Canonical target: {{c1::alpha}}.||Nursing::LATTE::Look Condition::ExampleCondition Tier::1',
    '[Synthetic] Alias target: {{c1::beta}}.||Nursing::LATTE::Look Condition::EC Tier::1',
    '[Synthetic] Unknown name: {{c1::gamma}}.||Nursing::LATTE::Look Condition::UnlistedName Tier::1',
    '[Synthetic] Selected malformed: {{c1::delta}}.||Nursing::LATTE::Look Condition::Example Condition Tier::1',
    '[Synthetic] Excluded malformed: {{c1::epsilon}}.||Nursing::LATTE::Look Condition::Example Condition Tier::1',
    '[Synthetic] Topic target: {{c1::zeta}}.||Bio::CellBiology::Mitosis Topic::ExampleCondition Tier::1',
    '[Synthetic] Custom hierarchy: {{c1::eta}}.||Custom-Domain::Week_4::Part-2 Condition::ExampleCondition Tier::1'
  ];
  return String.fromCharCode(96).repeat(3)+'text\n'+notes.join('\n')+'\n'+String.fromCharCode(96).repeat(3)+'\n'+String.fromCharCode(96).repeat(3)+'text\n'+notes.map((_,i)=>'fact-'+(i+1)+' -> line #'+(i+1)).join('\n')+'\n'+String.fromCharCode(96).repeat(3);
};`);
  html=once(html,'downloadBlob=async blob=>fixtureExport(await blob.text());',String.raw`downloadBlob=async(blob,name)=>{const text=await blob.text();window.__ankiQualityFixture.exports.push({name,text});fixtureExport(text);};`);
  html=once(html,"const cfg=useMemo(()=>({apiKey:'synthetic-only',forTool:()=>({model:'synthetic-fixture',level:'low'}),autoProfile:true}),[]);",
    "const cfg=useMemo(()=>({apiKey:'synthetic-only',flashModel:'synthetic-flash',proModel:'synthetic-pro',forTool:id=>({model:TOOL_PROFILE_DEFAULTS[id].m==='pro'?'synthetic-pro':'synthetic-flash',level:TOOL_PROFILE_DEFAULTS[id].lv}),autoProfile:true}),[]);");
  return html;
}

async function main(){
  const html=page(),output=path.join(__dirname,'../scratch/anki-next/browser');
  const server=http.createServer((req,res)=>{if(req.method!=='GET'||req.url!=='/'){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(html);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port+'/',{chromium}=require('playwright');
  let browser,context,view,network;
  const errors=[],resourceErrors=[],checks=[];
  const check=(name,condition)=>{assert(condition,name);checks.push(name);};
  fs.mkdirSync(output,{recursive:true});
  try{
    browser=await chromium.launch(process.env.REMEDIATION_BROWSER_EXECUTABLE?{executablePath:process.env.REMEDIATION_BROWSER_EXECUTABLE,headless:true}:{channel:'chrome',headless:true});
    context=await browser.newContext({serviceWorkers:'block',acceptDownloads:false});
    network=await interceptContext(context,url,html);
    view=await context.newPage();view.setDefaultTimeout(20000);
    view.on('pageerror',error=>errors.push(error.message));
    view.on('requestfailed',request=>resourceErrors.push({url:request.url(),error:request.failure()?.errorText}));
    await view.goto(url,{waitUntil:'load',timeout:45000});
    const download=async name=>{
      const count=await view.evaluate(()=>window.__ankiQualityFixture.exports.length);
      await view.getByRole('button',{name,exact:true}).click();
      await view.waitForFunction(before=>window.__ankiQualityFixture.exports.length>before,count);
      return view.evaluate(()=>window.__ankiQualityFixture.exports.at(-1));
    };
    const noteLines=text=>text.split('\n').filter(line=>line.includes('|'));
    await view.getByRole('button',{name:'▶ Generate Cards',exact:true}).click();
    const rows=view.getByRole('table',{name:'Editable Anki notes',exact:true}).locator('tbody tr');
    await rows.nth(6).waitFor();
    check('mocked generation uses the Flash / Medium recommendation',(await view.evaluate(()=>window.__ankiQualityFixture.generationCalls)).every(call=>call.model==='synthetic-flash'&&call.level==='medium'));
    check('all seven generated notes remain inspectable',await rows.count()===7);
    check('both malformed generated tags keep their checked selection',await rows.nth(3).getByRole('checkbox').isChecked()&&await rows.nth(4).getByRole('checkbox').isChecked());
    check('malformed tags display the actionable structural lint',/generated tags require/.test(await rows.nth(3).getAttribute('title'))&&/generated tags require/.test(await rows.nth(4).getAttribute('title')));
    const initial=await download('⬇ Export .txt');
    check('initial export excludes both malformed rows while retaining five notes',noteLines(initial.text).length===5&&!initial.text.includes('Selected malformed')&&!initial.text.includes('Excluded malformed'));
    check('Topic and custom hierarchies remain exportable',initial.text.includes('Bio::CellBiology::Mitosis Topic::ExampleCondition')&&initial.text.includes('Custom-Domain::Week_4::Part-2'));
    check('unknown canonical-name semantics stay advisory and exportable',initial.text.includes('Condition::UnlistedName'));
    check('proven alias is repaired before the first export',await rows.nth(1).getByLabel('Tags for note ',{exact:false}).inputValue()==='Nursing::LATTE::Look Condition::ExampleCondition Tier::1');
    await view.getByText('Batch diagnostics · original responses before edits and exclusions',{exact:true}).click();
    const originalDiagnostic=JSON.parse((await download('Save diagnostics and original responses')).text);
    const outcome=line=>originalDiagnostic.conditionTagOutcomes.find(item=>item.sourceLine===line);
    check('Save diagnostics captures all seven normalization decisions',originalDiagnostic.conditionTagOutcomes.length===7);
    check('Save diagnostics distinguishes canonical, repaired and review outcomes',outcome(1).status==='canonical'&&outcome(2).status==='repaired'&&outcome(3).status==='review'&&outcome(3).code==='non-alias-condition');
    check('repair diagnostics preserve original and resulting tag bytes',outcome(2).before.includes('Condition::EC ')&&outcome(2).after.includes('Condition::ExampleCondition '));
    check('generated malformed and Topic metadata remains reviewable',outcome(4).status==='review'&&outcome(5).status==='review'&&outcome(6).code==='topic-tag');
    check('private generation diagnostics retain original responses and exclude credentials',originalDiagnostic.rawResponses[0].includes('Condition::EC ')&&!JSON.stringify(originalDiagnostic).includes('synthetic-only'));
    fs.writeFileSync(path.join(output,'generation-diagnostics.json'),JSON.stringify(originalDiagnostic,null,2)+'\n');
    await rows.nth(4).getByRole('checkbox').uncheck();
    const repairedTags='Nursing::LATTE::Look Condition::ExampleCondition Tier::1';
    await rows.nth(3).getByLabel('Tags for note ',{exact:false}).fill(repairedTags);
    await rows.nth(4).getByLabel('Tags for note ',{exact:false}).fill(repairedTags);
    check('Table repair clears structural lint on both notes',!(await rows.nth(3).getAttribute('title'))&&!(await rows.nth(4).getAttribute('title')));
    check('repair preserves both checked and manually unchecked choices',await rows.nth(3).getByRole('checkbox').isChecked()&&!await rows.nth(4).getByRole('checkbox').isChecked());
    const repairedExport=await download('⬇ Export .txt');
    check('repair restores selected eligibility without reversing manual exclusion',noteLines(repairedExport.text).length===6&&repairedExport.text.includes('Selected malformed')&&!repairedExport.text.includes('Excluded malformed'));
    const afterDiagnostic=JSON.parse((await download('Save diagnostics and original responses')).text);
    check('later Table edits cannot rewrite captured generation outcomes',JSON.stringify(afterDiagnostic.conditionTagOutcomes)===JSON.stringify(originalDiagnostic.conditionTagOutcomes));
    await view.screenshot({path:path.join(output,'tag-repairs.png'),fullPage:true});
    await view.getByText('Optional · Check against KB',{exact:true}).click();
    await view.getByRole('button',{name:'Prepare review packet — no AI check yet',exact:true}).click();
    await view.getByText(/^Prepared — no AI check yet/).waitFor();
    const prepared=JSON.parse((await download('Download unrun review packet')).text);
    check('source-check preparation is local and explicitly unrun',prepared.status==='prepared'&&!prepared.metadata.checkComplete&&prepared.results.length===0&&prepared.responses.length===0&&(await view.evaluate(()=>window.__ankiQualityFixture.auditCalls.length))===0);
    const generation=prepared.conditionTagDiagnostics.generation,audit=prepared.conditionTagDiagnostics.auditSnapshot;
    check('prepared source report separates captured generation from read-only audit snapshot',generation.status==='captured'&&generation.stage.includes('before user edits')&&audit.stage.includes('no tag edits applied'));
    const reportAt=(items,line)=>items.find(item=>item.sourceLine===line);
    check('prepared report retains original repaired outcome while current alias is canonical',reportAt(generation.outcomes,2).status==='repaired'&&reportAt(audit.outcomes,2).status==='canonical');
    check('prepared report shows manual tag repairs without changing generation history',reportAt(generation.outcomes,4).status==='review'&&reportAt(audit.outcomes,4).status==='canonical'&&reportAt(generation.outcomes,5).status==='review'&&reportAt(audit.outcomes,5).status==='canonical');
    const captured=[...new Map(prepared.groups.flatMap(group=>group.notes).map(note=>[note.id,note])).values()];
    check('audit groups preserve scoped metadata and manual eligibility',captured.length===7&&captured.every(note=>note.tagFormatContract==='hierarchical-v1')&&captured.filter(note=>note.eligible).length===6&&captured.find(note=>note.sourceLine===5).keep===false);
    check('diagnostic JSON carries no fixture API credential',!JSON.stringify(prepared).includes('synthetic-only'));
    fs.writeFileSync(path.join(output,'prepared-source-report.json'),JSON.stringify(prepared,null,2)+'\n');
    await view.screenshot({path:path.join(output,'prepared-source-diagnostics.png'),fullPage:true});
    check('browser reports no uncaught application exceptions',errors.length===0);
    check('browser permits no unapproved network requests',network.unexpected.length===0);
    const report={status:'pass',checks,generationCalls:await view.evaluate(()=>window.__ankiQualityFixture.generationCalls),auditCalls:await view.evaluate(()=>window.__ankiQualityFixture.auditCalls),network,errors,resourceErrors,limitations:'Synthetic UI acceptance only; no clinical material, live Gemini request, or native Anki import.'};
    fs.writeFileSync(path.join(output,'acceptance-report.json'),JSON.stringify(report,null,2)+'\n');
    console.log('PASS '+checks.length+' Anki generation-quality browser checks: scoped malformed tags, selection/repair/export, Topic/custom namespaces, retained normalization outcomes, generation versus prepared-audit diagnostics. No live Gemini calls.');
  }catch(error){
    const state=await view?.evaluate(()=>({body:document.body.innerText.slice(-2200),generationCalls:window.__ankiQualityFixture?.generationCalls,auditCalls:window.__ankiQualityFixture?.auditCalls})).catch(()=>null);
    fs.writeFileSync(path.join(output,'acceptance-failure.json'),JSON.stringify({checks,errors,resourceErrors,network,state,message:error.stack||error.message},null,2)+'\n');
    if(view)await view.screenshot({path:path.join(output,'acceptance-failure.png'),fullPage:true}).catch(()=>{});
    throw error;
  }finally{await context?.close();await browser?.close();await new Promise(resolve=>server.close(resolve));}
}

if(require.main===module)main().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
module.exports={page,main};
