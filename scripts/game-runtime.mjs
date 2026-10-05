import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
let source=readFileSync('legacy/pedagolab/public/app.js','utf8');
const validators=source.slice(source.indexOf('function getFile'),source.indexOf('async function loadTeacherStudents'));
mkdirSync('public/game',{recursive:true});
// Only browser workers run the original game evaluators. The parent enforces a
// timeout, denies network via CSP, and treats results as unverified observations.
const worker=validators+`\nself.onmessage=e=>{const {m,d,index}=e.data;self.postMessage(testMission(m,d,index));};`;
source=source.replace(/const WORLDS=[\s\S]*?\nfunction defaultPlatform/, 'let WORLDS={};\nfunction defaultPlatform');
source=source.replace(/async function saveProgress\(\)[\s\S]*?\nasync function loadResources/,`async function saveProgress(){sendHost({type:'eden:progress',progress:platform()});}\nasync function loadResources`);
source=source.replace(/function recordEvidence\([\s\S]*?\nfunction toast/,`function recordEvidence(codes,score,meta={}){sendHost({type:'eden:event',eventType:'mission_completed',payload:{codes,score,meta,files:missionDraft(activeWorld,WORLDS[activeWorld].missions.find(m=>m.id===activeMission)).files}});}\nfunction toast`);
source=source.replace("$('#testScenario').onclick=()=>", "$('#testScenario').onclick=async()=>").replace("$('#validateMission').onclick=()=>", "$('#validateMission').onclick=async()=>");
source=source.replaceAll('const r=testMission(m,d,d.scenario);','const r=await workerTest(m,d,d.scenario);').replaceAll('const r=testMission(m,d,i);','const r=await workerTest(m,d,i);');
source=source.replace(validators,'');
// Preserve the student wording already used by the integrated runtime. Keep it
// in the generator too, so rebuilding cannot restore premature save claims.
source=source.replace("d.lastResult='Brouillon enregistré.'", "d.lastResult='Enregistrement demandé.'");
source=source.replace("toast('Progression enregistrée')", "toast('Enregistrement demandé.')");
source=source.replace("toast(m.final?'Production validée — nouveau monde potentiellement débloqué':'Mission validée')", "toast(m.final?'Production réussie.':'Mission réussie.')");
source=source.replace('<textarea id="missionCode"', '<textarea aria-label="Ton code · ${esc(activeFile)}" id="missionCode"');
source=source.replace('<div class="eyebrow">${esc(u.code)} · ${esc(u.blockId)}</div>', "${session.role==='student'?'':`<div class=\"eyebrow\">${esc(u.code)} · ${esc(u.blockId)}</div>`}");
source=source.replace('<h4>Preuve attendue</h4>', '<h4>À réaliser</h4>');
source=source.replace("if(!w||!worldUnlocked(activeWorld))", "if(!w||!worldUnlocked(activeWorld))");
// Keep the player inside the assigned mission. Other missions require a new EDEN launch.
source=source.replace("const unlocked=i===0||missionDone(activeWorld,w.missions[i-1].id);", "const unlocked=x.id===activeMission;");
source=source.replace("$('#backHub').onclick=()=>{activeWorld=null;activeMission=null;renderStudent();};", "$('#backHub').onclick=()=>sendHost({type:'eden:close'});");
const bridge=`
const WORKER_SOURCE=${JSON.stringify(worker)};
async function workerTest(m,d,index){
 sendHost({type:'eden:event',eventType:'test_run',payload:{index}});
 const result=await new Promise(resolve=>{const url=URL.createObjectURL(new Blob([WORKER_SOURCE],{type:'text/javascript'})),w=new Worker(url);let settled=false;const finish=r=>{if(settled)return;settled=true;clearTimeout(timer);w.terminate();URL.revokeObjectURL(url);resolve(r);};const timer=setTimeout(()=>finish({pass:false,message:'Temps maximal dépassé (1 seconde). Simplifie ou fais relire le code.'}),1000);w.onmessage=e=>finish({pass:e.data?.pass===true,message:String(e.data?.message||'').slice(0,3000)});w.onerror=()=>finish({pass:false,message:'Exécution indisponible : demander une relecture.'});w.postMessage({m,d,index});});
 sendHost({type:'eden:event',eventType:result.pass?'test_passed':'test_failed',payload:{index,result}});return result;
}
let hostPort=null;
function sendHost(message){if(hostPort)hostPort.postMessage(message);else parent.postMessage(message,'*');}
function initHost(c){if(c?.type!=='eden:init'||session.role)return;WORLDS=c.worlds;resources=c.resources;session.role='student';session.user=c.user;session.worldOverrides={[c.worldId]:true};session.progressRoot={platform:c.progress||defaultPlatform()};platform().callsign=c.user.displayName;activeWorld=c.worldId;activeMission=c.missionId;renderWorld();sendHost({type:'eden:event',eventType:'mission_started',payload:{}});}
window.addEventListener('message',e=>{if(e.source!==parent||session.role||hostPort)return;if(e.data?.type==='eden:connect'&&e.ports.length===1){hostPort=e.ports[0];hostPort.onmessage=event=>initHost(event.data);hostPort.start();}else initHost(e.data);});
parent.postMessage({type:'eden:ready'},'*');
`;
source=source.replace('boot();\n})();',bridge+'\n})();');
writeFileSync('public/game/runtime.js',source);copyFileSync('legacy/pedagolab/public/app.css','public/game/style.css');
writeFileSync('public/game/index.html','<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>EDEN Game Runtime</title><link rel="stylesheet" href="/game/style.css"><div id="app"></div><div id="toast" aria-live="polite"></div><script src="/game/runtime.js"></script></html>');
console.log('PédagoLab renderer and validators encapsulated; network disabled; worker deadline 1000ms.');
