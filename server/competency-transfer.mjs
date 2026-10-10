import {requireValue,uid} from './store.mjs';
import {activeGrid,validateFramework,validateGrid,importFramework,digest} from './competency-service.mjs';
const pick=(o,keys)=>Object.fromEntries(keys.filter(k=>o?.[k]!==undefined).map(k=>[k,structuredClone(o[k])]));
const gridKeys=['mode','categories','items','rounding','roundBeforeGrade','globalRules','competencies','links','situationId','allowedHelp'];
export async function exportPedagogy(tx,actor,version){
 const grid=await activeGrid(tx,version.id);if(!grid)return version.portablePedagogy||null;
 const ids=[...new Set([...grid.competencies,...grid.links].map(c=>c.frameworkVersionId))],frameworks=[];
 for(const id of ids){const f=await tx.get('framework_versions',id);requireValue(f?.classId===actor.classId,'Référentiel inaccessible.');frameworks.push({key:'ref_'+digest(validateFramework(f)),content:validateFramework(f),originalId:id});}
 const runs=(await tx.list('lesson_runs',actor.classId)).filter(r=>r.lessonVersionId===version.id),templates=structuredClone(version.pendingAdaptationTemplates||[]);
 for(const r of (await tx.list('adaptation_rules',actor.classId)).filter(r=>runs.some(run=>run.id===r.runId))){
  const targets={};for(const [kind,target] of Object.entries(r.targets)){const run=await tx.get('lesson_runs',target.runId),lesson=await tx.get('lessons',run.lessonId);targets[kind]={activityId:target.activityId,sourceLessonPortableId:lesson.portableId||null,sourceLessonVersionId:target.lessonVersionId,title:target.title};}
  templates.push({...pick(r,['activityId','version','reason','continuation','help','prerequisites','maxCycles']),targets});
 }
 const portableGrid=pick(grid,gridKeys),refs=new Map(frameworks.map(f=>[f.originalId,f.key]));for(const m of [...portableGrid.competencies,...portableGrid.links])m.frameworkVersionId=refs.get(m.frameworkVersionId);for(const t of templates)for(const p of t.prerequisites)p.frameworkVersionId=refs.get(p.frameworkVersionId)||p.frameworkVersionId;
 return {format:1,frameworks:frameworks.map(({originalId,...f})=>f),grid:portableGrid,adaptationTemplates:templates};
}
export function validatePortablePedagogy(p){
 if(!p)return;
 requireValue(p.format===1&&Object.keys(p).every(k=>['format','frameworks','grid','adaptationTemplates'].includes(k)),'Contenu pédagogique V2 invalide.');
 requireValue(Array.isArray(p.frameworks)&&p.frameworks.length<=100&&Array.isArray(p.adaptationTemplates)&&p.adaptationTemplates.length<=100,'Références pédagogiques invalides.');
 for(const f of p.frameworks){requireValue(typeof f.key==='string'&&Object.keys(f).every(k=>['key','content'].includes(k)),'Référence source invalide.');requireValue(digest(validateFramework(f.content))===digest(f.content),'Champs inconnus dans le référentiel portable.');}
 requireValue(p.grid&&Object.keys(p.grid).every(k=>gridKeys.includes(k)),'La grille portable contient des données hors du contenu pédagogique.');
 for(const r of p.adaptationTemplates){requireValue(Object.keys(r).every(k=>['activityId','version','reason','continuation','help','prerequisites','maxCycles','targets'].includes(k)),'Une autorisation ou donnée élève ne peut être importée.');for(const target of Object.values(r.targets||{}))requireValue(Object.keys(target).every(k=>['activityId','sourceLessonPortableId','sourceLessonVersionId','title'].includes(k)),'Cible de parcours non portable.');}
}
export async function checkPedagogy(tx,actor,p){
 validatePortablePedagogy(p);if(!p)return [];
 for(const f of p.frameworks){const id='framework_'+digest([actor.classId,f.content.frameworkKey,f.content.sourceVersion]),old=await tx.get('framework_versions',id);requireValue(!old||old.fingerprint===digest(f.content),'Conflit de contenu pour une même version de référentiel.');}
 return p.adaptationTemplates.length?['Les règles de parcours sont conservées comme modèles à rattacher aux occurrences locales. Leurs autorisations automatiques ne sont pas transportées.']:[];
}
export async function importPedagogy(tx,actor,version,p){
 if(!p)return;await checkPedagogy(tx,actor,p);const map=new Map();
 for(const f of p.frameworks){const imported=await importFramework(tx,actor,{...f.content,confirmed:true});map.set(f.key,imported.id);}
 const grid=structuredClone(p.grid);for(const m of [...grid.competencies,...grid.links]){requireValue(map.has(m.frameworkVersionId),'Référentiel non résolu dans l’archive.');m.frameworkVersionId=map.get(m.frameworkVersionId);}
 const content=await validateGrid(tx,actor,grid,version.spec.diagnostic);
 await tx.insert('competency_grids',{...content,id:uid('grid'),classId:actor.classId,lessonVersionId:version.id,version:1,authorId:actor.id,imported:true});
 // Templates are preserved for explicit local approval, never turned into permissions.
 version.portablePedagogy=structuredClone(p);version.pendingAdaptationTemplates=p.adaptationTemplates;await tx.put('lesson_versions',version);
}
export async function inheritGrid(tx,actor,oldVersion,newVersion){
 const old=await activeGrid(tx,oldVersion.id);if(!old)return;
 try{const content=await validateGrid(tx,actor,old,newVersion.spec.diagnostic);await tx.insert('competency_grids',{...content,id:uid('grid'),classId:actor.classId,lessonVersionId:newVersion.id,version:1,authorId:actor.id,inheritedFrom:old.id});}
 catch(error){if(!error.status)throw error;await tx.insert('competency_grids',{id:uid('unresolved-grid'),classId:actor.classId,lessonVersionId:newVersion.id,version:1,unresolved:'La modification du barème nécessite de revoir ses correspondances. '+error.message,originalGridId:old.id});}
}
