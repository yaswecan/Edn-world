import {validate} from '../contracts.mjs';
import {fail} from '../store.mjs';
import {documentarySchema,digest} from './contracts.mjs';
import {coursePolicy,CONTENT_VERSION,runtimeManifest} from './policy.mjs';

export function designContext(job) {
 const entry=job.brief.entry;
 return {version:CONTENT_VERSION,policy:coursePolicy,capabilities:job.capabilities||runtimeManifest(),
  session:{classId:job.classId,entryId:entry.id,entryVersion:entry.version||null,date:entry.date,timezone:'Europe/Paris',planningType:entry.category||null,sequence:entry.sequence||null,planVersion:job.brief.planVersion,duration:entry.duration,sourceRow:entry.sourceRow||null},
  resolvedContextHash:job.brief.resolvedContext?.hash||null,documentContext:job.documentContext||null,sourceVersions:job.sources.map(s=>({id:s.id,hash:s.contentHash})),revision:job.revision||1};
}
export function validateDocumentary(value,sources) {
 validate(documentarySchema,value);
 const cite=c=>sources.some(s=>s.id===c.sourceId&&s.segments.some(p=>p.id===c.segmentId));
 if(!value.concepts.length)fail(400,'Analyse des sources : aucune notion exploitable.');
 for(const c of [...value.concepts,...value.findings,...value.contradictions])if(!c.citations.length||!c.citations.every(cite))fail(400,'Analyse des sources : constat sans passage vérifiable.');
 if(new Set(value.concepts.map(c=>c.id)).size!==value.concepts.length)fail(400,'Analyse des sources : identifiants dupliqués.');
 return value;
}
export const analysisInputHash=job=>digest({sources:job.sources.map(s=>[s.id,s.contentHash]),session:job.brief.entry.id,version:1,...(job.documentContext?{context:job.documentContext.sha256}:{})});

export function contractIssues(plan,spec,context) {
 const issues=[],c=plan.contract;
 const add=(location,problem)=>issues.push({location,problem});
 if(!c){add('contract','Contrat de conception absent.');return issues;}
 const activities=new Map([...spec.activities,...spec.diagnostic.tasks].map(a=>[a.id,a]));
 const diagnostics=new Set(spec.diagnostic.tasks.map(a=>a.id));
 const phases=new Map([...spec.activities.map(a=>[a.id,spec.blocks.find(b=>b.activityIds.includes(a.id))?.phase]),...spec.diagnostic.tasks.map(a=>[a.id,'diagnostic'])]);
 const profiles=new Map(context.capabilities.profiles.map(p=>[p.id,p]));
 if(c.outcomes.length!==spec.skills.length||new Set(c.outcomes.map(o=>o.skill)).size!==spec.skills.length)add('contract/outcomes','Chaque acquis central doit être décrit une seule fois.');
 for(const skill of spec.skills){
  const o=c.outcomes.find(o=>o.skill===skill),coverage=plan.coverage.find(o=>o.skill===skill);
  if(!o||!o.criteria.length||!o.proof.trim()||!o.activityIds.some(id=>['guided','autonomy'].includes(phases.get(id))))add(`contract/outcomes/${skill}`,'Acquis central sans pratique ni preuve observable.');
  if(o?.activityIds.some(id=>(!activities.get(id)?.skills.includes(skill)&&!diagnostics.has(id))||!coverage?.activityIds.includes(id)))add(`contract/outcomes/${skill}`,'Pratique hors acquis ou carte de couverture.');
  const teaching=c.teaching.find(t=>t.skill===skill);if(!teaching)add(`contract/teaching/${skill}`,'Mécanisme, exemple et confusion non conçus.');
  if(teaching?.mode==='consolidation'&&!teaching.priorResourceIds.length)add(`contract/teaching/${skill}`,'Consolidation sans ressource antérieure explicitement référencée.');
 }
 if(phases.get(c.finalTask.activityId)!=='autonomy'||!c.finalTask.criteria.length)add('contract/finalTask','Production autonome et critères requis.');
 if(phases.get(c.finalTask.transferActivityId)!=='extend'||c.finalTask.transferActivityId===c.finalTask.activityId)add('contract/finalTask/transfer','Transfert distinct absent.');
 for(const id of c.finalTask.requiredConceptIds){
  const preparation=plan.prerequisites.find(p=>p.conceptId===id);
  const prepared=plan.coverage.some(o=>o.conceptIds.includes(id))||!!(preparation?.action.trim()&&preparation?.evidence.trim());
  if(!plan.analysis.some(n=>n.conceptId===id)||!prepared)add('contract/finalTask/prerequisites',`Notion non préparée : ${id}.`);
 }
 const ids=new Set(c.activities.map(a=>a.activityId));
 if(ids.size!==c.activities.length)add('contract/activities','Activités conçues en double.');
 for(const a of spec.activities.filter(a=>a.required))if(!ids.has(a.id))add(`contract/activities/${a.id}`,'Activité obligatoire non conçue.');
 for(const a of c.activities){
  const target=activities.get(a.activityId),p=profiles.get(a.runtimeProfile);
  if(!target){add(`contract/activities/${a.activityId}`,'Activité inconnue.');continue;}
  if(!p||!p.available||a.capabilities.some(cap=>!p.capabilities.includes(cap)))add(`contract/activities/${a.activityId}/runtime`,'Capacité requise indisponible dans le manifeste applicatif.');
  if(target.workshop?.profile&&target.workshop.profile!==a.runtimeProfile)add(`contract/activities/${a.activityId}/runtime`,'Le profil conçu ne correspond pas à l’atelier fourni.');
  if(['CodeEditor','Terminal','TestRunner'].includes(target.type)&&!a.capabilities.length)add(`contract/activities/${a.activityId}/capabilities`,'Capacités exécutables non spécifiées.');
  if(a.runtimeProfile==='algorithm'&&target.correctionMode==='javascript'&&['guided','autonomy'].includes(phases.get(a.activityId))&&!['editor','execution','console'].every(cap=>a.capabilities.includes(cap)))add(`contract/activities/${a.activityId}/execution`,'Programmation : prévoir un éditeur, le bouton Exécuter et une console pour console.log().');
  if(a.runtimeProfile==='html-css'&&target.type==='CodeEditor'&&!a.capabilities.includes('web-preview'))add(`contract/activities/${a.activityId}/preview`,'Design : aperçu réel requis.');
  if(a.runtimeProfile==='shell-git'&&!a.capabilities.includes('shell'))add(`contract/activities/${a.activityId}/shell`,'Commandes : shell réel requis.');
  if(a.files.some(f=>!f.path.trim()||f.path.startsWith('/')||f.path.split('/').includes('..')))add(`contract/activities/${a.activityId}/files`,'Chemin de fichier invalide.');
 }
 const finalProfile=c.activities.find(a=>a.activityId===c.finalTask.activityId)?.runtimeProfile;
 if(finalProfile&& !profiles.get(finalProfile)?.families.includes(c.family))add('contract/family','La famille dominante ne correspond pas à l’acquis évalué par le défi final.');
 if(c.timing.length!==spec.blocks.length||new Set(c.timing.map(t=>t.blockId)).size!==spec.blocks.length||c.timing.some(t=>!spec.blocks.some(b=>b.id===t.blockId)))add('contract/timing','Chaque bloc, diagnostic et pause inclus, doit être budgété une seule fois.');
 for(const t of c.timing)if(spec.blocks.find(b=>b.id===t.blockId)?.type==='Diagnostic'&&t.minutes!==spec.diagnostic.duration)add('contract/timing','La durée du diagnostic doit correspondre à ses tâches et à son barème.');
 const total=c.timing.reduce((n,t)=>n+t.minutes,0),available=spec.blocks.reduce((n,b)=>n+b.minutes,0);
 if(total>available||total<available*.7||total!==plan.duration.minutes)add('contract/timing','Durée incohérente avec le créneau et le déroulé.');
 const supportIds=new Set(c.supports.map(s=>s.id));
 if(supportIds.size!==c.supports.length)add('contract/supports','Identifiants de supports dupliqués.');
 for(const kind of ['student-course','teacher-guide','correction','export'])if(!c.supports.some(s=>s.kind===kind&&s.required))add('contract/supports',`Support obligatoire absent : ${kind}.`);
 const visiting=new Set(),done=new Set();
 function visit(id){if(visiting.has(id)){add('contract/supports','Cycle entre supports.');return;}if(done.has(id))return;visiting.add(id);for(const dep of c.supports.find(s=>s.id===id)?.dependsOn||[])if(supportIds.has(dep))visit(dep);else add('contract/supports',`Dépendance inconnue : ${dep}.`);visiting.delete(id);done.add(id);}
 for(const s of c.supports){visit(s.id);if(s.kind==='correction'&&s.audience!=='teacher')add('contract/supports','Corrigé déclaré visible par l’élève.');if(s.activityIds.some(id=>!activities.has(id)))add('contract/supports','Support lié à une activité inconnue.');}
 if(c.unresolvedConstraints.length)add('contract/unresolvedConstraints',c.unresolvedConstraints.join(' ; '));
 return issues;
}
export function validateDesignContract(plan,spec,context) {
 const issues=contractIssues(plan,spec,context);
 if(issues.length)fail(400,'Contrat de conception à corriger : '+issues.map(i=>`${i.location} : ${i.problem}`).join(' ; '),{kind:'design_contract',issues});
 return {context,contextHash:digest(context),content:plan.contract,planHash:digest(plan),validatedAt:new Date().toISOString()};
}
