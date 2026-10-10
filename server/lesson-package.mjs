import {validateEditorContent} from './lesson-editor-validation.mjs';
import JSZip from 'jszip';
import {inflateRawSync} from 'node:zlib';
import {randomUUID} from 'node:crypto';
import {canonical,sha256,safeContentPath} from './content-snapshots.mjs';
import {validate,lessonSchema} from './contracts.mjs';
import {fail,requireValue} from './store.mjs';

export const LIMITS=Object.freeze({archive:64*1024*1024,expanded:128*1024*1024,file:16*1024*1024,files:1000,lessons:50,chunk:1024*1024});
export const fingerprint=value=>sha256(canonical(value));
export const filePath=hash=>`files/${hash}`;
const check=(ok,message)=>{if(!ok)fail(422,message);};
export function assertKeys(value,keys){check(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>keys.includes(k)),'Champ inconnu dans le paquet.');}
export function validateReferences(spec){
 validate(lessonSchema,spec);
 validateEditorContent(spec);
 const unique=items=>new Set(items).size===items.length;
 check(unique(spec.blocks.map(b=>b.id))&&unique([...spec.activities,...spec.diagnostic.tasks].map(a=>a.id)),'Identifiants d’activités ou de blocs dupliqués.');
 check(spec.blocks.every(b=>b.activityIds.every(id=>spec.activities.some(a=>a.id===id)))&&spec.studentFlow.every(id=>spec.blocks.some(b=>b.id===id)),'Référence de bloc ou d’activité manquante.');
 check(spec.timeline.length===spec.blocks.length&&spec.timeline.every((t,i)=>t.blockId===spec.blocks[i].id&&t.minutes===spec.blocks[i].minutes),'Déroulé incohérent.');
 check(spec.diagnostic.rubric.every(r=>spec.diagnostic.tasks.some(a=>a.id===r.taskId)),'Référence de diagnostic manquante.');
 for(const a of [...spec.activities,...spec.diagnostic.tasks]){
  const paths=new Set();for(const file of a.workshop?.files||[]){safeContentPath(file.path);check(!paths.has(file.path),'Fichier de départ dupliqué.');paths.add(file.path);}
  const files=a.workshop?.files||[];
  if(a.workshop?.profile==='dom')check(files.length===3&&files.every(f=>['index.html','style.css','main.js'].includes(f.path)&&Buffer.byteLength(f.content)<=30000),'Projet DOM invalide : index.html, style.css et main.js, 30 Ko par fichier.');
  if(a.workshop?.profile==='shell-git')check(files.length<=1000&&files.every(f=>Buffer.byteLength(f.content)<=65536)&&files.reduce((n,f)=>n+Buffer.byteLength(f.content),0)<=512000,'Projet shell au-delà des quotas du laboratoire.');

 }
}
// Archive payloads contain portable placeholders. These destination properties
// deliberately do not contribute to a pedagogical revision.
export function normalizedSpec(original){
 const spec=structuredClone(original);
 Object.assign(spec,{lessonId:'portable',lessonVersion:1,classId:'portable',date:'',planEntryId:'',planVersion:0,sequence:''});
 spec.sourceVersions={curriculumVersion:'',planVersion:0,previousLessonRunId:null};
 Object.assign(spec.diagnostic,{id:'portable-diagnostic',sourceLessonRunId:null,sourceLessonVersion:null});
 if(spec.codeStation){Object.assign(spec.codeStation,{missionId:'portable-mission',missionVersion:1});delete spec.codeStation.missionSignature;}
 return spec;
}
export function contentFingerprint(payload){
 return fingerprint({...payload,spec:normalizedSpec(payload.spec)});
}
export function capabilities(spec){
 const set=new Set(['lesson-v1']);
 for(const a of [...spec.activities,...spec.diagnostic.tasks]){
  if(a.workshop?.profile==='shell-git')set.add('shell-git');
  if(a.workshop?.profile==='dom')set.add('dom');
  if(a.workshop?.language)set.add(`editor:${a.workshop.language}`);
 }
 if(spec.codeStation)set.add('game:exploration-v1');
 return [...set].sort();
}
export async function encodePackage(lessons,files){
 check(lessons.length>0&&lessons.length<=LIMITS.lessons,'Sélectionnez entre 1 et 50 séances.');
 check(files.size+lessons.length+1<=LIMITS.files&&[...files.values()].reduce((n,b)=>n+b.length,0)+lessons.reduce((n,l)=>n+Buffer.byteLength(canonical(l.payload)),0)<=LIMITS.expanded,'Limites de taille ou de nombre de fichiers dépassées.');
 const zip=new JSZip(),manifest={format:'tweenteach',version:1,packageId:randomUUID(),lessons:[],files:[]};
 for(const lesson of lessons){
  const path=`lessons/${lesson.portableId}.json`,buffer=Buffer.from(canonical(lesson.payload));
  check(buffer.length<=LIMITS.file,'Une séance dépasse la limite de 16 Mio.');zip.file(path,buffer,{createFolders:false});
  manifest.lessons.push({portableId:lesson.portableId,title:lesson.payload.spec.title,date:lesson.date,sequence:lesson.sequence,path,sha256:sha256(buffer),revision:contentFingerprint(lesson.payload),capabilities:capabilities(lesson.payload.spec)});
 }
 for(const [hash,buffer] of files){check(buffer.length<=LIMITS.file,'Une ressource dépasse la limite de 16 Mio.');zip.file(filePath(hash),buffer,{createFolders:false});manifest.files.push({path:filePath(hash),sha256:hash,bytes:buffer.length});}
 manifest.files.sort((a,b)=>a.path.localeCompare(b.path));zip.file('manifest.json',canonical(manifest));
 const bytes=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}});
 check(bytes.length<=LIMITS.archive,'Archive supérieure à 64 Mio. Exportez moins de séances.');
 // Exercise exactly the same bounded reader on our own output.
 await decodePackage(bytes);return {bytes,manifest};
}
// Parse ZIP central and local headers ourselves before inflation. JSZip's
// path sanitization and advertised uncompressedSize are not a security boundary.
function unzip(bytes){
 check(Buffer.isBuffer(bytes)&&bytes.length>=22&&bytes.length<=LIMITS.archive,'Archive vide ou supérieure à 64 Mio.');
 let end=-1;for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--)if(bytes.readUInt32LE(p)===0x06054b50&&p+22+bytes.readUInt16LE(p+20)===bytes.length){end=p;break;}
 check(end>=0,'Archive ZIP invalide.');
 const count=bytes.readUInt16LE(end+10),size=bytes.readUInt32LE(end+12),start=bytes.readUInt32LE(end+16);
 check(!bytes.readUInt16LE(end+4)&&!bytes.readUInt16LE(end+6)&&bytes.readUInt16LE(end+8)===count&&count>0&&count<=LIMITS.files&&start+size===end,'Archive multiple, ZIP64 ou nombre de fichiers non pris en charge.');
 const entries=[],names=new Set();let p=start,total=0,localEnd=0;
 for(let i=0;i<count;i++){
  check(p+46<=end&&bytes.readUInt32LE(p)===0x02014b50,'Répertoire ZIP invalide.');
  const flags=bytes.readUInt16LE(p+8),method=bytes.readUInt16LE(p+10),compressed=bytes.readUInt32LE(p+20),length=bytes.readUInt32LE(p+24),n=bytes.readUInt16LE(p+28),extra=bytes.readUInt16LE(p+30),comment=bytes.readUInt16LE(p+32),offset=bytes.readUInt32LE(p+42),mode=bytes.readUInt32LE(p+38)>>>16;
  check(p+46+n+extra+comment<=end,'Entrée ZIP tronquée.');
  const name=bytes.subarray(p+46,p+46+n).toString('utf8');
  check(/^(manifest\.json|lessons\/[a-zA-Z0-9_-]+\.json|files\/[a-f0-9]{64})$/.test(name)&&!names.has(name),'Chemin ZIP interdit ou dupliqué.');names.add(name);
  check(!(flags&1)&&[0,8].includes(method)&&(!mode||(mode&0xf000)===0x8000||(mode&0xf000)===0)&&!bytes.readUInt16LE(p+34),'Archive chiffrée, lien ou compression non pris en charge.');
  total+=length;check(length<=LIMITS.file&&total<=LIMITS.expanded,'Limite de décompression dépassée (16 Mio par fichier, 128 Mio au total).');
  check(offset>=localEnd&&offset+30<=start&&bytes.readUInt32LE(offset)===0x04034b50,'Entrée locale ZIP invalide.');
  const localN=bytes.readUInt16LE(offset+26),localExtra=bytes.readUInt16LE(offset+28),dataStart=offset+30+localN+localExtra;
  check(bytes.readUInt16LE(offset+6)===flags&&bytes.readUInt16LE(offset+8)===method&&bytes.subarray(offset+30,offset+30+localN).toString('utf8')===name&&dataStart+compressed<=start,'En-têtes ZIP incohérents.');
  entries.push({name,method,length,compressed,dataStart});localEnd=dataStart+compressed;p+=46+n+extra+comment;
 }
 check(p===end,'Répertoire ZIP incohérent.');
 const result=new Map();for(const e of entries){let out;try{const raw=bytes.subarray(e.dataStart,e.dataStart+e.compressed);out=e.method===0?Buffer.from(raw):inflateRawSync(raw,{maxOutputLength:Math.max(1,e.length)});}catch{fail(422,'Décompression refusée ou ressource corrompue.');}check(out.length===e.length,'Taille décompressée incohérente.');result.set(e.name,out);}return result;
}
export async function decodePackage(bytes){
 const entries=unzip(bytes),json=path=>{try{return JSON.parse(entries.get(path)?.toString('utf8'));}catch{fail(422,`Document JSON invalide : ${path}.`);}};
 const manifest=json('manifest.json');assertKeys(manifest,['format','version','packageId','lessons','files']);
 check(manifest.format==='tweenteach'&&manifest.version===1,'Version de paquet non prise en charge.');
 check(typeof manifest.packageId==='string'&&manifest.packageId.length<=100&&Array.isArray(manifest.lessons)&&manifest.lessons.length>0&&manifest.lessons.length<=LIMITS.lessons&&Array.isArray(manifest.files),'Manifeste invalide.');
 const expected=new Set(['manifest.json']),identities=new Set(),files=new Map(),lessons=[];
 for(const f of manifest.files){assertKeys(f,['path','sha256','bytes']);const buffer=entries.get(f.path);check(f.path===filePath(f.sha256)&&buffer&&buffer.length===f.bytes&&sha256(buffer)===f.sha256&&!expected.has(f.path),'Fichier absent, dupliqué ou altéré.');expected.add(f.path);files.set(f.sha256,buffer);}
 for(const row of manifest.lessons){
  assertKeys(row,['portableId','title','date','sequence','path','sha256','revision','capabilities']);
  check(typeof row.portableId==='string'&&/^[a-zA-Z0-9_-]{16,100}$/.test(row.portableId)&&!identities.has(row.portableId),'Identité portable invalide ou dupliquée.');identities.add(row.portableId);
  check(row.path===`lessons/${row.portableId}.json`&&entries.has(row.path)&&sha256(entries.get(row.path))===row.sha256,'Séance absente ou altérée.');expected.add(row.path);
  const payload=json(row.path);assertKeys(payload,['spec','context','assets','documents','mission','corpus','preparation','designContract','external','pedagogy']);validateReferences(payload.spec);
  check(contentFingerprint(payload)===row.revision,'Empreinte pédagogique incohérente.');
  check(fingerprint(capabilities(payload.spec))===fingerprint(row.capabilities),'Capacités déclarées incohérentes.');
  check(typeof row.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(row.date)&&Number.isFinite(Date.parse(row.date+'T12:00:00Z'))&&new Date(row.date+'T12:00:00Z').toISOString().slice(0,10)===row.date,'Date pédagogique invalide.');
  check(row.title===payload.spec.title&&typeof row.sequence==='string','Titre ou séquence incohérents.');lessons.push({...row,payload});
 }
 check(entries.size===expected.size&&[...entries.keys()].every(k=>expected.has(k)),'Fichiers non déclarés dans l’archive.');
 return {manifest,lessons,files,sha256:sha256(bytes)};
}
