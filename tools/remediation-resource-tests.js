#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const {resolveSuiteFile}=require('./repo-checks');
const EXPECTED_PURIFY_HASH='sha384-uUMu9JDY09vBzRf9SPcK2VgUj+W/70J6Soc+Dded5P474ElQ63iv9j5N3DE7Kp3N';
const EXPECTED_WORKER_HASH='sha384-SnzOobpRMLXZ52iJvZm/C0fYw0OQemTXzTjIsdsfMcrCtCEe9qgzxTd3RSklO5x2';
function extract(source,start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);if(a<0||b<a)throw Error('Resource regression anchor missing: '+start);return source.slice(a,b);}
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
async function runTests(source,test=(name,ok)=>assert.ok(ok,name)){
  let count=0;const t=(name,ok)=>{count++;test('resources: '+name,!!ok);};
  const rejected=async promise=>{try{await promise;return false;}catch{return true;}};
  const pins=[...source.matchAll(/<script src="([^"]+)" integrity="([^"]+)"/g)];
  t('eight SRI script resources remain distinct from the worker pin',pins.length===8&&pins.every(p=>p[2].startsWith('sha384-')));
  t('both sanitizer CDNs use the verified current patch',pins.filter(p=>p[1].includes('purify')).every(p=>p[1].includes('3.4.15')&&p[2]===EXPECTED_PURIFY_HASH));
  t('main CSP disables image/media fetch without a default-src migration',
    source.includes("img-src 'none'; media-src 'none'; worker-src blob:; frame-src 'self' blob:")&&
    !source.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/)[1].includes('default-src'));
  t('worker bootstrap has no unverified workerSrc assignment',!source.includes("GlobalWorkerOptions.workerSrc="));
  const policySource=extract(source,'const STUDY_OUTPUT_POLICY=','// navigator.clipboard requires');
  const nodes=[{tagName:'DIV',value:'pagebreak unwanted',classList:{contains:()=>true},
    setAttribute(k,v){this.value=v;},removeAttribute(){this.value=null;}},
    {tagName:'SPAN',value:'untrusted',classList:{contains:()=>true},setAttribute(k,v){this.value=v;},removeAttribute(){this.value=null;}}];
  let seenPolicy,seenMarkdown;
  const anchors=[{tagName:'A',attrs:{href:'https://synthetic.invalid/reference'},setAttribute(k,v){this.attrs[k]=v;}}];
  const fragment={querySelectorAll:selector=>selector==='a[href]'?anchors:nodes};
  const output=new Function('DOMPurify','marked','document',policySource+';return {mdToSafeHtml,STUDY_OUTPUT_POLICY};')(
    {isSupported:true,sanitize:(html,policy)=>{seenPolicy=policy;return fragment;}},
    {parse:md=>{seenMarkdown=md;return md;}},
    {createElement:()=>({appendChild:()=>{},innerHTML:'<p>synthetic safe content</p>'})});
  const rendered=output.mdToSafeHtml('synthetic markdown');
  t('live renderer uses the shared narrow policy',seenPolicy===output.STUDY_OUTPUT_POLICY&&seenMarkdown==='synthetic markdown'&&rendered.includes('safe content'));
  t('study text/table/code/comparator containers are retained',['p','h1','h6','table','thead','tbody','tr','th','td','pre','code','sup','sub'].every(tag=>seenPolicy.ALLOWED_TAGS.includes(tag)));
  t('untrusted resource and style elements are excluded',['img','picture','source','audio','video','svg','math','iframe','object','embed','style','link','script','input','form'].every(tag=>!seenPolicy.ALLOWED_TAGS.includes(tag)));
  t('resource/style/event attributes are excluded',['src','srcset','poster','style','background','ping','onerror','onload','srcdoc'].every(attr=>!seenPolicy.ALLOWED_ATTR.includes(attr)));
  t('only the answer-key pagebreak class survives',nodes[0].value==='pagebreak'&&nodes[1].value===null);
  t('rendered links open in a new tab without an opener',anchors[0].attrs.target==='_blank'&&anchors[0].attrs.rel==='noopener noreferrer');
  let failedClosed=false;
  try{new Function('DOMPurify',policySource+';return mdToSafeHtml("x");')({isSupported:false});}catch(error){failedClosed=/sanitizer is unavailable/.test(error.message);}
  t('unsupported sanitizer fails closed',failedClosed);
  const printSource=extract(source,'function buildPrintDoc(','// Fallback when a popup blocker');
  const printDoc=new Function('mdToSafeHtml','escHtml',printSource+';return buildPrintDoc;')(
    ()=>'<p>synthetic</p>',s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])));
  const html=printDoc('synthetic','<title>','<subtitle>');
  t('print CSP precedes content and blocks resource/script execution',
    html.indexOf('Content-Security-Policy')<html.indexOf('<p>synthetic')&&html.includes("default-src 'none'; style-src 'unsafe-inline'"));
  t('trusted print style and escaped headings remain',html.includes('<style>')&&html.includes('&lt;title&gt;')&&html.includes('&lt;subtitle&gt;'));
  let frame,appended=0,printed=0,removed=0,afterPrint,timeout;
  const iframeSource=extract(source,'function printViaIframe(','function exportAsPdf(');
  const printIframe=new Function('document','setTimeout',iframeSource+';return printViaIframe;')({
    createElement:()=>frame={attrs:{},style:{},setAttribute(k,v){this.attrs[k]=v;},
      contentWindow:{addEventListener:(name,fn)=>{if(name==='afterprint')afterPrint=fn;},focus:()=>{},print:()=>{printed++;}},
      remove:()=>{removed++;}},
    body:{appendChild:f=>{appended++;t('iframe receives sanitized srcdoc before insertion',f.srcdoc===html);}}
  },fn=>{timeout=fn;});
  printIframe(html);frame.onload();
  t('iframe permits parent print access without scripts',frame.attrs.sandbox==='allow-same-origin allow-modals'&&appended===1&&printed===1);
  afterPrint();timeout();
  t('iframe afterprint and timeout share idempotent cleanup',removed===1);

  const workerSource=extract(source,'const PDF_WORKER_INTEGRITY=','// v15.4: coordinate-aware page assembly');
  function env(options={}){
    const state={fetches:[],workers:[],wrappers:[],documents:[],tasks:[],urls:[],revoked:[],pagehide:null};
    class NativeWorker extends EventTarget{
      constructor(url){super();this.url=url;this.terminated=0;state.workers.push(this);
        if(options.workerThrows)throw Error('synthetic CSP startup failure');
        queueMicrotask(()=>{const event=options.workerError?new Event('error'):new MessageEvent('message',{data:{action:'ready',sourceName:'worker',targetName:'main'}});this.dispatchEvent(event);});
      }
      terminate(){this.terminated++;}
    }
    class Wrapper{
      constructor({port}){assert.ok(port instanceof NativeWorker,'worker port required; fake-worker path is prohibited');this.port=port;this.promise=Promise.resolve();this.destroyed=0;state.wrappers.push(this);}
      destroy(){this.destroyed++;}
    }
    const fetcher=async(url,config)=>{state.fetches.push({url,config});if(options.fetch)return options.fetch(url,config,state.fetches.length);
      return{ok:true,arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer};};
    const api=new Function('fetch','Worker','pdfjsLib','URL','Blob','AbortController','window',workerSource+
      ';return {pdfEnsureVerifiedWorker,getPdfDoc,destroyPdfDoc,pdfDisposeWorker,PDF_WORKER_URLS,PDF_WORKER_INTEGRITY};')(
        fetcher,NativeWorker,{PDFWorker:Wrapper,getDocument:config=>{
          assert.ok(config.worker instanceof Wrapper,'document must use the explicit verified shared worker');
          const doc={config,destroyed:0,destroy(){this.destroyed++;return Promise.resolve();}};state.documents.push(doc);
          const pending=options.holdDocument?deferred():null;
          const task={promise:pending?pending.promise:Promise.resolve(doc),destroyed:0,destroy(){this.destroyed++;if(pending)pending.reject(Error('cancelled'));return Promise.resolve();},pending};
          state.tasks.push(task);return task;
        }},
        {createObjectURL:blob=>{const url='blob:synthetic-'+state.urls.length;state.urls.push({url,blob});return url;},
          revokeObjectURL:url=>state.revoked.push(url)},Blob,AbortController,{addEventListener:(name,fn)=>{if(name==='pagehide')state.pagehide=fn;}});
    return{api,state};
  }
  const file=()=>({arrayBuffer:async()=>new Uint8Array([37,80,68,70]).buffer});
  const primary=env(),first=file(),second=file();
  const p1=primary.api.getPdfDoc(first),same=primary.api.getPdfDoc(first),p2=primary.api.getPdfDoc(second);
  const docs=await Promise.all([p1,p2]);
  t('one File shares its pending document promise',same===p1);
  t('concurrent documents share one verified worker',primary.state.fetches.length===1&&primary.state.workers.length===1&&primary.state.wrappers.length===1&&docs.length===2);
  t('worker integrity is native and credentials are omitted',primary.state.fetches[0].config.integrity===EXPECTED_WORKER_HASH&&primary.state.fetches[0].config.credentials==='omit'&&primary.state.fetches[0].config.mode==='cors');
  t('getDocument retains isEvalSupported false and explicit worker',docs.every(doc=>doc.config.isEvalSupported===false&&doc.config.worker===primary.state.wrappers[0]));
  primary.api.destroyPdfDoc(first);await Promise.resolve();await Promise.resolve();
  t('destroying one document keeps sibling and shared worker alive',docs[0].destroyed===1&&docs[1].destroyed===0&&primary.state.workers[0].terminated===0&&primary.state.wrappers[0].destroyed===0);
  primary.state.pagehide({persisted:true});
  t('bfcache pagehide retains live resources',docs[1].destroyed===0&&primary.state.workers[0].terminated===0);
  primary.state.pagehide({persisted:false});
  t('terminal pagehide releases document wrapper worker and Blob',docs[1].destroyed===1&&primary.state.wrappers[0].destroyed===1&&primary.state.workers[0].terminated===1&&primary.state.revoked.length===1);
  primary.api.pdfDisposeWorker();
  t('page cleanup is idempotent',primary.state.workers[0].terminated===1&&primary.state.revoked.length===1);
  await primary.api.getPdfDoc(second);
  t('opening after cleanup never returns destroyed cached document',primary.state.documents.length===3&&primary.state.workers.length===2);
  primary.api.pdfDisposeWorker();
  const fallback=env({fetch:async(url,config,n)=>{if(n===1)throw Error('integrity mismatch');return{ok:true,arrayBuffer:async()=>new Uint8Array([4]).buffer};}});
  await fallback.api.getPdfDoc(file());
  t('primary verification failure uses separately pinned fallback',fallback.state.fetches.length===2&&fallback.state.fetches.every(r=>r.config.integrity===EXPECTED_WORKER_HASH)&&fallback.state.workers.length===1);
  fallback.api.pdfDisposeWorker();
  let blocked=true;
  const failures=env({fetch:async()=>{if(blocked)throw Error('hash mismatch');return{ok:true,arrayBuffer:async()=>new Uint8Array([5]).buffer};}});
  const retryFile=file();
  t('both integrity failures reject before any worker executes',await rejected(failures.api.getPdfDoc(retryFile))&&failures.state.workers.length===0&&failures.state.urls.length===0);
  blocked=false;await failures.api.getPdfDoc(retryFile);
  t('failed initialization is explicitly retryable on the next open',failures.state.workers.length===1&&failures.state.fetches.length===3);
  failures.api.pdfDisposeWorker();
  for(const flag of ['workerThrows','workerError']){
    const broken=env({[flag]:true});
    t(flag+' fails closed without fake worker',await rejected(broken.api.getPdfDoc(file()))&&broken.state.wrappers.length===0&&broken.state.documents.length===0);
    t(flag+' revokes its verified Blob',broken.state.revoked.length===1);
  }
  const loading=env({holdDocument:true}),loadingFile=file(),pendingDoc=loading.api.getPdfDoc(loadingFile);
  const pendingRejected=rejected(pendingDoc);
  for(let i=0;i<10&&!loading.state.tasks.length;i++)await Promise.resolve();
  loading.api.destroyPdfDoc(loadingFile);
  t('removing a pending PDF destroys its loading task',await pendingRejected&&loading.state.tasks[0].destroyed===1&&loading.state.workers[0].terminated===0);
  loading.api.pdfDisposeWorker();
  const fetchPending=deferred(),cancelled=env({fetch:()=>fetchPending.promise});
  const old=cancelled.api.getPdfDoc(file()),oldRejected=rejected(old);
  cancelled.api.pdfDisposeWorker();
  fetchPending.resolve({ok:true,arrayBuffer:async()=>new Uint8Array([1]).buffer});
  t('cleanup during verification prevents late worker startup',await oldRejected&&cancelled.state.workers.length===0);
  return count;
}
module.exports={runTests};
if(require.main===module){
  let source=fs.readFileSync(resolveSuiteFile(),'utf8');
  runTests(source).then(count=>console.log('PASS '+count+' offline resource assertions against live extracted functions'))
    .catch(error=>{console.error(error.stack||error);process.exitCode=1;});
}
