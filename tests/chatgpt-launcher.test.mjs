import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {mkdtemp,rm,symlink,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {networkInterfaces} from 'node:os';
import {lanAddress} from '../server/local-network.mjs';
import {openStore} from '../server/store.mjs';
import {passwordHash} from '../server/auth.mjs';

const repository=fileURLToPath(new URL('../',import.meta.url));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function fixture(port){
 const directory=await mkdtemp(join(tmpdir(),'tween-launcher-'));
 for(const name of ['server','scripts','node_modules'])await symlink(join(repository,name),join(directory,name),'dir');
 await writeFile(join(directory,'.env.chatgpt.local'),`EDEN_CHATGPT_PORT=${port}\n`);
 const children=[];
 return {
  directory,
  launch(args=[]){
   const child=spawn(process.execPath,[join(repository,'scripts/chatgpt-local.mjs'),...args],{cwd:directory,env:{PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:tmpdir()},stdio:['ignore','pipe','pipe']});
   let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);
   const closed=once(child,'close');children.push({child,closed});
   return {child,closed,get output(){return output;}};
  },
  async close(){
   for(const {child} of children)if(child.exitCode===null&&child.signalCode===null)child.kill('SIGTERM');
   await Promise.all(children.map(({closed})=>closed));await rm(directory,{recursive:true,force:true});
  }
 };
}
async function listening(server){server.listen(0,'127.0.0.1');await once(server,'listening');return server.address().port;}
async function ready(run){
 for(let i=0;i<200;i++){
  if(run.output.includes('EDEN Teacher Twin →'))return;
  if(run.child.exitCode!==null)assert.fail(run.output);
  await delay(50);
 }
 assert.fail(`Le serveur n’a pas démarré : ${run.output}`);
}

test('occupied personal port fails once, preserves its listener and never announces a ready server', {timeout:20000},async()=>{
 const occupied=createServer((req,res)=>res.end('existing listener'));
 const port=await listening(occupied),f=await fixture(port);
 try{
  const run=f.launch(),[code]=await run.closed;
  assert.equal(code,1,run.output);
  assert.equal((run.output.match(/est déjà utilisé/g)||[]).length,1,run.output);
  assert.doesNotMatch(run.output,/redémarrage|EDEN Teacher Twin →|Error: listen/);
  const response=await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(await response.text(),'existing listener');
 }finally{occupied.closeAllConnections();await new Promise(resolve=>occupied.close(resolve));await f.close();}
});

test('LAN students use persistent courses while personal setup and AI connections remain local',{timeout:30000},async t=>{
 const address=Object.values(networkInterfaces()).flat().map(entry=>entry?.address).find(address=>{
  try{return lanAddress({address})===address;}catch{return false;}
 });
 if(!address){t.skip('No private IPv4 interface available');return;}
 const reservation=createServer(),port=await listening(reservation);await new Promise(resolve=>reservation.close(resolve));
 const f=await fixture(port),path=join(f.directory,'.data/chatgpt-personal/courses.sqlite');
 const store=await openStore({url:'',path});
 await store.insert('learners',{id:'lan-student',classId:'A1',username:'student',passwordHash:passwordHash('lan-student-only')});
 await store.insert('lessons',{id:'lan-lesson',classId:'A1',date:'2026-10-08',status:'published',title:'LAN fixture',version:1,versionId:'lan-v1',runId:'lan-run'});
 await store.insert('lesson_versions',{id:'lan-v1',classId:'A1',spec:{blocks:[],activities:[{id:'exercise',reference:'private answer'}],diagnostic:{tasks:[]}}});
 await store.close();
 const local=`http://127.0.0.1:${port}`,lan=`http://${address}:${port}`;
 const request=(base,path,{body,cookie}={})=>fetch(base+path,{method:body?'POST':'GET',headers:{Origin:base,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});
 try{
  const run=f.launch(['--lan',`--lan-host=${address}`]);await ready(run);
  assert.match(run.output,/Accès élèves sur le même Wi-Fi/);
  assert.equal((await request(lan,'/api/health')).status,200);
  assert.equal((await request(lan,'/api/setup',{body:{password:'lan-teacher-only'}})).status,403);
  const setup=await request(local,'/api/setup',{body:{password:'lan-teacher-only'}});assert.equal(setup.status,200);
  const teacher=setup.headers.get('set-cookie').split(';')[0];
  assert.equal((await request(lan,'/api/ai/chatgpt/connect',{cookie:teacher,body:{}})).status,403);
  const login=await request(lan,'/api/login',{body:{role:'student',username:'student',password:'lan-student-only'}});assert.equal(login.status,200);
  const student=login.headers.get('set-cookie').split(';')[0];
  assert.equal((await request(lan,'/api/dashboard',{cookie:student})).status,403);
  assert.equal((await request(lan,'/api/today?lesson=lan-lesson')).status,401);
  const lesson=await (await request(lan,'/api/today?lesson=lan-lesson',{cookie:student})).json();
  assert.equal(lesson.lesson.id,'lan-lesson');assert.equal(lesson.lesson.spec.activities[0].reference,undefined);
  const saved=await request(lan,'/api/events',{cookie:student,body:{lessonId:'lan-lesson',lessonVersionId:'lan-v1',eventId:'lan-answer',type:'answer_saved',activityId:'exercise',payload:{answer:'My saved answer'}}});assert.equal(saved.status,200);
  const shared=await (await request(local,'/api/today?lesson=lan-lesson',{cookie:student})).json();assert.equal(shared.progress.answers.exercise,'My saved answer');
  run.child.kill('SIGTERM');assert.equal((await run.closed)[0],0,run.output);
  const restarted=f.launch(['--lan',`--lan-host=${address}`]);await ready(restarted);
  const persisted=await (await request(lan,'/api/today?lesson=lan-lesson',{cookie:student})).json();assert.equal(persisted.progress.answers.exercise,'My saved answer');
 }finally{await f.close();}
});

test('an occupied LAN address closes the local listener without announcing success',{timeout:20000},async t=>{
 let address;try{address=lanAddress();}catch{t.skip('No unambiguous LAN interface');return;}
 const occupied=createServer((req,res)=>res.end('existing LAN listener'));occupied.listen(0,address);await once(occupied,'listening');
 const port=occupied.address().port,f=await fixture(port);
 try{
  const run=f.launch(['--lan',`--lan-host=${address}`]);assert.equal((await run.closed)[0],1,run.output);
  assert.doesNotMatch(run.output,/redémarrage|EDEN Teacher Twin →|Accès élèves/);
  assert.equal(await (await fetch(`http://${address}:${port}`)).text(),'existing LAN listener');
  const replacement=createServer();replacement.listen(port,'127.0.0.1');await once(replacement,'listening');await new Promise(resolve=>replacement.close(resolve));
 }finally{occupied.closeAllConnections();await new Promise(resolve=>occupied.close(resolve));await f.close();}
});

test('personal launcher starts, rejects a duplicate and releases its port on shutdown for a fresh launch',{timeout:30000},async()=>{
 const reservation=createServer(),port=await listening(reservation);await new Promise(resolve=>reservation.close(resolve));
 const f=await fixture(port);
 try{
  const first=f.launch();await ready(first);
  const url=`http://127.0.0.1:${port}/api/health`;
  assert.equal((await (await fetch(url)).json()).ok,true);
  const duplicate=f.launch();assert.equal((await duplicate.closed)[0],1,duplicate.output);
  assert.doesNotMatch(duplicate.output,/redémarrage/);
  assert.equal((await (await fetch(url)).json()).ok,true);
  first.child.kill('SIGTERM');assert.equal((await first.closed)[0],0,first.output);
  const restarted=f.launch();await ready(restarted);
  assert.equal((await (await fetch(url)).json()).ok,true);
  restarted.child.kill('SIGTERM');assert.equal((await restarted.closed)[0],0,restarted.output);
 }finally{await f.close();}
});
