// Local, explicit migration. A simulation opens SQLite read-only and never changes it.
import {DatabaseSync} from 'node:sqlite';
import {copyFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {openStore,TABLES} from '../server/store.mjs';
export const V3_TABLES=['occurrence_participations','result_questions','learning_alerts'];
export function inspectV3(path){
 const db=new DatabaseSync(path,{readOnly:true});
 try{
  const present=db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name),counts={};
  for(const name of TABLES.filter(t=>present.includes(t)))counts[name]=db.prepare(`SELECT COUNT(*) AS n FROM ${name}`).get().n;
  const issues=[];
  if(present.includes('lesson_runs'))for(const row of db.prepare('SELECT id,data FROM lesson_runs').all()){
   const r=JSON.parse(row.data);if(!r.realization)issues.push({id:r.id,reason:'Réalisé non documenté : aucune date reconstruite'});
  }
  return {mode:'simulation',missingTables:V3_TABLES.filter(t=>!present.includes(t)),counts,issues};
 }finally{db.close();}
}
export async function applyV3(path,{isolated=false,backupPath}={}){
 if(!isolated||!backupPath)throw Error('Une base de test explicitement isolée et un chemin de sauvegarde sont requis.');
 const before=inspectV3(path),db=new DatabaseSync(path);
 try{db.exec('PRAGMA wal_checkpoint(TRUNCATE)');}finally{db.close();}
 await mkdir(dirname(backupPath),{recursive:true});await copyFile(path,backupPath,1);
 const store=await openStore({url:'',path});await store.close();
 const after=inspectV3(path);for(const [name,count] of Object.entries(before.counts))if(after.counts[name]!==count)throw Error('Volume modifié pendant la migration : '+name);
 return {mode:'applied',before,after,backupCreated:true};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),get=k=>args[args.indexOf(k)+1];if(!args.includes('--db'))throw Error('Usage: node scripts/migrate-tracking-v3.mjs --db /base-test.sqlite [--apply --isolated-test --backup /copie.sqlite]');
 const path=resolve(get('--db'));const report=args.includes('--apply')?await applyV3(path,{isolated:args.includes('--isolated-test'),backupPath:args.includes('--backup')?resolve(get('--backup')):null}):inspectV3(path);console.log(JSON.stringify(report,null,2));
}
