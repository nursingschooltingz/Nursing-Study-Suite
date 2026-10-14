'use strict';

// v18.0: step 10 of the v17.14 production review, Low findings (transport group). Synthetic data only.
// L1 PPTX absolute targets, L2 callGemini default level, L3 mid-stream API errors, L4/L5 settings drawer,
// L16 number fields, L44 CSP style/font directives and print links. Each check runs the shipped code where it can.
const os=require('os'),path=require('path');

function span(S,start,end){
  const a=S.indexOf(start);if(a<0)throw Error('v18.0 transport anchor missing: '+start);
  const b=S.indexOf(end,a+start.length);if(b<0)throw Error('v18.0 transport end anchor missing after: '+start);
  return S.slice(a,b);
}
// A section whose extraction fails (for example against older bytes) fails each of its named checks.
async function section(t,names,fn){
  let results;
  try{results=await fn();}catch(e){results={};console.log('      v18.0 transport section error: '+(e&&e.message||e));}
  for(const name of names)t(name,results[name]===true);
}
function loadBabel(){
  const babelPath=process.env.NSS_BABEL_STANDALONE||path.join(os.tmpdir(),'nursing-study-suite-verify/node_modules/@babel/standalone/babel.js');
  return require(babelPath);
}
// Minimal hook runtime: enough of React to render one function component repeatedly (as in settings-focus-tests).
function createRuntime(context){
  const hooks=[];let cursor=0,pending=[];
  const React={
    useState(init){const i=cursor++;if(!hooks[i])hooks[i]={value:typeof init==='function'?init():init};const h=hooks[i];return [h.value,next=>{h.value=typeof next==='function'?next(h.value):next;}];},
    useRef(init){const i=cursor++;if(!hooks[i])hooks[i]={current:init};return hooks[i];},
    useEffect(fn,deps){const i=cursor++,prev=hooks[i];const changed=!prev||!deps||!prev.deps||deps.length!==prev.deps.length||deps.some((d,k)=>!Object.is(d,prev.deps[k]));hooks[i]={deps,cleanup:prev?prev.cleanup:null};if(changed)pending.push({i,fn});},
    useContext(){return context;},
    useCallback(fn){return fn;},
    useMemo(fn){return fn();},
    createElement(type,props,...children){return {type,props:props||{},children};},
    Fragment:'Fragment',
  };
  const flush=()=>{for(const e of pending){const h=hooks[e.i];if(typeof h.cleanup==='function')h.cleanup();h.cleanup=e.fn()||null;}pending=[];};
  return {React,render(Component,props){cursor=0;pending=[];const tree=Component(props);flush();return tree;}};
}
function walk(node,visit){
  if(node==null||typeof node==='boolean')return;
  if(Array.isArray(node)){for(const n of node)walk(n,visit);return;}
  if(typeof node!=='object')return;
  visit(node);walk(node.children,visit);
}
function textOf(node){
  if(node==null||typeof node==='boolean')return '';
  if(typeof node==='string'||typeof node==='number')return String(node);
  if(Array.isArray(node))return node.map(textOf).join('');
  return textOf(node.children);
}
function find(tree,pred){let hit=null;walk(tree,n=>{if(!hit&&pred(n))hit=n;});return hit;}

module.exports=async function run(S,t){
  // ── L1: absolute OPC relationship targets ──
  await section(t,['L1: an absolute presentation target resolves from the package root, relative targets unchanged',
    'L1: an absolute speaker-notes target from a slide resolves from the package root'],()=>{
    const norm=new Function(span(S,'function _zipNormalizePath(','function _xmlElementsByLocalName(')+';return _zipNormalizePath;')();
    return {
      'L1: an absolute presentation target resolves from the package root, relative targets unchanged':
        norm('ppt/presentation.xml','/ppt/slides/slide7.xml')==='ppt/slides/slide7.xml'&&
        norm('ppt/presentation.xml','slides/slide7.xml')==='ppt/slides/slide7.xml'&&
        norm('ppt/slides/slide1.xml','../notesSlides/notesSlide1.xml')==='ppt/notesSlides/notesSlide1.xml',
      'L1: an absolute speaker-notes target from a slide resolves from the package root':
        norm('ppt/slides/slide1.xml','/ppt/notesSlides/notesSlide1.xml')==='ppt/notesSlides/notesSlide1.xml'&&
        norm('ppt/slides/slide1.xml','\\ppt\\notesSlides\\notesSlide2.xml')==='ppt/notesSlides/notesSlide2.xml',
    };
  });

  // ── L2, L3, L5 (URL): the shipped transport with a scripted fetch ──
  const L23=['L2: an Argon call with no thinking level is refused before any request is sent',
    'L2: a given level is sent as given, and no level sends no thinkingConfig',
    'L3: a mid-stream 429 keeps its status, keeps the partial text and halts the batch',
    'L3: a mid-stream 429 retry waits for the RetryInfo delay it carried',
    'L3: a mid-stream permanent error is fatal and is not retried',
    'L3: a mid-stream error object without a code stays an incomplete response with its message',
    'L5: the request URL encodes the model ID'];
  await section(t,L23,async()=>{
    const THINKING_LEVELS=new Function(span(S,'const THINKING_LEVELS=','const MODEL_ID_RE=')+';return THINKING_LEVELS;')();
    const code=span(S,'function geminiRetryDelayMs(','\nfunction extractJSON(');
    const enc=new TextEncoder();
    const stream=chunks=>({ok:true,body:{getReader(){let i=0;return{read:async()=>i<chunks.length?{done:false,value:enc.encode(chunks[i++])}:{done:true},cancel:async()=>{},releaseLock(){}};}}});
    const json=text=>({ok:true,json:async()=>({candidates:[{content:{parts:[{text}]},finishReason:'STOP'}]})});
    const ev=obj=>'data: '+JSON.stringify(obj)+'\n\n';
    const part=ev({candidates:[{content:{parts:[{text:'partial'}]}}]}),done=ev({candidates:[{content:{parts:[{text:'x'}]},finishReason:'STOP'}]});
    const make=responses=>{
      let calls=0;const bodies=[],urls=[],delays=[];
      const fetch=async(url,opts)=>{urls.push(url);bodies.push(JSON.parse(opts.body));return responses[calls++];};
      const [callGemini,geminiRequest,halts]=new Function('fetch','_sleep','SAFETY_SETTINGS','THINKING_LEVELS',code+';return [callGemini,geminiRequest,geminiHaltsBatch];')(fetch,async ms=>{delays.push(ms);},[],THINKING_LEVELS);
      return {callGemini,geminiRequest,halts,bodies,urls,delays,calls:()=>calls};
    };
    const rejected=async p=>{try{await p;return null;}catch(e){return e;}};
    const out={};
    let h=make([json('x')]);let e=await rejected(h.callGemini('synthetic-key','gemini-4-argon',[{text:'p'}],{retries:0}));
    out[L23[0]]=!!e&&e.status===400&&e.isFatal===true&&/Argon/.test(e.message)&&h.calls()===0;
    h=make([json('a'),json('b')]);
    await h.callGemini('synthetic-key','synthetic-flash',[{text:'p'}],{retries:0});
    await h.callGemini('synthetic-key','synthetic-flash',[{text:'p'}],{retries:0,thinkingLevel:'medium'});
    out[L23[1]]=h.bodies.length===2&&!('thinkingConfig' in h.bodies[0].generationConfig)&&h.bodies[1].generationConfig.thinkingConfig.thinkingLevel==='medium';
    const quota=ev({error:{code:429,message:'Synthetic quota exhausted',status:'RESOURCE_EXHAUSTED',details:[{'@type':'type.googleapis.com/google.rpc.RetryInfo',retryDelay:'20s'}]}});
    h=make([stream([part,quota])]);e=await rejected(h.geminiRequest('synthetic-key','synthetic-flash',{contents:[]},{retries:0,onUpdate(){}}));
    out[L23[2]]=!!e&&e.status===429&&e.retryable===true&&e.isFatal===false&&e.message==='Synthetic quota exhausted'&&e.partialText==='partial'&&h.halts(e)===true;
    h=make([stream([part,quota]),stream([done])]);const retried=await h.geminiRequest('synthetic-key','synthetic-flash',{contents:[]},{retries:1,onUpdate(){}});
    out[L23[3]]=retried==='x'&&h.delays.length===1&&h.delays[0]>=20000&&h.calls()===2;
    h=make([stream([part,ev({error:{code:400,message:'Synthetic bad request',status:'INVALID_ARGUMENT'}})]),stream([done])]);
    e=await rejected(h.geminiRequest('synthetic-key','synthetic-flash',{contents:[]},{retries:2,onUpdate(){}}));
    out[L23[4]]=!!e&&e.status===400&&e.isFatal===true&&e.retryable===false&&h.calls()===1&&h.halts(e)===true;
    h=make([stream([part,ev({error:{message:'Synthetic stream fault'}})])]);
    e=await rejected(h.geminiRequest('synthetic-key','synthetic-flash',{contents:[]},{retries:0,onUpdate(){}}));
    out[L23[5]]=!!e&&e.incomplete===true&&e.message==='Synthetic stream fault'&&e.status===undefined&&h.halts(e)===false;
    h=make([json('a'),json('b')]);
    await h.geminiRequest('synthetic-key','gemini-3.8-flash',{contents:[]},{retries:0});
    await h.geminiRequest('synthetic-key','bad id/x?y',{contents:[]},{retries:0});
    out[L23[6]]=h.urls[0]==='https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent'&&
      h.urls[1]==='https://generativelanguage.googleapis.com/v1beta/models/bad%20id%2Fx%3Fy:generateContent';
    return out;
  });

  // ── L4, L5: the shipped settings drawer, compiled with the browser's Babel preset ──
  const SET=['L5: a typed model ID is trimmed before it is used and saved',
    'L5: an invalid model ID is not used; the field keeps it, marked invalid, and names the ID still running',
    'L4: the auto badge for NCLEX to Anki names the Flash model and the level set in that tab; other tabs unchanged',
    'L4: the drawer counts seven tools and the manual hint names the NCLEX to Anki exception'];
  await section(t,SET,()=>{
    const Babel=loadBabel();
    const constants=span(S,'const TOOL_PROFILE_DEFAULTS={','\n};')+'\n};\n'+span(S,'const PROFILE_ROWS=[','\n];')+'\n];\n'+span(S,'const MODEL_ID_RE=','\n')+'\n';
    const component=span(S,'function ConfigSidebar({onClose,activeTool}){','\n  );\n}\n')+'\n  );\n}\n';
    const prelude='const {useState,useRef,useCallback,useEffect,useMemo,useContext}=React;const ConfigCtx={};function useConfig(){return useContext(ConfigCtx);}\n';
    const compiled=Babel.transform(prelude+constants+component+'\nreturn ConfigSidebar;',{presets:['react'],parserOpts:{allowReturnOutsideFunction:true}}).code;
    const document={addEventListener(){},removeEventListener(){},getElementById(){return null;}};
    const mount=cfg=>{const rt=createRuntime(cfg);const C=new Function('React','document',compiled)(rt.React,document);return props=>rt.render(C,{onClose(){},...props});};
    const sets={flash:[],argon:[]};
    const profileFor=id=>id==='cases'?{model:'synthetic-argon',level:'high',family:'argon',auto:true}:{model:'synthetic-flash',level:'low',family:'flash',auto:true};
    const base={apiKey:'',setApiKey(){},setAutoProfile(){},thinkingMode:false,setThinkingMode(){},thinkingLevel:'low',setThinkingLevel(){},
      activeModel:'synthetic-flash',flashModel:'synthetic-flash',setFlashModel(v){sets.flash.push(v);},argonModel:'synthetic-argon',setArgonModel(v){sets.argon.push(v);},
      profiles:{},setProfile(){},resetProfiles(){},forTool:profileFor};
    const out={};
    let render=mount({...base,autoProfile:false}),tree=render({activeTool:'knowledge'});
    const field=(tr,id)=>find(tr,n=>n.type==='input'&&n.props.id===id);
    field(tree,'suite-flash-model').props.onChange({target:{value:'  gemini-next-flash  '}});
    field(tree,'suite-argon-model').props.onChange({target:{value:'\tgemini-next-argon\n'}});
    out[SET[0]]=sets.flash.join('|')==='gemini-next-flash'&&sets.argon.join('|')==='gemini-next-argon';
    tree=render({activeTool:'knowledge'});
    field(tree,'suite-flash-model').props.onChange({target:{value:'bad id/x'}});
    tree=render({activeTool:'knowledge'});
    const bad=field(tree,'suite-flash-model'),argon=field(tree,'suite-argon-model');
    const hint=bad&&find(tree,n=>n.props&&n.props.id===bad.props['aria-describedby']);
    out[SET[1]]=sets.flash.length===1&&bad.props.value==='bad id/x'&&bad.props['aria-invalid']===true&&!!hint&&/Still using synthetic-flash/.test(textOf(hint))&&
      argon.props['aria-invalid']===false&&argon.props.value==='\tgemini-next-argon\n';
    const badge=tr=>find(tr,n=>n.props&&n.props.className==='model-badge');
    const auto=mount({...base,autoProfile:true});
    const n2a=textOf(badge(auto({activeTool:'nclex2anki'}))),cases=textOf(badge(auto({activeTool:'cases'})));
    out[SET[2]]=n2a.includes('synthetic-flash')&&n2a.includes('level set in tab')&&!/low$/.test(n2a)&&cases==='synthetic-argonhigh';
    const manualText=textOf(mount({...base,autoProfile:false})({activeTool:'knowledge'}));
    out[SET[3]]=manualText.includes('Shared across all seven tools')&&!manualText.includes('six tools')&&manualText.includes('except NCLEX to Anki, which always uses the Flash model');
    return out;
  });

  // ── L16: number fields keep the typed text and clamp the tool state ──
  const NUM=['L16: a number field shows the digits being typed while the tool state holds the clamped value',
    'L16: a cleared field stays empty while focused and shows the clamped value after blur',
    'L16: every number field in the suite renders through NumberInput'];
  await section(t,NUM,()=>{
    const Babel=loadBabel();
    const src=span(S,'function NumberInput(','\n}\n')+'\n}\n';
    const compiled=Babel.transform('const {useState}=React;\n'+src+'\nreturn NumberInput;',{presets:['react'],parserOpts:{allowReturnOutsideFunction:true}}).code;
    const rt=createRuntime(null),NumberInput=new Function('React',compiled)(rt.React);
    let total=50;const setTotal=v=>{total=v;};
    // The NCLEX Generator's own clamp, applied through the field's unchanged onChange.
    const props=()=>({id:'synthetic-total',type:'number',min:5,max:200,value:total,onChange:e=>setTotal(Math.max(5,Math.min(200,parseInt(e.target.value)||50)))});
    let el=rt.render(NumberInput,props());
    el.props.onChange({target:{value:'1'}});el=rt.render(NumberInput,props());const afterOne=[el.props.value,total];
    el.props.onChange({target:{value:'12'}});el=rt.render(NumberInput,props());const afterTwelve=[el.props.value,total];
    el.props.onBlur({});el=rt.render(NumberInput,props());const blurred=el.props.value;
    el.props.onChange({target:{value:''}});el=rt.render(NumberInput,props());const cleared=[el.props.value,total];
    el.props.onBlur({});el=rt.render(NumberInput,props());
    const fields=S.split('<NumberInput ').length-1;
    return {
      [NUM[0]]:el.type==='input'&&el.props.type==='number'&&el.props.min===5&&afterOne[0]==='1'&&afterOne[1]===5&&afterTwelve[0]==='12'&&afterTwelve[1]===12&&blurred===12,
      [NUM[1]]:cleared[0]===''&&cleared[1]===50&&el.props.value===50,
      [NUM[2]]:fields===12&&!/<input [^>]*type="number"/.test(S)&&['kb-runs','kb-chunk-size','kb-overlap','priority-chunk-size','priority-overlap','extract-chunk-size','extract-overlap','extract-batch-size','nclex-total','nclex-facts-per-question'].every(id=>S.includes('<NumberInput id="'+id+'" type="number"'))&&
        S.includes("<NumberInput aria-label={sLabel+' range '+(i+1)+' start page'}")&&S.includes("<NumberInput aria-label={sLabel+' range '+(i+1)+' end page'}"),
    };
  });

  // ── L44: style/font CSP directives and print links ──
  const SEC=['L44: the suite CSP limits styles to inline and the Google Fonts stylesheet, and fonts to its font host',
    'L44: every linked stylesheet is allowed by style-src and no other font source is declared',
    'L44: the print preview underlines links on screen and keeps them plain in print'];
  await section(t,SEC,()=>{
    const meta=S.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
    const policy=new Map(meta[1].split(';').map(d=>d.trim().split(/\s+/)).filter(p=>p[0]).map(([k,...v])=>[k,v]));
    const style=policy.get('style-src')||[],font=policy.get('font-src')||[];
    const sheets=[...S.matchAll(/<link\b[^>]*>/g)].map(m=>m[0]).filter(tag=>/rel="stylesheet"/.test(tag)).map(tag=>new URL(tag.match(/href="([^"]+)"/)[1]).origin);
    const doc=new Function('escHtml','mdToSafeHtml',span(S,'function buildPrintDoc(','\n// Fallback when a popup blocker')+';return buildPrintDoc;')(
      s=>String(s),()=>'<p><a href="https://example.invalid/source">synthetic link</a></p>')('# synthetic','Synthetic title','');
    const screen=doc.slice(doc.indexOf('@media screen{'),doc.indexOf('@media print{'));
    return {
      [SEC[0]]:style.join(' ')==="'unsafe-inline' https://fonts.googleapis.com"&&font.join(' ')==='https://fonts.gstatic.com'&&
        !policy.has('default-src')&&!policy.has('script-src')&&(policy.get('object-src')||[]).join()==="'none'",
      [SEC[1]]:sheets.length===1&&sheets.every(o=>style.includes(o))&&!/@font-face/.test(S)&&!/@import/.test(S)&&style.includes("'unsafe-inline'"),
      [SEC[2]]:/a\{text-decoration:underline;\}/.test(screen)&&doc.includes('a{color:#14161f;text-decoration:none;}')&&doc.includes('synthetic link'),
    };
  });
};
