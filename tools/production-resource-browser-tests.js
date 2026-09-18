'use strict';
const assert=require('node:assert/strict');
const {withFixture}=require('./remediation-browser-tests');
async function runTests(browser,report=console.log){
  await withFixture(browser,{},async({page})=>{
    const result=await page.evaluate(async()=>{
      const xml=text=>'<a:p xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:r><a:t>'+text+'</a:t></a:r></a:p>';
      const archive=new JSZip();archive.file('ppt/slides/slide2.xml',xml('Second μg'));archive.file('ppt/slides/slide1.xml',xml('First synthetic marker'));
      const file=new File([await archive.generateAsync({type:'uint8array',compression:'DEFLATE'})],'synthetic.pptx');
      const control=await window.__remediation.extractPptxText(file);
      const nested=new JSZip();nested.file('ppt/slides/slide1.xml','<a:p xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'+'<a:t>'.repeat(80)+'x'.repeat(64*1024)+'</a:t>'.repeat(80)+'</a:p>');
      const hostile=new File([await nested.generateAsync({type:'uint8array',compression:'DEFLATE'})],'synthetic-nested.pptx');
      const descriptor=Object.getOwnPropertyDescriptor(Node.prototype,'textContent');let textReads=0,rejected='';
      Object.defineProperty(Node.prototype,'textContent',{...descriptor,get(){if(this.localName==='t')textReads++;return descriptor.get.call(this);}});
      try{await window.__remediation.extractPptxText(hostile);}catch(e){rejected=e.message;}
      finally{Object.defineProperty(Node.prototype,'textContent',descriptor);}
      return {control,rejected,textReads,hostileBytes:hostile.size};
    });
    assert.match(result.control,/SLIDE 1 ---\nFirst synthetic marker/);
    assert.match(result.control,/SLIDE 2 ---\nSecond μg/);
    assert(result.rejected,'nested text amplification must be rejected by the real DOM path');
    assert(result.textReads<80,'reject amplified run text before materializing every descendant string and joining it');
  });report('PASS native JSZip/DOM preserve normal slide text and reject nested text amplification');
  await withFixture(browser,{},async({page,context,url})=>{
    await context.route('https://synthetic-destination.test/**',route=>route.fulfill({contentType:'text/html',body:'<button id="continue">Continue</button><script>document.getElementById("continue").onclick=()=>{try{window.opener.location="https://synthetic-destination.test/replacement";window.__result="navigated";}catch(e){window.__result="blocked";}};</script>'}));
    const pending=context.waitForEvent('page');
    await page.evaluate(()=>window.__remediation.print('[Synthetic reference](https://synthetic-destination.test/)'));
    const popup=await pending;await popup.waitForLoadState();
    assert.equal(await popup.evaluate(()=>window.opener),null);
    await popup.getByRole('link',{name:'Synthetic reference',exact:true}).click();
    await popup.locator('#continue').click();
    assert.equal(await popup.evaluate(()=>window.__result),'blocked');
    assert.equal(page.url(),url);
    assert.equal(await page.locator('.nav-logo').count(),1);
  });report('PASS real sanitized print preview and external destination have no opener authority');
}
module.exports={runTests};
if(require.main===module){(async()=>{const {chromium}=require('playwright'),browser=await chromium.launch({channel:'chrome',headless:true});try{await runTests(browser);}finally{await browser.close();}})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});}
