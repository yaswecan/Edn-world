import {identityFields,identityKeys,deriveIdentity,identityContext,proposeTitle} from './session-identity.mjs';
import {canonical,sha256} from './content-snapshots.mjs';
import {fail,now} from './store.mjs';

const snapshot=l=>Object.fromEntries(['title',...identityKeys].filter(k=>l[k]!==undefined).map(k=>[k,l[k]]));
function validatePlan(plan){
 if(plan?.migration!=='session-identity-v1'||!Array.isArray(plan.rows))fail(400,'Plan de migration inconnu.');
 const ids=new Set();
 for(const row of plan.rows){
  if(typeof row.id!=='string'||ids.has(row.id)||!['ready','review'].includes(row.status))fail(400,'Séance dupliquée ou état de migration invalide.');ids.add(row.id);
  for(const fields of [row.before,row.after].filter(Boolean))if(Object.keys(fields).some(k=>!['title',...identityKeys].includes(k)))fail(400,'La migration ne peut modifier que l’identité pédagogique.');
  if(row.status==='ready'&&(!row.before||!row.after||typeof row.after.pedagogicalTitle!=='string'||row.after.title!==row.after.pedagogicalTitle||!Array.isArray(row.after.competencyRefs)))fail(400,'Identité de migration invalide.');
 }
}
export async function planIdentityMigration(tx,{classId}={}){
 const rows=[];
 for(const lesson of await tx.list('lessons',classId)){
  if(lesson.pedagogicalTitle)continue;
  const version=await tx.get('lesson_versions',lesson.versionId);
  if(!version){rows.push({id:lesson.id,classId:lesson.classId,status:'review',reason:'Version de contenu absente',before:snapshot(lesson)});continue;}
  const identity=await deriveIdentity(tx,lesson,version.spec);
  identity.identityRevision=1;
  const after={title:identity.pedagogicalTitle,...identityFields(identity)};
  const missing=(version.spec.skills||[]).length>0&&!identity.competencyRefs.length;
  const suggestion=identity.identityNeedsReview?proposeTitle({...await identityContext(tx,lesson,version.spec),lesson:{}}):null;
  rows.push({id:lesson.id,classId:lesson.classId,status:identity.identityNeedsReview?'review':'ready',reason:identity.titleSource==='validated'?'Titre modifié par le professeur conservé':identity.identityNeedsReview?'Sources insuffisantes pour un intitulé précis':null,suggestedTitle:suggestion&&!suggestion.needsReview?suggestion.title:null,warnings:missing?['Aucune compétence du contenu résolue dans la base']:[],before:snapshot(lesson),after,expected:sha256(canonical(lesson))});
 }
 return {migration:'session-identity-v1',createdAt:now(),rows,counts:{ready:rows.filter(r=>r.status==='ready').length,review:rows.filter(r=>r.status==='review').length}};
}
export async function applyIdentityMigration(store,plan,{actorId='session-identity-migration'}={}){
 validatePlan(plan);
 return store.transaction(async tx=>{
  await tx.lockTables();const applied=[],skipped=[];
  for(const row of plan.rows){
   if(row.status!=='ready'){skipped.push(row.id);continue;}
   const lesson=await tx.get('lessons',row.id);
   if(lesson&&canonical(snapshot(lesson))===canonical(row.after))continue;
   if(!lesson||lesson.classId!==row.classId||sha256(canonical(lesson))!==row.expected)fail(409,'Séance modifiée depuis la simulation : '+row.id);
   Object.assign(lesson,row.after);await tx.put('lessons',lesson);
   await tx.audit({id:actorId,classId:lesson.classId},'lesson.identity_migrated',lesson.id,{migration:plan.migration,before:row.before,after:row.after});applied.push(row.id);
  }
  return {applied,skipped};
 });
}
export async function rollbackIdentityMigration(store,plan){validatePlan(plan);return store.transaction(async tx=>{
 await tx.lockTables();const restored=[];
 for(const row of plan.rows.filter(r=>r.status==='ready')){
  const lesson=await tx.get('lessons',row.id);
  if(!lesson||lesson.classId!==row.classId)fail(409,'Séance absente : '+row.id);
  if(canonical(snapshot(lesson))===canonical(row.before))continue;
  if(canonical(snapshot(lesson))!==canonical(row.after))fail(409,'Identité modifiée après migration : '+row.id);
  for(const key of ['title',...identityKeys])delete lesson[key];Object.assign(lesson,row.before);await tx.put('lessons',lesson);
  await tx.audit({id:'session-identity-rollback',classId:lesson.classId},'lesson.identity_rollback',lesson.id,{migration:plan.migration});restored.push(row.id);
 }
 return {restored};
});}
