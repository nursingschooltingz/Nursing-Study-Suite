'use strict';

// These protect the approved instruction/protocol contract and actual masked views.
// They do not measure whether a model follows its internal allocation plan.
function runAnkiTargetAllocationTests({S,t,section}){
  if(section)section('Anki target allocation and source-meaning contract');
  const {extractPromptLiteral}=require('./repo-checks');
  const master=extractPromptLiteral(S,'ANKI_MASTER_PROMPT');
  const adapter=extractPromptLiteral(S,'kbAdapter');
  const runtime=new Function(master.declaration+'\n'+adapter.declaration+';return {master:ANKI_MASTER_PROMPT,adapter:kbAdapter};')();
  t('monitoring exception requires hidden destinations for remaining substantive items',runtime.master.includes('Assign every remaining substantive item to a hidden target in another note')&&runtime.master.includes('visible Text or Extra alone does not complete its recall coverage'));
  t('coverage explicitly outranks anti-overfragmentation while allowing necessary repeated context',runtime.master.includes('even when their necessary context repeats')&&runtime.master.includes('Target coverage takes precedence over the anti-redundancy and anti-overfragmentation preferences'));
  t('critical reminders distinguish a source link from completed recall',runtime.master.includes('one source fact may require several notes')&&runtime.master.includes('A ledger link records source support, not complete recall coverage')&&!runtime.master.includes('Coverage is enforced by the ledger'));
  t('full-proposition check includes labels and preserves timing origins and modality',runtime.master.includes('anchor, retrieval label, visible Text, hidden answers and Extra')&&runtime.master.includes('timing and its starting event')&&runtime.master.includes('Do not change may to must or often, potential to definite, or a high-risk condition into a contraindication'));
  t('headings and Extra cannot invent classifications or explanatory relationships',runtime.master.includes('Do not invent a named syndrome, formal cluster, ranking, or explanatory relationship in a heading or Extra')&&runtime.master.includes('Default Extra to empty.'));
  t('allocation precedes composition and cannot demote important targets to reduce note count',runtime.adapter.includes('Before composing notes, internally allocate each FACT')&&runtime.adapter.includes('planned note(s) and cloze index/indices')&&runtime.adapter.includes('do not classify an important target as context merely to reduce note count'));
  t('reconciliation follows compression and checks masked views with preserved relation and priority',runtime.adapter.includes('After shortening, splitting or combining notes')&&runtime.adapter.includes('actual masked review fronts')&&runtime.adapter.includes('required relation and source priority preserved')&&runtime.adapter.includes('add or restore notes when a target became only visible Text, Extra, or absent'));
  t('equivalent-unit instruction distinguishes numeric roles without recalculating source values',runtime.adapter.includes('hide answer-equivalent representations together under the same cloze index')&&runtime.adapter.includes('Do not confuse equal numbers serving different clinical roles')&&runtime.adapter.includes('do not calculate replacement source values'));
  t('planning remains internal and preserves the two-block fact-to-note wire contract',runtime.adapter.includes('Return only the existing two code blocks')&&runtime.adapter.includes('do not add target inventories, cloze indices, commentary or extra fields to the FACT COVERAGE MAP')&&runtime.adapter.includes('fact-<n> -> line #<m>')&&runtime.adapter.includes('one destination per line')&&runtime.adapter.includes('Put NO pipe character anywhere in CODE BLOCK #2'));
  const start=S.indexOf('function ankiParseCards(raw'),end=S.indexOf('function AnkiStyleBadges',start);
  if(start<0||end<=start)throw Error('Anki allocation helper extraction anchors moved');
  let sequence=0;
  const H=new Function('uid',S.slice(start,end)+';return {ankiParseCards,parseKBCoverage,ankiSelection,ankiPreviewText,ankiExportText};')(()=> 'allocation-'+(++sequence));
  const tags='Nursing::LATTE::Assess Condition::Synthetic Tier::1';
  const fence=String.fromCharCode(96).repeat(3);
  const response=fence+'text\n[Synthetic] First actions: {{c1::alpha}}, {{c2::beta}}, {{c3::gamma}}.||'+tags+'\n[Synthetic] Next actions: {{c1::delta}}, {{c2::epsilon}}.||'+tags+'\n'+fence+'\n'+fence+'text\nfact-1 -> line #1\nfact-1 -> line #2\n'+fence;
  const parsed=H.ankiParseCards(response,1,'hierarchical-v1'),refs=H.parseKBCoverage(parsed.ledger,1);
  t('one source fact still maps to sufficient short notes without adding import fields',parsed.cards.length===2&&H.ankiSelection(parsed.cards).reviews===5&&refs.length===2&&refs.every(x=>x.id==='fact-1')&&refs.map(x=>x.line).join(',')==='1,2');
  const together='[Synthetic] Quantity: {{c1::1 L}} ({{c1::1000 mL}}).',separate='[Synthetic] Quantity: {{c1::1 L}} ({{c2::1000 mL}}).';
  t('real review rendering hides equivalent forms together but exposes independently numbered forms',!H.ankiPreviewText(together,1).includes('1000 mL')&&!H.ankiPreviewText(together,1).includes('1 L')&&H.ankiPreviewText(separate,1).includes('1000 mL'));
  // Non-vacuous helper tail: round-trip through the complete shipped export formatter.
  const exported=H.ankiExportText(parsed.cards,null,true,'all',false,false),roundTrip=H.ankiParseCards(exported,1,'hierarchical-v1');
  t('allocation-compatible export retains exact three-field rows and all independent reviews',exported.split('\n').every(line=>line.split('|').length===3)&&roundTrip.cards.length===2&&H.ankiSelection(roundTrip.cards).reviews===5&&roundTrip.cards[1].tags===tags);
}

module.exports={runAnkiTargetAllocationTests};
