'use strict';

// v16/v17 UI contracts are asserted against the shipped source, including the live
// settings initializer. Browser geometry and keyboard behavior have their own
// optional isolated acceptance runner; no browser or CDN is needed by this gate.
//
// v17.0 moved four of these contracts rather than dropping them:
//   * the shell is `.app` > `.rail` + `.workspace`, not `.suite-shell` > `.nav-rail` + `.main-area`;
//   * settings is a right-hand drawer that starts closed at every width, instead of a
//     permanent 292px column opened by a min-width media query;
//   * the five progress bars are emitted by the single `RunStatus` primitive, so the
//     progressbar role and bounds are asserted once at the definition and each caller is
//     asserted by its label;
//   * the breakpoints are 1080px and 720px, matching the recompositions the layout performs.
// Each replacement assertion is at least as strong as the one it replaces.
module.exports=function visualRegressionTests(S,t){
  const cssMatch=S.match(/<style>([\s\S]*?)<\/style>/),css=cssMatch?.[1]||'';
  t('v17 keeps one coherent application stylesheet',!!cssMatch&&(S.slice(0,S.indexOf('</head>')).match(/<style>/g)||[]).length===1);
  t('v17 gives keyboard users a skip link and focusable main landmark',S.includes('<a className="skip-link" href="#study-workspace">')&&S.includes('<main className="workspace" id="study-workspace" tabIndex={-1}>'));
  t('v17 names navigation and marks its current tool',S.includes('<nav className="rail" aria-label="Study tools">')&&S.includes("aria-current={activeTool===t.id?'page':undefined}"));
  t('v17 groups the six tools under the three named workflow stages and numbers them',
    /const TOOL_STAGES=\[/.test(S)&&["{id:'source'","{id:'plan'","{id:'practice'"].every(x=>S.includes(x))
    &&S.includes('TOOLS.filter(t=>t.stage===stage.id)')&&S.includes('<span className="rail-index" aria-hidden="true">{TOOL_INDEX.get(t.id)}</span>')
    &&["'knowledge'","'priority'","'anki'","'nclex'","'nclexgen'","'cases'"].every(id=>S.includes('{id:'+id+',stage:')));
  t('v17 connects navigation controls to mounted named sections',S.includes("aria-controls={'tool-'+t.id}")&&S.includes("<section key={t.id} id={'tool-'+t.id} aria-label={t.title} style={{display:activeTool===t.id?'contents':'none'}}><ToolBoundary name={t.title}><C/></ToolBoundary></section>"));
  t('v17 exposes settings expansion and a named close control',S.includes('aria-label="Study settings" aria-expanded={showConfig} aria-controls="suite-settings"')&&S.includes('aria-label="Close study settings" onClick={onClose}'));
  const initializer=S.match(/const \[showConfig,setShowConfig\]=useState\((false)\);/);
  t('v17 settings initializer is extracted from shipped App',!!initializer);
  const initial=initializer?new Function('return ('+initializer[1]+');'):()=>null;
  t('v17 starts every width on the study tool, not on configuration',initial()===false);
  t('v17 keeps settings reachable from the rail and the workspace header at every width',
    S.includes('className="rail-settings" aria-label="Study settings"')&&S.includes('onClick={openSettings}>{apiKey?\'API key added\':\'Add API key\'}</button>'));
  t('v17 settings drawer is dismissable and leaves the workspace underneath usable',
    S.includes("const onKey=e=>{if(e.key==='Escape'){e.preventDefault();onClose();}};")
    &&!S.includes('settings-scrim')
    &&S.includes('<aside ref={panelRef} className="drawer config-drawer" id="suite-settings" aria-label="Study settings">'));
  t('v17 settings close restores the trigger and opening focuses the named API field',S.includes('settingsTrigger.current?.focus()')&&S.includes("document.getElementById('suite-api-key')?.focus()"));
  t('v17 API key is explicitly labelled, described and concealed',S.includes('htmlFor="suite-api-key">Gemini API key</label>')&&S.includes('id="suite-api-key" aria-describedby="suite-api-help" autoComplete="off" type="password"'));
  const fields={
    Knowledge:['kb-course','kb-exam','kb-runs','kb-outcomes','kb-points','kb-context','kb-chunk-size','kb-overlap'],
    Priority:['priority-condition','priority-context','priority-chunk-size','priority-overlap'],
    Anki:['anki-outcomes','anki-points','anki-context'],
    extraction:['extract-chunk-size','extract-overlap','extract-batch-size','extract-strategy','extract-search'],
    generation:['nclex-condition','nclex-total','nclex-batch-size','nclex-facts-per-question','nclex-outcomes','nclex-points','nclex-context'],
    cases:['case-condition','case-difficulty','case-stages','case-questions-per-stage']
  };
  for(const [name,ids] of Object.entries(fields))t('v17 '+name+' fields have explicit matching labels and unique ids',ids.every(id=>S.includes('htmlFor="'+id+'"')&&S.split('id="'+id+'"').length===2));
  t('v17 Anki table identifies its columns and editable fields',S.includes('<table aria-label="Editable Anki notes">')&&S.includes('<th scope="col">Text</th>')&&['Text for note ','Extra for note ','Tags for note ','Keep note ','Delete note '].every(label=>S.includes("aria-label={'"+label+"'+c.id}")));
  t('v17 page ranges retain native removal buttons and announce invalid boundaries',S.includes("aria-label={'Remove '+sLabel+' range '+(i+1)}")&&S.includes('aria-invalid={r.start>r.end}')&&!S.includes('<span className="f-rm" onClick={()=>removeRange(i)}>'));
  t('v17 review selection and answer disclosures are programmatically exposed',S.includes('role="group" aria-label="Anki review view"')&&S.includes('aria-pressed={view===v}')&&S.includes('aria-expanded={revealed}')&&S.includes('aria-expanded={!!kOpen}'));
  // One primitive emits every progress bar, so the role and bounds are proved once at the
  // definition and each of the five callers is proved by the label it passes.
  t('v17 the shared progress primitive is labelled, bounded and driven by real state',
    S.includes('function RunStatus({label,value,max=100,caption,detail,children}){')
    &&S.includes('const now=Math.max(0,Math.min(ceiling,Number(value)||0));')
    &&S.includes('<div className="progress-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={ceiling} aria-valuenow={now}><div className="progress-fill" style={{width:(now/ceiling*100)+\'%\'}}/></div>'));
  t('v17 all five processing bars report labelled numeric progress',
    ['Knowledge Base extraction','Priority analysis','Anki generation','Question extraction','NCLEX question generation']
      .every(name=>S.includes('<RunStatus label="'+name+'"')||S.includes('role="progressbar" aria-label="'+name+'" aria-valuemin={0}')));
  t('v17 shared forms and dense browsers use responsive hooks', ['kb-browser','kb-condition-list','workbench','wb-setup','wb-results','form-grid','stats-grid'].every(name=>S.includes('className="'+name)));
  t('v17 every tool composes the same setup-beside-results workbench',
    (S.match(/<Workbench\n/g)||[]).length===6&&(S.match(/setupLabel="/g)||[]).length===6&&(S.match(/resultsLabel="/g)||[]).length===6
    &&S.includes('<section className="wb-setup" aria-label={setupLabel}>')&&S.includes('<section className="wb-results" aria-label={resultsLabel}>'));
  t('v17 each tool offers an empty state naming the next useful action',(S.match(/<EmptyState mark=/g)||[]).length===6);
  t('v17 focus indicators cover ordinary interactive controls',css.includes(':focus-visible')&&/outline\s*:\s*[^;}]*(?:var\(--focus|[23]px)/.test(css));
  t('v17 motion respects the operating-system reduction preference',/prefers-reduced-motion:\s*reduce/.test(css)&&/animation(?:-duration)?\s*:\s*(?:none|0(?:\.01)?m?s)/.test(css));
  t('v17 provides explicit tablet and phone layout recompositions',/@media\s*\(max-width:\s*1080px\)/.test(css)&&/@media\s*\(max-width:\s*720px\)/.test(css)&&/@media\(max-width:1080px\)\{[\s\S]*?\.workbench\{display:block;\}/.test(css.replace(/\s*\n\s*/g,'')));
  t('v17 keeps intentionally wide editable tables inside their own scroll area with intact column headings',/\.anki-tbl-wrap\s*\{[^}]*overflow-x:\s*auto/.test(css)&&/\.anki-tbl-wrap th\s*\{[^}]*white-space:\s*nowrap/.test(css));
  t('v17 keeps the fact drawer labelled, trapped and escape-dismissable',S.includes('role="dialog" aria-modal="true" aria-labelledby="fact-inspector-title"')&&S.includes("if(e.key==='Escape'){e.preventDefault();FI.closeFactInspector();return;}")&&S.includes("else if(e.shiftKey&&here===first){e.preventDefault();last.focus();}"));
  t('v17 source tail still mounts the real App through its boot boundary',S.includes("ReactDOM.createRoot(document.getElementById('root')).render(<BootErrorBoundary><App/></BootErrorBoundary>);window.__latteMounted=true;"));
};
