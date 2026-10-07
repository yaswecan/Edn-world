import {readFile,mkdir,chmod} from 'node:fs/promises';
import {resolve} from 'node:path';
import {parseEnv} from 'node:util';
import {fork} from 'node:child_process';

if(process.env.VERCEL||process.env.NODE_ENV==='production')throw Error('Le parcours personnel ne se lance pas dans un hébergement de production.');
process.umask(0o077);
// Deliberately ignore .env.local, inherited API keys, databases and storage providers.
let local={};try{local=parseEnv(await readFile('.env.chatgpt.local','utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const allowed=/^(OPENAI_(API_KEY|MODEL|GRADING_MODEL)|EDEN_AI_[A-Z_]+|EDEN_(SOURCE_HOSTS|DIAGNOSTIC_MINUTES|CHATGPT_PORT|LAB_URL|LAB_TOKEN|LAB_SHELL_IMAGE|LAB_DOM_IMAGE)|PLAYWRIGHT_CHROMIUM_EXECUTABLE)$/;
for(const key of Object.keys(local))if(!allowed.test(key))throw Error(`Variable non autorisée dans .env.chatgpt.local : ${key}`);
const port=Number(local.EDEN_CHATGPT_PORT||4181);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('EDEN_CHATGPT_PORT invalide.');
const root=resolve('.data/chatgpt-personal');await mkdir(root,{recursive:true,mode:0o700});await chmod(root,0o700);
const base=Object.fromEntries(['PATH','HOME','TMPDIR','LANG','LC_ALL','SystemRoot'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
const env={...base,...local,NODE_ENV:'development',HOST:'127.0.0.1',PORT:String(port),DATABASE_URL:'',EDEN_DB_PATH:resolve(root,'courses.sqlite'),EDEN_ARTIFACT_PATH:resolve(root,'artifacts'),EDEN_QUALITY_EVIDENCE_PATH:resolve(root,'evidence'),EDEN_CHATGPT_VAULT:resolve(root,'credentials'),EDEN_PERSONAL_LOCAL:'1',EDEN_CHATGPT_MODE:'local',EDEN_QUALITY_PIPELINE:'1',EDEN_AI_WORKER_EXTERNAL:'1'};
let stopping=false,workerStarted=false;const children=new Map(),restarts=new Map();
function start(name,path){
 const child=fork(path,[],{env,execArgv:['--import','tsx'],stdio:['inherit','inherit','inherit','ipc']});children.set(name,child);
 child.on('message',m=>{if(name==='web'&&m?.type==='ready'&&!workerStarted){workerStarted=true;start('worker','scripts/ai-worker.mjs');}});
 child.on('exit',()=>{children.delete(name);if(stopping)return;const count=(restarts.get(name)||0)+1;restarts.set(name,count);if(count>5){console.error(`${name} : arrêts répétés. Relancez après vérification ; les jobs restent en base.`);shutdown();return;}console.error(`${name} interrompu ; redémarrage dans 2 s. Les étapes incertaines seront conservées.`);setTimeout(()=>{if(!stopping)start(name,path);},2000);});
}
function shutdown(){if(stopping)return;stopping=true;for(const child of children.values())child.kill('SIGTERM');setTimeout(()=>{for(const child of children.values())child.kill('SIGKILL');},5000).unref();}
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,shutdown);
console.log(`Tween Teach personnel → http://127.0.0.1:${port}/`);
console.log('Base séparée .data/chatgpt-personal. Créez votre mot de passe professeur, importez votre planification, puis ouvrez Ma classe & réglages → Réglages IA.');
start('web','server/index.mjs');
