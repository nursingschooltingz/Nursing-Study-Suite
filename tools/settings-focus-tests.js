#!/usr/bin/env node
'use strict';

// v17.3: the settings drawer's entry-focus effect depended on a close callback that App
// recreated on every render, so any App state change while the drawer was open re-ran the
// effect and moved focus into the API key field. These checks compile the SHIPPED ConfigSidebar
// with the same Babel build the browser uses and drive it through a minimal hook runtime with
// React's dependency-comparison semantics, so the behavioral assertions fail against the
// pre-fix bytes rather than against a copy of the component.
const os=require('os'),path=require('path');

function span(S,start,end){
  const a=S.indexOf(start);if(a<0)throw Error('Settings focus anchor missing: '+start);
  const b=S.indexOf(end,a+start.length);if(b<0)throw Error('Settings focus end anchor missing after: '+start);
  return S.slice(a,b+end.length);
}
function count(haystack,needle){return haystack.split(needle).length-1;}

// Enough of React's hooks to render a function component repeatedly. Effects run after each
// render only when their dependency array changed (Object.is per slot), with the previous
// cleanup first; unmount runs every remaining cleanup. Context lookups return the stub config.
function createRuntime(context){
  const hooks=[];let cursor=0,pending=[];
  const React={
    useState(init){const i=cursor++;if(!hooks[i])hooks[i]={value:typeof init==='function'?init():init};const h=hooks[i];return [h.value,next=>{h.value=typeof next==='function'?next(h.value):next;}];},
    useRef(init){const i=cursor++;if(!hooks[i])hooks[i]={current:init};return hooks[i];},
    useEffect(fn,deps){
      const i=cursor++,prev=hooks[i];
      const changed=!prev||!deps||!prev.deps||deps.length!==prev.deps.length||deps.some((d,k)=>!Object.is(d,prev.deps[k]));
      hooks[i]={deps,cleanup:prev?prev.cleanup:null};
      if(changed)pending.push({i,fn});
    },
    useContext(){return context;},
    useCallback(fn){return fn;},
    useMemo(fn){return fn();},
    createElement(type,props,...children){return {type,props:props||{},children};},
    Fragment:'Fragment',
  };
  const flush=()=>{for(const e of pending){const h=hooks[e.i];if(typeof h.cleanup==='function')h.cleanup();h.cleanup=e.fn()||null;}pending=[];};
  return {
    React,
    render(Component,props){cursor=0;pending=[];const tree=Component(props);flush();return tree;},
    unmount(){for(const h of hooks)if(h&&typeof h.cleanup==='function'){h.cleanup();h.cleanup=null;}},
  };
}

function loadDrawer(S,React,document){
  const babelPath=process.env.NSS_BABEL_STANDALONE||path.join(os.tmpdir(),'nursing-study-suite-verify/node_modules/@babel/standalone/babel.js');
  const Babel=require(babelPath);
  const constants=span(S,'const TOOL_PROFILE_DEFAULTS={','\n};')+'\n'+span(S,'const PROFILE_ROWS=[','\n];');
  const component=span(S,'function ConfigSidebar({onClose,activeTool}){','\n  );\n}\n');
  const prelude='const {useState,useRef,useCallback,useEffect,useMemo,useContext}=React;const ConfigCtx={};function useConfig(){return useContext(ConfigCtx);}\n';
  const code=Babel.transform(prelude+constants+'\n'+component+'\nreturn ConfigSidebar;',{presets:['env','react'],parserOpts:{allowReturnOutsideFunction:true}}).code;
  return new Function('React','document',code)(React,document);
}

function run(S,t){
  const drawer=span(S,'function ConfigSidebar({onClose,activeTool}){','\n  );\n}\n');
  t('settings drawer: extracted component reaches its closing aside',drawer.includes('</aside>')&&drawer.includes('suite-pro-model'));
  t('settings drawer: entry focus is requested once, inside a mount-only effect',
    count(drawer,"getElementById('suite-api-key')?.focus()")===1&&
    drawer.includes("document.getElementById('suite-api-key')?.focus();\n    return()=>document.removeEventListener('keydown',onKey);\n  },[]);"));
  t('settings drawer: Escape reads the latest close callback through a ref',
    drawer.includes('const onCloseRef=useRef(onClose);')&&drawer.includes("if(e.key==='Escape'){e.preventDefault();onCloseRef.current();}"));
  t('settings drawer: the only onClose-dependent effect syncs the ref',
    count(drawer,',[onClose]);')===1&&drawer.includes('useEffect(()=>{onCloseRef.current=onClose;},[onClose]);'));
  const app=span(S,'function App(){','\n  );\n}\n');
  t('app shell: closeSettings is memoized with no dependencies',
    app.includes("const closeSettings=useCallback(()=>{setShowConfig(false);settingsTrigger.current?.focus();},[]);")&&!app.includes('const closeSettings=()=>'));

  const cfg={apiKey:'',setApiKey(){},autoProfile:false,setAutoProfile(){},thinkingMode:false,setThinkingMode(){},thinkingLevel:'low',setThinkingLevel(){},
    activeModel:'synthetic-flash',flashModel:'synthetic-flash',setFlashModel(){},proModel:'synthetic-pro',setProModel(){},profiles:{},setProfile(){},resetProfiles(){},
    forTool(){return {model:'synthetic-flash',level:'low',family:'flash',auto:false};},activeTool:'knowledge'};
  const focus=[],listeners=new Map(),removed=[];
  const document={
    addEventListener(type,fn){listeners.set(type,fn);},
    removeEventListener(type,fn){removed.push([type,fn]);if(listeners.get(type)===fn)listeners.delete(type);},
    getElementById(id){return id==='suite-api-key'?{focus(){focus.push(id);}}:null;},
  };
  const runtime=createRuntime(cfg),ConfigSidebar=loadDrawer(S,runtime.React,document);
  const closed=[],closeA=()=>closed.push('A'),closeB=()=>closed.push('B');
  runtime.render(ConfigSidebar,{onClose:closeA,activeTool:'knowledge'});
  t('settings drawer: the first render focuses the API key field once',focus.length===1);
  // App re-renders hand the drawer a new callback identity; before v17.3 that re-ran the effect.
  runtime.render(ConfigSidebar,{onClose:closeB,activeTool:'knowledge'});
  t('settings drawer: a re-render with a new close callback does not steal focus again',focus.length===1);
  runtime.render(ConfigSidebar,{onClose:closeB,activeTool:'knowledge'});
  t('settings drawer: a re-render with the same close callback does not steal focus either',focus.length===1);
  const onKey=listeners.get('keydown');let prevented=0;
  if(onKey)onKey({key:'Escape',preventDefault(){prevented++;}});
  t('settings drawer: Escape closes through the latest callback, not the first',!!onKey&&prevented===1&&closed.join()==='B');
  runtime.unmount();
  t('settings drawer: unmount removes the keydown listener it added',removed.some(([type,fn])=>type==='keydown'&&fn===onKey)&&!listeners.has('keydown'));
}

module.exports=run;
