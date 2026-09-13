'use strict';

// Synthetic transport fixture only: produce structurally traceable receipts, not a
// semantic judgment. Kept standalone so browser fixtures can inject toString().
function validReceipt(group,findings=[]){
  const byFact=new Map(group.facts.map(f=>[f.id,f])),scope=new Set(group.scopeNoteIds);
  const output={factReviews:[],noteReviews:[],findings:findings.map(f=>({...f,factIds:[...f.factIds],noteIds:[...f.noteIds]}))};
  const span=f=>{const text=String(f?.text||'');if(!text.trim())throw Error('Synthetic audit fixture needs nonempty fact text.');const start=text.search(/\S/);return text.slice(start,start+2000);};
  const reference=n=>({noteId:n.id,clozeIndices:n.reviewTargets.map(t=>t.index)});
  for(const id of group.sourceFactIds){
    const fact=byFact.get(id);if(!fact.inSelectedTier)continue;
    const related=group.notes.filter(n=>n.factIds.includes(id));
    let targetNote=related.find(n=>scope.has(n.id)&&n.eligible&&n.reviewTargets.length),status='tested';
    if(!targetNote){targetNote=related.find(n=>!n.keep);status='manual-excluded';}
    if(!targetNote){targetNote=related.find(n=>n.keep&&n.structurallyValid&&!n.inSelectedTier);status='out-of-tier';}
    if(!targetNote){targetNote=related.find(n=>n.keep&&!n.structurallyValid);status='invalid-note';}
    if(!targetNote){
      status='missing';
      if(!output.findings.some(f=>f.code==='missing-target'&&f.factIds.includes(id)))output.findings.push({code:'missing-target',factIds:[id],noteIds:[],message:'Synthetic fixture has no related note for this supplied fact.',suggestion:''});
    }
    output.factReviews.push({factId:id,targets:[{sourceSpan:span(fact),status,noteRefs:targetNote?[reference(targetNote)]:[]}]});
  }
  for(const id of group.scopeNoteIds){
    const note=group.notes.find(n=>n.id===id),fact=note.factIds.map(f=>byFact.get(f)).find(Boolean)||group.facts[0];
    const field=()=>fact?{status:'supported',evidence:[{factId:fact.id,sourceSpan:span(fact)}]}:{status:'unsupported',evidence:[]};
    output.noteReviews.push({noteId:id,text:field(),extra:note.extra.trim()?field():{status:'empty',evidence:[]}});
    if(!fact&&!output.findings.some(f=>f.code==='unsupported'&&f.noteIds.includes(id)))output.findings.push({code:'unsupported',factIds:[],noteIds:[id],message:'Synthetic fixture has no supplied fact for this note.',suggestion:''});
  }
  // v16.4: transport fixtures use the same exact token addresses and short handles
  // as real packets. Whole-fact targets here exercise protocol shape, not quality.
  if(group.protocolVersion===4){
    const range=id=>({start:1,end:byFact.get(id).text.match(/\S+/gu).length});
    for(const review of output.factReviews){
      review.inventory=[{sourceRef:range(review.factId),role:'target',reason:'Synthetic fixture target; not a semantic judgment.'}];
      review.targets=review.targets.map(({sourceSpan,...target})=>({...target,sourceRef:range(review.factId),contextRefs:[]}));
    }
    for(const review of output.noteReviews)for(const field of ['text','extra'])review[field].evidence=review[field].evidence.map(e=>({factId:e.factId,sourceRef:range(e.factId)}));
  }
  return output;
}

module.exports={validReceipt};
