#!/usr/bin/env node
'use strict';

// Test-only, real-App fixture. It never serves the repository or reads course files.
// Use the companion Playwright runner for request interception across every frame,
// popup, CSS resource, image and worker; a fetch stub alone cannot enforce that.
const fs=require('fs'),http=require('http'),path=require('path');
const {resolveSuiteFile}=require('./repo-checks');
const root=path.join(__dirname,'..');

function once(source,old,next){
  if(source.split(old).length!==2)throw Error('Real-App fixture anchor must occur exactly once: '+old.slice(0,100));
  return source.replace(old,()=>next);
}

function syntheticKB(label='A'){
  if(!/^[A-Z]$/.test(label))throw Error('Use a one-letter synthetic KB label.');
  return {metadata:{schemaVersion:'1.0',course:'Synthetic course '+label,exam:'Fixture only'},conditions:[{
    id:'condition-1',name:'Synthetic condition '+label,aliases:[],facts:[{
      id:'fact-1',text:'Fictional marker '+label+' is present.',sourceQuote:'Fictional marker '+label+' is present.',
      tier:1,latteBucket:'Look',factType:'other',safetyCritical:false,
      sources:[{filename:'Synthetic '+label+' source',location:'page 1'}]
    }]
  }],sources:[],medications:[],diagnostics:[],scoringTools:[],formulas:[],contradictions:[]};
}

function fixtureScript(config){
  // JSON is embedded in a script element, not interpreted as HTML.
  const encoded=JSON.stringify(config).replace(/</g,'\\u003c');
  return 'const remediationConfig='+encoded+';\n'+String.raw`
// Delays wrap the actual storage helpers; App's own hydration/save effects still run.
const remediationNative={load:kbLoadPersisted,save:kbSavePersisted,delete:kbDeletePersisted,fetch:window.fetch.bind(window),fileText:File.prototype.text};
const remediationClone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const remediation={
  state:null,events:[],pending:[],exports:[],copies:[],errors:[],geminiCalls:[],csp:[],
  perf:{originalDiagnostics:0,numericAudits:0},
  holds:new Set(remediationConfig.hold||[]),failures:[],sequence:0,
  hold(kind,stage='before'){this.holds.add(kind+':'+stage);},
  resume(kind,stage='before'){this.holds.delete(kind+':'+stage);},
  release(id){const p=this.pending.find(x=>x.id===id);if(!p)throw Error('Unknown pending checkpoint: '+id);p.resolve();},
  reject(id,message='Synthetic storage failure',name='QuotaExceededError'){
    const p=this.pending.find(x=>x.id===id);if(!p)throw Error('Unknown pending checkpoint: '+id);
    p.reject(Object.assign(new Error(message),{name}));
  },
  failNext(kind,message='Synthetic storage failure',name='QuotaExceededError'){this.failures.push({kind,message,name});},
  async checkpoint(kind,stage,event){
    const failed=this.failures.findIndex(x=>x.kind===kind&&stage==='before');
    if(failed>=0){const f=this.failures.splice(failed,1)[0];throw Object.assign(new Error(f.message),{name:f.name});}
    if(!this.holds.has(kind+':'+stage)&&!(stage==='before'&&this.holds.has(kind)))return;
    const id=event.id+':'+stage;
    await new Promise((resolve,reject)=>this.pending.push({id,kind,stage,snapshot:event.snapshot,resolve,reject}));
    this.pending=this.pending.filter(x=>x.id!==id);
  },
  async operation(kind,args){
    const event={id:kind+':'+(++this.sequence),kind,status:'waiting',snapshot:remediationClone(args[0])};
    this.events.push(event);
    try{
      await this.checkpoint(kind,'before',event);
      const value=await remediationNative[kind](...args);
      event.status='committed';event.result=remediationClone(value);
      await this.checkpoint(kind,'after',event);
      event.status='resolved';return value;
    }catch(e){event.status='rejected';event.error=e.message;this.pending=this.pending.filter(x=>!x.id.startsWith(event.id+':'));throw e;}
  },
  responseQueue:[],
  queueGemini(text,{defer=false,abortOnSignal=false}={}){this.responseQueue.push({text,defer,abortOnSignal});},
  streamGemini(id,text){const call=this.geminiCalls.find(x=>x.id===id);if(!call)throw Error('Unknown Gemini call: '+id);call.onUpdate?.(text);},
  metaGemini(id,meta){const call=this.geminiCalls.find(x=>x.id===id);if(!call)throw Error('Unknown Gemini call: '+id);call.onMeta?.(meta);},
  resolveGemini(id,text){const call=this.geminiCalls.find(x=>x.id===id);if(!call?.resolve)throw Error('Unknown deferred Gemini call: '+id);call.resolve(text===undefined?call.text:text);},
  rejectGemini(id,message='Synthetic Gemini failure'){const call=this.geminiCalls.find(x=>x.id===id);if(!call?.reject)throw Error('Unknown deferred Gemini call: '+id);call.reject(new Error(message));},
  async readStores(){
    const db=await kbOpenDB();
    const indexed=await new Promise((resolve,reject)=>{
      const tx=db.transaction(KB_DB_STORE,'readonly'),store=tx.objectStore(KB_DB_STORE),rows=[];
      const req=store.openCursor();req.onsuccess=()=>{const cursor=req.result;if(cursor){rows.push({key:cursor.key,value:cursor.value});cursor.continue();}};
      tx.oncomplete=()=>resolve(rows);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Read aborted'));
    });db.close();
    const local={};for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key.startsWith('latte_knowledge'))local[key]=localStorage.getItem(key);}
    return {indexed,local};
  },
  replace(kb){if(!this.context)throw Error('App is not mounted');this.context.setKnowledgeBase(kbNormalizeImported(kb).kb);},
  clear(){if(!this.context)throw Error('App is not mounted');this.context.setKnowledgeBase(EMPTY_LATTE_KB);},
  unmount(){window.__remediationRoot.unmount();},
  renderMarkdown(markdown){const target=document.createElement('section');target.id='remediation-output';target.innerHTML=mdToSafeHtml(markdown);document.body.appendChild(target);return target.innerHTML;},
  printDocument(markdown){return buildPrintDoc(markdown,'Synthetic fixture print','Synthetic resources only');},
  print(markdown){return exportAsPdf(markdown,'Synthetic fixture print','Synthetic resources only');},
  printIframe(markdown){return printViaIframe(this.printDocument(markdown));},
  snapshot(){return remediationClone({state:this.state,pending:this.pending.map(({id,kind,stage,snapshot})=>({id,kind,stage,snapshot})),events:this.events,exports:this.exports,errors:this.errors,csp:this.csp,geminiCalls:this.geminiCalls.map(({id,status})=>({id,status}))});}
};
window.__remediation=remediation;
Object.assign(remediation,{getPdfDoc,destroyPdfDoc,pdfWalkPages,cardFilePayload,extractPptxText,PPTX_LIMITS});
if(typeof pdfEnsureVerifiedWorker==='function')Object.assign(remediation,{pdfEnsureVerifiedWorker,pdfDisposeWorker,PDF_WORKER_URLS,PDF_WORKER_INTEGRITY});
const remediationDiagnostics=ankiBatchDiagnostics,remediationNumeric=ankiNumericAudit;
ankiBatchDiagnostics=(...args)=>{remediation.perf.originalDiagnostics++;return remediationDiagnostics(...args);};
ankiNumericAudit=(...args)=>{remediation.perf.numericAudits++;return remediationNumeric(...args);};
document.addEventListener('securitypolicyviolation',e=>remediation.csp.push({directive:e.violatedDirective,uri:e.blockedURI}));
kbLoadPersisted=(...args)=>remediation.operation('load',args);
kbSavePersisted=(...args)=>remediation.operation('save',args);
kbDeletePersisted=(...args)=>remediation.operation('delete',args);
File.prototype.text=async function(){
  const event={id:'file:'+(++remediation.sequence),kind:'file',status:'waiting',snapshot:{name:this.name,size:this.size}};remediation.events.push(event);
  try{await remediation.checkpoint('file','before',event);const text=await remediationNative.fileText.call(this);event.status='resolved';return text;}
  catch(e){event.status='rejected';throw e;}
};
window.fetch=(resource,...args)=>{
  const url=typeof resource==='string'?resource:resource.url;
  if(/^https:\/\/generativelanguage\.googleapis\.com\//.test(url)){
    const message='Unexpected real Gemini request in synthetic fixture';remediation.errors.push(message);return Promise.reject(new Error(message));
  }
  return remediationNative.fetch(resource,...args);
};
callGemini=async(...args)=>{
  const response=remediation.responseQueue.shift(),id='gemini:'+String(remediation.geminiCalls.length+1);
  const opts=args[3]||{};
  const call={id,status:'waiting',text:response?.text,onUpdate:opts.onUpdate,onMeta:opts.onMeta,signal:opts.signal};remediation.geminiCalls.push(call);
  if(!response){const message='Unexpected Gemini operation without a queued synthetic response';remediation.errors.push(message);call.status='unexpected';throw new Error(message);}
  let abortListener;
  try{const text=response.defer?await new Promise((resolve,reject)=>{Object.assign(call,{resolve,reject});if(response.abortOnSignal&&opts.signal){abortListener=()=>reject(new DOMException('Synthetic request aborted','AbortError'));if(opts.signal.aborted)abortListener();else opts.signal.addEventListener('abort',abortListener,{once:true});}}):response.text;call.status='resolved';return text;}
  catch(e){call.status='rejected';throw e;}
  finally{if(abortListener)opts.signal.removeEventListener('abort',abortListener);}
};
downloadBlob=async(blob,name)=>remediation.exports.push({name,text:await blob.text()});
copyText=async text=>{remediation.copies.push(String(text));return true;};
function RemediationProbe(){
  const context=useContext(KnowledgeCtx);
  useEffect(()=>{remediation.context=context;remediation.state={knowledgeBase:remediationClone(context.knowledgeBase),persistenceStatus:context.persistenceStatus,persistenceError:context.persistenceError,artifactRegistry:remediationClone(context.artifactRegistry),recovery:remediationClone(context.recoveryChoices)};},[context]);
  return <div id="remediation-fixture-label" style={{position:'fixed',bottom:0,left:0,zIndex:99999,padding:'4px 10px',background:'#113322',color:'white',fontSize:11}}>Synthetic real-App fixture · isolated storage · mocked generation</div>;
}
window.__remediationSeedReady=(async()=>{
  sessionStorage.setItem('suite_key','synthetic-fixture-only');
  // Reload must exercise persisted bytes, rather than overwriting them with the seed.
  if(sessionStorage.getItem('remediation_seeded'))return;
  if(remediationConfig.local!==undefined)localStorage.setItem('latte_knowledge_base_v1',JSON.stringify(remediationConfig.local));
  if(remediationConfig.fallback!==undefined)localStorage.setItem('latte_knowledge_snapshot_v2',JSON.stringify(remediationConfig.fallback));
  if(remediationConfig.indexed!==undefined){
    const db=await kbOpenDB();
    await new Promise((resolve,reject)=>{const tx=db.transaction(KB_DB_STORE,'readwrite');tx.objectStore(KB_DB_STORE).put(remediationConfig.indexed,KB_DB_KEY);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Seed aborted'));});db.close();
  }
  sessionStorage.setItem('remediation_seeded','1');
})();
`;
}

function page(config={}){
  let source=fs.readFileSync(resolveSuiteFile({rootDir:root}),'utf8');
  source=once(source,'      <FactInspectorDrawer/>','      <RemediationProbe/>\n      <FactInspectorDrawer/>');
  source=once(source,'try{if(!window.React)throw new Error(',fixtureScript(config)+'\ntry{if(!window.React)throw new Error(');
  source=once(source,"ReactDOM.createRoot(document.getElementById('root')).render(<BootErrorBoundary><App/></BootErrorBoundary>);",
    "window.__remediationSeedReady.then(()=>{window.__remediationRoot=ReactDOM.createRoot(document.getElementById('root'));window.__remediationRoot.render(<BootErrorBoundary><App/></BootErrorBoundary>);}).catch(e=>{window.__remediation.errors.push(e.message);window.__latteBootFail?.(e.message);});");
  return source;
}

function createServer({config={},port=0}={}){
  const html=page(config);
  const server=http.createServer((req,res)=>{
    if(req.method!=='GET'||req.url!=='/'){
      res.writeHead(404,{'Content-Type':'text/plain','Cache-Control':'no-store'});res.end('Not found');return;
    }
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(html);
  });
  return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>resolve({server,url:'http://127.0.0.1:'+server.address().port+'/'}));});
}

if(require.main===module){
  const port=process.argv[2]===undefined?0:Number(process.argv[2]);
  if(!Number.isInteger(port)||port<0||port>65535){console.error('Port must be an integer from 0 through 65535.');process.exitCode=1;}
  else createServer({port}).then(({url})=>console.log('Synthetic real-App fixture: '+url+'\nUse remediation-browser-tests.js for browser-wide network interception.')).catch(e=>{console.error(e.message);process.exitCode=1;});
}
module.exports={page,createServer,syntheticKB,once};
