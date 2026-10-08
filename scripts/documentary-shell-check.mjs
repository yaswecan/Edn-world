import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {createServer} from 'node:net';
import {randomBytes} from 'node:crypto';
import {mkdtemp,rm,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {openStore} from '../server/store.mjs';
import {labService} from '../server/pedagogy/labs.mjs';
import {submitWork} from '../server/work-submissions.mjs';
import {runArchiveJob} from '../server/git-archive.mjs';
import {snapshotView} from '../server/content-snapshots.mjs';

const directory=await mkdtemp(join(tmpdir(),'eden-real-remise-')),image=execFileSync('docker',['image','inspect','tweenteach-shell:quality-v2','--format','{{.Id}}'],{encoding:'utf8'}).trim();
const socket=createServer().listen(0,'127.0.0.1');await new Promise(r=>socket.once('listening',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
const token=randomBytes(32).toString('hex'),key=randomBytes(32).toString('hex');
Object.assign(process.env,{EDEN_LAB_URL:`http://127.0.0.1:${port}`,EDEN_LAB_TOKEN:token,EDEN_LAB_SHELL_IMAGE:image});delete process.env.EDEN_S3_BUCKET;
const child=spawn('python3',['labs/broker.py'],{env:{...process.env,TWEEN_LAB_TOKEN:token,TWEEN_LAB_IMAGE:image,TWEEN_LAB_PORT:String(port),TWEEN_LAB_STATE:directory},stdio:['ignore','ignore','ignore']});
const store=await openStore({path:':memory:',url:''}),actor={id:'synthetic-shell-student',classId:'A1',role:'student'},report={simulation:false,scope:'Dedicated local Docker broker, real shell/Git files, durable submission, Git archive, reset',runtime:image,checks:[]};
try{
 let session;for(let i=0;i<30;i++){try{session=await labService('/sessions',{key,profile:'shell-git',files:[{path:'notes.txt',content:'avant\n'}]});break;}catch{await new Promise(r=>setTimeout(r,250));}}assert.ok(session,'Laboratoire indisponible.');
 // Known fixture code only, run inside the isolated classroom image.
 execFileSync('docker',['exec','tween-lab-'+key,'bash','--noprofile','--norc','-c','mkdir -p livraison && printf "travail réel\\n" > livraison/notes.txt && git init -q && git add livraison/notes.txt && git -c user.name=Recette -c user.email=recette@example.invalid commit -qm "Travail élève"'],{stdio:'pipe',timeout:10000});
 await store.insert('lessons',{id:'synthetic-shell-lesson',classId:'A1',status:'published',versionId:'shell-v1'});
 await store.insert('lesson_versions',{id:'shell-v1',classId:'A1',spec:{activities:[{id:'shell',title:'Livraison',type:'Terminal',required:true,workshop:{profile:'shell-git'}}],diagnostic:{tasks:[]}}});
 await store.insert('assessment_attempts',{id:'done',classId:'A1',learnerId:actor.id,lessonVersionId:'shell-v1',submissionId:'synthetic-diagnostic'});
 await store.insert('lab_sessions',{id:'real-lab',classId:'A1',learnerId:actor.id,lessonId:'synthetic-shell-lesson',lessonVersionId:'shell-v1',activityId:'shell',runtime:image,remoteId:session.id});
 const input={requestId:'real-shell-remise',lessonId:'synthetic-shell-lesson',lessonVersionId:'shell-v1',answers:{shell:'J’ai préparé le fichier puis créé le commit.'}},receipt=await submitWork(store,actor,input);
 const snapshot=await snapshotView(store,receipt.snapshotId,actor);assert.ok(snapshot.files.some(f=>f.path.endsWith('livraison/notes.txt')&&f.content==='travail réel\n'));assert.ok(snapshot.files.every(f=>!f.path.includes('/.git/')));report.checks.push({id:'real-shell-bytes-and-student-git-evidence',status:'PASS'});
 const fail=await runArchiveJob(store,{config:{id:'test',repository:join(directory,'archive.git')},project:async()=>{throw Error('Controlled archive outage');}});assert.equal(fail.state,'retry');assert.equal((await submitWork(store,actor,input)).id,receipt.id);report.checks.push({id:'archive-outage-keeps-receipt-and-duplicate-is-idempotent',status:'PASS'});
 fail.availableAt=new Date(0).toISOString();await store.put('archive_outbox',fail);const archived=await runArchiveJob(store,{config:{id:'test',repository:join(directory,'archive.git')}});assert.equal(archived.state,'confirmed');
 await labService(`/sessions/${session.id}/reset`,{});const after=await snapshotView(store,receipt.snapshotId,actor);assert.equal(after.sha256,snapshot.sha256);assert.ok(after.files.some(f=>f.content==='travail réel\n'));report.checks.push({id:'reset-preserves-submission-and-archive',status:'PASS',commit:archived.archive.commit});
}catch(e){report.error=e.message;throw e;}
finally{child.kill('SIGTERM');try{execFileSync('docker',['rm','-f','tween-lab-'+key],{stdio:'ignore',timeout:10000});}catch{}await store.close();await mkdir('docs/quality/evidence-documentary',{recursive:true});await writeFile('docs/quality/evidence-documentary/shell.json',JSON.stringify(report,null,2)+'\n');await rm(directory,{recursive:true,force:true});}
console.log(JSON.stringify(report));
