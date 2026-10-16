import {now,fail,requireValue,scoped} from './store.mjs';
import {sha256,canonical} from './content-snapshots.mjs';

export const DIAGNOSTIC_V31='diagnostic-3.1';
export const TRANSFER_ROLE='near-transfer-3.1';
const unique=a=>[...new Set(a)];
const fingerprint=value=>sha256(canonical(value));

// Read the two existing journals. Import/correction timestamps never order work.
export async function diagnosticSources(tx,actor,{date,trackId=null}={}){
 const candidates=[];
 for(const run of await tx.list('lesson_runs',actor.classId)){
  if(trackId&&run.trackId!==trackId)continue;
  const modern=['realized','partial'].includes(run.planStatus),legacy=['completed','partially_completed'].includes(run.status)&&run.closedAt&&run.eligibleForDiagnostic;
  if(!modern&&!legacy||run.planStatus==='cancelled')continue;
  const v=await tx.get('lesson_versions',run.lessonVersionId);if(!v||v.classId!==actor.classId)continue;
  const records=modern?(run.realization.records?.length?run.realization.records:[{date:run.realization.date,activityIds:run.realization.activityIds}]):[{date:run.actualDate||run.date,activityIds:run.coveredActivityIds||[]}];
  const eligible=records.filter(r=>r.date&&r.date<date),actualDate=eligible.map(r=>r.date).sort().at(-1);if(!actualDate)continue;
  const ids=unique(eligible.flatMap(r=>r.activityIds||[])),activities=v.spec.activities.filter(a=>ids.includes(a.id));
  // A partial legacy record without confirmed activities is ambiguous.
  if(!activities.length)continue;
  const objectives=(run.objectives||[]).filter(o=>o.activityId&&ids.includes(o.activityId));
  const mapped=[];for(const o of objectives){const f=await tx.get('framework_versions',o.frameworkVersionId),n=f?.nodes.find(n=>n.id===o.competencyId);if(f?.classId===actor.classId&&n?.code)mapped.push(n.code);}
  const criteria=unique([...mapped,...activities.flatMap(a=>a.skills||[]).filter(c=>modern||run.coveredSkills?.includes(c))]);
  const reactivatedPrerequisites=(run.reactivatedPrerequisites||[]).filter(c=>v.spec.prerequisites?.includes(c));
  if(!criteria.length&&!objectives.length)continue;
  candidates.push({runId:run.id,revision:run.revision||1,lessonVersionId:v.id,title:v.spec.pedagogicalTitle||v.spec.title,date:actualDate,trackId:run.trackId||null,activities:activities.map(a=>({id:a.id,title:a.title,skills:a.skills||[]})),criteria:unique([...criteria,...reactivatedPrerequisites]),objectives,reactivatedPrerequisites,provenance:modern?'realization.records':'journal.confirmedActivities'});
 }
 candidates.sort((a,b)=>b.date.localeCompare(a.date)||a.runId.localeCompare(b.runId));
 const tracks=unique(candidates.map(c=>c.trackId)),ambiguous=!trackId&&tracks.length>1||candidates.length>1&&candidates[0].date===candidates[1].date;
 return {candidates,selected:ambiguous?null:candidates[0]||null,status:!candidates.length?'source_required':ambiguous?'selection_required':'to_confirm'};
}

export function upgradeDiagnostic(original,source,{extraTask,extraRubric}={}){
 if(original.contract?.version===DIAGNOSTIC_V31)return structuredClone(original);
 const d=structuredClone(original),tasks=d.tasks.filter(t=>t.required!==false),n=tasks.length;
 requireValue(n>0&&n<=11,'Le gabarit doit être restructuré avant de tenir dans vingt minutes.');
 const base=tasks.find(t=>['CodeEditor','Terminal','Preview','TestRunner'].includes(t.type))||tasks[0];
 // This is an editable proposal, never a claim that the copied tasks are calibrated.
 const extra=extraTask||{...structuredClone(base),id:'diag-near-transfer',type:'WriteResponse',title:'Appliquer dans une situation proche',instruction:`Choisis une donnée ou une contrainte déjà travaillée dans « ${source?.title||'la séance source à confirmer'} ». Écris sa nouvelle valeur, produis la réponse adaptée et justifie un cas de vérification (entrée et résultat attendu).`,starter:'',options:[],tests:[],publicTests:[],correctionMode:'manual',expectedAnswer:'',reference:'Relire la contrainte choisie, la production adaptée et le cas de vérification. Refuser toute notion qui ne figure pas dans la source confirmée. Accepter les variantes correctes explicitées.',expectedEvidence:'Une contrainte connue modifiée, une production adaptée et un cas justifié.'};
 delete extra.workshop;delete extra.richText;
 extra.required=true;extra.duration=5;extra.diagnosticRole=TRANSFER_ROLE;
 requireValue(!tasks.some(t=>t.id===extra.id),'Identifiant de l’exercice ajouté déjà utilisé.');
 tasks.forEach((t,i)=>{
  t.duration=Math.floor(11/n)+(i<11%n?1:0);t.itemVersion=t.itemVersion||1;
  if(t.id==='diag-verification'){
   t.title='Justifier un contrôle';t.instruction='Sur la production de la séance source, choisis un seul cas de vérification. Précise l’entrée, le résultat attendu et le défaut que ce contrôle permet de détecter.';
   t.expectedEvidence='Un cas de contrôle précis avec son résultat et le défaut détectable.';
   t.reference='Accepter tout contrôle pertinent sur les critères confirmés, avec une entrée précise, un résultat correct et un défaut effectivement détectable. L’adaptation à un nouveau contexte appartient à l’exercice ajouté.';
  }
 });
 extra.itemVersion=1;d.tasks=[...tasks,extra];
 // Do not invent a /20 conversion: the author must supply the extra rubric.
 d.rubric=[...d.rubric,...(extraRubric||[])];
 d.duration=20;d.criteria=unique(d.tasks.flatMap(t=>t.skills||[]));
 d.policyVersion=DIAGNOSTIC_V31;
 d.contract={version:DIAGNOSTIC_V31,baseCount:n,addedRole:TRANSFER_ROLE,readingMinutes:2,submissionMinutes:2,source:source||null,sourceConfirmed:false,reviewed:false,calibration:'estimated',initialTaskIds:tasks.map(t=>t.id)};
 if(source){d.kind='previous_lesson';d.sourceLessonRunId=source.runId;d.sourceLessonVersion=source.lessonVersionId;}
 return d;
}

export function diagnosticV31Issues(d,{ready=true}={}){
 if(d.contract?.version!==DIAGNOSTIC_V31)return [];
 const c=d.contract,issues=[],tasks=d.tasks||[],rubric=d.rubric||[];
 if(!c.source||!c.sourceConfirmed)issues.push('Séance source à confirmer.');
 if(c.source&&(d.sourceLessonRunId!==c.source.runId||d.sourceLessonVersion!==c.source.lessonVersionId))issues.push('Références de source incohérentes.');
 const allowed=new Set(c.source?.criteria||[]);
 if(tasks.some(t=>!t.skills?.length||t.skills.some(k=>!allowed.has(k))))issues.push('Un exercice évalue une notion non confirmée dans la source.');
 if(tasks.length!==c.baseCount+1||tasks.some(t=>!t.required)||tasks.filter(t=>t.diagnosticRole===TRANSFER_ROLE).length!==1)issues.push('Le gabarit doit contenir N+1 exercices obligatoires avec un seul exercice ajouté.');
 if(c.readingMinutes<1||c.submissionMinutes<1||tasks.reduce((n,t)=>n+t.duration,0)+c.readingMinutes+c.submissionMinutes!==d.duration||d.duration>20)issues.push('Le budget doit inclure lecture, exercices, vérification et remise, en vingt minutes maximum.');
 if(unique(tasks.map(t=>t.id)).length!==tasks.length||unique(rubric.map(r=>r.id)).length!==rubric.length)issues.push('Identifiants d’exercices ou d’items dupliqués.');
 if(rubric.some(r=>!tasks.some(t=>t.id===r.taskId&&t.skills.includes(r.criterion)))||tasks.some(t=>t.skills.some(c=>!rubric.some(r=>r.taskId===t.id&&r.criterion===c))))issues.push('La grille doit couvrir exactement les critères annoncés par tâche.');
 if(tasks.some(t=>!t.instruction?.trim()||!t.expectedEvidence?.trim()||!t.reference?.trim()||!rubric.some(r=>r.taskId===t.id&&r.max>0)))issues.push('Chaque exercice doit avoir consigne, trace, correction et barème.');
 if(tasks.some(t=>!t.validationVariants?.alternative?.trim()||!t.validationVariants?.wrongExplanation?.trim()))issues.push('Documentez une alternative correcte et une erreur prévue pour chaque tâche.');
 if(ready&&!c.reviewed)issues.push('Relisez et resserrez les tâches avant de confirmer le budget estimé.');
 return issues;
}

export function requireDiagnosticV31(d){const issues=diagnosticV31Issues(d);if(issues.length)fail(422,'Diagnostic à compléter avant publication.',{issues});}

export function responseUnits(d,attemptId,lessonVersionId,answers={}){
 return d.tasks.flatMap(t=>{
  let content;try{content=JSON.parse(answers[t.id]||'null');}catch{}
  const parts=t.answerParts?.length?t.answerParts.map(p=>({key:p.id,label:p.label,value:content?.[p.id]})):t.correctionMode==='structured'&&t.options?.length?t.options.map((label,i)=>({key:String(i),label,value:content?.[i]})):[];
  if(Array.isArray(content?.files))for(const f of content.files)if(typeof f.path==='string'&&typeof f.content==='string')parts.push({key:'file:'+f.path,label:f.path,value:f.content});
  return [{key:'',label:t.title,value:answers[t.id]},...parts].map(p=>({id:'response_'+fingerprint([attemptId,lessonVersionId,t.id,t.itemVersion||1,p.key]),attemptId,lessonVersionId,taskId:t.id,itemVersion:t.itemVersion||1,partId:p.key||null,label:p.label,answer:typeof p.value==='string'?p.value:p.value==null?'':JSON.stringify(p.value)}));
 });
}

export function applyResponseComments(submission,old,input){
 const units=responseUnits(submission.diagnostic,submission.attemptId,submission.lessonVersionId,submission.answers),comments=input.responseComments??old.responseComments??[];
 requireValue(Array.isArray(comments)&&comments.length<=units.length&&unique(comments.map(c=>c.responseId)).length===comments.length,'Commentaires dupliqués ou invalides.');
 return comments.map(c=>{const unit=units.find(u=>u.id===c.responseId);requireValue(unit,'Commentaire sans ancrage dans cette copie.');requireValue(typeof c.text==='string'&&c.text.length<=4000,'Commentaire limité à 4 000 caractères.');return {responseId:unit.id,taskId:unit.taskId,itemVersion:unit.itemVersion,partId:unit.partId,text:c.text};});
}

export const isTimed=a=>a.timing?.version===DIAGNOSTIC_V31&&a.mode!=='practice';
export const deadlinePassed=(a,at=Date.now())=>isTimed(a)&&!a.timing.pausedAt&&!!a.timing.deadlineAt&&at>=Date.parse(a.timing.deadlineAt);
export function assertDiagnosticWriting(a){
 if(!isTimed(a))return;
 if(!a.timing.startedAt)fail(409,'Démarre explicitement le diagnostic avant de répondre.');
 if(a.timing.pausedAt)fail(409,'Diagnostic interrompu avec autorisation.');
 if(deadlinePassed(a))fail(409,'Le temps est écoulé. Seul le travail déjà reçu par le serveur est conservé dans la copie.',{deadlineAt:a.timing.deadlineAt,expired:true});
}

export async function beginDiagnostic(tx,a){
 if(!isTimed(a)||a.timing.startedAt)return a;
 const at=now();a.timing.startedAt=at;a.timing.deadlineAt=new Date(Date.parse(at)+(a.timing.standardMinutes+a.timing.extraMinutes)*60000).toISOString();
 a.status='started';await tx.put('assessment_attempts',a);return a;
}

export async function adjustDiagnosticTime(tx,actor,id,input){
 const a=await scoped(tx,'assessment_attempts',id,actor);
 requireValue(isTimed(a)&&!a.submissionId,'Cette copie ne peut plus être aménagée.');
 if(input.revision!==(a.timing.revision||0))fail(409,'Les aménagements ont changé.');
 requireValue(typeof input.reason==='string'&&input.reason.trim()&&input.reason.length<=2000,'Justifiez l’aménagement.');
 const at=now(),t=a.timing;
 if(input.action==='extend'){
  requireValue(Number.isInteger(input.minutes)&&input.minutes>0&&input.minutes<=180,'Extension de 1 à 180 minutes attendue.');
  requireValue(!deadlinePassed(a),'Une copie échue exige une récupération distincte.');t.extraMinutes+=input.minutes;
  if(t.deadlineAt)t.deadlineAt=new Date(Date.parse(t.deadlineAt)+input.minutes*60000).toISOString();
 }else if(input.action==='pause'){requireValue(t.startedAt&&!t.pausedAt&&!deadlinePassed(a),'Cette copie ne peut pas être interrompue.');t.pausedAt=at;}
 else if(input.action==='resume'){requireValue(t.pausedAt,'Aucune interruption en cours.');t.deadlineAt=new Date(Date.parse(t.deadlineAt)+Date.parse(at)-Date.parse(t.pausedAt)).toISOString();t.pausedAt=null;}
 else fail(400,'Aménagement inconnu.');
 t.revision=(t.revision||0)+1;t.history=[...(t.history||[]),{action:input.action,minutes:input.minutes||0,reason:input.reason,authorId:actor.id,at}];
 await tx.put('assessment_attempts',a);await tx.audit(actor,'diagnostic.accommodation',id,{revision:t.revision,action:input.action});return a;
}

export async function assertDiagnosticSourceCurrent(tx,actor,spec){
 const c=spec.diagnostic.contract;if(!c)return;const choice=await diagnosticSources(tx,actor,{date:spec.date,trackId:c.source?.trackId||null}),current=choice.candidates.find(s=>s.runId===c.source?.runId);if(!current||fingerprint(current)!==fingerprint(c.source))fail(409,'La source réalisée a changé. Confirmez un nouvel aperçu avant publication.');
}
