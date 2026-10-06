import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {TABLES,schemaSQL} from '../../server/store.mjs';

const columns=['id','class_id','version','data','created_at'];
const sha256=value=>createHash('sha256').update(value).digest('hex');
export class MigrationError extends Error {}
const ensure=(condition,message)=>{if(!condition)throw new MigrationError(message);};

export function snapshotDigest(tables){
 const hash=createHash('sha256');
 for(const table of TABLES){
  hash.update(JSON.stringify(table));
  const rows=[...tables[table]].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  for(const row of rows)hash.update(JSON.stringify(columns.map(column=>row[column])));
 }
 return hash.digest('hex');
}

// Never open the application store here: it initializes schema and can write.
export async function prepareSnapshot({source='.data/eden.sqlite',artifactDirectory}={}){
 source=resolve(source);
 artifactDirectory=resolve(artifactDirectory||join(dirname(source),'artifacts'));
 const db=new DatabaseSync(source,{readOnly:true});
 const tables=Object.fromEntries(TABLES.map(table=>[table,[]]));
 try{
  db.exec('BEGIN');
  const names=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(row=>row.name);
  ensure(names.every(name=>TABLES.includes(name)),'La source contient des tables inconnues ; migration interrompue pour éviter une copie incomplète.');
  ensure(names.includes('learners')&&names.includes('lessons'),'La source ne contient pas les tables EDEN attendues.');
  for(const table of TABLES){
   if(!names.includes(table))continue;
   tables[table]=db.prepare(`SELECT ${columns.join(',')} FROM ${table} ORDER BY id`).all();
   for(const row of tables[table]){
    const data=JSON.parse(row.data);
    ensure(data&&typeof data==='object'&&!Array.isArray(data)&&data.id===row.id,`Agrégat invalide dans ${table}.`);
   }
  }
  db.exec('COMMIT');
 }finally{db.close();}

 const cache=new Map();
 const artifacts={files:0,localFiles:0,uniqueLocalFiles:0,bytes:0,externalS3Files:0};
 for(const row of tables.corpus_packages){
  const pack=JSON.parse(row.data);
  ensure(Array.isArray(pack.files),'Corpus sans liste de documents.');
  let changed=false;
  for(const file of pack.files){
   artifacts.files++;
   if(file.s3Key){
    ensure(!file.artifactKey,'Document avec deux références de stockage incompatibles.');
    artifacts.externalS3Files++;
    continue;
   }
   let buffer;
   if(file.artifactKey){
    const key=file.artifactKey;
    ensure(/^[a-f0-9]{64}$/.test(key),'Clé de document local invalide.');
    buffer=cache.get(key);
    if(!buffer){
     try{buffer=await readFile(join(artifactDirectory,key.slice(0,2),key));}
     catch{throw new MigrationError('Document local manquant ou illisible ; aucune copie distante effectuée.');}
     ensure(sha256(buffer)===key,'Document local corrompu ; aucune copie distante effectuée.');
     cache.set(key,buffer);
     artifacts.bytes+=buffer.length;
    }
    artifacts.localFiles++;
    file.base64=buffer.toString('base64');
    delete file.artifactKey;
    changed=true;
   }else{
    ensure(typeof file.base64==='string','Document sans contenu ni référence de stockage.');
    buffer=Buffer.from(file.base64,'base64');
   }
   ensure(typeof file.sha256==='string'&&sha256(buffer)===file.sha256,'Empreinte de document incorrecte.');
   ensure(file.bytes===buffer.length,'Taille de document incorrecte.');
  }
  if(changed)row.data=JSON.stringify(pack);
 }
 artifacts.uniqueLocalFiles=cache.size;
 const counts=Object.fromEntries(TABLES.map(table=>[table,tables[table].length]));
 const learners=tables.learners.map(row=>JSON.parse(row.data));
 const lessons=tables.lessons.map(row=>{
  const {id,classId,date,title,status,versionId}=JSON.parse(row.data);
  return {id,classId,date,title,status,versionId};
 });
 const fingerprint=snapshotDigest(tables);
 return {tables,report:{source,fingerprint,counts,totalRows:Object.values(counts).reduce((a,b)=>a+b,0),
  learners:learners.length,learnersWithAccess:learners.filter(row=>row.passwordHash).length,lessons,artifacts}};
}

async function readTarget(client){
 const tables={};
 for(const table of TABLES){
  const result=await client.query('SELECT to_regclass($1)::text AS name',[table]);
  tables[table]=result.rows[0].name?(await client.query(`SELECT ${columns.join(',')} FROM ${table} ORDER BY id`)).rows:[];
 }
 return tables;
}

function compareTarget(snapshot,tables){
 const counts=Object.fromEntries(TABLES.map(table=>[table,tables[table].length]));
 const totalRows=Object.values(counts).reduce((a,b)=>a+b,0);
 const status=snapshotDigest(tables)===snapshot.report.fingerprint?'identical':totalRows===0?'empty':'conflict';
 return {status,totalRows,counts};
}

export async function inspectTarget(client,snapshot){
 await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 try{
  const result=compareTarget(snapshot,await readTarget(client));
  await client.query('COMMIT');
  return result;
 }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}
}

// One transaction, bound values, and no UPDATE/DELETE. An identical retry is a no-op.
export async function applySnapshot(client,snapshot){
 ensure(snapshotDigest(snapshot.tables)===snapshot.report.fingerprint,'La copie préparée a changé ; relancer le contrôle local.');
 await client.query('BEGIN');
 try{
  await client.query("SET LOCAL lock_timeout = '10s'");
  await client.query("SET LOCAL statement_timeout = '120s'");
  await client.query('SELECT pg_advisory_xact_lock(260104)');
  await client.query(schemaSQL);
  await client.query(`LOCK TABLE ${TABLES.join(',')} IN SHARE ROW EXCLUSIVE MODE`);
  const before=compareTarget(snapshot,await readTarget(client));
  ensure(before.status!=='conflict','La base cible contient déjà des données différentes. Aucun écrasement effectué ; utiliser une base EDEN vide.');
  if(before.status==='identical'){
   await client.query('COMMIT');
   return {status:'already_migrated',inserted:0,fingerprint:snapshot.report.fingerprint};
  }
  for(const table of TABLES)for(const row of snapshot.tables[table]){
   await client.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES ($1,$2,$3,$4,$5)`,columns.map(column=>row[column]));
  }
  ensure(compareTarget(snapshot,await readTarget(client)).status==='identical','La vérification après copie a échoué ; transaction annulée.');
  await client.query('COMMIT');
  return {status:'migrated',inserted:snapshot.report.totalRows,fingerprint:snapshot.report.fingerprint};
 }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}
}
