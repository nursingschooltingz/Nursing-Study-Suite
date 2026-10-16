'use strict';

// v18.6: the NCLEX Generator's Points and Outcomes pick facts that go first in their batches. Synthetic pools only; no network.

module.exports=function run(S,t){
  const span=(a,b)=>{const x=S.indexOf(a),y=S.indexOf(b,x+a.length);if(x<0||y<0||S.indexOf(a,x+1)>=0)throw Error('Missing or ambiguous v18.6 anchor '+a);return S.slice(x,y);};
  const names=['ngBuildFactPool','ngAllocateBatch','ngBatchStart','ngFocusWords','ngFocusItems','ngFocusIndex','ngFocusMatch','ngFocusPlan','ngFocusSummary'];
  const M=new Function('kbSourceText',span('function ngFactRow(','// v17.3: this text was duplicated')+';return {'+names.join(',')+'};')(()=>'');
  const {ngBuildFactPool,ngAllocateBatch,ngBatchStart,ngFocusWords,ngFocusItems,ngFocusIndex,ngFocusMatch,ngFocusPlan,ngFocusSummary}=M;
  const F=(id,text)=>({id,text,tier:1,latteBucket:'Look'});
  const G=(condition,aliases,facts)=>({condition,aliases,facts});
  const ids=list=>list.map(x=>x.f?x.f.id:x.id).join();

  // A small pool shaped like real KB groups, plus filler whose words are common (in more than 5 facts).
  const mini=[
    G('Hyperthermia',[],[F('h1','Hyperthermia raises core body temperature.'),F('h2','Cool the client with fans and tepid water.')]),
    G('Malignant Hyperthermia',['MH'],[F('m1','Malignant hyperthermia follows triggering anesthetics.'),F('m2','Give dantrolene at the first sign of rigidity.')]),
    G('Acute Lymphocytic Leukemia',['ALL'],[F('a1','Blast cells crowd the bone marrow.')]),
    G('Hypocalcemia',[],[F('c1','Initiate seizure precautions for severe hypocalcemia.'),F('c2','A positive Chvostek sign shows neuromuscular irritability.')]),
    G('Neutropenia',[],[F('n1','Implement neutropenic precautions below 1,000 cells.')]),
    G('Potassium Imbalances',['Hyperkalemia','Hypokalemia'],[F('k1','Hypokalemia causes muscle weakness.'),F('k2','Hyperkalemia shows peaked T waves on the ECG.'),F('k3','Hyperkalemia requires continuous cardiac monitoring.')]),
    G('Ear Assessment',[],[F('e1','Purulent discharge from the ear suggests infection.')]),
    G('Dantrolene',[],[F('d1','Dantrolene is the antidote for a malignant hyperthermia crisis.')]),
    ...Array.from({length:10},(_,g)=>G('Filler '+g,[],Array.from({length:3},(_,i)=>F('x'+g+'-'+i,'Monitor vital signs every hour for the filler client '+g+'.'))))
  ];
  const ix=ngFocusIndex(mini);
  const match=(item,o)=>ngFocusMatch(ix,item,o);

  // ── items and words ──
  t('v18.6: Points split into one item per line or semicolon, without bullets or list numbers, keeping a leading decimal',
    ngFocusItems('- Stroke\n2. Hyperkalemia ECG changes; GCS\n\n  • 5.5 mEq potassium\n(3) Lumbar puncture\nx\r\n* Mannitol').join('|')==='Stroke|Hyperkalemia ECG changes|GCS|5.5 mEq potassium|Lumbar puncture|Mannitol'
    &&ngFocusItems('').length===0&&ngFocusItems(null).length===0);
  t('v18.6: words drop a possessive and a plural s (not ss, us or is) and keep their typed form',
    ngFocusWords("Chvostek's signs, ABGs, stress and status").map(x=>x.w).join()==='chvostek,sign,abg,stress,and,status'&&ngFocusWords('MH crisis')[0].raw==='MH');

  // ── names ──
  t('v18.6: an item names a group by its name or an alias, as whole words, ignoring case and a plural s',
    match('hyperkalemias').named.join()==='5'&&match('Hypocalcemia teaching').named.join()==='3'&&match('Hypocalcemic').named.length===0);
  t('v18.6: a name inside a longer name the item contains is ignored (Malignant Hyperthermia, not Hyperthermia)',
    match('Malignant hyperthermia crisis').named.join()==='1'&&match('Hyperthermia').named.join()==='0');
  t('v18.6: an all-capitals alias names its group only when typed in capitals',
    match('MH crisis').named.join()==='1'&&match('mh crisis').named.length===0&&match('Assess all clients').named.length===0&&match('ALL in children').named.join()==='2');

  // ── words (Points) ──
  t('v18.6: outside named groups a fact needs more than half of the item\'s words, so one shared word is not enough',
    ids(match('Seizure precautions').facts)==='c1'&&ids(match('Neutropenic precautions').facts)==='n1'&&match('Discharge teaching').facts.length===0);
  t('v18.6: a word match needs one of the words to be rare in the pool; common words alone match nothing',
    match('Monitor vital signs every hour').facts.length===0&&ix.rareMax===5);
  t('v18.6: only the facts with the most of the item\'s words are kept',ids(match('Hyperkalemia ECG changes').facts)==='k2');
  t('v18.6: on a tie, facts in a named group come before other matches, then pool order',
    ids(match('Dantrolene').facts)==='d1,m2'&&ids(match('Hyperkalemia').facts)==='k2,k3');
  t('v18.6: Outcomes match by name only, and nursing words such as client or care never count',
    match('Seizure precautions',{words:false}).facts.length===0&&ids(match('Hyperkalemia ECG changes',{words:false}).facts)==='k2'
    &&match('Nursing care for the client').facts.length===0);

  // ── the plan ──
  const three='Hyperkalemia\nSeizure precautions\nNeutropenic precautions';
  const p=ngFocusPlan(mini,{points:three,outcomes:'Malignant hyperthermia',batches:2,perItem:3});
  t('v18.6: item k goes to batch (k mod batches)+1, Points first and then Outcomes',
    p.plan.map(b=>b.join()).join('|')==='k2,k3,n1|c1,m1'&&p.items.map(i=>i.kind).join()==='point,point,point,outcome'&&p.items.every(i=>i.matched));
  const capped=ngFocusPlan(mini,{points:three,batches:2,perItem:3,cap:3}),tight=ngFocusPlan(mini,{points:three,batches:2,perItem:3,cap:2});
  t('v18.6: the cap shrinks each item\'s quota to fit, to at least 1, and stops picking once reached',
    capped.items.map(i=>i.facts.join()).join('|')==='k2|c1|n1'&&tight.items.map(i=>i.facts.length).join()==='1,1,0'&&tight.items[2].matched);
  const twice=ngFocusPlan(mini,{points:'Hyperkalemia\nHyperkalemia ECG changes',batches:2,perItem:3});
  t('v18.6: a fact is picked for one item only, and no items means an empty plan',
    twice.items[0].facts.join()==='k2,k3'&&twice.items[1].facts.length===0&&twice.items[1].matched
    &&(()=>{const e=ngFocusPlan(mini,{points:' \n',outcomes:''});return e.items.length===0&&e.plan.length===1&&e.plan[0].length===0;})());

  // ── the batch takes its picks first ──
  const five=Array.from({length:5},(_,g)=>G('Group '+g,[],Array.from({length:4},(_,i)=>F('fact-'+g+'-'+i,'Synthetic fact '+i+' of group '+g+'.'))));
  t('v18.6: a batch takes its picked facts first, in order, before the walk',
    ids(ngAllocateBatch(five,new Set(),{want:4,perCondition:2,neighborCap:0,first:['fact-3-1','fact-0-2']}).targets)==='fact-3-1,fact-0-2,fact-0-0,fact-1-0');
  t('v18.6: picked facts already used or not in the pool are skipped, and no picks keeps the v18.5 order',
    ids(ngAllocateBatch(five,new Set(['fact-2-0']),{want:2,perCondition:2,neighborCap:0,first:['nope','fact-2-0']}).targets)==='fact-0-0,fact-0-1'
    &&[0,1,2,3,4].every(s=>ids(ngAllocateBatch(five,new Set(),{want:7,perCondition:2,neighborCap:0,start:s}).targets)===ids(ngAllocateBatch(five,new Set(),{want:7,perCondition:2,neighborCap:0,start:s,first:[]}).targets)));
  t('v18.6: picks count toward their group\'s limit in the first round, and a batch with every group full still fills',
    ids(ngAllocateBatch(five,new Set(),{want:4,perCondition:2,neighborCap:0,first:['fact-0-2','fact-0-3']}).targets)==='fact-0-2,fact-0-3,fact-1-0,fact-1-1'
    &&ngAllocateBatch([five[0]],new Set(),{want:4,perCondition:2,neighborCap:0,first:['fact-0-0','fact-0-1']}).targets.length===4);
  const withCtx=ngAllocateBatch(five,new Set(),{want:2,perCondition:2,neighborCap:1,start:0,first:['fact-4-3']});
  t('v18.6: a picked fact\'s group also supplies same-group context facts',withCtx.context.some(f=>f.condition==='Group 4'&&f.id!=='fact-4-3'));

  // ── a default run on a pool shaped like the Exam 1 KB, with Points naming groups the v18.5 walk never reaches ──
  const exam=[...Array.from({length:62},(_,g)=>G('Group '+g,[],Array.from({length:10},(_,i)=>F('fact-'+g+'-'+i,'Synthetic fact '+i+' of group '+g+'.')))),
    ...Array.from({length:83},(_,g)=>G('Group '+(62+g),[],Array.from({length:3},(_,i)=>F('fact-'+(62+g)+'-'+i,'Synthetic fact '+i+' of group '+(62+g)+'.'))))];
  const aimed=[10,30,45,61,70,80,100,115,130,144];
  const simulate=points=>{
    const plan=ngFocusPlan(exam,{points,batches:5,perItem:3,cap:75}),used=new Set();let picked=0;
    for(let b=1;b<=5;b++){const a=ngAllocateBatch(exam,used,{want:30,perCondition:4,neighborCap:2,start:ngBatchStart(exam,b,5),first:plan.plan[b-1]});picked+=a.targets.filter(f=>plan.plan[b-1].includes(f.id)).length;a.targets.forEach(f=>used.add(f.id));}
    const reached=new Set([...used].map(id=>Number(id.split('-')[1])));
    return {used,reached,picked,targets:used.size};
  };
  const before=simulate(''),after=simulate(aimed.map(g=>'Group '+g).join('\n'));
  t('v18.6: in a default 50-question run every Point gets a fact, where the v18.5 walk gave none of them one',
    aimed.every(g=>!before.reached.has(g))&&aimed.every(g=>after.reached.has(g))&&after.picked===30);
  // Picks take walk slots, so on this evenly sized pool they trade walk groups for named ones (42 and 42); the Exam 1 KB went 48 to 54.
  t('v18.6: the run still allocates 150 distinct targets, reaches no fewer groups, and the walk keeps more than half of them',
    before.targets===150&&after.targets===150&&after.reached.size>=before.reached.size&&after.targets-after.picked>=75);

  // ── the log line ──
  const sum=ngFocusSummary([{kind:'point',text:'Stroke',matched:true,facts:['x','y']},{kind:'point',text:'Delegation to UAP',matched:false,facts:[]},{kind:'outcome',text:'O',matched:true,facts:['z']}]);
  t('v18.6: the run log says how many Points and Outcomes matched and names the Points that did not',
    sum.t==='warn'&&sum.text==='Focus: 1 of 2 Points and 1 of 1 Outcome matched Knowledge Base facts; 3 of those fact(s) go first in their batches. No match for "Delegation to UAP". To steer those, use a condition, medication or test name as the Knowledge Base spells it.'
    &&ngFocusSummary([])===null&&ngFocusSummary([{kind:'point',text:'Stroke',matched:true,facts:['x']}]).t==='ok');
  const many=ngFocusSummary(Array.from({length:7},(_,i)=>({kind:'point',text:i?'Point '+i:'A'.repeat(70),matched:false,facts:[]})));
  t('v18.6: the log names at most five unmatched Points and shortens long ones',
    many.text.includes('"'+'A'.repeat(60)+'…", "Point 1"')&&many.text.includes('"Point 4" and 2 more.')&&!many.text.includes('Point 5'));

  // ── the generator ──
  t('v18.6: pool groups carry their aliases (an empty list when there are none)',
    (()=>{const pool=ngBuildFactPool({conditions:[{name:'X',aliases:['Why'],facts:[F('q1','t')]},{name:'Z',facts:[F('q2','u')]}]});return pool[0].aliases.join()==='Why'&&Array.isArray(pool[1].aliases)&&!pool[1].aliases.length;})());
  t('v18.6: the NCLEX Generator plans the picks with half the run\'s targets as the cap, passes each batch its picks and logs them',
    S.includes("const focus=allocMode?ngFocusPlan(pool,{points,outcomes,batches:numBatches,perItem:factsPerQ,cap:Math.floor(targetCount*factsPerQ/2)}):{plan:[],items:[]};")
    &&S.split('first:focus.plan[b-1]});').length===2&&S.includes('const focusNote=ngFocusSummary(focus.items);\n        if(focusNote)owned_log(focusNote.text,focusNote.t);'));
  t('v18.6: the focus block\'s prompt wording is unchanged',
    S.includes("- Concepts matching the OUTCOMES or POINTS get Tier 1 priority for selection; their PART 1 and Tags tier stays the supplied KB tier.\n- Every listed POINT should receive at least one question across the full run.\n- If a POINT has no support in the source material, say so explicitly in PART 2 —"));
};
