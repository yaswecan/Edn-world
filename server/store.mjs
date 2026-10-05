import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export const TABLES = ['organizations','classes','teachers','learners','enrollments','sessions','imports','curriculum_versions','competency_n3','sequence_versions','teacher_policies','plan_versions','plan_entries','plan_changes','lessons','lesson_versions','lesson_runs','lesson_publications','assessment_specs','assessment_attempts','submissions','corrections','correction_revisions','evidence','remediation_snapshots','resources','corpus_packages','game_worlds','game_missions','game_runs','game_events','game_evidence','game_unlocks','game_teacher_overrides','player_progression','agent_runs','teacher_approvals','audit_log','drive_publications','learning_events','teacher_observations','lesson_adaptations','publication_jobs','import_reconciliations','learning_progress','resource_documents'];
export const uid = (prefix='id') => `${prefix}_${randomUUID()}`;
export const now = () => new Date().toISOString();
export function fail(status, message, details) { throw Object.assign(new Error(message), { status, details }); }
export const requireValue = (value, message) => { if (!value) fail(400, message); return value; };
export const schemaSQL = TABLES.map(t=>`CREATE TABLE IF NOT EXISTS ${t} (id TEXT PRIMARY KEY, class_id TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, data TEXT NOT NULL, created_at TEXT NOT NULL); CREATE INDEX IF NOT EXISTS ${t}_class ON ${t}(class_id);`).join('\n');

// Each aggregate has its own table. Historical versions, submissions, evidence and
// audit entries are append-only through the domain service, never overwritten.
export async function openStore({url=process.env.DATABASE_URL,path=process.env.EDEN_DB_PATH||'.data/eden.sqlite'}={}) {
 let db, pool;
 if (url) { const { Pool }=await import('pg'); pool=new Pool({connectionString:url}); await pool.query(schemaSQL); }
 else { const {DatabaseSync}=await import('node:sqlite'); if(path!==':memory:')mkdirSync(dirname(path),{recursive:true}); db=new DatabaseSync(path); db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;'); db.exec(schemaSQL); }
 const table = t => { if(!TABLES.includes(t)) throw Error('Unknown table'); return t; };
 const parse = row => row ? JSON.parse(row.data) : null;
 function context(client=null) {
  async function query(sql,args=[]) { if(pool)return (await (client||pool).query(sql,args)).rows; return db.prepare(sql.replace(/\$\d+/g,'?')).all(...args); }
  async function exec(sql,args=[]) { if(pool)return (await (client||pool).query(sql,args)); return db.prepare(sql.replace(/\$\d+/g,'?')).run(...args); }
  const api={
   async get(t,id) { return parse((await query(`SELECT data FROM ${table(t)} WHERE id=$1`,[id]))[0]); },
   async list(t,classId) { const rows=await query(`SELECT data FROM ${table(t)}${classId?' WHERE class_id=$1':''} ORDER BY ${t.endsWith('_versions')||['teacher_policies','remediation_snapshots'].includes(t)?'version,':''}created_at,id`,classId?[classId]:[]);return rows.map(parse); },
   async insert(t,obj) { const data={...obj,id:obj.id||uid(t),createdAt:obj.createdAt||now()};await exec(`INSERT INTO ${table(t)} (id,class_id,version,data,created_at) VALUES ($1,$2,$3,$4,$5)`,[data.id,data.classId||'A1',data.version||1,JSON.stringify(data),data.createdAt]);return data; },
   async put(t,obj) { await exec(`UPDATE ${table(t)} SET version=$1,data=$2 WHERE id=$3`,[obj.version||1,JSON.stringify(obj),obj.id]);return obj; },
   async remove(t,id) { await exec(`DELETE FROM ${table(t)} WHERE id=$1`,[id]); },
   async audit(actor,action,entityId,details={}) { return api.insert('audit_log',{actorId:actor.id,classId:actor.classId,action,entityId,details}); }
  };return api;
 }
 let tail=Promise.resolve();
 return {...context(), inlineArtifacts:path===':memory:'||!!url, kind:pool?'postgres':'sqlite',
  transaction(fn) {
   const op=tail.then(async()=>{ const client=pool?await pool.connect():null;
    try { if(client){await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(260104)');}else db.exec('BEGIN IMMEDIATE');
     const result=await fn(context(client));if(client)await client.query('COMMIT');else db.exec('COMMIT');return result;
    }catch(e){if(client)await client.query('ROLLBACK');else db.exec('ROLLBACK');throw e;}finally{client?.release();}
   });tail=op.catch(()=>{});return op;
  }, async close(){await tail;if(pool)await pool.end();else db.close();}
 };
}
export async function scoped(store,table,id,actor){const obj=await store.get(table,id);if(!obj||obj.classId!==actor.classId)fail(404,'Objet introuvable dans cette classe.');return obj;}
