import {exportPedagogy,validatePortablePedagogy} from './competency-transfer.mjs';
import {readFile,realpath} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {scoped,fail,requireValue} from './store.mjs';
import {artifactBuffer} from './artifacts.mjs';
import {originalDocument} from './pedagogy/documents.mjs';
import {authorizedSource} from './pedagogy/documentary-index.mjs';
import {publicationGate} from './pedagogy/quality.mjs';
import {explorationForMission} from './game.mjs';
import {sha256,safeContentPath} from './content-snapshots.mjs';
import {assertKeys,normalizedSpec,validateReferences,capabilities,fingerprint,LIMITS} from './lesson-package.mjs';

const pick=(obj,keys)=>Object.fromEntries(keys.filter(k=>obj?.[k]!==undefined).map(k=>[k,structuredClone(obj[k])]));
const missionFields=['world','title','brief','files','starterFiles','scenarios','validator','resources','competencies','prerequisites','completionRule','hints','objectives','exploration','type','description','difficulty','duration','instructions','solution','reference'];
const sourceFields=['title','filename','role','visibility','author','sourceURL','declaredVersion','contentHash','status','warnings','segments'];
const active=['queued','running','retry_wait'];
function addResource(files,hash,bytes){
 requireValue(Buffer.isBuffer(bytes)&&bytes.length<=LIMITS.file,'Une ressource dépasse la limite de 16 Mio.');
 if(!files.has(hash)){const total=[...files.values()].reduce((n,b)=>n+b.length,0)+bytes.length;requireValue(files.size<LIMITS.files-51&&total<=LIMITS.expanded,'Le paquet dépasse les limites de fichiers ou de taille décompressée. Réduisez la sélection.');files.set(hash,bytes);}
}

export async function assertIdle(tx,lesson,actor){
 if((await tx.list('generation_jobs',actor.classId)).some(j=>j.lessonId===lesson.id&&active.includes(j.status)))fail(409,'Une génération est en cours sur cette séance. Attendez sa fin ou annulez-la.');
 if((await tx.list('lesson_adaptations',actor.classId)).some(j=>j.lessonId===lesson.id&&j.status==='running'))fail(409,'Une modification est en cours sur cette séance. Attendez sa fin.');
}
export async function ensurePortable(tx,lesson){
 if(!lesson.portableId){lesson.portableId=randomUUID();await tx.put('lessons',lesson);}return lesson.portableId;
}
const mimeFor=path=>({'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.svg':'image/svg+xml','.pdf':'application/pdf','.txt':'text/plain','.css':'text/css','.js':'text/javascript'})[extname(path).toLowerCase()]||'application/octet-stream';
const localURL=u=>['localhost','127.0.0.1','[::1]'].includes(u.hostname)||u.hostname.endsWith('.localhost');
const temporary=u=>/x-amz-|x-goog-|signature|token|expires/i.test(u.search);
async function mapStrings(value,fn,path=[]){
 if(typeof value==='string')return fn(value,path);
 if(Array.isArray(value))return Promise.all(value.map((v,i)=>mapStrings(v,fn,[...path,i])));
 if(value&&typeof value==='object')return Object.fromEntries(await Promise.all(Object.entries(value).map(async([k,v])=>[k,await mapStrings(v,fn,[...path,k])])));
 return value;
}
// No arbitrary local reads and no fetching an URL supplied by an archive.
// Public bundled assets and authenticated EDEN sources are the only resolvers.
async function portableLinks(value,tx,actor,files,external){
 return mapStrings(value,async text=>{
  text=text.replace(/data:(image\/(?:png|jpeg|webp|gif|svg\+xml));base64,([A-Za-z0-9+/=]+)/g,(_all,mime,encoded)=>{const bytes=Buffer.from(encoded,'base64'),hash=sha256(bytes);addResource(files,hash,bytes);return `tweenteach-file:${hash}:${mime}`;});
  const urls=[...new Set(text.match(/(?:https?:\/\/|file:\/\/|\/api\/(?:lesson-assets|lesson-transfer-files)\/|\/assets\/)[^\s<>"')\]\\]+/g)||[])];
  for(const url of urls){
   let parsed;try{parsed=new URL(url,'http://localhost');}catch{fail(422,'Lien de ressource invalide.');}
   if(parsed.protocol==='file:')fail(422,'Une ressource utilise un chemin de fichier local. Importez-la dans les ressources de la séance avant l’export.');
   if(parsed.username||parsed.password)fail(422,'Un lien de ressource contient des identifiants.');
   if(!localURL(parsed)){
    if(temporary(parsed))fail(422,'Un lien de téléchargement temporaire doit être importé comme document avant l’export.');
    external.add(parsed.href);continue;
   }
   let bytes,mime;
   if(parsed.pathname.startsWith('/assets/')){
    const base=await realpath(resolve('public/assets')),path=await realpath(resolve('public','.'+decodeURIComponent(parsed.pathname))).catch(()=>null);
    requireValue(path&&path.startsWith(base+sep),'Ressource locale absente ou hors du dossier public/assets.');bytes=await readFile(path);mime=mimeFor(path);
   }else if(/^\/api\/(lesson-assets|lesson-transfer-files)\/[a-f0-9]{64}$/.test(parsed.pathname)){
    const asset=await scoped(tx,'lesson_assets',parsed.pathname.split('/').at(-1),actor);bytes=Buffer.from(asset.base64,'base64');requireValue(sha256(bytes)===asset.sha256,'Ressource altérée.');mime=asset.mimeType;
   }else fail(422,'Une ressource dépend de localhost et ne peut pas être transportée. Importez son fichier dans la séance.');
   const hash=sha256(bytes);addResource(files,hash,bytes);
   text=text.split(url).join(`tweenteach-file:${hash}:${mime}`);
  }
  if(/(?:^|["'(\s])(?:\/Users\/|\/home\/|[A-Za-z]:\\)/.test(text))fail(422,'Un chemin absolu local subsiste dans le contenu. Remplacez-le par un support embarqué.');
  return text;
 });
}
export async function captureLesson(tx,lesson,actor,files,{identity=true}={}){
 const version=await scoped(tx,'lesson_versions',lesson.versionId,actor),original=structuredClone(version.spec);
 validateReferences(original);
 const portableId=identity?await ensurePortable(tx,lesson):lesson.portableId;
 const spec=normalizedSpec(original),assets=[],documents=[],external=new Set();
 for(const task of [...spec.activities,...spec.diagnostic.tasks])if(task.workshop?.visual){
  const asset=await scoped(tx,'lesson_assets',task.workshop.visual.id,actor),bytes=Buffer.from(asset.base64,'base64');
  requireValue(sha256(bytes)===asset.sha256,'Illustration manquante ou altérée.');addResource(files,asset.sha256,bytes);
  task.workshop.visual.id=asset.sha256;if(!assets.some(a=>a.sha256===asset.sha256))assets.push({...pick(asset,['mimeType','width','height']),sha256:asset.sha256});
 }
 const sourceIds=new Set(spec.blocks.flatMap(b=>b.depth?.citations?.map(c=>c.sourceId)||[]));
 const job=lesson.qualityJobId?await tx.get('generation_jobs',lesson.qualityJobId):null;for(const id of job?.sourceIds||[])sourceIds.add(id);
 for(const id of version.transferSourceIds||[])sourceIds.add(id);
 for(const id of sourceIds){
  const source=await authorizedSource(tx,id,actor),bytes=await originalDocument(source),hash=sha256(bytes);addResource(files,hash,bytes);
  const doc=pick(source,sourceFields);doc.sha256=hash;doc.key=hash;
  const segmentMap=new Map(doc.segments.map((s,i)=>[s.id,`${hash}:s${i+1}`]));
  doc.segments=doc.segments.map(s=>({...pick(s,['parent','location','blocks','text','visibility']),id:segmentMap.get(s.id)}));
  for(const block of spec.blocks)for(const citation of block.depth?.citations||[])if(citation.sourceId===id){requireValue(segmentMap.has(citation.segmentId),'Citation vers un segment absent.');citation.sourceId=hash;citation.segmentId=segmentMap.get(citation.segmentId);}
  documents.push(doc);
 }
 const storedMission=original.codeStation?await scoped(tx,'game_missions',original.codeStation.missionId,actor):null;
 const mission=storedMission?pick(storedMission,missionFields):null;
 if(mission){const compiled=explorationForMission({...mission,id:'portable-mission',localId:storedMission.portableLocalId||storedMission.localId,version:1});mission.localId=storedMission.portableLocalId||storedMission.localId;requireValue(!original.codeStation.mapId||compiled.map.id===original.codeStation.mapId,'Carte de mission incohérente.');}
 const pack=(await tx.list('corpus_packages',actor.classId)).find(c=>c.lessonVersionId===lesson.versionId);
 const corpus={complete:!!pack?.complete,files:[]};
 if(pack)for(const file of pack.files){
  // This derived workbook contains learner identities and is never portable.
  if(file.path==='03_PROFESSEUR/groupes-remediation.xlsx'||file.path==='00_MANIFEST/manifest.json')continue;
  safeContentPath(file.path);let bytes=await artifactBuffer(file);
  if(/\.(?:html?|css|js|mjs|json|txt|svg)$/i.test(file.path)){
   const portable=await portableLinks(bytes.toString('utf8'),tx,actor,files,external);
   bytes=Buffer.from(portable.replace(/tweenteach-file:([a-f0-9]{64}):([\w.+-]+\/[\w.+-]+)/g,(_m,hash,mime)=>`data:${mime};base64,${files.get(hash).toString('base64')}`));
  }
  const hash=sha256(bytes);addResource(files,hash,bytes);
  corpus.files.push({path:file.path,audience:file.audience,mimeType:file.mimeType,sha256:hash,bytes:bytes.length});
 }
 const entry=await tx.get('plan_entries',original.planEntryId),curriculum=await tx.get('curriculum_versions',original.sourceVersions.curriculumVersion);
 const codes=new Set([...spec.skills,...spec.prerequisites,...spec.blocks.flatMap(b=>b.skills),...spec.activities.flatMap(a=>a.skills),...spec.diagnostic.criteria,...spec.diagnostic.tasks.flatMap(a=>a.skills)]);
 const previousRun=original.diagnostic.sourceLessonRunId?await tx.get('lesson_runs',original.diagnostic.sourceLessonRunId):null;
 const previousLesson=previousRun?await tx.get('lessons',previousRun.lessonId):null;
 const context=lesson.transferContext||{entry:pick(entry,['duration','durationConfirmed','objective','activity']),criteria:(curriculum?.criteria||[]).filter(c=>codes.has(c.n3_code)),diagnosticSource:previousLesson?{portableId:identity?await ensurePortable(tx,previousLesson):previousLesson.portableId||'unmapped',title:previousLesson.title,date:previousLesson.date}:null};
 const gate=await publicationGate(tx,lesson,original);
 const preparation=lesson.transferPreparation||{requiresReview:!!lesson.qualityRequired,incomplete:lesson.qualityRequired===true&&(gate.some(c=>!c.ok)||!pack?.complete),state:lesson.preparationState||'teacher_draft'};
 const pedagogy=await exportPedagogy(tx,actor,version);
 const payload={...(pedagogy?{pedagogy}:{}),spec,context,assets:assets.sort((a,b)=>a.sha256.localeCompare(b.sha256)),documents:documents.sort((a,b)=>a.key.localeCompare(b.key)),mission,corpus,preparation,designContract:version.designContract||null,external:[]};
 const portable=await portableLinks(payload,tx,actor,files,external);portable.external=[...external].sort();
 return {portableId,date:lesson.date,sequence:original.sequence,payload:portable};
}
export function validatePayload(payload,files){
 validatePortablePedagogy(payload.pedagogy);
 assertKeys(payload.context,['entry','criteria','diagnosticSource']);assertKeys(payload.context.entry,['duration','durationConfirmed','objective','activity']);
 requireValue(Array.isArray(payload.context.criteria)&&Array.isArray(payload.assets)&&Array.isArray(payload.documents)&&Array.isArray(payload.external),'Contexte ou ressources invalides.');
 assertKeys(payload.preparation,['requiresReview','incomplete','state']);requireValue(typeof payload.preparation.requiresReview==='boolean'&&typeof payload.preparation.incomplete==='boolean'&&typeof payload.preparation.state==='string','État de préparation invalide.');
 assertKeys(payload.corpus,['complete','files']);requireValue(typeof payload.corpus.complete==='boolean'&&Array.isArray(payload.corpus.files),'Supports invalides.');
 const need=hash=>requireValue(/^[a-f0-9]{64}$/.test(hash)&&files.has(hash),'Ressource indispensable absente du paquet.');
 const paths=new Set();for(const file of payload.corpus.files){assertKeys(file,['path','audience','mimeType','sha256','bytes']);safeContentPath(file.path);requireValue(!paths.has(file.path)&&['teacher','student'].includes(file.audience)&&typeof file.mimeType==='string','Support dupliqué ou audience invalide.');paths.add(file.path);need(file.sha256);requireValue(files.get(file.sha256).length===file.bytes,'Taille de support incohérente.');requireValue(file.path!=='03_PROFESSEUR/groupes-remediation.xlsx','Le paquet contient des données élèves interdites.');}
 for(const asset of payload.assets){assertKeys(asset,['sha256','mimeType','width','height']);need(asset.sha256);requireValue(asset.mimeType==='image/png','Type d’illustration non pris en charge.');}
 for(const a of [...payload.spec.activities,...payload.spec.diagnostic.tasks])if(a.workshop?.visual)requireValue(payload.assets.some(v=>v.sha256===a.workshop.visual.id),'Illustration référencée absente.');
 for(const doc of payload.documents){assertKeys(doc,[...sourceFields,'sha256','key']);need(doc.sha256);requireValue(doc.key===doc.sha256&&Array.isArray(doc.segments)&&['student','teacher'].includes(doc.visibility),'Source invalide.');}
 for(const block of payload.spec.blocks)for(const c of block.depth?.citations||[])requireValue(payload.documents.some(d=>d.key===c.sourceId&&d.segments.some(s=>s.id===c.segmentId)),'Citation sans source transportée.');
 if(payload.mission){assertKeys(payload.mission,[...missionFields,'localId']);requireValue(payload.spec.codeStation,'Mission sans affectation.');explorationForMission({...payload.mission,id:'portable-mission',version:1});for(const path of Object.keys(payload.mission.files||{}))safeContentPath(path);}
 requireValue(!!payload.spec.codeStation===!!payload.mission,'Configuration de mission absente.');
 requireValue(payload.external.every(u=>typeof u==='string'&&/^https?:\/\//.test(u)),'Dépendance externe invalide.');
 const text=JSON.stringify(payload);for(const match of text.matchAll(/tweenteach-file:([a-f0-9]{64}):([\w.+-]+\/[\w.+-]+)/g))need(match[1]);
 requireValue(!/https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?=[:/])|file:\/\//i.test(text),'Lien local non transporté.');
 return capabilities(payload.spec);
}
export async function materialize(payload,files,{classId,actorId,lessonId,version,date,entry,plan,previous,sourceMatches}){
 const assets=[],documents=[],spec=structuredClone(payload.spec);
 for(const asset of payload.assets){const id=fingerprint([classId,'visual',asset.sha256]);assets.push({...asset,id,classId,kind:'reference-render',base64:files.get(asset.sha256).toString('base64')});for(const a of [...spec.activities,...spec.diagnostic.tasks])if(a.workshop?.visual?.id===asset.sha256)a.workshop.visual.id=id;}
 for(const doc of payload.documents){const id=fingerprint([classId,actorId,'document',doc.sha256]),map=new Map(doc.segments.map((s,i)=>[s.id,`${id}:s${i+1}`]));documents.push({...doc,id,classId,ownerId:actorId,access:{teacherIds:[actorId],revoked:false},documentId:id,sourceKey:doc.filename,version:1,original:{sha256:doc.sha256,bytes:files.get(doc.sha256).length,base64:files.get(doc.sha256).toString('base64')},segments:doc.segments.map(s=>({...s,id:map.get(s.id)}))});for(const block of spec.blocks)for(const c of block.depth?.citations||[])if(c.sourceId===doc.key){c.sourceId=id;c.segmentId=map.get(c.segmentId);}}
 let mission=null;if(payload.mission){const id=fingerprint([classId,'mission',payload.mission]);mission={...payload.mission,id,classId,localId:`transfer-${id}`,version:1,status:'validated',templateId:'portable',portableLocalId:payload.mission.localId};spec.codeStation.missionId=id;spec.codeStation.missionVersion=1;spec.codeStation.missionSignature=explorationForMission(mission).signature;}
 Object.assign(spec,{lessonId,lessonVersion:version,classId,date,planEntryId:entry?.id||'',planVersion:plan?.version||0,sequence:entry?.sequence||''});
 spec.sourceVersions={curriculumVersion:plan?.curriculumVersion||'',planVersion:plan?.version||0,previousLessonRunId:sourceMatches?previous?.id||null:null};
 spec.diagnostic.id=`${lessonId}:diagnostic:v${version}`;spec.diagnostic.sourceLessonRunId=sourceMatches?previous?.id||null:null;spec.diagnostic.sourceLessonVersion=sourceMatches?previous?.lessonVersionId||null:null;
 const linked=await mapStrings(spec,(text,path)=>text.replace(/tweenteach-file:([a-f0-9]{64}):([\w.+-]+\/[\w.+-]+)/g,(_m,hash,mime)=>{
  const id=fingerprint([classId,'file',hash]);if(!assets.some(a=>a.id===id))assets.push({id,classId,kind:'portable-file',mimeType:mime,sha256:hash,base64:files.get(hash).toString('base64')});
  return path.at(-1)!=='src'&&/^image\/(?:png|jpeg|webp|gif|svg\+xml)$/.test(mime)?`data:${mime};base64,${files.get(hash).toString('base64')}`:`/api/lesson-transfer-files/${id}`;
 }));
 return {spec:linked,assets,documents,mission};
}
