'use strict';

// The V4 cap measures the serialized model packet, including token addresses.
function runAnkiAuditPacketSizeTests({S,t,section}){
  if(section)section('Anki V4 wire packet bounds and preserved relationships');
  const start='function ankiParseCards(raw',end='function AnkiStyleBadges';
  const a=S.indexOf(start),b=S.indexOf(end,a+start.length);
  if(a<0||b<=a||S.indexOf(start,a+start.length)>=0)throw Error('Anki V4 packet grouping extraction anchors moved or became ambiguous.');
  const source=S.slice(a,b),H=new Function('uid',source+';return {ankiAuditGroups,ankiAuditPacket,ANKI_SOURCE_AUDIT_GROUP_CHARS};')(()=> 'synthetic');
  const fact=(id,text,tier=1)=>({id,text,tier,bucket:'Assessment',condition:'Synthetic Marker',aliases:['Marker'],subtype:'independent',sourceQuote:'PRIVATE_QUOTE_MUST_NOT_BE_SENT'});
  const note=(id,factIds=[],changes={})=>({id,factIds,chunk:1,sourceLine:1,text:'[Synthetic] Marker: {{c1::blue}} after {{c2::review}}.',extra:'Supplied context.',tags:'Tier::1',keep:true,pipeCount:2,...changes});
  const batch=facts=>({snapshot:{facts},chunkIds:[facts.map(f=>f.id)]});
  const packetSize=g=>JSON.stringify(H.ankiAuditPacket(g)).length;
  const facts=Array.from({length:22},(_,i)=>fact('fact-'+i,'Marker '+i+' '+('independent detail '.repeat(65))));
  const notes=facts.map((f,i)=>note('captured-note-'+i,[f.id],{sourceLine:i+1,text:'[Synthetic] Marker '+i+': {{c1::blue}}. '+('Supplied context. '.repeat(14))}));
  const original=JSON.stringify({facts,notes}),groups=H.ankiAuditGroups(notes,batch(facts),'all',4);
  t('V4 source grouping keeps the explicit 24000-character packet ceiling',H.ANKI_SOURCE_AUDIT_GROUP_CHARS===24000);
  t('V4 packet overhead produces genuinely partitioned synthetic groups',groups.length>1&&groups.some(g=>g.sourceFactIds.length>1));
  t('V4 actual serialized wire packets remain within the ceiling',groups.every(g=>packetSize(g)<=H.ANKI_SOURCE_AUDIT_GROUP_CHARS));
  t('V4 displayed size exactly measures the serialized wire packet',groups.every(g=>g.sizeChars===packetSize(g)));
  t('V4 groups declare their protocol and consistent part numbering',groups.every((g,i)=>g.protocolVersion===4&&g.part===i+1&&g.parts===groups.length));
  t('V4 bounded grouping retains every primary source fact exactly once',groups.flatMap(g=>g.sourceFactIds).length===facts.length&&new Set(groups.flatMap(g=>g.sourceFactIds)).size===facts.length);
  t('V4 bounded grouping retains every captured note',new Set(groups.flatMap(g=>g.notes.map(n=>n.id))).size===notes.length);
  t('V4 bounded grouping preserves each note to fact relationship',notes.every(n=>groups.some(g=>g.notes.some(row=>row.id===n.id&&row.factIds.includes(n.factIds[0]))&&g.facts.some(f=>f.id===n.factIds[0]))));
  t('V4 packet construction leaves source facts and captured notes unchanged',JSON.stringify({facts,notes})===original);
  t('V4 bounded packets exclude provenance quotes outside generation input',groups.every(g=>!JSON.stringify(H.ankiAuditPacket(g)).includes('PRIVATE_QUOTE_MUST_NOT_BE_SENT')));
  t('V4 note handles are rebuilt locally for every bounded packet',groups.every(g=>H.ankiAuditPacket(g).notes.every((n,i)=>n.id==='n'+(i+1))));
  t('V4 scope handles all resolve to notes in their own packet',groups.every(g=>{const p=H.ankiAuditPacket(g);return p.scopeNoteIds.every(id=>p.notes.some(n=>n.id===id));}));

  const linkedFacts=[fact('primary','A blue marker.'),fact('secondary','Review the marker.',2),fact('residual','Residual detail.',3)];
  const linkedNotes=[note('cross',['primary','secondary']),note('other-tier',['primary'],{tags:'Tier::2'}),note('unchecked',['primary'],{keep:false}),note('invalid',['primary'],{text:'{{c1::unfinished'}),note('orphan',[],{chunk:0})];
  const linkedBatch={snapshot:{facts:linkedFacts},chunkIds:[['primary'],['secondary']]};
  const linked=H.ankiAuditGroups(linkedNotes,linkedBatch,'1',4),primary=linked.find(g=>g.sourceFactIds.includes('primary')),secondary=linked.find(g=>g.sourceFactIds.includes('secondary'));
  t('V4 cross-chunk note retains all supporting source facts',linked.filter(g=>g.notes.some(n=>n.id==='cross')).every(g=>['primary','secondary'].every(id=>g.facts.some(f=>f.id===id))));
  t('V4 support facts stay separate from primary obligations',primary.facts.some(f=>f.id==='secondary')&&!primary.sourceFactIds.includes('secondary')&&secondary.facts.some(f=>f.id==='primary')&&!secondary.sourceFactIds.includes('primary'));
  t('V4 other-tier notes remain supplied but outside eligible scope',primary.notes.some(n=>n.id==='other-tier'&&!n.eligible)&&!primary.scopeNoteIds.includes('other-tier'));
  t('V4 manually excluded notes remain supplied without active scope',primary.notes.some(n=>n.id==='unchecked'&&!n.keep)&&!primary.scopeNoteIds.includes('unchecked'));
  t('V4 structurally invalid notes retain evidence but no review targets',primary.notes.some(n=>n.id==='invalid'&&!n.structurallyValid&&n.reviewTargets.length===0));
  t('V4 unassigned source facts and orphan notes remain explicitly grouped',linked.some(g=>g.chunk===0&&g.sourceFactIds.includes('residual')&&g.notes.some(n=>n.id==='orphan')));
  const unlinkedFacts=Array.from({length:7},(_,i)=>fact('unlinked-'+i,'Synthetic context '+i+'.'));
  const unlinkedRows=[...unlinkedFacts.map((f,i)=>note('wide-note-'+i,[f.id],{text:'[Synthetic] {{c1::marker}}. '+('Visible scaffolding. '.repeat(110))})),note('unmapped',['unknown-source'])];
  const unlinked=H.ankiAuditGroups(unlinkedRows,batch(unlinkedFacts),'all',4);
  t('V4 partitioned unmapped notes retain complete origin-chunk source evidence',unlinked.length>1&&unlinked.every(g=>g.notes.some(n=>n.id==='unmapped')&&g.facts.length===unlinkedFacts.length));
  t('V4 unresolved source links remain explicit rather than invented',unlinked.every(g=>g.notes.find(n=>n.id==='unmapped').unresolvedFactIds[0]==='unknown-source'));
  t('V4 overlapping support packets still honor their actual wire size',unlinked.every(g=>packetSize(g)<=24000));

  const failure=fn=>{try{fn();return null;}catch(error){return error;}};
  const veryLong=fact('long','marker '+('x'.repeat(14000)));
  t('legacy payload size alone can fit a fact whose V4 token payload cannot',H.ankiAuditGroups([],batch([veryLong]),'all').length===1&&!!failure(()=>H.ankiAuditGroups([],batch([veryLong]),'all',4)));
  const oversized=failure(()=>H.ankiAuditGroups([],batch([veryLong]),'all',4));
  t('V4 oversized indivisible source fails without dropping or truncating text',oversized.message.includes('long')&&oversized.message.includes('Nothing was truncated')&&veryLong.text.length===14007);
  const oversizedNote=failure(()=>H.ankiAuditGroups([note('oversized-note',[],{text:'{{c1::'+('x'.repeat(25000))+'}}'})],batch([]),'all',4));
  t('V4 oversized indivisible note fails with an identifiable note',!!oversizedNote&&oversizedNote.message.includes('oversized-note')&&oversizedNote.message.includes('Nothing was truncated'));

  // Find the accepted boundary using a two-token fact, so each added character
  // predictably appears in both source text and its numbered token entry.
  const sized=n=>batch([fact('boundary','marker '+('x'.repeat(n)))]);
  let low=1,high=24000;
  while(low<high){const mid=Math.ceil((low+high)/2);if(failure(()=>H.ankiAuditGroups([],sized(mid),'all',4)))high=mid-1;else low=mid;}
  const boundary=H.ankiAuditGroups([],sized(low),'all',4)[0];
  t('V4 conservative metadata reservation still allows a packet near its bound',packetSize(boundary)>23900&&packetSize(boundary)<=24000);
  t('V4 next indivisible payload beyond the planning boundary is rejected',!!failure(()=>H.ankiAuditGroups([],sized(low+1),'all',4)));
  t('V4 boundary source text survives byte-for-byte',boundary.facts[0].text===sized(low).snapshot.facts[0].text);
  t('V4 near-limit actual size agrees with its displayed size',boundary.sizeChars===packetSize(boundary));
  t('packet-size extraction reaches final group assembly and live wire serialization',source.includes('group.sizeChars=protocolVersion===4?JSON.stringify(ankiAuditPacket(group)).length')&&source.includes('return groups;')&&source.includes('function ankiAuditSourceRange(fact,sourceRef)'));
}

module.exports={runAnkiAuditPacketSizeTests};
