import {createHash} from 'node:crypto';
import {uid,now,requireValue,fail} from './store.mjs';
import {storeArtifact,artifactBuffer} from './artifacts.mjs';
import {validate} from './contracts.mjs';
import {snapshotManifestSchema} from './storage-contracts.mjs';

export const canonical=value=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v,2)+'\n';
export const sha256=value=>createHash('sha256').update(value).digest('hex');
export function safeContentPath(path){
 requireValue(typeof path==='string'&&path.length<=240&&!/[\\\x00-\x1f\x7f:]/.test(path)&&!path.startsWith('/')&&path.split('/').every(p=>p&&p!=='.'&&p!=='..'&&!/^\.git(?:$|attributes$|modules$)|^\.env(?:\.|$)/i.test(p)),'Chemin de fichier non autorisé.');
 return path;
}
// Call inside the transaction that accepts the business event. Durable bytes are
// authoritative even if the Git projection cannot run. No archive state in hash.
export async function freezeContent(tx,{classId,event,eventId,subject,files,external=[],versions={},acceptedAt=now()}){
 const id='snapshot_'+sha256([classId,event,eventId].join('\0'));
 requireValue(Array.isArray(files)&&files.length>0&&files.length<=200,'Liste de fichiers invalide.');
 const paths=new Set(),frozen=files.map(f=>{
  const path=safeContentPath(f.path);requireValue(!paths.has(path),'Chemin de fichier dupliqué.');paths.add(path);
  requireValue(typeof f.content==='string'&&Buffer.byteLength(f.content)<=1000000,'Contenu texte invalide ou trop volumineux.');
  requireValue(['student','teacher','private'].includes(f.audience||'private'),'Audience invalide.');
  return {path,content:f.content,audience:f.audience||'private',sha256:sha256(f.content),bytes:Buffer.byteLength(f.content)};
 }).sort((a,b)=>a.path.localeCompare(b.path));
 requireValue(frozen.reduce((n,f)=>n+f.bytes,0)<=4000000,'Instantané trop volumineux.');
 const previous=await tx.get('content_snapshots',id);
 const manifest={schemaVersion:1,id,event,eventId,subject,acceptedAt:previous?.manifest.acceptedAt||acceptedAt,versions,files:frozen.map(({content,...f})=>f),external:external.map(({base64,...f})=>f)};
 validate(snapshotManifestSchema,manifest);
 const hash=sha256(canonical(manifest));
 if(previous){if(previous.sha256!==hash)fail(409,'Cet événement a déjà figé un contenu différent.');return previous;}
 const snapshot=await tx.insert('content_snapshots',{id,classId,manifest,sha256:hash,files:frozen,externalObjects:external});
 await tx.insert('archive_outbox',{id,classId,snapshotId:id,event,state:'pending',attempts:0,availableAt:now(),archive:null});
 return snapshot;
}
export async function snapshotView(store,id,actor){
 const s=await store.get('content_snapshots',id);
 if(!s||s.classId!==actor.classId||(actor.role!=='teacher'&&s.manifest.subject.learnerId!==actor.id))fail(404,'Instantané introuvable.');
 const archive=await store.get('archive_outbox',id);
 // Private repository coordinates and instructor files never go to students.
 const {externalObjects,...view}=s;
 return {...view,files:s.files.filter(f=>actor.role==='teacher'||f.audience==='student'),archival:{state:archive?.state||'pending',...(actor.role==='teacher'?{commit:archive?.archive?.commit||null,error:archive?.lastError||null}:{} )}};
}
export async function preserveOriginal(store,bytes){
 const reference=await storeArtifact(bytes,{inline:store.inlineArtifacts});
 requireValue(sha256(await artifactBuffer(reference))===sha256(bytes),'Original non confirmé dans le stockage durable.');return reference;
}
