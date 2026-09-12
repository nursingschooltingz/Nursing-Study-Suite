#!/usr/bin/env node
'use strict';

// Optional v16 browser acceptance. Only the shipped App plus fictional fixture data
// is served; the shared fixture rejects real Gemini calls and repository routes.
// Uses an existing external Playwright installation, never a runtime dependency.
const assert=require('assert/strict');
const fs=require('fs'),path=require('path');
const crypto=require('crypto');
const {resolveSuiteFile}=require('./repo-checks');
const {withFixture,selfTest}=require('./remediation-browser-tests');
const {syntheticKB}=require('./remediation-browser-fixture');
const {worksheet}=require('./remediation-worksheet-browser-tests');
const widths=[360,768,1024,1440];
const tabs=[
  ['knowledge','LATTE Knowledge Base'],['priority','Pyramid Priority Analyzer'],
  ['anki','LATTE Anki Generator'],['nclex','NCLEX Question Extractor'],
  ['nclexgen','NCLEX Question Generator'],['cases','Clinical Case Study Generator']
];

async function settle(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function choose(page,id){
  const title=tabs.find(t=>t[0]===id)?.[1];if(!title)throw Error('Unknown fixture tool: '+id);
  await page.getByTitle(title,{exact:true}).click();await settle(page);
  assert.equal(await page.locator('.tool-panel:visible').count(),1,'exactly one tool is visible');
  assert.equal(await page.getByTitle(title,{exact:true}).getAttribute('aria-current'),'page','active tool is programmatically identified');
}
async function layout(page,label){
  const issues=await page.evaluate(()=>{
    const rows=[];
    const visible=e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
    for(const e of [document.documentElement,...document.querySelectorAll('.main-area,.tool-panel,[role=dialog]')]){
      if(!visible(e))continue;
      // Tables intentionally have their own scroll container. Page and tool panels do not.
      if(e.scrollWidth>e.clientWidth+2)rows.push({node:e.className||e.tagName,client:e.clientWidth,scroll:e.scrollWidth});
    }
    for(const e of document.querySelectorAll('[role=dialog]')){
      if(!visible(e))continue;const r=e.getBoundingClientRect();
      if(r.left<-.5||r.right>innerWidth+.5||r.top<-.5||r.bottom>innerHeight+.5)rows.push({dialog:e.className,bounds:{left:r.left,right:r.right,top:r.top,bottom:r.bottom}});
    }
    return rows;
  });
  assert.deepEqual(issues,[],label+' must fit without page/panel horizontal overflow');
}
async function capture(page,directory,name,fullPage=true){
  if(!directory)return;
  await page.screenshot({path:path.join(directory,name+'.png'),fullPage});
}
async function focusVisible(page){
  const nav=page.getByTitle('LATTE Knowledge Base',{exact:true});
  await nav.focus();await page.keyboard.press('Tab');
  const result=await page.evaluate(()=>{
    const e=document.activeElement,s=getComputedStyle(e);
    return {visible:e.matches(':focus-visible'),outline:s.outlineStyle,width:parseFloat(s.outlineWidth),shadow:s.boxShadow};
  });
  assert(result.visible&&(result.outline!=='none'&&result.width>=2||result.shadow!=='none'),'keyboard focus has a visible indicator');
}
async function ankiLabels(page){
  const wraps=await page.locator('.tool-panel:visible .anki-tbl-wrap th,.tool-panel:visible .segmented-control button').evaluateAll(nodes=>nodes.flatMap(node=>{
    if(node.textContent.trim()!=='Preview'&&node.tagName!=='TH')return [];
    const range=document.createRange();range.selectNodeContents(node);
    return range.getClientRects().length>1?[node.textContent.trim()]:[];
  }));
  assert.deepEqual(wraps,[],'Anki column headings and Preview label stay on one line');
}
async function settings(page,directory,width){
  const trigger=page.getByRole('button',{name:'Study settings',exact:true});
  if(await trigger.getAttribute('aria-expanded')!=='true')await trigger.click();
  const panel=page.getByRole('complementary',{name:'Study settings',exact:true});await panel.waitFor();
  assert.equal(await page.getByLabel('Gemini API key',{exact:true}).getAttribute('type'),'password','API key remains concealed');
  const auto=page.getByRole('switch',{name:'Auto profile — per-tool model and thinking level',exact:true});
  const before=await auto.getAttribute('aria-checked');await auto.focus();await page.keyboard.press('Space');
  assert.notEqual(await auto.getAttribute('aria-checked'),before,'profile switch works from keyboard');await page.keyboard.press('Space');
  await layout(page,width+'px settings');await capture(page,directory,width+'-settings');
  await page.getByRole('button',{name:'Close study settings',exact:true}).click();
  assert.equal(await trigger.getAttribute('aria-expanded'),'false','settings close state is announced');
  assert(await trigger.evaluate(node=>node===document.activeElement),'settings close restores trigger focus');
}
async function drawer(page,directory,width){
  const tag=page.locator('.tool-panel:visible').getByTitle('Inspect fact-1',{exact:true}).first();
  await tag.click();const dialog=page.getByRole('dialog');await dialog.waitFor();
  // Measure the settled drawer, not the deliberate 16px opening translation.
  await dialog.evaluate(node=>Promise.all(node.getAnimations().map(animation=>animation.finished)));
  try{
    await page.getByRole('button',{name:'Close fact inspector',exact:true}).focus();
    await page.keyboard.press('Shift+Tab');
    assert(await dialog.evaluate(node=>node.contains(document.activeElement)),'fact drawer traps reverse keyboard navigation');
    await layout(page,width+'px fact inspector');await capture(page,directory,width+'-fact-inspector',false);
  }finally{await page.keyboard.press('Escape');}
  assert.equal(await dialog.count(),0,'Escape closes fact inspector');
  assert(await tag.evaluate(node=>node===document.activeElement),'closing fact inspector restores source-link focus');
}

async function createOutputs(page){
  await choose(page,'anki');
  const notes='```text\n[Synthetic] Marker: {{c1::present}}|Synthetic explanation|Nursing::LATTE::Look Condition::Synthetic Tier::1\n```\n```text\nfact-1 -> line #1\n```';
  await page.evaluate(text=>window.__remediation.queueGemini(text),notes);
  await page.getByRole('button',{name:'▶ Generate Cards',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.anki-tbl-wrap tbody tr').length===1);
  const extra=page.locator('.anki-tbl-wrap tbody tr').first().locator('td').nth(3).locator('textarea');
  await extra.fill('Edited fictional explanation');
  await page.getByRole('button',{name:'⬇ Export .txt',exact:true}).click();
  await page.waitForFunction(()=>window.__remediation.exports.some(x=>x.text.includes('Edited fictional explanation')));

  await choose(page,'priority');
  await page.evaluate(()=>{window.__remediation.queueGemini('Synthetic harvest');window.__remediation.queueGemini('# Synthetic priority review\n\n## Tier 1\n\nFictional marker A is present.\n\n| Evidence | Source |\n| --- | --- |\n| Fictional marker | Synthetic A source |');});
  await page.getByRole('button',{name:'△ Analyze Knowledge Base',exact:true}).click();
  await page.getByRole('heading',{name:'Priority Analysis',exact:true}).waitFor();

  await choose(page,'nclexgen');
  const panel=page.locator('.tool-panel:visible');
  await panel.locator('input[type=number][min="5"]').fill('5');
  await panel.locator('select').filter({has:page.locator('option[value="5"]')}).selectOption('5');
  await page.getByRole('checkbox',{name:/Fact allocation/}).uncheck();
  await page.evaluate(text=>window.__remediation.queueGemini(text),worksheet(Array(5).fill('Ordering')));
  await page.getByRole('button',{name:'▶ Generate 5 Questions (1 batch)',exact:true}).click();
  await page.getByRole('heading',{name:'5 Questions · 1 concepts',exact:true}).waitFor();
  await page.getByRole('button',{name:'▶ Generate 5 Questions (1 batch)',exact:true}).waitFor();

  await choose(page,'cases');
  await page.getByRole('checkbox',{name:/Run the item-quality audit/}).uncheck();
  const response={title:'Synthetic visual case',condition:'Synthetic condition A',stages:[{stageNumber:1,title:'Fictional observation',narrative:'A fictional observation for interface acceptance.',data:[{label:'Marker',value:'Fictional marker A is present.',supportType:'direct',availability:'revealed',factIds:['fact-1']}],questions:[{id:'q1',type:'MCQ',stem:'Choose the fictional marker.',options:[{label:'A',text:'Marker A'},{label:'B',text:'Marker B'}],correctAnswers:['A'],rationales:[{option:'A',text:'Fictional marker A is present.',supportType:'direct',factIds:['fact-1']},{option:'B',text:'Fictional marker A is present.',supportType:'direct',factIds:['fact-1']}]}]}],debrief:{notes:'Synthetic source has fewer facts than the requested case size.'}};
  await page.evaluate(text=>window.__remediation.queueGemini(text),JSON.stringify(response));
  await page.getByRole('button',{name:'▶ Generate Case Study',exact:true}).click();
  await page.getByRole('heading',{name:'Synthetic visual case',exact:true}).waitFor();
  await page.getByRole('button',{name:'Show answer & rationale',exact:true}).click();
  await page.getByRole('button',{name:'⬇ .md',exact:true}).click();
  await page.waitForFunction(()=>window.__remediation.exports.some(x=>x.name==='LATTE-Case-Study.md'));
}

async function visualTests(browser,{screenshots,report=console.log}={}){
  const failures=[];
  const check=async(label,run)=>{try{await run();report('PASS '+label);}catch(e){failures.push(label+': '+e.message);report('FAIL '+label+': '+e.message);}};
  await withFixture(browser,{},async({page})=>{
    await page.waitForFunction(()=>window.__remediation?.state?.persistenceStatus==='ready');
    // The synthetic label is test-only; constrain it independently of the shipped CSS.
    await page.locator('#remediation-fixture-label').evaluate(node=>{node.style.maxWidth='100vw';node.style.boxSizing='border-box';});
    const warnings=[],startupWarnings=[];
    page.on('console',message=>{
      if(!['warning','error'].includes(message.type()))return;
      const text=message.text();
      if(text.includes('You are using the in-browser Babel transformer')||/^\[BABEL\] Note: The code generator has deoptimised the styling of \/Inline Babel script as it exceeds the max of 500KB\.$/.test(text))startupWarnings.push(text);
      else warnings.push(text);
    });
    for(const width of widths){
      await page.setViewportSize({width,height:900});
      await page.reload({waitUntil:'load'});await page.waitForFunction(()=>window.__remediation?.state?.persistenceStatus==='ready');
      await page.locator('#remediation-fixture-label').evaluate(node=>{node.style.maxWidth='100vw';node.style.boxSizing='border-box';});
      assert.equal(await page.getByRole('button',{name:'Study settings',exact:true}).getAttribute('aria-expanded'),width>800?'true':'false','initial settings visibility follows available width');
      if(await page.getByRole('button',{name:'Close study settings',exact:true}).isVisible())await page.getByRole('button',{name:'Close study settings',exact:true}).click();
      for(const [id] of tabs){await choose(page,id);await check(width+'px empty '+id,()=>layout(page,width+'px '+id));await capture(page,screenshots,width+'-empty-'+id);}
      await check(width+'px keyboard focus',()=>focusVisible(page));
      await check(width+'px settings',()=>settings(page,screenshots,width));
    }
    assert.deepEqual(warnings,[],'interacting with empty views reports no console warnings or errors');
    // A real JSON import exercises the existing hidden upload input and React state.
    await choose(page,'knowledge');
    await page.locator('input[type=file][accept=".json,application/json"]').setInputFiles({name:'synthetic-visual-kb.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(syntheticKB('A')))});
    await page.waitForFunction(()=>window.__remediation.state.knowledgeBase.conditions.length===1);
    await page.setViewportSize({width:1440,height:900});
    await createOutputs(page);report('PASS synthetic JSON import, four generated outputs, Anki edit/export and case export');
    for(const width of widths){
      await page.setViewportSize({width,height:900});
      for(const [id] of tabs){await choose(page,id);await check(width+'px populated '+id,()=>layout(page,width+'px '+id));await capture(page,screenshots,width+'-populated-'+id);}
      await check(width+'px fact drawer',()=>drawer(page,screenshots,width));
      // Exercise generated views without reissuing a model operation.
      await choose(page,'anki');
      for(const view of ['List','Preview','Table']){await page.getByRole('button',{name:view,exact:true}).click();await check(width+'px Anki '+view,async()=>{await layout(page,width+'px Anki '+view);await ankiLabels(page);});}
    }
    assert.equal(await page.locator('.anki-tbl-wrap tbody tr').first().locator('td').nth(3).locator('textarea').inputValue(),'Edited fictional explanation','tab navigation retains edited output');
    assert.deepEqual(warnings,[],'synthetic generation and output interactions report no console warnings or errors');
    if(startupWarnings.length)report('Expected Babel startup advisory observed; no application console errors or unexpected warnings.');
  });
  assert.deepEqual(failures,[],'visual acceptance failures');
}
async function main(args=process.argv.slice(2)){
  let screenshots;
  if(args.length){if(args.length!==2||args[0]!=='--screenshots')throw Error('Usage: node tools/visual-browser-tests.js [--screenshots <directory>]');screenshots=path.resolve(args[1]);fs.mkdirSync(screenshots,{recursive:true});}
  const suite=resolveSuiteFile({rootDir:path.join(__dirname,'..')}),source=fs.readFileSync(suite);
  console.log('Visual acceptance source SHA-256: '+crypto.createHash('sha256').update(source).digest('hex'));
  await selfTest();
  const {chromium}=require('playwright');
  const browser=await chromium.launch(process.env.REMEDIATION_BROWSER_EXECUTABLE?{headless:true,executablePath:process.env.REMEDIATION_BROWSER_EXECUTABLE}:{headless:true,channel:'chrome'});
  try{await visualTests(browser,{screenshots});}finally{await browser.close();}
  assert(source.equals(fs.readFileSync(suite)),'shipped source must remain unchanged during the acceptance run');
  console.log('Visual browser acceptance passed at 360, 768, 1024 and 1440px. No live Gemini calls or private material.');
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});
module.exports={visualTests,layout,main};
