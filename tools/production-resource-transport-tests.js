#!/usr/bin/env node
'use strict';
// Synthetic, offline checks of live resource/transport functions; no application runtime dependencies.
const assert=require('assert/strict'),fs=require('fs');
const {resolveSuiteFile}=require('./repo-checks');
function extract(source,start,end){
  if(source.split(start).length!==2)throw Error('Production resource anchor must occur once: '+start);
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  if(b<0)throw Error('Production resource tail missing: '+end);
  return source.slice(a,b);
}
const rejection=async work=>{try{await work;return null;}catch(error){return error;}};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
async function runTests(source,test=(name,ok)=>assert.ok(ok,name)){
  let count=0;const t=(name,ok)=>{count++;test('production resource/transport: '+name,!!ok);};
  const pptxSource=extract(source,"const _OOXML_A_NS =",'// Single core for ALL Gemini traffic:');
  const enc=new TextEncoder();
  // Deliberately small XML model for canonical synthetic fixtures, never a substitute parser in the app.
  class FixtureDOMParser{
    parseFromString(xml){
      const elements=[...xml.matchAll(/<([\w:]+)\b([^>]*)>/g)].map(m=>{
        const attrs=Object.fromEntries([...m[2].matchAll(/([\w:]+)="([^"]*)"/g)].map(a=>[a[1],a[2]]));
        return{nodeName:m[1],localName:m[1].split(':').pop(),getAttribute:k=>attrs[k]||'',getAttributeNS:(_,k)=>attrs['r:'+k]||''};
      });
      const runs=[...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(m=>({textContent:m[1]}));
      return{getElementsByTagNameNS:()=>runs,getElementsByTagName:name=>name==='*'?elements:name==='a:t'?runs:[]};
    }
  }
  function entry(chunks,options={}){
    const state={started:0,paused:0,emitted:0,decoded:0};
    const value={state,internalStream(type){
      assert.equal(type,'uint8array','decompression must expose bytes before text decoding');
      const handlers={};let stopped=false;
      const stream={on(name,fn){handlers[name]=fn;return this;},pause(){stopped=true;state.paused++;return this;},resume(){
        state.started++;
        queueMicrotask(()=>{
          for(const chunk of chunks){
            if(stopped&&!options.lateAfterPause)return;
            state.emitted++;handlers.data(typeof chunk==='string'?enc.encode(chunk):chunk);
            options.afterChunk?.(state.emitted);
          }
          if(!stopped)options.error?handlers.error(options.error):handlers.end();
          else if(options.lateAfterPause)handlers.end();
        });return this;
      }};return stream;
    }};return value;
  }
  function env(files={},options={}){
    let loads=0,decoders=0;
    class Decoder extends TextDecoder{constructor(...args){super(...args);decoders++;}}
    const api=new Function('JSZip','DOMParser','TextDecoder',pptxSource+';return {extractPptxText,pptxReadXml,_pptxRunText,PPTX_LIMITS};')(
      {loadAsync:()=>{loads++;return options.load?options.load():Promise.resolve({files});}},options.DOMParser||FixtureDOMParser,Decoder);
    return{...api,loads:()=>loads,decoders:()=>decoders};
  }
  const file={name:'synthetic.pptx',size:128},basic={'ppt/slides/slide1.xml':entry(['<a:t>Alpha</a:t>'])};
  let h=env(basic),out=await h.extractPptxText(file);
  t('ordinary slide text and numbering survive bounded extraction',out==='\n--- SLIDE 1 ---\nAlpha\n');
  h=env();let error=await rejection(h.extractPptxText({...file,size:h.PPTX_LIMITS.fileBytes+1}));
  t('oversized compressed input is rejected before ZIP loading',/64 MiB/.test(error?.message)&&h.loads()===0);
  const many=Object.fromEntries(Array.from({length:h.PPTX_LIMITS.entries+1},(_,i)=>['unused'+i,entry([])]));h=env(many);
  error=await rejection(h.extractPptxText(file));
  t('entry count rejects before any member expands',/ZIP entries/.test(error?.message)&&Object.values(many).every(e=>e.state.started===0));
  const member=entry([new Uint8Array(4*1024*1024),Uint8Array.of(1),Uint8Array.of(2)],{lateAfterPause:true});h=env();
  error=await rejection(h.pptxReadXml(member,{bytes:0}));
  t('actual member bytes reject before text decoding, ignoring late inflate output',/expansion/.test(error?.message)&&member.state.paused===1&&h.decoders()===0&&member.state.emitted===3);
  const aggregate=entry([new Uint8Array(6)]);h=env();
  error=await rejection(h.pptxReadXml(aggregate,{bytes:h.PPTX_LIMITS.totalBytes-5}));
  t('aggregate budget counts actual bytes across members',/expansion/.test(error?.message)&&aggregate.state.paused===1&&h.decoders()===0);
  h=env();const boundaryBudget={bytes:h.PPTX_LIMITS.totalBytes-h.PPTX_LIMITS.xmlBytes};
  const boundary=await h.pptxReadXml(entry([new Uint8Array(h.PPTX_LIMITS.xmlBytes)]),boundaryBudget);
  t('exact member and aggregate byte limits remain accepted',boundary.length===h.PPTX_LIMITS.xmlBytes&&boundaryBudget.bytes===h.PPTX_LIMITS.totalBytes);
  h=env();const exact=entry([enc.encode('μ').slice(0,1),enc.encode('μ').slice(1)]);
  t('UTF-8 split across decompressor chunks remains intact',await h.pptxReadXml(exact,{bytes:0})==='μ');
  const broken=entry([],{error:Error('synthetic corrupt ZIP')});h=env();
  t('stream errors preserve the original failure', (await rejection(h.pptxReadXml(broken,{bytes:0})))?.message==='synthetic corrupt ZIP');
  const aborted=new AbortController();aborted.abort();h=env();
  t('already cancelled extraction never loads a ZIP',(await rejection(h.extractPptxText(file,{signal:aborted.signal})))?.name==='AbortError'&&h.loads()===0);
  const loading=deferred(),loadingCtl=new AbortController();h=env(basic,{load:()=>loading.promise});
  const loadResult=rejection(h.extractPptxText(file,{signal:loadingCtl.signal}));loadingCtl.abort();
  t('cancel during ZIP loading settles without waiting for file reading',(await loadResult)?.name==='AbortError');
  loading.resolve({files:basic});await Promise.resolve();
  const racedCtl=new AbortController();h=env({}, {load:()=>{racedCtl.abort();return Promise.reject(Error('late loading failure'));}});
  error=await rejection(h.extractPptxText(file,{signal:racedCtl.signal}));await new Promise(resolve=>setImmediate(resolve));
  t('cancellation while creating the ZIP promise still observes a late rejection',error?.name==='AbortError');
  const ctl=new AbortController(),streaming=entry(['first','second'],{afterChunk:n=>{if(n===1)ctl.abort();}});h=env();
  let added=0,removed=0;const add=ctl.signal.addEventListener.bind(ctl.signal),remove=ctl.signal.removeEventListener.bind(ctl.signal);
  ctl.signal.addEventListener=(...args)=>{added++;return add(...args);};ctl.signal.removeEventListener=(...args)=>{removed++;return remove(...args);};
  error=await rejection(h.pptxReadXml(streaming,{bytes:0},ctl.signal));
  t('cancel during expansion pauses the stream and detaches its listener',error?.name==='AbortError'&&streaming.state.paused===1&&streaming.state.emitted===1&&added===removed&&h.decoders()===0);
  const ordered={
    'ppt/presentation.xml':entry(['<p:sldId r:id="two"/><p:sldId r:id="one"/><p:sldId r:id="two"/>']),
    'ppt/_rels/presentation.xml.rels':entry(['<Relationship Id="one" Target="slides/slide1.xml"/><Relationship Id="two" Target="slides/slide2.xml"/>']),
    'ppt/slides/slide1.xml':entry(['<a:t>Alpha</a:t>']),
    'ppt/slides/slide2.xml':entry(['<a:t>Beta</a:t>']),
    'ppt/slides/_rels/slide2.xml.rels':entry(['<Relationship Id="note" Type="x/notesSlide" Target="../notesSlides/notesSlide2.xml"/>']),
    'ppt/notesSlides/notesSlide2.xml':entry(['<a:t>Note</a:t>'])
  };
  h=env(ordered);out=await h.extractPptxText(file);
  t('presentation order, legitimate repeated slides and notes are preserved',out==='\n--- SLIDE 1 ---\nBeta\n[Speaker notes] Note\n\n--- SLIDE 2 ---\nAlpha\n\n--- SLIDE 3 ---\nBeta\n[Speaker notes] Note\n');
  const refs=entry(['<p:sldId r:id="one"/>'.repeat(h.PPTX_LIMITS.slides+1)]),unusedSlide=entry(['<a:t>unused</a:t>']);
  h=env({'ppt/presentation.xml':refs,'ppt/_rels/presentation.xml.rels':entry(['<Relationship Id="one" Target="slides/slide1.xml"/>']),'ppt/slides/slide1.xml':unusedSlide});
  error=await rejection(h.extractPptxText(file));
  t('reference amplification stops before slide expansion',/slide references/.test(error?.message)&&unusedSlide.state.started===0);
  const largeText='x'.repeat(2100000),largeSlide=entry(['<a:t>'+largeText+'</a:t>']);
  h=env({'ppt/slides/slide1.xml':largeSlide,'ppt/slides/slide2.xml':largeSlide});error=await rejection(h.extractPptxText(file));
  t('extracted text limit rejects instead of returning a shortened deck',/extracted text/.test(error?.message));
  let descendantReads=0;
  class NestedDOMParser{parseFromString(){return{getElementsByTagNameNS:()=>[{firstElementChild:{},get textContent(){descendantReads++;throw Error('must not materialize nested descendants');}}]};}}
  h=env({}, {DOMParser:NestedDOMParser});error=await rejection(Promise.resolve().then(()=>h._pptxRunText('synthetic',100)));
  t('nested OOXML text is rejected before descendant textContent materialization',/nested markup/.test(error?.message)&&descendantReads===0);
  let runReads=0;
  class RunBudgetDOMParser{parseFromString(){return{getElementsByTagNameNS:()=>['abc','def','never read'].map(text=>({firstElementChild:null,get textContent(){runReads++;return text;}}))};}}
  h=env({}, {DOMParser:RunBudgetDOMParser});error=await rejection(Promise.resolve().then(()=>h._pptxRunText('synthetic',6)));
  t('cumulative run budget includes separators and stops before later runs or joins',/extracted text/.test(error?.message)&&runReads===2);
  h=env();const exactRuns=h._pptxRunText('<a:t> abc </a:t><a:t> </a:t><a:t>def</a:t>',7);
  t('leaf runs retain trimming and exact-budget separators',exactRuns.join('\n')==='abc\ndef');
  const withNotes={'ppt/slides/slide1.xml':entry(['<a:t>'+largeText+'</a:t>']),
    'ppt/slides/_rels/slide1.xml.rels':entry(['<Relationship Id="note" Type="x/notesSlide" Target="../notesSlides/notesSlide1.xml"/>']),
    'ppt/notesSlides/notesSlide1.xml':entry(['<a:t>'+largeText+'</a:t>'])};
  h=env(withNotes);error=await rejection(h.extractPptxText(file));
  t('speaker notes share the remaining slide-output budget',/extracted text/.test(error?.message));
  t('live ingestion forwards its cancellation signal',source.includes('const text=await extractPptxText(file,{signal});'));

  const retrySource=extract(source,'function geminiRetryDelayMs(','// v15.17: an SSE line');
  const now=Date.UTC(2026,0,1),fixedDate={parse:Date.parse,now:()=>now};
  const delay=new Function('Date','Math',retrySource+';return geminiRetryDelayMs;')(fixedDate,{pow:Math.pow,random:()=>0,max:Math.max});
  const hdr=value=>({get:()=>value}),info=value=>({error:{details:[{'@type':'type.googleapis.com/google.rpc.RetryInfo',retryDelay:value}]}});
  t('RetryInfo 120 seconds remains a 120-second floor',delay(info('120s'),hdr(null),0)===120000);
  t('fractional protobuf durations retain subsecond precision',delay(info('12.750s'),hdr(null),0)===12750);
  t('Retry-After HTTP dates are converted to future delays',delay({},hdr(new Date(now+90000).toUTCString()),0)===90000);
  t('a longer header floor wins over a shorter body hint',delay(info('37s'),hdr('120'),0)===120000);
  t('a shorter server hint cannot shorten exponential pacing',delay(info('1s'),hdr('2'),3)===16000);
  t('malformed and past hints retain ordinary pacing',delay(info('12junk'),hdr('not a date'),0)===2000&&delay({},hdr(new Date(now-1000).toUTCString()),0)===2000);
  const transportSource=extract(source,'function geminiSSEParser(','\nasync function callGemini(');
  let calls=0,sleeps=[];
  const transport=new Function('fetch','_sleep','geminiRetryDelayMs','SAFETY_SETTINGS',transportSource+';return geminiRequest;')(
    async()=>{calls++;return{ok:false,status:429,json:async()=>({error:{message:'Synthetic rate limit',...info('120s').error}}),headers:hdr(null)};},
    async(ms)=>{sleeps.push(ms);},delay,[]);
  error=await rejection(transport('synthetic-key','synthetic-model',{}, {retries:2}));
  t('long floor defers without retry or hidden wait and preserves status',error?.name==='RetryDeferredError'&&error.retryDeferred&&error.status===429&&error.retryAfterMs===120000&&/120 seconds/.test(error.message)&&calls===1&&sleeps.length===0);
  const sleepSource=extract(source,'const _sleep=','// v15.14: how long to wait');
  const sleep=new Function(sleepSource+';return _sleep;')(),sleepCtl=new AbortController(),waiting=rejection(sleep(60000,sleepCtl.signal));sleepCtl.abort();
  t('ordinary retry waits remain immediately abortable',(await waiting)?.name==='AbortError');

  const printSource=extract(source,'function exportAsPdf(','\n/* ═');
  let writes=0,printed=0,fallback=0,opened=0;const opener={sensitive:'synthetic'};
  const popup={opener,document:{open(){assert.equal(popup.opener,null,'opener must be severed before document construction');},write(){writes++;},close(){},readyState:'complete',getElementById(){return{};}},focus(){},print(){printed++;}};
  const print=new Function('window','buildPrintDoc','printViaIframe','setTimeout','alert',printSource+';return exportAsPdf;')(
    {open(){opened++;return popup;}},()=>'<p>synthetic</p>',()=>{fallback++;},fn=>fn(),()=>{});
  print('synthetic','Study');
  t('successful popup severs opener while parent can still write and print',popup.opener===null&&writes===1&&printed===1&&opened===1&&fallback===0);
  const blockedPrint=new Function('window','buildPrintDoc','printViaIframe','alert',printSource+';return exportAsPdf;')({open:()=>null},()=>'<p>safe</p>',()=>{fallback++;},()=>{});
  blockedPrint('synthetic','Study');t('blocked popup still uses the sandboxed iframe fallback',fallback===1);
  t('extractions include full failure, cleanup and output tails',pptxSource.includes('pptxCheckAbort(signal);return out;')&&transportSource.includes('await _sleep(retryDelay,signal);')&&printSource.includes("win.addEventListener('load'"));
  return count;
}
async function runJsZipTests(source,JSZip){
  assert.equal(JSZip.version,'3.10.1','exercise the shipped JSZip version');
  const code=extract(source,'const PPTX_LIMITS=','async function extractPptxText(');
  const {pptxReadXml,PPTX_LIMITS}=new Function(code+';return {pptxReadXml,PPTX_LIMITS};')();
  const generated=new JSZip();generated.file('tiny.xml','<a:t>μ</a:t>');generated.file('large.xml',Buffer.alloc(PPTX_LIMITS.xmlBytes+1,65));
  const bytes=await generated.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
  assert(bytes.length<10000,'synthetic compressed fixture stays small');
  // Falsify the large member's declared length: the boundary must count real expanded output.
  let pos=0;
  while((pos=bytes.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]),pos))>=0){
    const length=bytes.readUInt16LE(pos+28),name=bytes.toString('utf8',pos+46,pos+46+length);
    if(name==='large.xml')bytes.writeUInt32LE(1,pos+24);
    pos+=46+length;
  }
  const archive=await JSZip.loadAsync(bytes);
  assert.equal(await pptxReadXml(archive.file('tiny.xml'),{bytes:0}),'<a:t>μ</a:t>');
  const failure=await rejection(pptxReadXml(archive.file('large.xml'),{bytes:0}));
  assert.match(failure?.message||'',/expansion exceeds/,'actual inflate budget rejects even with forged size metadata');
  return 3;
}
module.exports={runTests,runJsZipTests};
if(require.main===module){
  const source=fs.readFileSync(resolveSuiteFile(),'utf8');
  runTests(source).then(async count=>{
    if(process.argv.includes('--jszip'))count+=await runJsZipTests(source,require('jszip'));
    console.log('PASS '+count+' production resource/transport assertions');
  }).catch(error=>{console.error(error.stack||error);process.exitCode=1;});
}
