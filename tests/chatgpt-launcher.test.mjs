import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {mkdtemp,rm,symlink,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const repository=fileURLToPath(new URL('../',import.meta.url));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function fixture(port){
 const directory=await mkdtemp(join(tmpdir(),'tween-launcher-'));
 for(const name of ['server','scripts','node_modules'])await symlink(join(repository,name),join(directory,name),'dir');
 await writeFile(join(directory,'.env.chatgpt.local'),`EDEN_CHATGPT_PORT=${port}\n`);
 const children=[];
 return {
  launch(){
   const child=spawn(process.execPath,[join(repository,'scripts/chatgpt-local.mjs')],{cwd:directory,env:{PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:tmpdir()},stdio:['ignore','pipe','pipe']});
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
