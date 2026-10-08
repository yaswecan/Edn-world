import {createHash} from 'node:crypto';
import {gzip,gunzip} from 'node:zlib';
import {promisify,isDeepStrictEqual} from 'node:util';
import {TABLES,fail} from './store.mjs';
import {initialCatalog} from './game.mjs';

export const MAX_UPLOAD_BYTES=4*1024*1024;
export const MAX_SNAPSHOT_BYTES=32*1024*1024;
const columns=['id','class_id','version','data','created_at'];
const sha256=value=>createHash('sha256').update(value).digest('hex');
const ensure=(condition,message)=>{if(!condition)fail(400,message);};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const identifier=value=>typeof value==='string'&&value.length>0&&value.length<=500&&!value.includes('\0');

export function snapshotDigest(tables){
 const hash=createHash('sha256');
 for(const table of TABLES){
  hash.update(JSON.stringify(table));
  const rows=[...tables[table]].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  for(const row of rows)hash.update(JSON.stringify(columns.map(column=>row[column])));
 }
 return hash.digest('hex');
}

function validateBackup(backup,classId){
 ensure(object(backup)&&backup.format==='eden-database-backup'&&backup.formatVersion===1,'Choisissez le fichier de base .eden-db.gz produit par « npm run db:export ».');
 const {tables}=backup;
 ensure(object(tables)&&Object.keys(tables).length===TABLES.length&&TABLES.every(t=>Object.hasOwn(tables,t)),'Tables de sauvegarde incompatibles avec cette version de Tween Teach.');
 let count=0;
 for(const table of TABLES){
  const rows=tables[table],ids=new Set();
  ensure(Array.isArray(rows),'Table de sauvegarde invalide.');
  count+=rows.length;
  ensure(count<=100000,'Sauvegarde trop volumineuse.');
  for(const row of rows){
   ensure(object(row)&&Object.keys(row).length===columns.length&&columns.every(key=>Object.hasOwn(row,key)),'Ligne de sauvegarde invalide.');
   ensure(identifier(row.id)&&identifier(row.class_id)&&!ids.has(row.id),'Identifiant invalide ou dupliqué dans la sauvegarde.');
   ensure(row.class_id===classId,'Cette sauvegarde contient une autre classe. Utilisez une installation dédiée à cette classe.');
   ensure(Number.isSafeInteger(row.version)&&row.version>=1&&typeof row.created_at==='string'&&Number.isFinite(Date.parse(row.created_at))&&typeof row.data==='string','Métadonnées de sauvegarde invalides.');
   let data;try{data=JSON.parse(row.data);}catch{fail(400,'Contenu de sauvegarde illisible.');}
   ensure(object(data)&&data.id===row.id&&data.classId===row.class_id&&(data.version||1)===row.version,'Identité incohérente dans la sauvegarde.');
   ids.add(row.id);
  }
 }
 ensure(tables.sessions.length===0,'Les sessions de connexion ne doivent pas être restaurées. Recréez le fichier avec « npm run db:export ».');
 ensure(tables.teachers.length>0,'La sauvegarde doit contenir un compte professeur.');
 for(const table of ['teachers','learners']){
  const usernames=new Set();
  for(const row of tables[table]){
   const account=JSON.parse(row.data);
   ensure(identifier(account.username)&&!usernames.has(account.username),'Identifiant de connexion invalide ou dupliqué.');
   ensure(table!=='teachers'||account.role==='teacher','Compte professeur invalide.');
   ensure((table==='learners'&&!account.passwordHash)||/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(account.passwordHash),'Empreinte de mot de passe invalide.');
   usernames.add(account.username);
  }
 }
 // Importing a database must not restart external work on the destination.
 for(const table of ['publication_jobs','generation_jobs'])for(const row of tables[table]){
  ensure(['completed','failed','cancelled'].includes(JSON.parse(row.data).status),'Terminez ou annulez les travaux en cours avant d’exporter la base.');
 }
 ensure(tables.lab_sessions.length===0,'La sauvegarde contient des sessions de laboratoire liées à un autre hôte. Utilisez la migration administrateur.');
 for(const row of tables.archive_outbox)ensure(['confirmed','failed'].includes(JSON.parse(row.data).state),'Terminez les archivages avant le transfert navigateur ; utilisez la sauvegarde administrateur pour préserver les reprises en attente.');
 let documents=0;
 for(const row of tables.corpus_packages){
  const pack=JSON.parse(row.data),paths=new Set();
  ensure(Array.isArray(pack.files),'Corpus sans documents.');
  for(const file of pack.files){
   ensure(object(file)&&typeof file.path==='string'&&file.path.length>0&&!file.path.startsWith('/')&&!/[\\\u0000:]/.test(file.path)&&!file.path.split('/').some(p=>p==='..'||p==='.'||p==='')&&!paths.has(file.path),'Chemin de document invalide.');
   ensure(!file.artifactKey&&!file.s3Key&&typeof file.base64==='string','Des documents ne sont pas inclus dans la sauvegarde.');
   const buffer=Buffer.from(file.base64,'base64');
   ensure(buffer.toString('base64')===file.base64&&buffer.length===file.bytes&&sha256(buffer)===file.sha256,'Document manquant ou corrompu dans la sauvegarde.');
   paths.add(file.path);documents++;
  }
 }
 for(const [kind,row] of ['pedagogical_sources','content_snapshots'].flatMap(kind=>tables[kind].map(row=>[kind,row]))){
  const value=JSON.parse(row.data),files=kind==='pedagogical_sources'?(value.original?[value.original]:[]):value.externalObjects||[];
  for(const file of files){ensure(!file.artifactKey&&!file.s3Key&&typeof file.base64==='string','Original ou remise non inclus dans la sauvegarde.');const bytes=Buffer.from(file.base64,'base64');ensure(bytes.toString('base64')===file.base64&&bytes.length===file.bytes&&sha256(bytes)===file.sha256,'Original ou remise corrompu.');documents++;}
  if(kind==='content_snapshots')for(const f of value.files)ensure(sha256(f.content)===f.sha256,'Texte de remise corrompu.');
 }
 ensure(snapshotDigest(tables)===backup.fingerprint,'L’empreinte de la sauvegarde ne correspond pas à son contenu.');
 const counts=Object.fromEntries(TABLES.map(t=>[t,tables[t].length]));
 return {fingerprint:backup.fingerprint,totalRows:count,counts,learners:tables.learners.length,documents,
  teachers:tables.teachers.map(row=>{const {username}=JSON.parse(row.data);return {username};}),
  lessons:tables.lessons.map(row=>{const {title,date,status,version}=JSON.parse(row.data);return {title,date,status,version};})};
}

export async function encodeBackup(snapshot){
 const tables={...snapshot.tables,sessions:[]};
 const backup={format:'eden-database-backup',formatVersion:1,exportedAt:new Date().toISOString(),fingerprint:snapshotDigest(tables),tables};
 const classId=tables.teachers[0]&&JSON.parse(tables.teachers[0].data).classId;
 const report=validateBackup(backup,classId),json=Buffer.from(JSON.stringify(backup));
 ensure(json.length<=MAX_SNAPSHOT_BYTES,'Base trop volumineuse pour l’import navigateur. Utilisez « npm run db:migrate ».');
 const buffer=await promisify(gzip)(json,{level:9});
 ensure(buffer.length<=MAX_UPLOAD_BYTES,'Fichier supérieur à 4 Mio. Utilisez « npm run db:migrate ».');
 return {buffer,report};
}

export async function decodeBackup(buffer,classId){
 ensure(Buffer.isBuffer(buffer)&&buffer.length>0&&buffer.length<=MAX_UPLOAD_BYTES,'Envoyez une sauvegarde .eden-db.gz de 4 Mio maximum.');
 let backup;
 try{backup=JSON.parse((await promisify(gunzip)(buffer,{maxOutputLength:MAX_SNAPSHOT_BYTES})).toString('utf8'));}
 catch{fail(400,'Sauvegarde compressée illisible ou trop volumineuse. Utilisez le fichier .eden-db.gz.');}
 const report=validateBackup(backup,classId);
 return {tables:backup.tables,report};
}

async function targetRows(tx){return Object.fromEntries(await Promise.all(TABLES.map(async t=>[t,await tx.readRows(t)])));}
function targetStatus(tables,snapshot,actor){
 if(snapshotDigest({...tables,sessions:[]})===snapshot.report.fingerprint)return 'identical';
 const seed=initialCatalog(actor.classId);
 for(const table of TABLES)for(const row of tables[table]){
  const data=JSON.parse(row.data);
  if(row.class_id!==actor.classId)return 'conflict';
  if(table==='teachers'&&tables.teachers.length===1&&data.id===actor.id)continue;
  if(table==='sessions'&&data.userId===actor.id&&data.role==='teacher')continue;
  if(seed[table]){
   const expected=seed[table].find(item=>item.id===row.id),{createdAt,...actual}=data;
   if(expected&&row.version===(expected.version||1)&&isDeepStrictEqual(actual,expected))continue;
  }
  return 'conflict';
 }
 return 'ready';
}

export async function inspectBackup(store,snapshot,actor){
 return store.transaction(async tx=>({...snapshot.report,status:targetStatus(await targetRows(tx),snapshot,actor)}));
}

export async function restoreBackup(store,snapshot,actor,confirmation){
 ensure(confirmation===snapshot.report.fingerprint,'Analysez le fichier puis confirmez cet import.');
 ensure(snapshotDigest(snapshot.tables)===snapshot.report.fingerprint,'La copie préparée a changé. Analysez de nouveau le fichier.');
 return store.transaction(async tx=>{
  await tx.lockTables();
  const current=await tx.get('teachers',actor.id);
  if(!current||current.classId!==actor.classId||current.passwordHash!==actor.passwordHash||(current.authVersion||0)!==(actor.authVersion||0))fail(401,'Reconnectez-vous avant l’import.');
  const before=await targetRows(tx),status=targetStatus(before,snapshot,actor);
  if(status==='conflict')fail(409,'Cette installation contient déjà des données différentes. L’import initial refuse de les écraser ; utilisez une base Tween Teach neuve.');
  if(status==='identical')return {status:'already_imported',...snapshot.report};
  for(const table of TABLES)for(const row of before[table])await tx.remove(table,row.id);
  for(const table of TABLES)for(const row of snapshot.tables[table])await tx.insertRow(table,row);
  if(snapshotDigest(await targetRows(tx))!==snapshot.report.fingerprint)fail(409,'La vérification après copie a échoué. Import annulé.');
  return {status:'imported',...snapshot.report};
 });
}
