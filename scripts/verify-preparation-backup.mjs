import assert from 'node:assert/strict';
import {mkdtemp,copyFile,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {openStore} from '../server/store.mjs';
process.umask(0o077);
const evidence=JSON.parse(await readFile('docs/quality/evidence-v2/original-preparation.json','utf8'));
const directory=await mkdtemp(join(tmpdir(),'tweenteach-restore-')),path=join(directory,'restored.sqlite');let store;
try{
 await copyFile(evidence.backup,path);
 const db=new DatabaseSync(path,{readOnly:true});assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');db.close();
 store=await openStore({path,url:''});const job=await store.get('generation_jobs',evidence.jobId);
 assert.ok(job);assert.ok(await store.get('lesson_versions',job.lessonVersionId));assert.equal(job.brief.entry.date,evidence.session.date);assert.equal(job.calls,evidence.originalCalls.length);
 assert.ok(Array.isArray(await store.list('generation_revisions')));assert.ok(Array.isArray(await store.list('lesson_assets')));
 await writeFile('docs/quality/evidence-v2/backup-restore.json',JSON.stringify({status:'PASS',scope:'Private disposable SQLite restoration, integrity, original job and lesson linkage, additive migrations. No production restore or object-storage restore.',date:new Date().toISOString(),checks:['integrity','original-session-preserved','lesson-version-readable','calls-preserved','additive-migration']},null,2)+'\n');
 console.log('PASS: private disposable backup restoration and additive migrations.');
}finally{await store?.close();await rm(directory,{recursive:true,force:true});}
