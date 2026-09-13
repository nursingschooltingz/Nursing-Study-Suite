'use strict';

// Synthetic V4 addressing regressions. Token accounting is not semantic proof.
function runAnkiAuditWireTests({S,t,section}){
  if(section)section('Anki V4 exact packet handles and source addresses');
  const start='function ankiAuditSourceTokens(text){',end='// v16.3: keep exact citations first;';
  const a=S.indexOf(start),b=S.indexOf(end,a+start.length);
  if(a<0||b<=a||S.indexOf(start,a+start.length)>=0)throw Error('Anki V4 wire extraction anchors moved or became ambiguous.');
  const source=S.slice(a,b),H=new Function(source+';return {ankiAuditSourceTokens,ankiAuditSourceRange,ankiAuditPacket,ankiBuildSourceAuditPrompt};')();
  const copy=x=>JSON.parse(JSON.stringify(x)),tokens=H.ankiAuditSourceTokens,range=H.ankiAuditSourceRange;
  const fact={id:'fact-1',condition:'Synthetic Marker',aliases:['Marker'],subtype:'',text:'  Mmol\tand\nmmol remain distinct.  ',tier:1,bucket:'assessment',inSelectedTier:true};
  const ts=tokens(fact.text);
  t('V4 source token IDs are stable one-based integers',JSON.stringify(ts.map(x=>x.id))==='[1,2,3,4,5]');
  t('V4 source tokens preserve unit capitalization',ts[0].text==='Mmol'&&ts[2].text==='mmol');
  t('V4 source tokens preserve exact UTF-16 character offsets',ts.every(x=>fact.text.slice(x.start,x.end)===x.text)&&ts[0].start===2&&ts[0].end===6);
  t('V4 source tokenization treats tabs and newlines only as boundaries',ts.map(x=>x.text).join(' ')==='Mmol and mmol remain distinct.');
  t('V4 source ranges restore original intervening whitespace',range(fact,{start:1,end:3}).sourceSpan==='Mmol\tand\nmmol');
  t('V4 source ranges return inclusive token IDs and exclusive character end',JSON.stringify(range(fact,{start:1,end:3}))===JSON.stringify({ok:true,sourceSpan:'Mmol\tand\nmmol',start:2,end:15,sourceRef:{start:1,end:3}}));
  t('V4 source range may address one final token',range(fact,{start:5,end:5}).sourceSpan==='distinct.');
  t('V4 source range preserves exact first-word capitalization without repair',range({text:'Unlisted prose stays strict.'},{start:1,end:1}).sourceSpan==='Unlisted');
  t('V4 source range preserves numeric comparators and punctuation',range({text:'Use <5 mg; never >6 Mg.'},{start:2,end:6}).sourceSpan==='<5 mg; never >6 Mg.');
  t('V4 source range preserves Unicode offsets after surrogate pairs',range({text:'💠 blue\u00a0marker'},{start:2,end:3}).sourceSpan==='blue\u00a0marker'&&tokens('💠 blue')[1].start===3);
  t('V4 repeated words have separate exact addresses',range({text:'blue and blue'},{start:3,end:3}).start===9);
  t('V4 empty source tokenizes to no invented target',tokens(' \n\t').length===0&&tokens(null).length===0);
  const badRefs=[null,[],{}, {start:1}, {start:1,end:1,sourceSpan:'Mmol'}, {start:'1',end:2}, {start:0,end:2}, {start:2,end:1}, {start:1.5,end:2}, {start:1,end:Infinity}];
  t('V4 source addressing rejects malformed, quoted, fractional and reversed references',badRefs.every(ref=>range(fact,ref).reason==='invalid-source-reference'));
  t('V4 source addressing rejects out-of-range token IDs',range(fact,{start:1,end:6}).reason==='unknown-source-token'&&range(fact,{start:7,end:7}).reason==='unknown-source-token');
  t('V4 source addressing rejects facts without captured text',range(null,{start:1,end:1}).reason==='invalid-source-text'&&range({text:7},{start:1,end:1}).reason==='invalid-source-text');
  t('V4 source addressing never normalizes unit case',range({text:'Msec Mbar Mrem Mrad'},{start:1,end:4}).sourceSpan==='Msec Mbar Mrem Mrad');

  const uuid1='aaaaaaaa-1234-4321-bbbb-111111111111',uuid2='bbbbbbbb-5678-8765-cccc-222222222222';
  const note={id:uuid1,chunk:1,sourceLine:1,text:'[Synthetic] Marker: {{c1::blue}}.',extra:'Context only.',tags:'Tier1 Condition::SyntheticMarker',tier:'1',keep:true,structurallyValid:true,inSelectedTier:true,eligible:true,factIds:['fact-1'],unresolvedFactIds:[],reviewTargets:[{index:1,front:'[Synthetic] Marker: [...].',answers:['blue']}]};
  const group={protocolVersion:4,id:'source-1-part-1',chunk:1,part:1,parts:1,tier:'1',sourceFactIds:['fact-1'],scopeNoteIds:[uuid2,uuid1],facts:[fact],notes:[note,{...copy(note),id:uuid2,sourceLine:2}],secretLocalMap:{[uuid1]:uuid2}};
  const before=JSON.stringify(group),packet=H.ankiAuditPacket(group),serialized=JSON.stringify(packet);
  t('V4 packet declares its protocol and retains source group identity',packet.protocolVersion===4&&packet.id===group.id&&packet.tier==='1');
  t('V4 packet note handles follow frozen note order',packet.notes[0].id==='n1'&&packet.notes[1].id==='n2');
  t('V4 packet scope handles retain captured scope order',JSON.stringify(packet.scopeNoteIds)==='["n2","n1"]');
  t('V4 packet omits internal note UUIDs and local metadata',!serialized.includes(uuid1)&&!serialized.includes(uuid2)&&!serialized.includes('secretLocalMap'));
  t('V4 packet keeps canonical source IDs and note mappings intact',packet.sourceFactIds[0]==='fact-1'&&packet.notes[0].factIds[0]==='fact-1');
  t('V4 packet includes exact source text and printable token addresses',packet.facts[0].text===fact.text&&packet.facts[0].sourceTokens[2].id===3&&packet.facts[0].sourceTokens[2].text==='mmol');
  t('V4 wire tokens omit character offsets to avoid competing address systems',Object.keys(packet.facts[0].sourceTokens[0]).sort().join(',')==='id,text');
  t('V4 packet retains real hidden answers and masked review fronts',packet.notes[0].reviewTargets[0].answers[0]==='blue'&&packet.notes[0].reviewTargets[0].front===note.reviewTargets[0].front);
  t('V4 packet construction does not mutate captured source or notes',JSON.stringify(group)===before);
  packet.notes[0].reviewTargets[0].answers.push('mutated');packet.facts[0].aliases.push('mutated');
  t('V4 packet mutable arrays do not alias captured source arrays',JSON.stringify(group)===before);
  const throws=x=>{try{H.ankiAuditPacket(x);return false;}catch(e){return true;}};
  t('V4 duplicate internal note IDs cannot acquire ambiguous handles',throws({...group,notes:[note,copy(note)]}));
  t('V4 absent internal note IDs cannot acquire handles',throws({...group,notes:[{...note,id:''}]}));
  t('V4 unknown scoped note IDs are never guessed from nearby IDs',throws({...group,scopeNoteIds:[uuid1.slice(0,-1)+'2']}));
  t('V4 empty groups retain empty scope and note arrays',H.ankiAuditPacket({facts:[],notes:[],scopeNoteIds:[],sourceFactIds:[]}).notes.length===0);

  const prompt=H.ankiBuildSourceAuditPrompt(group),tail=prompt.split('AUDIT PACKET:\n')[1];
  t('V4 dynamic builder serializes the exact packet helper result',tail===JSON.stringify(H.ankiAuditPacket(group)));
  t('V4 dynamic prompt never requests or exposes internal UUID values',!prompt.includes(uuid1)&&!prompt.includes(uuid2)&&prompt.includes('EXACT packet-local handles'));
  t('V4 dynamic prompt drafts inventory before looking for note matches',prompt.includes('Before looking for card matches')&&prompt.includes('Do not let existing clozes determine'));
  t('V4 dynamic prompt requires all tokens exactly once and separately inventories meaningful list members',prompt.includes('Partition ALL numbered sourceTokens')&&prompt.includes('Separate meaningful list members'));
  t('V4 dynamic prompt exposes all-context classification without forcing a fake target',prompt.includes('all-context fact may have targets:[]')&&prompt.includes('Never invent a target'));
  t('V4 dynamic prompt requires full actor-action-certainty-frequency-route-condition comparison',prompt.includes('FULL SOURCE PROPOSITION')&&['actor, action','certainty, frequency','modality, route','condition/trigger'].every(x=>prompt.includes(x)));
  t('V4 dynamic prompt separates tested and contextual references without guessing cloze indices',prompt.includes('contextRefs')&&prompt.includes('Never invent or auto-fill an index')&&prompt.includes('do not downgrade valid tested coverage'));
  t('V4 dynamic prompt preserves bounded-search and whole-deck review limits',prompt.includes('does not include the entire deck')&&prompt.includes('missing-target finding is provisional')&&prompt.includes('whole-deck coverage review'));
  t('V4 dynamic prompt preserves advisory scope and unchanged original notes',prompt.includes('Report advisory findings')&&prompt.includes('must leave original notes intact'));
  t('V4 dynamic prompt preserves three-cloze and higher-priority safety of suggestions',prompt.includes('at most three distinct cloze indices')&&prompt.includes('especially Tier 1'));
  t('V4 dynamic prompt does not mistake token completeness for semantic certainty',prompt.includes('checks token accounting, not whether')&&prompt.includes('does not certify clinical correctness'));
  const legacy={...group};delete legacy.protocolVersion;
  const oldPrompt=H.ankiBuildSourceAuditPrompt(legacy);
  t('legacy protocol keeps its strict original citation schema for recorded evidence',oldPrompt.includes('"sourceSpan":"exact nonempty substring')&&!oldPrompt.includes('"inventory":')&&oldPrompt.endsWith(JSON.stringify(legacy)));
  t('wire extraction reaches both new packet serialization and legacy builder tail',source.includes('JSON.stringify(ankiAuditPacket(group))')&&source.includes('JSON.stringify(group)')&&source.trim().endsWith('}'));
}

module.exports={runAnkiAuditWireTests};
