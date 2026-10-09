// Opt-in real Docker acceptance. No .env file, active catalogue or shared lab state.
import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,readdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {chromium,expect} from '@playwright/test';
import {diagnosticRevisionFixture} from '../tests/fixtures/diagnostic-revision.mjs';
import {pedagogyFixture,pilotDefinitions} from '../tests/fixtures/pedagogy.mjs';
import {exportLessons,readTransfer,beginUpload,writeChunk,previewTransfer,applyTransfer} from '../server/lesson-transfer.mjs';
import {createApp} from '../server/app.mjs';

if(process.env.NODE_ENV==='production')throw Error('Recette isolée uniquement.');
const image=name=>execFileSync('docker',['image','inspect',name,'--format','{{.Id}}'],{encoding:'utf8'}).trim();
const shell=image('tweenteach-shell:quality-v2'),dom=image('tweenteach-dom:quality-v2'),token=randomBytes(32).toString('hex');
const root=await mkdtemp(join(tmpdir(),'tween-transfer-labs-')),state=join(root,'state'),directory='test-results/lesson-transfer';await mkdir(directory,{recursive:true});
const socket=createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(r=>socket.close(r));
const broker=spawn('python3',['labs/broker.py'],{env:{...process.env,TWEEN_LAB_HOST:'127.0.0.1',TWEEN_LAB_PORT:String(port),TWEEN_LAB_TOKEN:token,TWEEN_LAB_IMAGE:shell,TWEEN_DOM_IMAGE:dom,TWEEN_LAB_STATE:state},stdio:['ignore','ignore','pipe']});
Object.assign(process.env,{EDEN_LAB_URL:`http://127.0.0.1:${port}`,EDEN_LAB_TOKEN:token,EDEN_LAB_SHELL_IMAGE:shell,EDEN_LAB_DOM_IMAGE:dom});
const source=await diagnosticRevisionFixture(pilotDefinitions[2]),css=await diagnosticRevisionFixture(),dest=await pedagogyFixture(),report={scope:'Real Docker Desktop broker and immutable installed images, source store closed after export; synthetic lessons',images:{shell,dom},checks:[]};
let browser,server,sourceClosed=false;
try{
 for(let i=0;i<50;i++){try{const r=await fetch(process.env.EDEN_LAB_URL+'/capabilities',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({profiles:['shell-git']})});if(r.ok)break;}catch{}if(i===49)throw Error('Broker unavailable');await new Promise(r=>setTimeout(r,100));}
 const v=await css.store.get('lesson_versions',css.lesson.versionId),task=v.spec.activities.find(a=>a.id==='guided');
 const script='let n=0;document.querySelector("button").onclick=()=>{document.querySelector("output").textContent=++n;console.log(n)}';
 Object.assign(task,{starter:script,reference:script,correctionMode:'javascript',workshop:{language:'javascript',profile:'dom',files:[{path:'index.html',content:'<!doctype html><html lang="fr"><meta charset="utf-8"><button>Compter</button><output>0</output><script src="/main.js"></script></html>'},{path:'style.css',content:'body{font:20px sans-serif}'},{path:'main.js',content:script}]},tests:[{invoke:'dom-behavior',argsJSON:JSON.stringify({label:'Deux clics',steps:[{action:'click',selector:'button'},{action:'click',selector:'button'},{action:'text',selector:'output',value:'2'}]}),expectedJSON:'true'}]});
 await source.store.insert('lessons',css.lesson);await source.store.insert('lesson_versions',v);
 const exported=await exportLessons(source.store,[source.lesson.id,css.lesson.id],source.actor),{bytes}=await readTransfer(source.store,exported.id,source.actor);await source.store.close();sourceClosed=true;
 const transfer=await beginUpload(dest.store,{bytes:bytes.length,sha256:exported.sha256},dest.actor);for(let i=0;i<transfer.chunks;i++)await writeChunk(dest.store,transfer.id,i,bytes.subarray(i*transfer.chunkBytes,(i+1)*transfer.chunkBytes),dest.actor);
 let preview=await previewTransfer(dest.store,transfer.id,{},dest.actor);const domAvailable=!preview.rows[1].blockers.length;
 if(!domAvailable){assert.equal(preview.canApply,false);assert.equal((await dest.store.list('lessons')).length,0);report.dom={status:'FAIL',reason:preview.rows[1].blockers.join(' '),transferProtection:'PASS — excluded before activation'};preview=await previewTransfer(dest.store,transfer.id,{choices:preview.choices.map((c,i)=>({...c,action:i===1?'ignore':'add'}))},dest.actor);}
 assert.equal(preview.canApply,true,JSON.stringify(preview.rows));assert.equal((await dest.store.list('lab_sessions')).length,0);report.checks.push('engine-smoke-probe-never-executes-archive-code');
 const result=await applyTransfer(dest.store,transfer.id,{token:preview.token,confirmed:true},dest.actor),shellLesson=await dest.store.get('lessons',result.lessons[0].id),domLesson=domAvailable?await dest.store.get('lessons',result.lessons[1].id):null;
 server=createApp(dest.store).listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 await context.request.post(base+'/api/login',{data:{role:'teacher',username:'professeur',password:'quality-preview-only'}});
 await page.goto(base);await page.locator('.nav [data-id="lessons"]').click();await page.locator(`[data-action="open-lesson"][data-id="${shellLesson.id}"]`).click();await page.getByRole('button',{name:'Aperçu élève',exact:true}).click();await page.getByRole('button',{name:'Aller aux éditeurs'}).click();await page.getByRole('button',{name:'Connecter le terminal',exact:true}).click();const terminal=page.locator('[data-real-lab="guided"]');await expect(terminal.locator('[role="status"]')).toContainText('Connecté',{timeout:30000});
 const session=(await dest.store.list('lab_sessions'))[0];assert.equal(session.preview,true);assert.equal(session.jobId,undefined);
 const input=await context.request.post(base+`/api/labs/${session.id}/io`,{data:{cursor:0,input:'mkdir -p projet\nmv brouillon/notes.txt projet/notes.txt\n',cols:80,rows:20}});assert.ok(input.ok());
 await expect(async()=>{const r=await context.request.post(base+`/api/labs/${session.id}/check`,{data:{}});assert.equal((await r.json()).ok,true);}).toPass({timeout:10000});
 const files=await(await context.request.post(base+`/api/labs/${session.id}/files`,{data:{action:'list'}})).json();assert.equal(Buffer.from(files.files.find(f=>f.path==='projet/notes.txt').base64,'base64').toString(),'réunion jeudi\n');await page.screenshot({path:directory+'/shell-imported.png'});report.checks.push('imported-shell-preview-without-generation-job','real-pty-files-and-validation-after-source-shutdown');
 if(domAvailable){ await page.getByRole('button',{name:'Fermer',exact:true}).click();await page.getByRole('button',{name:'Retour aux séances'}).click();await page.locator(`[data-action="open-lesson"][data-id="${domLesson.id}"]`).click();await page.getByRole('button',{name:'Aperçu élève',exact:true}).click();await page.getByRole('button',{name:'Aller aux éditeurs'}).click();await page.getByRole('button',{name:'Enregistrer et lancer',exact:true}).click();const domRoot=page.locator('[data-dom-lab="guided"]');await expect(domRoot.locator('[role="status"]')).toContainText('Aperçu prêt',{timeout:30000});await page.getByRole('button',{name:'Vérifier les interactions',exact:true}).click();await expect(domRoot.locator('[role="status"]')).toContainText('✓ Deux clics',{timeout:30000});await expect(domRoot.locator('[data-dom-console]')).toContainText('2');await page.screenshot({path:directory+'/dom-imported.png'});report.checks.push('imported-dom-editor-render-console-and-private-tests','docker-browser-sandbox-retained');report.dom={status:'PASS'};}else report.checks.push('unavailable-dom-blocks-import-before-any-active-change');
 assert.equal((await dest.store.list('learning_events')).length,0);assert.equal((await dest.store.list('assessment_attempts')).length,0);report.checks.push('teacher-preview-does-not-create-student-progress');report.status=domAvailable?'PASS':'FAIL';process.exitCode=domAvailable?0:1;
}catch(e){report.status='FAIL';report.error=e.stack;throw e;}
finally{
 await writeFile(directory+'/labs-report.json',JSON.stringify(report,null,2)+'\n');if(browser){for(const context of browser.contexts())await context.close();await browser.close();}
 if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
 broker.kill('SIGTERM');await once(broker,'exit').catch(()=>{});
 for(const file of await readdir(state).catch(()=>[])){if(!/^[a-f0-9]{64}\.json$/.test(file))continue;const record=JSON.parse(await readFile(join(state,file),'utf8'));if(record.container===`tween-lab-${file.slice(0,-5)}`)execFileSync('docker',['rm','-f',record.container],{stdio:'ignore'});}
 if(!sourceClosed)await source.store.close();await css.store.close();await dest.store.close();await rm(root,{recursive:true,force:true});
}
console.log(JSON.stringify(report,null,2));
