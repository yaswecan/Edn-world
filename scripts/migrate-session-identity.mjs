import {DatabaseSync} from 'node:sqlite';
import {readFile,writeFile,mkdir,chmod} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {openStore,TABLES} from '../server/store.mjs';
import {planIdentityMigration,applyIdentityMigration,rollbackIdentityMigration} from '../server/session-identity-migration.mjs';

// No credentials are loaded implicitly. PostgreSQL requires an explicit flag.
const args=process.argv.slice(2),option=name=>args.includes(name)?args[args.indexOf(name)+1]:null;
const path=option('--db'),postgres=args.includes('--postgres'),migrationURL=process.env.EDEN_MIGRATION_DATABASE_URL||process.env.DATABASE_URL;
if(!!path===postgres)throw Error('Choisissez --db chemin.sqlite ou --postgres (DATABASE_URL). Simulation par défaut ; --report plan.json, puis --apply-plan plan.json. Retour arrière : --rollback plan.json.');
const known=['--db','--postgres','--report','--apply','--apply-plan','--rollback','--class','--backup'];
for(const arg of args)if(arg.startsWith('--')&&!known.includes(arg))throw Error('Option inconnue : '+arg);
let db,pool,store,execution;
const save=async(file,value)=>{await mkdir(dirname(resolve(file)),{recursive:true});await writeFile(file,JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'wx'});};
try{
 let readRows,tables;
 if(postgres){
  if(!migrationURL)throw Error('EDEN_MIGRATION_DATABASE_URL (ou DATABASE_URL) est requis avec --postgres.');
  const {Client}=await import('pg');pool=new Client({connectionString:migrationURL});await pool.connect();
  await pool.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  tables=new Set((await pool.query("SELECT tablename FROM pg_tables WHERE schemaname=current_schema()" )).rows.map(r=>r.tablename));
  readRows=async table=>(await pool.query(`SELECT id,class_id,version,data,created_at FROM ${table} ORDER BY id`)).rows;
 }else{
  db=new DatabaseSync(resolve(path),{readOnly:true});tables=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name));
  readRows=async table=>db.prepare(`SELECT id,class_id,version,data,created_at FROM ${table} ORDER BY id`).all();
 }
 const rows=async table=>TABLES.includes(table)&&tables.has(table)?readRows(table):[];
 const reader={list:async(t,c)=>(await rows(t)).map(r=>JSON.parse(r.data)).filter(r=>!c||r.classId===c),get:async(t,id)=>JSON.parse((await rows(t)).find(r=>r.id===id)?.data||'null')};
 const rollback=option('--rollback'),applyPlan=option('--apply-plan'),report=option('--report'),apply=args.includes('--apply')||!!applyPlan;
 if([rollback,applyPlan,args.includes('--apply')].filter(Boolean).length>1)throw Error('Choisissez une seule opération d’écriture.');
 const plan=rollback||applyPlan?JSON.parse(await readFile(rollback||applyPlan,'utf8')):await planIdentityMigration(reader,{classId:option('--class')||undefined});
 if(report)await save(report,plan);
 if(apply||rollback){
  if(!report&&!applyPlan&&!rollback)throw Error('--report est requis pour sauvegarder le plan avant application.');
  const backup=resolve(option('--backup')||(path?path+'.identity-'+Date.now()+'.backup':'.data/identity-postgres-'+Date.now()+'.backup.json'));
  await mkdir(dirname(backup),{recursive:true});
  if(db){db.exec("VACUUM INTO '"+backup.replaceAll("'","''")+"'");await chmod(backup,0o600);}
  else {const snapshot={format:'tweenteach-identity-backup',createdAt:new Date().toISOString(),tables:{}};for(const t of TABLES)if(tables.has(t))snapshot.tables[t]=await rows(t);await save(backup,snapshot);}
  if(pool)await pool.query('COMMIT');
  store=await openStore(postgres?{url:migrationURL}:{url:null,path:resolve(path)});
  execution={backup,...await (rollback?rollbackIdentityMigration(store,plan):applyIdentityMigration(store,plan))};
 }else if(pool)await pool.query('COMMIT');
 console.log(JSON.stringify({...execution,mode:rollback?'rollback':apply?'apply':'simulation',counts:plan.counts,rows:plan.rows.map(r=>({id:r.id,status:r.status,oldTitle:r.before.title,title:r.after?.pedagogicalTitle,reason:r.reason,suggestedTitle:r.suggestedTitle,warnings:r.warnings}))},null,2));
}finally{db?.close();await pool?.end();await store?.close();}
