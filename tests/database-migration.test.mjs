import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {schemaSQL} from '../server/store.mjs';
import {prepareSnapshot,inspectTarget,applySnapshot} from '../scripts/lib/database-migration.mjs';

const digest=value=>createHash('sha256').update(value).digest('hex');
const teacher={id:'teacher-test',classId:'A1',username:'professeur',passwordHash:'preserved-hash',role:'teacher'};
const learner={id:"élève-'$1",classId:'A1',displayName:"Élève d'essai",passwordHash:'student-hash',version:3};
const lesson={id:'lesson-test',classId:'A1',date:'2026-10-06',status:'draft',version:2,versionId:'version-test',title:'Retrouver la trace'};

async function fixture(t){
 const directory=await mkdtemp(join(tmpdir(),'eden-migration-'));
 t.after(()=>rm(directory,{recursive:true,force:true}));
 const source=join(directory,'eden.sqlite'),db=new DatabaseSync(source);
 db.exec(schemaSQL);
 const bytes=Buffer.from('Document PDF/PPTX de test\nÉté'),key=digest(bytes);
 const artifactDirectory=join(directory,'artifacts'),artifactPath=join(artifactDirectory,key.slice(0,2),key);
 await mkdir(join(artifactDirectory,key.slice(0,2)),{recursive:true});
 await writeFile(artifactPath,bytes);
 const file={path:'04_PRESENTATION/presentation.pptx',artifactKey:key,sha256:key,bytes:bytes.length};
 const pack={id:'corpus-test',classId:'A1',lessonId:lesson.id,lessonVersionId:'version-test',complete:true,files:[file,{...file,path:'copie.pptx'}]};
 const insert=(table,data)=>db.prepare(`INSERT INTO ${table} VALUES (?,?,?,?,?)`).run(data.id,data.classId,data.version||1,JSON.stringify(data),'2026-10-01T08:00:00.000Z');
 insert('teachers',teacher);insert('learners',learner);insert('lessons',lesson);
 insert('lesson_versions',{id:'version-test',classId:'A1',version:2,lessonId:lesson.id,spec:{title:lesson.title}});
 insert('corpus_packages',pack);
 insert('plan_entries',{id:'plan-test',classId:'A1',date:'2026-10-06',lessonId:lesson.id});
 insert('audit_log',{id:'audit-test',classId:'A1',actorId:teacher.id,entityId:lesson.id,action:'lesson.created'});
 db.close();
 return {source,artifactDirectory,artifactPath,bytes};
}

async function postgres(t){
 const pg=await PGlite.create();
 t.after(()=>pg.close());
 // pg.Client uses the simple protocol without parameters; PGlite calls it exec.
 const client={query:async(sql,parameters)=>parameters?pg.query(sql,parameters):(await pg.exec(sql)).at(-1)};
 return {pg,client};
}

test('snapshot is read-only, preserves metadata and embeds verified local documents',async t=>{
 const f=await fixture(t),before=digest(await readFile(f.source));
 const snapshot=await prepareSnapshot(f);
 assert.equal(digest(await readFile(f.source)),before);
 assert.equal(snapshot.report.learners,1);
 assert.equal(snapshot.report.learnersWithAccess,1);
 assert.deepEqual(snapshot.report.artifacts,{files:2,localFiles:2,uniqueLocalFiles:1,bytes:f.bytes.length,externalS3Files:0});
 const row=snapshot.tables.lessons[0];
 assert.equal(row.created_at,'2026-10-01T08:00:00.000Z');
 assert.equal(JSON.parse(row.data).createdAt,undefined);
 assert.equal(JSON.parse(row.data).status,'draft');
 for(const file of JSON.parse(snapshot.tables.corpus_packages[0].data).files){
  assert.equal(file.artifactKey,undefined);
  assert.deepEqual(Buffer.from(file.base64,'base64'),f.bytes);
 }
 const db=new DatabaseSync(f.source,{readOnly:true});
 assert.ok(JSON.parse(db.prepare('SELECT data FROM corpus_packages').get().data).files[0].artifactKey);
 db.close();
 assert.equal((await prepareSnapshot(f)).report.fingerprint,snapshot.report.fingerprint);
});

test('missing or corrupt documents and unknown source tables stop preparation',async t=>{
 const f=await fixture(t);
 await writeFile(f.artifactPath,'corrupt');
 await assert.rejects(prepareSnapshot(f),/corrompu/);
 await rm(f.artifactPath);
 await assert.rejects(prepareSnapshot(f),/manquant ou illisible/);
 await writeFile(f.artifactPath,f.bytes);
 const db=new DatabaseSync(f.source);db.exec('CREATE TABLE future_records (id TEXT)');db.close();
 await assert.rejects(prepareSnapshot(f),/tables inconnues/);
});

test('PostgreSQL transfer preserves identities, lesson versions, dates and documents; retry is idempotent',async t=>{
 const snapshot=await prepareSnapshot(await fixture(t)),{pg,client}=await postgres(t);
 assert.equal((await inspectTarget(client,snapshot)).status,'empty');
 assert.equal((await pg.query("SELECT to_regclass('learners')::text AS name")).rows[0].name,null,'Read-only inspection must not initialize schema.');
 assert.equal((await applySnapshot(client,snapshot)).status,'migrated');
 assert.deepEqual((await pg.query('SELECT * FROM learners')).rows,snapshot.tables.learners.map(row=>({...row})));
 assert.deepEqual((await pg.query('SELECT * FROM lessons')).rows,snapshot.tables.lessons.map(row=>({...row})));
 const pack=JSON.parse((await pg.query('SELECT data FROM corpus_packages')).rows[0].data);
 assert.equal(pack.lessonVersionId,'version-test');
 assert.equal(pack.files[0].artifactKey,undefined);
 assert.equal(digest(Buffer.from(pack.files[0].base64,'base64')),pack.files[0].sha256);
 assert.equal((await inspectTarget(client,snapshot)).status,'identical');
 assert.deepEqual(await applySnapshot(client,snapshot),{status:'already_migrated',inserted:0,fingerprint:snapshot.report.fingerprint});
});

test('existing target data is not overwritten and schema creation rolls back on conflict',async t=>{
 const snapshot=await prepareSnapshot(await fixture(t)),{pg,client}=await postgres(t);
 await pg.exec('CREATE TABLE learners (id TEXT PRIMARY KEY,class_id TEXT NOT NULL,version INTEGER NOT NULL,data TEXT NOT NULL,created_at TEXT NOT NULL)');
 await pg.query('INSERT INTO learners VALUES ($1,$2,$3,$4,$5)',['existing','B1',1,JSON.stringify({id:'existing'}),'2020-01-01']);
 const before=(await pg.query('SELECT * FROM learners')).rows;
 assert.equal((await inspectTarget(client,snapshot)).status,'conflict');
 await assert.rejects(applySnapshot(client,snapshot),/déjà des données différentes/);
 assert.deepEqual((await pg.query('SELECT * FROM learners')).rows,before);
 assert.equal((await pg.query("SELECT to_regclass('teachers')::text AS name")).rows[0].name,null);
});

test('an insertion failure rolls back every preceding table and a retry can finish',async t=>{
 const snapshot=await prepareSnapshot(await fixture(t)),{pg,client}=await postgres(t);
 await pg.exec(schemaSQL);
 await pg.exec("ALTER TABLE lesson_versions ADD CONSTRAINT reject_copy CHECK (id <> 'version-test')");
 await assert.rejects(applySnapshot(client,snapshot));
 assert.equal(Number((await pg.query('SELECT count(*) AS n FROM teachers')).rows[0].n),0);
 assert.equal(Number((await pg.query('SELECT count(*) AS n FROM learners')).rows[0].n),0);
 await pg.exec('ALTER TABLE lesson_versions DROP CONSTRAINT reject_copy');
 assert.equal((await applySnapshot(client,snapshot)).status,'migrated');
});

test('read-back verification rejects database triggers that alter copied data',async t=>{
 const snapshot=await prepareSnapshot(await fixture(t)),{pg,client}=await postgres(t);
 await pg.exec(schemaSQL);
 await pg.exec("CREATE FUNCTION change_copy() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.version := 99; RETURN NEW; END $$; CREATE TRIGGER change_copy BEFORE INSERT ON learners FOR EACH ROW EXECUTE FUNCTION change_copy()");
 await assert.rejects(applySnapshot(client,snapshot),/vérification après copie/);
 assert.equal(Number((await pg.query('SELECT count(*) AS n FROM teachers')).rows[0].n),0);
 assert.equal(Number((await pg.query('SELECT count(*) AS n FROM learners')).rows[0].n),0);
});
