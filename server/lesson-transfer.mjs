import {randomUUID} from 'node:crypto';
import {uid,now,fail,requireValue,scoped} from './store.mjs';
import {LIMITS,encodePackage,decodePackage,contentFingerprint,fingerprint} from './lesson-package.mjs';
import {captureLesson,validatePayload,materialize,assertIdle} from './lesson-transfer-content.mjs';
import {compileCorpus} from './corpus.mjs';
import {qualityCheck,previousCompleted} from './generator.mjs';
import {publicationCodeChecks} from './publication-code.mjs';
import {runtimeManifest} from './pedagogy/policy.mjs';
import {sha256} from './content-snapshots.mjs';

const ttl=()=>new Date(Date.now()+24*3600000).toISOString();
function authorize(actor){if(actor?.role!=='teacher')fail(403,'Transfert réservé au professeur.');}
export async function ownedTransfer(tx,id,actor){authorize(actor);const t=await scoped(tx,'lesson_transfers',id,actor);if(t.actorId!==actor.id)fail(404,'Transfert introuvable.');if(t.expiresAt<now())fail(410,'Ce transfert a expiré. Choisissez de nouveau le fichier.');return t;}
async function cleanup(tx,actor){
 for(const t of await tx.list('lesson_transfers',actor.classId))if(t.expiresAt<now()){
  for(const c of await tx.list('lesson_transfer_chunks',actor.classId))if(c.transferId===t.id)await tx.remove('lesson_transfer_chunks',c.id);
  await tx.remove('lesson_transfers',t.id);
 }
}
export async function beginUpload(store,input,actor){
 authorize(actor);requireValue(Number.isInteger(input.bytes)&&input.bytes>0&&input.bytes<=LIMITS.archive&&/^[a-f0-9]{64}$/.test(input.sha256),'Archive limitée à 64 Mio ; empreinte requise.');
 return store.transaction(async tx=>{await cleanup(tx,actor);const pending=(await tx.list('lesson_transfers',actor.classId)).filter(t=>t.actorId===actor.id);if(pending.length>=10)fail(429,'Dix transferts sont conservés pendant 24 heures. Fermez un transfert avant de recommencer.');const t=await tx.insert('lesson_transfers',{id:uid('transfer'),classId:actor.classId,actorId:actor.id,kind:'import',bytes:input.bytes,sha256:input.sha256,chunks:Math.ceil(input.bytes/LIMITS.chunk),expiresAt:ttl()});return transferSummary(t);});
}
const transferSummary=t=>({id:t.id,bytes:t.bytes,sha256:t.sha256,chunks:t.chunks,chunkBytes:LIMITS.chunk,expiresAt:t.expiresAt});
export async function writeChunk(store,id,index,bytes,actor){
 requireValue(Buffer.isBuffer(bytes),'Fragment binaire attendu.');
 return store.transaction(async tx=>{const t=await ownedTransfer(tx,id,actor);requireValue(t.kind==='import'&&!t.sealed,'Transfert déjà analysé.');requireValue(Number.isInteger(index)&&index>=0&&index<t.chunks&&bytes.length===Math.min(LIMITS.chunk,t.bytes-index*LIMITS.chunk),'Fragment incomplet ou hors limites.');const key=`${id}:${index}`,old=await tx.get('lesson_transfer_chunks',key),hash=sha256(bytes);if(old){if(old.sha256!==hash)fail(409,'Ce fragment contient déjà d’autres données.');return {saved:true,index};}await tx.insert('lesson_transfer_chunks',{id:key,classId:actor.classId,transferId:id,index,sha256:hash,base64:bytes.toString('base64')});return {saved:true,index};});
}
export async function readTransfer(store,id,actor){
 const t=await ownedTransfer(store,id,actor),chunks=[];
 for(let i=0;i<t.chunks;i++){const c=await store.get('lesson_transfer_chunks',`${id}:${i}`);requireValue(c,'Transfert incomplet. Reprenez l’envoi du fichier.');const b=Buffer.from(c.base64,'base64');requireValue(sha256(b)===c.sha256,'Fragment altéré.');chunks.push(b);}
 const bytes=Buffer.concat(chunks);requireValue(bytes.length===t.bytes&&sha256(bytes)===t.sha256,'Archive transférée altérée.');return {t,bytes};
}
export async function exportLessons(store,ids,actor){
 authorize(actor);requireValue(Array.isArray(ids)&&ids.length>0&&ids.length<=LIMITS.lessons&&new Set(ids).size===ids.length,'Sélectionnez de 1 à 50 séances différentes.');
 const versions=new Map();
 for(const id of ids){const lesson=await scoped(store,'lessons',id,actor);versions.set(id,lesson.versionId);if(!(await store.list('corpus_packages',actor.classId)).some(p=>p.lessonVersionId===lesson.versionId))await compileCorpus(store,id,actor);}
 const files=new Map();
 const lessons=await store.transaction(async tx=>{await tx.lockTables();const rows=[];for(const id of ids){const lesson=await scoped(tx,'lessons',id,actor);if(lesson.versionId!==versions.get(id))fail(409,'Une séance a changé pendant la préparation de l’archive. Relancez l’export.');rows.push(await captureLesson(tx,lesson,actor,files));}return rows;});
 for(const l of lessons)validatePayload(l.payload,files);
 const {bytes,manifest}=await encodePackage(lessons,files);
 return store.transaction(async tx=>{await cleanup(tx,actor);const t=await tx.insert('lesson_transfers',{id:uid('export'),classId:actor.classId,actorId:actor.id,kind:'export',bytes:bytes.length,sha256:sha256(bytes),chunks:Math.ceil(bytes.length/LIMITS.chunk),expiresAt:ttl(),sealed:true});for(let i=0;i<t.chunks;i++){const chunk=bytes.subarray(i*LIMITS.chunk,(i+1)*LIMITS.chunk);await tx.insert('lesson_transfer_chunks',{id:`${t.id}:${i}`,classId:actor.classId,transferId:t.id,index:i,sha256:sha256(chunk),base64:chunk.toString('base64')});}return {...transferSummary(t),filename:`seances-${manifest.packageId.slice(0,8)}.tweenteach.zip`,external:[...new Set(lessons.flatMap(l=>l.payload.external))],count:lessons.length};});
}
const linkId=(classId,portableId)=>fingerprint([classId,portableId]);
async function matchLesson(tx,source,actor){
 const mapping=await tx.get('lesson_transfer_links',linkId(actor.classId,source.portableId));
 if(mapping){const target=await tx.get('lessons',mapping.lessonId);if(target?.classId===actor.classId)return target;}
 return (await tx.list('lessons',actor.classId)).find(l=>l.portableId===source.portableId)||null;
}
async function runtimeBlockers(caps){
 const blockers=[],manifest=runtimeManifest();
 for(const capability of caps.filter(c=>['dom','shell-git'].includes(c))){
  if(!manifest.profiles.find(p=>p.id===capability)?.available){blockers.push(`Laboratoire ${capability} indisponible sur cette instance.`);continue;}
  try{
   const host=new URL(process.env.EDEN_LAB_URL);if(host.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(host.hostname))throw Error('HTTPS required');
   const r=await fetch(new URL('/capabilities',host),{method:'POST',headers:{Authorization:`Bearer ${process.env.EDEN_LAB_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({profiles:[capability]}),signal:AbortSignal.timeout(30000)});
   const data=await r.json(),expected=process.env[capability==='dom'?'EDEN_LAB_DOM_IMAGE':'EDEN_LAB_SHELL_IMAGE'];
   if(!r.ok||data.probeVersion!==1||data[capability]!==expected)throw Error();
  }catch{blockers.push(`La disponibilité du laboratoire ${capability} n’a pas pu être confirmée. Vérifiez son hôte et son image.`);}
 }
 return blockers;
}
function differences(source,target){
 if(!target)return {added:source.spec.activities.length,removed:0,changed:0,resourcesChanged:true,contentChanged:true};
 const before=new Map(target.spec.activities.map(a=>[a.id,a])),after=new Map(source.spec.activities.map(a=>[a.id,a]));
 return {added:[...after.keys()].filter(id=>!before.has(id)).length,removed:[...before.keys()].filter(id=>!after.has(id)).length,changed:[...after].filter(([id,a])=>before.has(id)&&fingerprint(a)!==fingerprint(before.get(id))).length,resourcesChanged:fingerprint([source.assets,source.documents,source.corpus])!==fingerprint([target.assets,target.documents,target.corpus]),contentChanged:contentFingerprint(source)!==contentFingerprint(target)};
}
async function proposedLesson(tx,source,choice,target,actor,files){
 const old=target?await scoped(tx,'lesson_versions',target.versionId,actor):null;
 const entryId=choice.entryId===undefined?(target?.planEntryId||old?.spec.planEntryId||''):choice.entryId;
 const entry=entryId?await scoped(tx,'plan_entries',entryId,actor):null;
 const plans=await tx.list('plan_versions',actor.classId),plan=plans.at(-1)||null;
 const date=entry?.date||target?.date||source.date;
 const previous=previousCompleted(await tx.list('lesson_runs',actor.classId),date),prior=previous?await tx.get('lessons',previous.lessonId):null;
 const origin=source.payload.context.diagnosticSource,mapped=origin?await matchLesson(tx,{portableId:origin.portableId},actor):null;
 const sourceMatches=source.payload.spec.diagnostic.kind==='baseline'?!previous:!!(prior&&mapped?.id===prior.id);
 const id=target?.id||`${actor.classId}:import-${randomUUID()}`,lessonId=old?.spec.lessonId||id.slice(actor.classId.length+1),version=(target?.version||0)+1;
 const content=await materialize(source.payload,files,{classId:actor.classId,actorId:actor.id,lessonId,version,date,entry,plan,previous,sourceMatches});
 if(!entry)content.spec.sequence=target?old.spec.sequence:source.sequence;
 const curriculum=plan?await tx.get('curriculum_versions',plan.curriculumVersion):null;
 const fallback={id:'',date,duration:source.payload.context.entry.duration||0,durationConfirmed:false,status:'planned'};
 const quality=qualityCheck(content.spec,{entry:entry||fallback,criteria:curriculum?.criteria||source.payload.context.criteria,previous,corpusComplete:source.payload.corpus.complete});
 quality.checks.push({id:'transfer_preparation',ok:!source.payload.preparation.incomplete,message:'La préparation source doit être terminée ou reprise explicitement en brouillon professeur.'});
 quality.checks.push({id:'transfer_review',ok:!source.payload.preparation.requiresReview||choice.reviewed===true,message:'Relisez cette préparation puis confirmez votre reprise sous responsabilité professeur.'});
 quality.checks.push({id:'transfer_attachment',ok:!!entry&&!!plan,message:'Choisissez un créneau existant avant de publier.'});
 quality.publishable=quality.checks.every(c=>c.ok);
 return {id,version,versionId:`${id}:v${version}`,content,quality,entry,plan,date};
}
async function analyze(tx,pack,actor,choicesInput,{forcedTarget=null,capabilityIssues=[]}={}){
 const choices=[],rows=[],targets=new Set(),lessons=await tx.list('lessons',actor.classId),supplied=new Map();
 if(choicesInput!==undefined){requireValue(Array.isArray(choicesInput)&&choicesInput.length===pack.lessons.length,'Choisissez une action pour chaque séance.');for(const c of choicesInput){requireValue(c&&typeof c.portableId==='string'&&!supplied.has(c.portableId)&&pack.lessons.some(s=>s.portableId===c.portableId),'Sélection incohérente.');requireValue(Object.keys(c).every(k=>['portableId','action','targetId','entryId','reviewed'].includes(k)),'Choix non reconnu.');supplied.set(c.portableId,c);}}
 if(forcedTarget)await scoped(tx,'lessons',forcedTarget,actor);
 for(const source of pack.lessons){
  const matched=await matchLesson(tx,source,actor),choice={...(supplied.get(source.portableId)||{portableId:source.portableId,action:forcedTarget?(pack.lessons.length===1?'replace':'ignore'):matched?'replace':'add',targetId:forcedTarget||matched?.id||null})};
  requireValue(['add','replace','ignore'].includes(choice.action),'Action d’import inconnue.');
  if(choice.action!=='replace')choice.targetId=null;
  if(choice.action==='ignore'){delete choice.entryId;delete choice.reviewed;}
  let target=choice.action==='replace'?await scoped(tx,'lessons',choice.targetId,actor):null;
  const blockers=[],warnings=[];let current=null,proposal=null,identical=false;
  try{
   const caps=validatePayload(source.payload,pack.files);warnings.push(...source.payload.external.map(u=>`Lien externe conservé : ${u}`));blockers.push(...capabilityIssues.filter(i=>caps.includes(i.capability)).map(i=>i.message));
   if(target){
    if(target.editorDraftVersionId)warnings.push('Un brouillon de modification existe. Le remplacement sélectionnera le contenu importé ; l’ancien brouillon restera dans l’historique.');
    if(targets.has(target.id))blockers.push('Deux séances sélectionnées remplacent la même cible. Modifiez votre sélection.');targets.add(target.id);
    if(!['draft','published'].includes(target.status))blockers.push('Cette séance est clôturée. Ajoutez une préparation distincte.');
    await assertIdle(tx,target,actor);
    current=(await captureLesson(tx,target,actor,new Map(),{identity:false})).payload;
    identical=contentFingerprint(current)===source.revision;
   }
   proposal=await proposedLesson(tx,source,choice,target,actor,pack.files);
   if(target?.status==='published'&&!identical)blockers.push(...proposal.quality.checks.filter(c=>!c.ok).map(c=>c.message));
   if(choice.action==='add'&&matched)warnings.push('Une copie indépendante sera créée ; la correspondance existante sera conservée.');
   if(!proposal.entry)warnings.push('Préparation sans créneau. Vos objectifs sont conservés ; choisissez un créneau pour publier.');
   if(source.payload.preparation.incomplete)warnings.push('Préparation incomplète : elle restera à relire.');
  }catch(error){blockers.push(error.status?error.message:'Ressource ou configuration de séance invalide.');}
  if(identical&&choice.entryId!==undefined&&choice.entryId!==(target.planEntryId||(await tx.get('lesson_versions',target.versionId)).spec.planEntryId))identical=false;
  const expected=target?fingerprint(target):null;
  choices.push(choice);
  rows.push({portableId:source.portableId,title:source.title,date:source.date,action:choice.action,targetId:target?.id||choice.targetId,targetTitle:target?.title||null,targetDate:target?.date||null,status:identical?'identical':target?'matched':matched?'matched':'new',differences:differences(source.payload,current),blockers:choice.action==='ignore'?[]:blockers,warnings,expected,identical,requiresReview:source.payload.preparation.requiresReview,publication:target?.status==='published'?'Le nouveau contenu sera visible aux élèves après validation. Le lien et la visibilité restent identiques.':'Ajout ou remplacement en brouillon ; publication séparée.',destinationDate:proposal?.date||source.date});
 }
 const active=rows.filter(r=>r.action!=='ignore');
 const contextHash=fingerprint({targets:rows.filter(r=>r.action==='replace').map(r=>[r.targetId,r.expected]),plans:await tx.list('plan_versions',actor.classId),entries:await tx.list('plan_entries',actor.classId),runs:await tx.list('lesson_runs',actor.classId),links:await tx.list('lesson_transfer_links',actor.classId),identities:lessons.map(l=>[l.id,l.portableId])});
 return {rows,choices,contextHash,canApply:active.length>0&&active.every(r=>!r.blockers.length),counts:{add:active.filter(r=>r.action==='add').length,replace:active.filter(r=>r.action==='replace'&&!r.identical).length,identical:active.filter(r=>r.identical).length},targets:lessons.filter(l=>['draft','published'].includes(l.status)).map(l=>({id:l.id,title:l.title,date:l.date,status:l.status})),entries:(await tx.list('plan_entries',actor.classId)).map(e=>({id:e.id,date:e.date,title:e.objective,status:e.status}))};
}
async function availability(pack){const issues=[];for(const capability of new Set(pack.lessons.flatMap(l=>l.capabilities)))for(const message of await runtimeBlockers([capability]))issues.push({capability,message});return issues;}
export async function previewTransfer(store,id,input,actor){
 const {t,bytes}=await readTransfer(store,id,actor);requireValue(t.kind==='import','Choisissez une archive à importer.');const pack=await decodePackage(bytes),capabilityIssues=await availability(pack);
 return store.transaction(async tx=>{const transfer=await ownedTransfer(tx,id,actor),analysis=await analyze(tx,pack,actor,input.choices,{forcedTarget:input.targetId,capabilityIssues}),token=randomUUID();transfer.sealed=true;transfer.review={token,choices:analysis.choices,contextHash:analysis.contextHash};await tx.put('lesson_transfers',transfer);return {...analysis,token,transferId:id};});
}
export async function applyTransfer(store,id,input,actor){
 requireValue(input.confirmed===true&&typeof input.token==='string','Confirmez le récapitulatif avant application.');
 const {t,bytes}=await readTransfer(store,id,actor);
 // Response loss and double click return the original receipt even if the
 // destination has advanced since the successful operation.
 const receiptId=fingerprint([actor.classId,actor.id,id,input.token]),old=await store.get('lesson_transfer_receipts',receiptId);if(old)return old.result;
 if(t.review?.token!==input.token)fail(409,'Le récapitulatif a changé. Analysez de nouveau votre sélection.');
 const pack=await decodePackage(bytes),capabilityIssues=await availability(pack);
 return store.transaction(async tx=>{
  await tx.lockTables();const transfer=await ownedTransfer(tx,id,actor),receipt=await tx.get('lesson_transfer_receipts',receiptId);if(receipt)return receipt.result;
  if(transfer.review?.token!==input.token)fail(409,'Le récapitulatif a changé. Analysez de nouveau votre sélection.');
  const review=transfer.review,operationId=fingerprint([actor.classId,actor.id,pack.sha256,review.choices]);
  const analysis=await analyze(tx,pack,actor,review.choices,{capabilityIssues});
  if(analysis.contextHash!==review.contextHash)fail(409,'Une cible ou son planning a changé depuis le récapitulatif. Comparez de nouveau avant de remplacer.');
  if(!analysis.canApply)fail(422,'Le lot comporte des blocages. Actualisez le récapitulatif.',analysis.rows);
  const result={status:'imported',lessons:[]};
  for(const row of analysis.rows){
   if(row.action==='ignore')continue;
   const source=pack.lessons.find(s=>s.portableId===row.portableId),choice=analysis.choices.find(c=>c.portableId===row.portableId),target=row.action==='replace'?await scoped(tx,'lessons',row.targetId,actor):null;
   if(row.identical){await txPutLink(tx,actor,source.portableId,target.id);result.lessons.push({id:target.id,title:target.title,status:'identical',version:target.version});continue;}
   const proposal=await proposedLesson(tx,source,choice,target,actor,pack.files),{content,version,versionId}=proposal;
   // Analysis never executes educational code. Publication repeats the existing
   // isolated correction validation only after the final teacher confirmation.
   if(target?.status==='published'){
    const checks=await publicationCodeChecks(content.spec);if(checks.some(c=>!c.ok))fail(422,'Un corrigé ne satisfait pas les validations de publication. Aucun élément du lot n’a été appliqué.',checks.filter(c=>!c.ok));
   }
   for(const asset of content.assets)if(!await tx.get('lesson_assets',asset.id))await tx.insert('lesson_assets',asset);
   for(const document of content.documents)if(!await tx.get('pedagogical_sources',document.id))await tx.insert('pedagogical_sources',document);
   if(content.mission&&!await tx.get('game_missions',content.mission.id))await tx.insert('game_missions',content.mission);
   const matched=await matchLesson(tx,source,actor),portableId=target?.portableId||(row.action==='add'&&matched?randomUUID():source.portableId);
   const lesson={...target,id:proposal.id,classId:actor.classId,authorId:target?.authorId||actor.id,portableId,version,versionId,date:proposal.date,title:content.spec.title,planEntryId:proposal.entry?.id||'',status:target?.status||'draft',provider:'transfer',quality:proposal.quality,qualityRequired:source.payload.preparation.incomplete||source.payload.preparation.requiresReview&&!choice.reviewed,preparationState:source.payload.preparation.incomplete?'incomplete':'teacher_draft',transferContext:source.payload.context,transferPreparation:source.payload.preparation,transferReview:choice.reviewed?{actorId:actor.id,at:now()}:null};
   delete lesson.editorDraftVersionId;delete lesson.qualityJobId;delete lesson.pedagogicalValidation;delete lesson.diagnosticVersionId;delete lesson.teacherReview;delete lesson.agentRunId;
   await tx.insert('lesson_versions',{id:versionId,classId:actor.classId,lessonId:lesson.id,version,spec:content.spec,designContract:source.payload.designContract,transferSourceIds:content.documents.map(d=>d.id),previousVersionId:target?.versionId||null,authorId:actor.id,reason:'Import de préparation professeur'});
   const files=source.payload.corpus.files.map(file=>({...file,base64:pack.files.get(file.sha256).toString('base64')})),corpusId=uid('corpus');
   if(files.length)await tx.insert('corpus_packages',{id:corpusId,classId:actor.classId,lessonId:lesson.id,lessonVersionId:versionId,version,complete:source.payload.corpus.complete,files,manifest:{schemaVersion:2,lessonId:content.spec.lessonId,lessonVersionId:versionId,lessonVersion:version,classId:actor.classId,generatedAt:now(),completeness:source.payload.corpus.complete?'complete':'partial',missing:source.payload.corpus.complete?[]:['Préparation source incomplète.'],files:source.payload.corpus.files}});
   if(target?.status==='published'){
    const publication=await tx.insert('lesson_publications',{id:uid('publication'),classId:actor.classId,lessonId:lesson.id,lessonVersionId:versionId,version,publishedBy:actor.id,publishedAt:now(),corpusId});lesson.publicationId=publication.id;
    // Version separation prevents old work and arcade saves crediting new tasks.
    const run=await tx.insert('lesson_runs',{id:uid('lessonrun'),classId:actor.classId,lessonId:lesson.id,lessonVersionId:versionId,date:lesson.date,status:'planned',eligibleForDiagnostic:false,coveredSkills:[],coveredActivityIds:[],coveredContent:'',reactivatedPrerequisites:[],closedAt:null,previousRunId:target.runId});lesson.runId=run.id;
   }
   if(target)await tx.put('lessons',lesson);else await tx.insert('lessons',lesson);
   if(row.action==='replace'||!matched)await txPutLink(tx,actor,source.portableId,lesson.id);
   await tx.audit(actor,'lesson.transferred',lesson.id,{packageId:pack.manifest.packageId,version,action:row.action,revision:source.revision});
   result.lessons.push({id:lesson.id,title:lesson.title,status:row.action==='add'?'added':'replaced',version,publication:lesson.status});
  }
  await tx.insert('lesson_transfer_receipts',{id:receiptId,classId:actor.classId,actorId:actor.id,operationId,result});return result;
 });
}
async function txPutLink(tx,actor,portableId,lessonId){const id=linkId(actor.classId,portableId),record={id,classId:actor.classId,portableId,lessonId};if(await tx.get('lesson_transfer_links',id))await tx.put('lesson_transfer_links',record);else await tx.insert('lesson_transfer_links',record);}
export async function removeTransfer(store,id,actor){return store.transaction(async tx=>{await ownedTransfer(tx,id,actor);for(const c of await tx.list('lesson_transfer_chunks',actor.classId))if(c.transferId===id)await tx.remove('lesson_transfer_chunks',c.id);await tx.remove('lesson_transfers',id);return {removed:true};});}
