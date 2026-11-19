'use strict';
const assert=require('node:assert/strict');
const {withFixture}=require('./remediation-browser-tests');
async function runTests(browser,report=console.log){
  await withFixture(browser,{},async({page})=>{
    const result=await page.evaluate(async()=>{
      const xml=text=>'<a:p xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:r><a:t>'+text+'</a:t></a:r></a:p>';
      const makeZip=entries=>{
        const enc=new TextEncoder(),locals=[],cds=[];let off=0;
        for(const [name,text] of Object.entries(entries)){
          const nb=enc.encode(name),pl=enc.encode(text);
          const lh=new Uint8Array(30+nb.length+pl.length),ldv=new DataView(lh.buffer);
          ldv.setUint32(0,0x04034b50,true);ldv.setUint16(4,20,true);ldv.setUint32(18,pl.length,true);ldv.setUint32(22,pl.length,true);ldv.setUint16(26,nb.length,true);
          lh.set(nb,30);lh.set(pl,30+nb.length);locals.push(lh);
          const cd=new Uint8Array(46+nb.length),cdv=new DataView(cd.buffer);
          cdv.setUint32(0,0x02014b50,true);cdv.setUint16(4,20,true);cdv.setUint16(6,20,true);cdv.setUint32(20,pl.length,true);cdv.setUint32(24,pl.length,true);cdv.setUint16(28,nb.length,true);cdv.setUint32(42,off,true);
          cd.set(nb,46);cds.push(cd);off+=lh.length;
        }
        const cdSize=cds.reduce((s,b)=>s+b.length,0),eocd=new Uint8Array(22),edv=new DataView(eocd.buffer);
        edv.setUint32(0,0x06054b50,true);edv.setUint16(8,cds.length,true);edv.setUint16(10,cds.length,true);edv.setUint32(12,cdSize,true);edv.setUint32(16,off,true);
        const out=new Uint8Array(off+cdSize+22);let p=0;for(const b of [...locals,...cds,eocd]){out.set(b,p);p+=b.length;}return out;
      };
      const file=new File([makeZip({'ppt/slides/slide2.xml':xml('Second μg'),'ppt/slides/slide1.xml':xml('First synthetic marker')})],'synthetic.pptx');
      const control=await window.__remediation.extractPptxText(file);
      const hostile=new File([makeZip({'ppt/slides/slide1.xml':'<a:p xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'+'<a:t>'.repeat(80)+'x'.repeat(64*1024)+'</a:t>'.repeat(80)+'</a:p>'})],'synthetic-nested.pptx');
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
