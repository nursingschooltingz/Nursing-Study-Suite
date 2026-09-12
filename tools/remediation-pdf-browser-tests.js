#!/usr/bin/env node
'use strict';
// Real-browser acceptance of shipped PDF/card helpers with generated, public-free inputs.
// No Gemini calls, course files, repository file serving, or normal browser profile.
const assert=require('assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
const {pathToFileURL}=require('url');
const {page:fixturePage}=require('./remediation-browser-fixture');
const {withFixture,interceptContext}=require('./remediation-browser-tests');
function syntheticPdf(){
  const stream=n=>'BT /F1 18 Tf 72 720 Td (Synthetic page '+n+' - range 10 to 20.) Tj ET\n';
  const objects=[
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [4 0 R 6 0 R] /Count 2 >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >>',
    '<< /Length '+Buffer.byteLength(stream(1))+' >>\nstream\n'+stream(1)+'endstream',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents 7 0 R >>',
    '<< /Length '+Buffer.byteLength(stream(2))+' >>\nstream\n'+stream(2)+'endstream',
  ];
  let source='%PDF-1.4\n%Synthetic regression fixture\n';const offsets=[0];
  objects.forEach((body,i)=>{offsets.push(Buffer.byteLength(source));source+=(i+1)+' 0 obj\n'+body+'\nendobj\n';});
  const xref=Buffer.byteLength(source);
  source+='xref\n0 '+offsets.length+'\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('');
  source+='trailer\n<< /Size '+offsets.length+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
  return Buffer.from(source);
}
async function observeWorker(page){
  await page.evaluate(()=>{
    window.__pdfTest={native:0,fake:0,urls:[],revoked:[]};
    const Native=window.Worker,create=URL.createObjectURL,revoke=URL.revokeObjectURL;
    window.Worker=class extends Native{constructor(url,...args){window.__pdfTest.native++;window.__pdfTest.urls.push(url);super(url,...args);}};
    URL.createObjectURL=function(value){return create.call(URL,value);};
    URL.revokeObjectURL=function(url){window.__pdfTest.revoked.push(url);return revoke.call(URL,url);};
    const proto=pdfjsLib.PDFWorker.prototype,original=proto._setupFakeWorker;
    proto._setupFakeWorker=function(...args){window.__pdfTest.fake++;return original.apply(this,args);};
  });
}
async function documentChecks(page,pdfBytes){
  await observeWorker(page);
  return page.evaluate(async bytes=>{
    const api=window.__remediation;
    const fileA=new File([new Uint8Array(bytes)],'synthetic-a.pdf',{type:'application/pdf'});
    const fileB=new File([new Uint8Array(bytes)],'synthetic-b.pdf',{type:'application/pdf'});
    const first=api.getPdfDoc(fileA),same=api.getPdfDoc(fileA),second=api.getPdfDoc(fileB);
    const [a,b]=await Promise.all([first,second]);
    const whole=[],range=[];
    await api.pdfWalkPages(fileA,{onPage:(text,n)=>whole.push({text,n})});
    await api.pdfWalkPages(fileB,{from:2,to:2,onPage:(text,n)=>range.push({text,n})});
    const abort=new AbortController(),visited=[];let aborted='';
    try{await api.pdfWalkPages(fileB,{signal:abort.signal,onPage:(text,n)=>{visited.push(n);abort.abort();}});}catch(error){aborted=error.name;}
    const shared=await api.pdfEnsureVerifiedWorker();
    api.destroyPdfDoc(fileA);
    await Promise.resolve();await Promise.resolve();
    const survivorPage=await b.getPage(2),survivorText=(await survivorPage.getTextContent()).items.map(x=>x.str).join(' ');
    survivorPage.cleanup();
    const beforeDispose={samePromise:first===same,numPages:[a.numPages,b.numPages],whole,range,visited,aborted,
      survivorText,sharedAlive:!shared.destroyed,native:window.__pdfTest.native,fake:window.__pdfTest.fake,urls:window.__pdfTest.urls.slice()};
    api.destroyPdfDoc(fileB);await Promise.resolve();await Promise.resolve();api.pdfDisposeWorker();
    return{...beforeDispose,revoked:window.__pdfTest.revoked.slice()};
  },[...pdfBytes]);
}
function assertDocumentChecks(result){
  assert(result.samePromise);
  assert.deepEqual(result.numPages,[2,2]);
  assert.deepEqual(result.whole.map(p=>p.n),[1,2]);
  assert(result.whole[0].text.includes('Synthetic page 1')&&result.whole[1].text.includes('Synthetic page 2'));
  assert.deepEqual(result.range.map(p=>p.n),[2]);
  assert(result.range[0].text.includes('Synthetic page 2'));
  assert.deepEqual(result.visited,[1]);assert.equal(result.aborted,'AbortError');
  assert(result.survivorText.includes('Synthetic page 2')&&result.sharedAlive);
  assert.equal(result.native,1);assert.equal(result.fake,0);assert(result.urls.every(url=>url.startsWith('blob:')));
  assert.equal(result.revoked.length,1);assert.equal(result.revoked[0],result.urls[0]);
}
async function imageChecks(page){
  return page.evaluate(async()=>{
    const canvas=document.createElement('canvas');canvas.width=4000;canvas.height=3000;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,4000,3000);
    ctx.fillStyle='#123456';ctx.font='160px sans-serif';ctx.fillText('SYNTHETIC 12345',200,400);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    const small=new File([blob],'synthetic-small.png',{type:'image/png'});
    // PNG permits trailing bytes; this crosses the untouched production byte threshold
    // while keeping a deterministic, easily decoded synthetic image and modest memory use.
    const large=new File([blob,new Uint8Array(3*1024*1024)],'synthetic-large.png',{type:'image/png'});
    const decoded=await createImageBitmap(large);const dimensions=[decoded.width,decoded.height];decoded.close();
    const original=await window.__remediation.cardFilePayload(small);
    const resized=await window.__remediation.cardFilePayload(large);
    const actualBlob=await(await fetch('data:'+resized.mimeType+';base64,'+resized.data)).blob();
    const actual=await createImageBitmap(actualBlob),actualDimensions=[actual.width,actual.height];actual.close();
    return{smallSize:small.size,largeSize:large.size,dimensions,actualDimensions,
      untouched:!original.resized&&original.mimeType==='image/png'&&atob(original.data).length===small.size,
      resized:resized.resized,mime:resized.mimeType};
  });
}
async function withFileFixture(browser,run){
  const fixtureFile=path.join(os.tmpdir(),'nss-synthetic-pdf-'+process.pid+'.html');
  const html=fixturePage(),url=pathToFileURL(fixtureFile).href;
  fs.writeFileSync(fixtureFile,html,'utf8');
  const context=await browser.newContext({serviceWorkers:'block',acceptDownloads:false});
  try{
    const network=await interceptContext(context,url,html),errors=[];
    context.on('page',p=>p.on('pageerror',error=>errors.push(error.message)));
    const page=await context.newPage();await page.goto(url,{waitUntil:'load',timeout:45000});
    await page.waitForFunction(()=>window.__remediation?.state,{timeout:30000});
    await run({page,context,network,url});
    assert.deepEqual(network.unexpected,[]);assert.deepEqual(errors,[]);
    assert.deepEqual(await page.evaluate(()=>window.__remediation.errors),[]);
  }finally{await context.close();fs.unlinkSync(fixtureFile);}
}
async function main(){
  const {chromium}=require('playwright');
  const browser=await chromium.launch(process.env.REMEDIATION_BROWSER_EXECUTABLE?
    {executablePath:process.env.REMEDIATION_BROWSER_EXECUTABLE,headless:true}:{channel:'chrome',headless:true});
  const bytes=syntheticPdf(),report=text=>console.log('PASS '+text);
  try{
    await withFixture(browser,{},async({page,network})=>{
      assertDocumentChecks(await documentChecks(page,bytes));
      assert.equal(network.workers.length,1);
      const images=await imageChecks(page);
      assert.deepEqual(images.dimensions,[4000,3000]);assert(images.untouched);
      assert(images.largeSize>3*1024*1024&&images.smallSize<3*1024*1024);
      assert.deepEqual(images.actualDimensions,[3000,2250]);assert.equal(images.mime,'image/jpeg');
      assert.deepEqual(images.resized,{from:'4000x3000',to:'3000x2250'});
    });report('loopback: actual pinned worker, two PDFs, ranges, cancellation, survivor document, Blob cleanup, and actual PNG decoding/JPEG resize');
    await withFileFixture(browser,async({page,network})=>{
      assertDocumentChecks(await documentChecks(page,bytes));assert.equal(network.workers.length,1);
    });report('file://: actual app startup and verified Blob worker preserve two-page extraction and independent document destruction');
    await withFixture(browser,{},async({page,context,network})=>{
      await observeWorker(page);let mismatches=0;
      await context.route('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',route=>{
        mismatches++;return route.fulfill({status:200,contentType:'application/javascript',
          headers:{'access-control-allow-origin':'*'},body:'self.postMessage("bad integrity bytes");'});
      });
      const result=await page.evaluate(async bytes=>{
        const api=window.__remediation,file=new File([new Uint8Array(bytes)],'synthetic.pdf',{type:'application/pdf'});
        const pdf=await api.getPdfDoc(file);const pages=pdf.numPages;api.destroyPdfDoc(file);api.pdfDisposeWorker();
        return{pages,...window.__pdfTest};
      },[...bytes]);
      assert.equal(mismatches,1);assert.equal(result.pages,2);assert.equal(result.native,1);assert.equal(result.fake,0);
      assert(network.workers.some(url=>url.includes('cdn.jsdelivr.net')));
    });report('native fetch integrity rejects altered primary bytes; the independently pinned fallback reads the PDF');
    await withFixture(browser,{},async({page,context})=>{
      await observeWorker(page);let attempts=0;
      const bad=route=>{attempts++;return route.fulfill({status:200,contentType:'application/javascript',
        headers:{'access-control-allow-origin':'*'},body:'self.postMessage("incorrect worker");'});};
      await context.route('**/pdf.worker.min.js',bad);
      const result=await page.evaluate(async()=>{
        let message='';try{await window.__remediation.pdfEnsureVerifiedWorker();}catch(error){message=error.message;}
        return{message,...window.__pdfTest};
      });
      assert(result.message.includes('could not be verified'));assert.equal(attempts,2);
      assert.equal(result.native,0);assert.equal(result.fake,0);
      await context.unroute('**/pdf.worker.min.js',bad);
      const retried=await page.evaluate(async()=>{await window.__remediation.pdfEnsureVerifiedWorker();const n=window.__pdfTest.native;window.__remediation.pdfDisposeWorker();return n;});
      assert.equal(retried,1);
    });report('both worker integrity failures execute no worker or fake fallback; a later explicit retry succeeds');
    await withFixture(browser,{},async({page})=>{
      await observeWorker(page);
      const result=await page.evaluate(async()=>{
        const meta=document.createElement('meta');meta.httpEquiv='Content-Security-Policy';meta.content="worker-src 'none'";document.head.appendChild(meta);
        let message='';try{await window.__remediation.pdfEnsureVerifiedWorker();}catch(error){message=error.message;}
        return{message,...window.__pdfTest,csp:window.__remediation.csp};
      });
      assert(result.message);assert.equal(result.fake,0);
      assert(result.csp.some(event=>event.directive==='worker-src'));assert.equal(result.revoked.length,1);
    });report('actual worker CSP failure fails closed, revokes the Blob, and never enters PDF.js fake-worker fallback');
  }finally{await browser.close();}
  console.log('Synthetic PDF/card browser acceptance passed. No clinical material or Gemini requests.');
}
module.exports={syntheticPdf,documentChecks,imageChecks,withFileFixture,main};
if(require.main===module)main().catch(error=>{console.error(error.stack||error.message||error);process.exitCode=1;});
