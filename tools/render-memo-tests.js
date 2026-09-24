#!/usr/bin/env node
'use strict';

// v17.3: source contracts for the render-work fixes. Every App re-render used to re-run marked
// and DOMPurify for the Knowledge Base study view and the four Priority tier sections, the
// config context carried activeTool so a tab switch invalidated every tool, and the six tools
// re-rendered on every App render. The browser runner measures the effect; these assertions keep
// the shape from drifting back.

function span(S,start,end){
  const a=S.indexOf(start);if(a<0)throw Error('Render memo anchor missing: '+start);
  const b=S.indexOf(end,a+start.length);if(b<0)throw Error('Render memo end anchor missing after: '+start);
  return S.slice(a,b);
}
const count=(haystack,needle)=>haystack.split(needle).length-1;

function run(S,t){
  const kbBuilder=span(S,'function KnowledgeBaseBuilder(){','\n// ──── TOOL: Priority Analyzer ────');
  t('KB study view memoizes its sanitized HTML on the selected condition and view',
    kbBuilder.includes("const selHtml=useMemo(()=>sel&&kbView==='study'?mdToSafeHtml(renderKBMarkdown({...kb,conditions:[sel]})):'',[kb,sel,kbView]);")&&
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
  t('all six tools are memoized components',!!tools&&['KnowledgeBaseBuilder','PriorityAnalyzer','AnkiGenerator','NCLEXExtractor','NCLEXGenerator','CaseStudyGenerator'].every(name=>tools[1].includes('React.memo('+name+')')));
  const renderer=span(S,'function mdToSafeHtml(md){','\n}\n');
  t('sanitized study links open in a new tab without an opener',renderer.includes("for(const anchor of fragment.querySelectorAll('a[href]')){anchor.setAttribute('target','_blank');anchor.setAttribute('rel','noopener noreferrer');}"));
}

module.exports=run;
