import {uid,now,requireValue,fail,scoped} from './store.mjs';
import {validateFramework,digest,currentActor} from './competency-service.mjs';

export const publishedFramework=f=>!f.status||f.status==='published';
export function revision(row,expected){if((row.revision||1)!==expected)fail(409,'Cet objet a changé. Rechargez avant de réessayer.');}
const text=(s,max=2000)=>typeof s==='string'&&s.trim().length>0&&s.length<=max;
export function frameworkContent(input){
 const content=validateFramework(input);
 for(const node of content.nodes){
  const raw=input.nodes.find(n=>n.id===node.id);
  if(raw.archived===true)node.archived=true;
  node.origin=raw.origin==='source'?'source':'local';node.description=String(raw.description||'').slice(0,10000);
  for(const criterion of node.criteria){const c=raw.criteria.find(c=>c.id===criterion.id);
   if(c.archived===true)criterion.archived=true;
   criterion.studentLabel=String(c.studentLabel||'').slice(0,2000);criterion.observable=String(c.observable||c.title).slice(0,2000);
   criterion.expectedEvidence=String(c.expectedEvidence||'').slice(0,2000);criterion.allowedHelp=String(c.allowedHelp||'').slice(0,2000);
   criterion.descriptors=Object.fromEntries(Object.entries(c.descriptors||{}).slice(0,12).map(([k,v])=>[k.slice(0,40),String(v).slice(0,2000)]));
  }
 }
 const relations=content.relations||[];
 return {...content,relations};
}
export async function frameworkUsages(tx,actor,id,nodeId){
 const framework=await scoped(tx,'framework_versions',id,actor);
 requireValue(!nodeId||framework.nodes.some(n=>n.id===nodeId),'Élément introuvable.');
 const match=r=>r.frameworkVersionId===id&&(!nodeId||r.competencyId===nodeId);
 const tables=['competency_grids','lesson_versions','lesson_runs','submissions','mastery_decisions','mastery_rules','framework_mappings','framework_versions','lessons'];
 const data=Object.fromEntries(await Promise.all(tables.map(async t=>[t,await tx.list(t,actor.classId)])));
 const grids=data.competency_grids.filter(g=>[...(g.competencies||[]),...(g.links||[])].some(match));
 const versions=data.lesson_versions.filter(v=>(v.spec.competencyRefs||[]).some(match)||data.lessons.some(l=>l.versionId===v.id&&(l.competencyRefs||[]).some(match))||grids.some(g=>g.lessonVersionId===v.id)||data.lesson_runs.some(r=>r.lessonVersionId===v.id&&(r.objectives||[]).some(match)));
 const runs=data.lesson_runs.filter(r=>(r.objectives||[]).some(match)||versions.some(v=>v.id===r.lessonVersionId));
 return {grids:grids.map(g=>({id:g.id,lessonVersionId:g.lessonVersionId,version:g.version})),
  lessons:versions.map(v=>({id:v.id,lessonId:v.lessonId,title:v.spec.pedagogicalTitle||v.spec.title,version:v.version})),
  occurrences:runs.map(r=>({id:r.id,date:r.date,initialDate:r.initialDate||r.date,sequence:r.sequence||'',lessonId:r.lessonId})),
  submissions:data.submissions.filter(s=>grids.some(g=>g.id===s.competencyGrid?.id)).length,
  decisions:data.mastery_decisions.filter(match).length,rules:data.mastery_rules.filter(match).length,
  mappings:data.framework_mappings.filter(m=>m.fromFrameworkId===id||m.toFrameworkId===id).length,
  revisions:data.framework_versions.filter(f=>f.basedOnId===id).length};
}
export async function createFramework(tx,actor,input){
 await currentActor(tx,actor);const content=frameworkContent(input);
 const row=await tx.insert('framework_versions',{...content,id:uid('framework'),classId:actor.classId,status:'draft',revision:1,version:1,scope:input.scope==='shared'?'shared':'class',authorId:actor.id,fingerprint:digest(content)});
 await tx.audit(actor,'framework.draft_created',row.id);return row;
}
export async function editFramework(tx,actor,id,input){
 const f=await scoped(tx,'framework_versions',id,actor);revision(f,input.revision);
 requireValue(f.status!=='archived','Ce référentiel est archivé.');
 const content=frameworkContent(input);
 if(f.status==='draft'){
  const usage=await frameworkUsages(tx,actor,id);requireValue(!hasUsages(usage),'Ce brouillon possède des dépendances : créez une révision.');
  const row={...f,...content,revision:f.revision+1,fingerprint:digest(content),editedBy:actor.id};await tx.put('framework_versions',row);await tx.audit(actor,'framework.draft_edited',id);return row;
 }
 requireValue(text(input.reason),'Justifiez la nouvelle révision.');
 const siblings=(await tx.list('framework_versions',actor.classId)).filter(r=>(r.logicalId||r.id)===(f.logicalId||f.id));
 const row=await tx.insert('framework_versions',{...f,...content,id:uid('framework'),createdAt:now(),logicalId:f.logicalId||f.id,basedOnId:f.id,status:'draft',revision:1,version:Math.max(...siblings.map(r=>r.version||1))+1,publishedAt:null,validatedAt:null,validatedBy:null,authorId:actor.id,reason:input.reason,fingerprint:digest(content)});
 await tx.audit(actor,'framework.revised',row.id,{basedOnId:f.id});return row;
}
export const hasUsages=u=>u.grids.length||u.lessons.length||u.occurrences.length||u.submissions||u.decisions||u.rules||u.mappings||u.revisions;
export async function transitionFramework(tx,actor,id,input){
 const account=await currentActor(tx,actor),f=await scoped(tx,'framework_versions',id,actor);revision(f,input.revision);
 if(input.action==='delete'){
  requireValue(f.status==='draft'&&!f.publishedAt&&!hasUsages(await frameworkUsages(tx,actor,id)),'Seul un brouillon sans dépendance peut être supprimé. Archivez cet élément.');
  await tx.remove('framework_versions',id);await tx.audit(actor,'framework.draft_deleted',id);return {deleted:true,id};
 }
 requireValue(['publish','archive'].includes(input.action),'Action inconnue.');
 if(f.scope==='shared'&&!account.permissions?.includes('framework:publish'))fail(403,'La publication ou l’archivage du référentiel partagé exige le droit dédié.');
 if(input.action==='publish'){
  requireValue(f.status==='draft','Seul un brouillon peut être publié.');frameworkContent(f);
  if(f.basedOnId){const base=await scoped(tx,'framework_versions',f.basedOnId,actor);const newer=(await tx.list('framework_versions',actor.classId)).some(r=>(r.logicalId||r.id)===(base.logicalId||base.id)&&publishedFramework(r)&&(r.version||1)>(base.version||1));if(newer)fail(409,'Une autre révision a été publiée. Comparez les modifications.');}
  f.status='published';f.publishedAt=now();f.validatedAt=f.publishedAt;f.validatedBy=actor.id;
 }else{requireValue(text(input.reason),'Motif d’archivage requis.');f.status='archived';f.archivedAt=now();f.archiveReason=input.reason;}
 f.revision=(f.revision||1)+1;await tx.put('framework_versions',f);await tx.audit(actor,'framework.'+input.action,id);return f;
}
// Import units are immutable snapshots. Never remove absent units or merge by title/code.
export async function previewFrameworkImport(tx,actor,input){
 const content=frameworkContent(input.content),key=digest([actor.classId,content.frameworkKey,content.sourceVersion]),rows=await tx.list('framework_versions',actor.classId);
 const prior=rows.find(r=>r.importKey===key),fingerprint=digest(content);
 const state=!prior?'create':prior.importFingerprint===fingerprint?'unchanged':'conflict';
 return {state,content,key,fingerprint,existingId:prior?.id||null,message:state==='conflict'?'Cette origine existe avec un autre contenu. Importez une nouvelle version source ou révisez explicitement le référentiel.':null};
}
export async function applyFrameworkImport(tx,actor,input){
 const preview=await previewFrameworkImport(tx,actor,input);requireValue(input.confirmed===true&&input.fingerprint===preview.fingerprint,'Validez cet aperçu d’import.');
 if(preview.state==='conflict')fail(409,preview.message);if(preview.state==='unchanged')return {...preview,framework:await tx.get('framework_versions',preview.existingId)};
 const f=await createFramework(tx,actor,{...preview.content,scope:input.scope});f.importKey=preview.key;f.importFingerprint=preview.fingerprint;await tx.put('framework_versions',f);return {...preview,framework:f};
}
