#!/usr/bin/env node
'use strict';

// Read-only planning tool. Pass only a KB explicitly placed in scope by its owner.
// It calculates calls using the shipped packet/chunk functions; it never calls Gemini.
const fs=require('fs'),path=require('path');
const {resolveSuiteFile,sha256,suiteVersionFromFilename}=require('./repo-checks');
function span(source,start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);if(a<0||b<0)throw Error('Pilot extraction anchor moved: '+start);return source.slice(a,b);}
function makeAnkiPilotSpec(kb,source){
  // v16.6: the live packet now uses the same canonical-tag registry as generation review.
  const helpers=span(source,'function kbSourceText(f){','\n')+'\n'+span(source,'function ankiConditionTagKey(','function ankiConditionTagCheck(')+span(source,'function kbForAnki(kb){','// ── KB source chunking')+span(source,'function splitOversizedConditionBlock(block,max){','function ankiParseCards(raw');
  // v18.4: the run sends kbForAnki(kbFactView(kb,{boxTableFirst:true})): entry facts included, box and table facts first.
  // An imported KB has been through normalizeKbEntities, so a file that predates v18.4 is normalized here the same way.
  const view=span(source,'const KB_ENTITY_KINDS=','\nfunction kbBucketFacts('),normalizer=span(source,'function kbSlug(','// v15.14: the class kept ASCII');
  const {kbForAnki,ankiChunkText,kbFactView,normalizeKbEntities}=new Function(helpers+'\n'+view+'\n'+normalizer+';return {kbForAnki,ankiChunkText,kbFactView,normalizeKbEntities};')();
  const sent=kbFactView(normalizeKbEntities(kb).kb,{boxTableFirst:true}),packet=kbForAnki(sent),chunks=ankiChunkText(packet,12000,2);
  const model=source.match(/const MODEL_SETTINGS_DEFAULTS=Object\.freeze\(\{[^}]*\bflashModel:'([^']+)'/)?.[1]; // v17.3: shipped defaults live in MODEL_SETTINGS_DEFAULTS
  if(!model||!source.includes("anki:{m:'flash',lv:'medium'}"))throw Error('Recommended Anki profile changed; inspect settings before planning.');
  return {model,thinkingLevel:'medium',profile:'recommended auto; confirm these settings in the UI',conditions:(kb.conditions||[]).length,entries:sent.conditions.length-(kb.conditions||[]).length,facts:sent.conditions.reduce((n,c)=>n+(c.facts||[]).length,0),packetSha256:sha256(packet),chunkChars:12000,overlapPages:2,chunkCount:chunks.length,chunkSizes:chunks.map(c=>c.length),expectedGenerationCalls:chunks.length,retriesPerCall:2,maximumAttempts:3*chunks.length,maxOutputTokensPerAttempt:65536,additionalAuditCalls:0,focusContext:'Keep Outcomes, Points, and Additional Context identical for all comparison runs.',privateOutputs:'scratch/anki-pilot/ (gitignored); save diagnostics, original responses, and the exported .txt locally.',status:'PLANNED ONLY — explicit approval for this source and these calls is required.'};
}
if(require.main===module){
  const filename=process.argv[2];if(!filename)throw Error('Usage: node tools/anki-pilot-spec.js <explicitly-authorized-KB.json>');
  const suite=resolveSuiteFile({rootDir:path.join(__dirname,'..')}),raw=fs.readFileSync(path.resolve(filename),'utf8');
  console.log(JSON.stringify({sourcePath:path.resolve(filename),sourceSha256:sha256(raw),suiteVersion:suiteVersionFromFilename(suite),...makeAnkiPilotSpec(JSON.parse(raw),fs.readFileSync(suite,'utf8'))},null,2));
}
module.exports={makeAnkiPilotSpec};
