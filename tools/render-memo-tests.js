#!/usr/bin/env node
'use strict';

// v17.3 + v21.10 (Phase 6 M19): source contracts and behavioral verification for render-work memoization and safe Markdown link sanitization.

const { extractSpan } = require('./repo-checks');
const span = (S, start, end) => extractSpan(S, start, end, { uniqueStart: false });
const count = (haystack, needle) => haystack.split(needle).length - 1;

function run(S,t){
  const kbBuilder=span(S,'function KnowledgeBaseBuilder(){','\n// ──── TOOL: Priority Analyzer ────');
  t('KB study view memoizes its sanitized HTML on the selected condition and view',
    kbBuilder.includes("const selHtml=useMemo(()=>sel&&kbView==='study'?mdToSafeHtml(renderKBMarkdown(view,{showEmptyTrapWorksheet:kbTrapWorksheet,onlyConditionId:sel.id})):'',[view,sel,kbView,kbTrapWorksheet]);")&&
    kbBuilder.includes('dangerouslySetInnerHTML={{__html:selHtml}}')&&count(kbBuilder,'mdToSafeHtml(')===1);
  const priority=span(S,'function PriorityAnalyzer(){','\n// ──── TOOL: Anki Generator ────');
  t('Priority memoizes all four tier fragments and renders only the memoized HTML',
    priority.includes('const tierHtml=useMemo(()=>tiers?{')&&count(priority,'mdToSafeHtml(')===5&&
    ['tier1','tier2','tier3','strategy'].every(key=>priority.includes('__html:tierHtml.'+key+'}}')));
  const app=span(S,'function App(){','\n  );\n}\n');
  const cfgMemo=app.match(/const cfg=useMemo\(\(\)=>\(\{([^}]*)\}\),\[([^\]]*)\]\);/);
  t('the config context no longer carries the active tool',!!cfgMemo&&!/\bactiveTool\b/.test(cfgMemo[1])&&!/\bactiveTool\b/.test(cfgMemo[2]));
  t('the settings drawer receives the active tool as a prop',app.includes('<ConfigSidebar onClose={closeSettings} activeTool={activeTool}/>')&&S.includes('function ConfigSidebar({onClose,activeTool}){')&&!S.includes('cfg.activeTool'));
  const tools=S.match(/const TOOL_COMPONENTS=\{([^}]*)\}/);
  t('all nine tools are memoized components',!!tools&&['CourseAnalyzer','KnowledgeBaseBuilder','PriorityAnalyzer','AnkiGenerator','NCLEXExtractor','NCLEXGenerator','CaseStudyGenerator','NCLEXToAnki','GizmoImporter'].every(name=>tools[1].includes('React.memo('+name+')')));
  const renderer=extractSpan(S,'const STUDY_OUTPUT_POLICY=','function formatFactCitation(');
  const mkAnchor=href=>{
    const attrs={href};
    return {tagName:'A',attrs,getAttribute:k=>attrs[k],setAttribute:(k,v)=>{attrs[k]=v;},removeAttribute:k=>{delete attrs[k];}};
  };
  const extAnchor=mkAnchor('https://www.ncsbn.org/nclex'),hashAnchor=mkAnchor('#sec-1');
  const fakeFrag={querySelectorAll:()=>[extAnchor,hashAnchor]};
  const fakeDoc={
    createElement:()=>({appendChild:()=>{},innerHTML:'<a href="https://www.ncsbn.org/nclex">ok</a>'})
  };
  const mdEnv=new Function('marked','DOMPurify','document',renderer+'\nreturn {mdToSafeHtml};')(
    {parse:s=>String(s)},
    {isSupported:true,sanitize:(s,cfg)=>cfg&&cfg.RETURN_DOM_FRAGMENT?fakeFrag:String(s),addHook:()=>{}},
    fakeDoc
  );
  mdEnv.mdToSafeHtml('test');
  t('sanitized study links open in a new tab without an opener',
    renderer.includes("for(const anchor of fragment.querySelectorAll('a[href]')){anchor.setAttribute('target','_blank');anchor.setAttribute('rel','noopener noreferrer');}")&&
    extAnchor.attrs.target==='_blank'&&extAnchor.attrs.rel==='noopener noreferrer'&&
    hashAnchor.attrs.target==='_blank'&&hashAnchor.attrs.rel==='noopener noreferrer');
}

module.exports=run;
