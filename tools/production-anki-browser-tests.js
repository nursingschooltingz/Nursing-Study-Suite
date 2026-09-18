#!/usr/bin/env node
'use strict';

// Optional browser acceptance: one synthetic 120-note deck, mocked generation,
// disposable browser storage and the shared pinned-resource request policy.
const assert=require('assert/strict');
const {withFixture}=require('./remediation-browser-tests');
const {syntheticKB}=require('./remediation-browser-fixture');
const {waitForSyntheticKnowledge}=require('./remediation-anki-performance');

function syntheticNotes(count=120){
  const rows=Array.from({length:count},(_,i)=>'[Synthetic] Marker '+i+': {{c1::answer-'+i+'}}.'+(i===0?' Also answer-0.':'')+'|Synthetic explanation|Nursing::LATTE::Look Condition::SyntheticConditionA Tier::'+(i<60?1:2));
  return '```text\n'+rows.join('\n')+'\n```\n```text\n'+rows.map((_,i)=>'fact-1 -> line #'+(i+1)).join('\n')+'\n```';
}

async function test(browser,report=()=>{}){
  const checks=[],check=(name,value)=>{assert(value,name);checks.push(name);report(name);};
  await withFixture(browser,{indexed:syntheticKB('A')},async({page})=>{
    await waitForSyntheticKnowledge(page);
    await page.getByTitle('LATTE Anki Generator',{exact:true}).click();
    await page.evaluate(text=>window.__remediation.queueGemini(text),syntheticNotes());
    await page.getByRole('button',{name:'▶ Generate Cards',exact:true}).click();
    const table=page.getByRole('table',{name:'Editable Anki notes',exact:true}),rows=table.locator('tbody tr');
    const pageNav=page.getByRole('navigation',{name:'Anki note pages',exact:true});
    const next=page.getByRole('button',{name:'Next notes',exact:true}),previous=page.getByRole('button',{name:'Previous notes',exact:true});
    const view=name=>page.getByRole('group',{name:'Anki review view',exact:true}).getByRole('button',{name,exact:true}).click();
    const firstText=()=>rows.first().getByLabel('Text for note ',{exact:false}).inputValue();
    const waitPage=async number=>{await page.waitForFunction(number=>document.querySelector('nav[aria-label="Anki note pages"]')?.textContent.includes('Page '+number+' of'),number);};
    const download=async()=>{const before=await page.evaluate(()=>window.__remediation.exports.length);await page.getByRole('button',{name:'⬇ Export .txt',exact:true}).click();await page.waitForFunction(n=>window.__remediation.exports.length>n,before);return page.evaluate(()=>window.__remediation.exports.at(-1).text);};
    const noteLines=text=>text.split('\n').filter(line=>line.includes('|'));
    await rows.nth(49).waitFor();await waitPage(1);
    check('Anki mounts only the first 50 of 120 notes',await rows.count()===50&&(await pageNav.innerText()).includes('Notes 1–50 of 120')&&(await firstText()).includes('Marker 0:'));
    check('Anki first-page previous control is disabled',await previous.isDisabled());
    await next.click();await waitPage(2);
    check('Anki next page mounts the next 50 original notes',await rows.count()===50&&(await firstText()).includes('Marker 50:'));
    const extra=rows.first().getByLabel('Extra for note ',{exact:false});
    await extra.fill('Synthetic edited explanation');
    await extra.evaluate(el=>{el.focus();el.setSelectionRange(9,9);});
    await page.keyboard.insertText(' stable');
    check('Anki editing preserves textarea focus and caret on the current page',await extra.inputValue()==='Synthetic stable edited explanation'&&await extra.evaluate(el=>document.activeElement===el&&el.selectionStart===16&&el.selectionEnd===16)&&(await pageNav.innerText()).includes('Page 2 of 3'));
    await next.click();await waitPage(3);
    check('Anki final page mounts the remaining 20 notes',await rows.count()===20&&(await firstText()).includes('Marker 100:')&&await next.isDisabled());
    await rows.first().getByRole('checkbox',{name:/^Keep note /}).uncheck();
    const allExport=await download();
    check('Anki export spans every page and honors an unchecked note',noteLines(allExport).length===119&&allExport.includes('Marker 0:')&&allExport.includes('Marker 119:')&&!allExport.includes('Marker 100:')&&allExport.includes('Synthetic stable edited explanation'));
    await view('Preview');
    const editButtons=page.getByRole('button',{name:'Edit in Table',exact:true});
    check('Anki Preview preserves the selected final page',await editButtons.count()===20&&(await pageNav.innerText()).includes('Page 3 of 3'));
    await editButtons.last().click();
    await page.waitForFunction(()=>document.activeElement?.id?.startsWith('anki-text-')&&document.activeElement.value.includes('Marker 119:'));
    check('Anki Edit in Table mounts and focuses the requested later note',await rows.count()===20&&(await pageNav.innerText()).includes('Page 3 of 3'));
    await view('List');
    check('Anki List uses the same bounded page',await page.getByRole('checkbox',{name:/^Keep note /}).count()===20);
    await previous.click();await waitPage(2);
    check('Anki List previous-page navigation mounts 50 notes',await page.getByRole('checkbox',{name:/^Keep note /}).count()===50);
    await view('Table');
    check('Anki edits survive paging and view changes',(await firstText()).includes('Marker 50:')&&await rows.first().getByLabel('Extra for note ',{exact:false}).inputValue()==='Synthetic stable edited explanation');
    const findings=page.getByLabel('Anki review findings',{exact:true});
    await findings.selectOption('answer-visible');
    await page.waitForFunction(()=>document.querySelectorAll('.anki-tbl-wrap tbody tr').length===1);
    check('Anki warning filters reset pagination and retain the matching note',(await firstText()).includes('Marker 0:')&&await pageNav.count()===0);
    check('Anki review-only filters cannot narrow the exported deck',await download()===allExport);
    await findings.selectOption('all');await waitPage(1);await next.click();await waitPage(2);
    const style=page.getByRole('checkbox',{name:/^Style warnings /});
    await style.check();await page.waitForFunction(()=>document.querySelectorAll('.anki-tbl-wrap tbody tr').length===1);
    check('Anki style filtering resets to the first matching page',(await firstText()).includes('Marker 0:')&&await pageNav.count()===0);
    await style.uncheck();await waitPage(1);await next.click();await waitPage(2);
    await page.getByRole('button',{name:'T2 60 notes',exact:true}).click();await waitPage(1);
    check('Anki tier filters reset pagination within the selected tier',await rows.count()===50&&(await firstText()).includes('Marker 60:'));
    await next.click();await waitPage(2);
    check('Anki tier pagination reaches the remaining selected notes',await rows.count()===10&&(await firstText()).includes('Marker 110:'));
    const tierExport=await download();
    check('Anki tier export includes off-page kept notes and retains prior exclusions',noteLines(tierExport).length===59&&tierExport.includes('Marker 60:')&&tierExport.includes('Marker 119:')&&!tierExport.includes('Marker 0:')&&!tierExport.includes('Marker 100:'));
    await page.getByRole('button',{name:'Show All',exact:true}).click();await waitPage(1);
    check('Anki Show All resets pagination without changing selection',(await firstText()).includes('Marker 0:')&&await download()===allExport);
    check('Anki acceptance uses exactly one mocked generation request',(await page.evaluate(()=>window.__remediation.geminiCalls.length))===1);
  });
  return {status:'pass',checks,limitations:'Synthetic browser acceptance only; no live Gemini, course material, native Anki import or clinical claims.'};
}

async function main(){
  const {chromium}=require('playwright'),browser=await chromium.launch(process.env.REMEDIATION_BROWSER_EXECUTABLE?{headless:true,executablePath:process.env.REMEDIATION_BROWSER_EXECUTABLE}:{headless:true,channel:'chrome'});
  try{console.log(JSON.stringify(await test(browser),null,2));}finally{await browser.close();}
}
if(require.main===module)main().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
module.exports={syntheticNotes,test,browserTests:test,main};
