#!/usr/bin/env node
'use strict';

// Local-only synthetic browser acceptance fixture. Serves only /, never the repository
// directory or course files. Uses the shipped JSX, live generator, and harness mini-KB.
const fs=require('fs'),http=require('http'),path=require('path');
const {resolveSuiteFile}=require('./repo-checks');
const root=path.join(__dirname,'..');
function once(source,old,next){if(source.split(old).length!==2)throw Error('Fixture anchor must occur once: '+old.slice(0,80));return source.replace(old,()=>next);}
function page(){
  let source=fs.readFileSync(resolveSuiteFile({rootDir:root}),'utf8');
  const harness=fs.readFileSync(path.join(root,'latte-tests.js'),'utf8');
  const start=harness.indexOf('function ankiSyntheticFixture(){'),end=harness.indexOf('\nconst ankiHelperSource=',start);
  if(start<0||end<0)throw Error('Synthetic fixture extraction anchor moved');
  const fixture=harness.slice(start,end);
  const script=fixture+String.raw`
// All generation and export operations remain in this fixture's memory.
const fixtureData=ankiSyntheticFixture();
let fixtureDelay=false,fixtureEmpty=false,fixturePending=[],fixtureExport=()=>{};
window.fetch=()=>Promise.reject(new Error('Network calls are disabled in the synthetic fixture.'));
callGemini=async()=>{
  const notes=[
    '[ExampleMedication-A] Pulse: {{c1::60 bpm}}||Nursing::LATTE::Assess Condition::ExampleMedicationA Tier::1',
    '[ExampleMedication-A] Pulse: {{c1::50 bpm}}||Nursing::LATTE::Assess Condition::ExampleMedicationA Tier::1',
    '[Example] Pattern: {{c1::alpha}} + {{c1::beta}} then {{c2::gamma}} and {{c3::delta}}|Synthetic explanation|Nursing::LATTE::Treatments Condition::Example Tier::1',
    'An {{c1::unusual finding}}||Nursing::LATTE::Look Condition::Example Tier::2',
    '[Example] Broken: {{c1::missing closure||Nursing::LATTE::Assess Condition::Example Tier::1',
    '[Example] Amount: {{c1::5000 units}}||Nursing::LATTE::Treatments Condition::Example Tier::2',
    '[Example] Markup: {{c1::<b>literal & text</b>}}|<img src=x onerror=alert(1)>|Nursing::LATTE::Educate Condition::Example Tier::2'
  ];
  const response=fixtureEmpty?'':String.fromCharCode(96).repeat(3)+'text\n'+notes.join('\n')+'\n'+String.fromCharCode(96).repeat(3)+'\n'+String.fromCharCode(96).repeat(3)+'text\n'+['fact-1 -> line #1','fact-1 -> line #2','fact-2 -> line #3','fact-4 -> line #4','fact-1 -> line #5','fact-3 -> line #6','fact-5 -> line #7'].join('\n')+'\n'+String.fromCharCode(96).repeat(3);
  if(fixtureDelay)return new Promise(resolve=>fixturePending.push(()=>resolve(response)));
  return response;
};
downloadBlob=async blob=>fixtureExport(await blob.text());
function SyntheticAnkiApp(){
  const [kb,setKB]=useState(fixtureData.kb),[registry,setRegistry]=useState({...EMPTY_ARTIFACT_REGISTRY,nclexQuestions:[{id:'synthetic-nclex',factIds:['fact-1']}],caseStudies:[{id:'synthetic-case',factIds:['fact-2']}]}),[exported,setExported]=useState(''),[publications,setPublications]=useState(0);
  fixtureExport=setExported;
  const registerArtifact=useCallback((kind,entries)=>{setRegistry(r=>({...r,[kind]:entries}));setPublications(n=>n+1);},[]);
  const K=useMemo(()=>({knowledgeBase:kb,registerArtifact,artifactRegistry:registry,factIndex:buildFactIndex(kb)}),[kb,registry,registerArtifact]);
  const cfg=useMemo(()=>({apiKey:'synthetic-only',forTool:()=>({model:'synthetic-fixture',level:'low'}),autoProfile:true}),[]);
  return <ConfigCtx.Provider value={cfg}><KnowledgeCtx.Provider value={K}><FactInspectorCtx.Provider value={{openFactInspector:()=>{}}}>
    <div style={{maxWidth:1300,margin:'0 auto',padding:20}}>
      <h1>Synthetic Anki acceptance fixture</h1><p>No clinical material, API credentials, or live requests.</p>
      <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
        <button onClick={()=>setKB(ankiSyntheticFixture().kb)}>Replace KB</button>
        <label><input type="checkbox" onChange={e=>{fixtureDelay=e.target.checked;}}/>Delay fixture response</label>
        <button onClick={()=>{const pending=fixturePending.splice(0);pending.forEach(resolve=>resolve());}}>Resolve pending responses</button>
        <label><input type="checkbox" onChange={e=>{fixtureEmpty=e.target.checked;}}/>Empty fixture response</label>
      </div>
      <div role="status">Registry publications: {publications} · Anki entries: {registry.ankiNotes.length} · NCLEX entries: {registry.nclexQuestions.length} · Case entries: {registry.caseStudies.length}</div>
      <AnkiGenerator/>
      <label>Captured export<textarea aria-label="Captured export" rows={8} value={exported} readOnly/></label>
      <details><summary>Current registry labels</summary><pre>{JSON.stringify(registry,null,2)}</pre></details>
    </div>
  </FactInspectorCtx.Provider></KnowledgeCtx.Provider></ConfigCtx.Provider>;
}
`;
  source=once(source,'try{if(!window.React)throw new Error(',script+'\ntry{if(!window.React)throw new Error(');
  source=once(source,'<BootErrorBoundary><App/></BootErrorBoundary>','<BootErrorBoundary><SyntheticAnkiApp/></BootErrorBoundary>');
  return source;
}
if(require.main===module){
  const port=Number(process.argv[2]||4173);
  http.createServer((req,res)=>{
    if(req.url!=='/'){res.writeHead(404);res.end('Not found');return;}
    try{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(page());}
    catch(error){res.writeHead(500);res.end(error.message);}
  }).listen(port,'127.0.0.1',()=>console.log('Synthetic Anki fixture: http://127.0.0.1:'+port+'/'));
}
module.exports={page};
