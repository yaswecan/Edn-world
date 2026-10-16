import {requireValue,fail} from './store.mjs';
import {validateFramework,importFramework} from './competency-service.mjs';
import {identityFields,sessionIdentity,deriveIdentity} from './session-identity.mjs';
import {canonical} from './content-snapshots.mjs';

const nodeKeys=['n2_code','n2_label','n3_code','n3_label','typology','notions_tools','observable_criterion','prerequisites','prerequisiteCodes','mastery_rule','scaffolding_rule','expected_trace'];
const pickNode=n=>Object.fromEntries(nodeKeys.filter(k=>n[k]!==undefined).map(k=>[k,n[k]]));
export async function exportSessionIdentity(tx,lesson,spec){
 const identity=await sessionIdentity(tx,lesson,spec),associations=[];
 for(const ref of identity.competencyRefs){
  if(ref.frameworkVersionId){const f=await tx.get('framework_versions',ref.frameworkVersionId);if(f?.classId!==lesson.classId||!f.nodes.some(n=>n.id===ref.competencyId))fail(422,'Compétence inaccessible pour cet export.');associations.push({kind:'framework',competencyId:ref.competencyId,framework:validateFramework(f)});}
  else {const c=await tx.get('competency_n3',ref.competencyId);if(c?.classId!==lesson.classId)fail(422,'Compétence absente pour cet export.');associations.push({kind:'curriculum',node:pickNode(c)});}
 }
 return {format:1,pedagogicalTitle:identity.pedagogicalTitle,missionTitle:identity.missionTitle,titleSource:identity.titleSource,needsReview:identity.identityNeedsReview,associations};
}
export function validateSessionIdentity(p){
 if(p===undefined)return; // Explicit backwards compatibility with v1 archives.
 requireValue(p&&p.format===1&&Object.keys(p).every(k=>['format','pedagogicalTitle','missionTitle','titleSource','needsReview','associations'].includes(k)),'Identité pédagogique portable invalide.');
 requireValue(typeof p.pedagogicalTitle==='string'&&p.pedagogicalTitle.trim()&&p.pedagogicalTitle.length<=160&&(p.missionTitle===null||typeof p.missionTitle==='string'&&p.missionTitle.length<=500)&&['validated','generated','imported'].includes(p.titleSource)&&typeof p.needsReview==='boolean','Intitulés portables invalides.');
 requireValue(Array.isArray(p.associations)&&p.associations.length<=100,'Associations portables invalides.');
 for(const a of p.associations){
  if(a.kind==='curriculum')requireValue(Object.keys(a).every(k=>['kind','node'].includes(k))&&a.node&&Object.keys(a.node).every(k=>nodeKeys.includes(k))&&typeof a.node.n3_code==='string'&&a.node.n3_code.length<=200&&typeof a.node.n3_label==='string'&&a.node.n3_label.length<=2000,'Compétence source invalide.');
  else {requireValue(a.kind==='framework'&&Object.keys(a).every(k=>['kind','framework','competencyId'].includes(k)),'Source de compétence invalide.');const f=validateFramework(a.framework);requireValue(canonical(f)===canonical(a.framework)&&f.nodes.some(n=>['competency','subcompetency'].includes(n.kind)&&n.id===a.competencyId),'Compétence absente du référentiel embarqué.');}
 }
}
export async function checkSessionIdentity(tx,actor,p){
 validateSessionIdentity(p);
 for(const a of p?.associations||[])if(a.kind==='curriculum'){
  const matches=(await tx.list('competency_n3',actor.classId)).filter(c=>c.n3_code===a.node.n3_code);
  requireValue(matches.length<=1&&(!matches.length||matches[0].n3_label===a.node.n3_label),'Le code de compétence existe avec un autre libellé : '+a.node.n3_code);
 }else {const f=(await tx.list('framework_versions',actor.classId)).find(f=>f.frameworkKey===a.framework.frameworkKey&&f.sourceVersion===a.framework.sourceVersion);requireValue(!f||canonical(validateFramework(f))===canonical(a.framework),'Le référentiel embarqué entre en conflit avec une version locale.');}
}
export async function importSessionIdentity(tx,actor,p,lesson,spec,target){
 if(target?.titleSource==='validated')return identityFields(target);
 if(!p)return deriveIdentity(tx,lesson,spec);
 await checkSessionIdentity(tx,actor,p);const refs=[];
 for(const a of p.associations){
  if(a.kind==='framework'){const f=await importFramework(tx,actor,{...a.framework,confirmed:true});refs.push({frameworkVersionId:f.id,competencyId:a.competencyId});}
  else {let node=(await tx.list('competency_n3',actor.classId)).find(c=>c.n3_code===a.node.n3_code);if(!node)node=await tx.insert('competency_n3',{...a.node,id:actor.classId+':'+a.node.n3_code,classId:actor.classId,source:'lesson-transfer'});refs.push({competencyId:node.id});}
 }
 return {pedagogicalTitle:p.pedagogicalTitle,missionTitle:p.missionTitle,titleSource:p.titleSource,identityNeedsReview:p.needsReview,competencyRefs:refs,identityRevision:(target?.identityRevision||0)+1};
}
