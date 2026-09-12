'use strict';

// v16 UI contracts are asserted against the shipped source, including the live
// settings initializer. Browser geometry and keyboard behavior have their own
// optional isolated acceptance runner; no browser or CDN is needed by this gate.
module.exports=function visualRegressionTests(S,t){
  const cssMatch=S.match(/<style>([\s\S]*?)<\/style>/),css=cssMatch?.[1]||'';
  t('v16 keeps one coherent application stylesheet',!!cssMatch&&(S.slice(0,S.indexOf('</head>')).match(/<style>/g)||[]).length===1);
  t('v16 gives keyboard users a skip link and focusable main landmark',S.includes('<a className="skip-link" href="#study-workspace">')&&S.includes('<main className="main-area" id="study-workspace" tabIndex={-1}>'));
  t('v16 names navigation and marks its current tool',S.includes('<nav className="nav-rail" aria-label="Study tools">')&&S.includes("aria-current={activeTool===t.id?'page':undefined}"));
  t('v16 connects navigation controls to mounted named sections',S.includes("aria-controls={'tool-'+t.id}")&&S.includes("<section key={t.id} id={'tool-'+t.id} aria-label={t.title} style={{display:activeTool===t.id?'contents':'none'}}><ToolBoundary name={t.title}><C/></ToolBoundary></section>"));
  t('v16 exposes settings expansion and a named close control',S.includes('aria-label="Study settings" aria-expanded={showConfig} aria-controls="suite-settings"')&&S.includes('aria-label="Close study settings" onClick={onClose}'));
  const initializer=S.match(/const \[showConfig,setShowConfig\]=useState\((\(\)=>window\.matchMedia\('\(min-width: 801px\)'\)\.matches)\);/);
  t('v16 settings initializer is extracted from shipped App',!!initializer);
  const initial=initializer?new Function('window','return ('+initializer[1]+')();'):()=>null;
  t('v16 initially reveals the study tool on small screens',initial({matchMedia:()=>({matches:false})})===false);
  t('v16 initially makes settings available beside wide workspaces',initial({matchMedia:()=>({matches:true})})===true);
  t('v16 settings close restores the trigger and API shortcut focuses its named field',S.includes('settingsTrigger.current?.focus()')&&S.includes("document.getElementById('suite-api-key')?.focus()"));
  t('v16 API key is explicitly labelled, described and concealed',S.includes('htmlFor="suite-api-key">Gemini API key</label>')&&S.includes('id="suite-api-key" aria-describedby="suite-api-help" autoComplete="off" type="password"'));
  const fields={
    Knowledge:['kb-course','kb-exam','kb-runs','kb-outcomes','kb-points','kb-context','kb-chunk-size','kb-overlap'],
    Priority:['priority-condition','priority-context','priority-chunk-size','priority-overlap'],
    Anki:['anki-outcomes','anki-points','anki-context'],
    extraction:['extract-chunk-size','extract-overlap','extract-batch-size','extract-strategy','extract-search'],
    generation:['nclex-condition','nclex-total','nclex-batch-size','nclex-facts-per-question','nclex-outcomes','nclex-points','nclex-context'],
    cases:['case-condition','case-difficulty','case-stages','case-questions-per-stage']
  };
  for(const [name,ids] of Object.entries(fields))t('v16 '+name+' fields have explicit matching labels and unique ids',ids.every(id=>S.includes('htmlFor="'+id+'"')&&S.split('id="'+id+'"').length===2));
  t('v16 Anki table identifies its columns and editable fields',S.includes('<table aria-label="Editable Anki notes">')&&S.includes('<th scope="col">Text</th>')&&['Text for note ','Extra for note ','Tags for note ','Keep note ','Delete note '].every(label=>S.includes("aria-label={'"+label+"'+c.id}")));
  t('v16 page ranges retain native removal buttons and announce invalid boundaries',S.includes("aria-label={'Remove '+sLabel+' range '+(i+1)}")&&S.includes('aria-invalid={r.start>r.end}')&&!S.includes('<span className="f-rm" onClick={()=>removeRange(i)}>'));
  t('v16 review selection and answer disclosures are programmatically exposed',S.includes('role="group" aria-label="Anki review view"')&&S.includes('aria-pressed={view===v}')&&S.includes('aria-expanded={revealed}')&&S.includes('aria-expanded={!!kOpen}'));
  t('v16 all five processing bars report labelled numeric progress', ['Knowledge Base extraction','Priority analysis','Anki generation','Question extraction','NCLEX question generation'].every(name=>S.includes('role="progressbar" aria-label="'+name+'" aria-valuemin={0}')));
  t('v16 shared forms and dense browsers use responsive hooks', ['kb-browser','kb-condition-list','priority-layout','form-grid','stats-grid'].every(name=>S.includes('className="'+name)));
  t('v16 focus indicators cover ordinary interactive controls',css.includes(':focus-visible')&&/outline\s*:\s*[^;}]*(?:var\(--focus|[23]px)/.test(css));
  t('v16 motion respects the operating-system reduction preference',/prefers-reduced-motion:\s*reduce/.test(css)&&/animation(?:-duration)?\s*:\s*(?:none|0(?:\.01)?m?s)/.test(css));
  t('v16 provides explicit tablet and phone layout breakpoints',/@media[^{}]*max-width:\s*800px/.test(css)&&/@media[^{}]*max-width:\s*(?:480|520|600)px/.test(css));
  t('v16 keeps intentionally wide editable tables inside their own scroll area with intact column headings',/\.anki-tbl-wrap\s*\{[^}]*overflow-x:\s*auto/.test(css)&&/\.anki-tbl-wrap th\s*\{[^}]*white-space:\s*nowrap/.test(css));
  t('v16 keeps the fact drawer labelled, trapped and escape-dismissable',S.includes('role="dialog" aria-modal="true" aria-labelledby="fact-inspector-title"')&&S.includes("if(e.key==='Escape'){e.preventDefault();FI.closeFactInspector();return;}")&&S.includes("else if(e.shiftKey&&here===first){e.preventDefault();last.focus();}"));
  t('v16 source tail still mounts the real App through its boot boundary',S.includes("ReactDOM.createRoot(document.getElementById('root')).render(<BootErrorBoundary><App/></BootErrorBoundary>);window.__latteMounted=true;"));
};
