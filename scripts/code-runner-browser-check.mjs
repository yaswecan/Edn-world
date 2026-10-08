import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import express from 'express';
import {pedagogyFixture} from '../tests/fixtures/pedagogy.mjs';
import {createApp} from '../server/app.mjs';
import {demoLesson} from '../server/demo-lesson.mjs';
import {practicalBaseline} from '../server/diagnostic-practice.mjs';
import {studentSpec,library} from '../server/generator.mjs';
import {lanAddress} from '../server/local-network.mjs';

const {store}=await pedagogyFixture();
let blockExecution=false;
const app=express();
// Serve the obsolete header over real HTTP: fulfilling a navigation with
// Playwright changes Chrome's local-network classification of the iframe.
app.get('/code-runner-frame.html',(req,res,next)=>{
 if(!blockExecution)return next();
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; frame-ancestors 'self'");
 res.sendFile(resolve('public/code-runner-frame.html'));
});
app.use(createApp(store));
const lan=process.argv.includes('--lan'),host=lan?lanAddress():'127.0.0.1';
const server=app.listen(0,host);
await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
const base=`http://${host}:${server.address().port}`,directory=lan?'test-results/code-runner-lan':'test-results/code-runner';
await mkdir(directory,{recursive:true});
const chrome=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
let browser,page;
const report={checks:[]},errors=[],validationRequests=[];
try{
 browser=await chromium.launch({headless:true,...existsSync(chrome)?{executablePath:chrome}:{}});
 page=await browser.newPage({viewport:{width:1440,height:1050}});
 page.on('pageerror',error=>errors.push(error.message));
 page.on('request',request=>{if(request.method()==='POST')validationRequests.push(new URL(request.url()).pathname);});
 await page.goto(base+'/lesson-demo.html');
 if(lan){
  assert.equal(await page.evaluate(()=>isSecureContext),false);
  const ids=await page.evaluate(async()=>{const {randomUUID}=await import('/random-id.js');return Array.from({length:100},()=>randomUUID());});
  assert.equal(new Set(ids).size,100);assert.ok(ids.every(id=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)));
  report.checks.push('HTTP-LAN-identifiers-without-secure-context');
 }
 await page.locator('.lesson-desktop-nav [data-action=demo-step][data-id="4"]').click();
 const root=page.locator('[data-workbench=guided-code]'),editor=root.locator('textarea'),output=root.locator('[data-code-output]'),status=root.locator('[data-code-status]');
 const run=async code=>{await editor.fill(code);await root.getByRole('button',{name:'Exécuter',exact:true}).click();};
 const done=()=>expect(status).toContainText('Exécution terminée.');
 await expect(output).toBeVisible();
 await expect(page.getByText(/Déboguer|Exécuter et déboguer|Points d’arrêt|Pas à pas/)).toHaveCount(0);
 await run('console.log();');await done();await expect(output).toBeEmpty();
 report.checks.push('console-log-without-arguments');
 // Reproduce a server still sending the old page CSP to the new runner frame.
 blockExecution=true;
 await run('console.log("code valide");');await expect(output).toContainText('Le moteur d’exécution n’a pas pu démarrer');
 await expect(status).toHaveText('Exécution indisponible. Ton code est conservé.');
 await expect(output).not.toContainText('Erreur JavaScript');await expect(editor).toHaveValue('console.log("code valide");');
 blockExecution=false;await root.locator('[data-code-execute]').click();await done();await expect(output).toHaveText('code valide');
 report.checks.push('blocked-worker-is-an-engine-error-recovery-with-code-preserved');
 await run('console.log("premier", 1, true);\nconsole.log("second", [2, 3], {ok: true}, null, undefined);');await done();
 assert.equal(await output.textContent(),'premier 1 true\nsecond [2, 3] {"ok": true} null undefined');
 report.checks.push('ordered-logs-with-multiple-arguments');
 await run('globalThis.valeur = 42; console.log(valeur);');await done();
 await run('console.log(typeof valeur);');await done();await expect(output).toHaveText('undefined');
 await expect(editor).toHaveValue('console.log(typeof valeur);');
 await run('');await done();await expect(output).toBeEmpty();
 report.checks.push('new-console-and-context-each-run-code-preserved');
 await run('console.log("avant");\nvaleurInconnue();');
 await expect(output).toContainText('Ligne 2');await expect(output).toContainText('ReferenceError');await expect(output).toContainText('avant');
 await run('const ok = true;\nconst invalide = ;');await expect(output).toContainText('SyntaxError');await expect(output).toContainText('Ligne 2');
 await run('console.log("corrigé");');await done();await expect(output).toHaveText('corrigé');
 report.checks.push('runtime-and-syntax-errors-with-lines-recovery');
 await run('console.log("début");\nwhile (true) {}');
 // A timer on the application thread must fire while the student's loop runs.
 assert.equal(await page.evaluate(()=>new Promise(resolve=>setTimeout(()=>resolve('page réactive'),100))),'page réactive');
 await expect(output).toContainText('Durée maximale dépassée');await expect(output).toContainText('début');
 await run('console.log("après la boucle");');await done();await expect(output).toHaveText('après la boucle');
 report.checks.push('infinite-loop-terminated-page-responsive-recovery');
 await run('for (let i = 0; i < 1000000; i++) console.log(i);');
 await expect(output).toContainText('Trop de messages');assert.ok((await output.textContent()).split('\n').length<=101);
 await run('for (let i = 0; i < 30; i++) console.log("x".repeat(4000));');await expect(output).toContainText('Trop de messages');assert.ok((await output.textContent()).length<66000);
 await run('const a = {nom: "élève"}; a.self = a; console.log(a, 12n); console.log("<img src=x onerror=alert(1)>");');await done();
 await expect(output).toContainText('[circulaire]');await expect(output).toContainText('12n');assert.equal(await output.locator('img').count(),0);
 report.checks.push('bounded-log-count-and-size-safe-object-and-text-display');
 await run('console.log("synchrone"); Promise.resolve().then(() => console.log("promesse")); setTimeout(() => console.log("différé"), 20);');await done();
 await expect(output).toHaveText('synchrone\npromesse\ndifféré');
 await run('Promise.reject(new Error("échec asynchrone"));');await expect(output).toContainText('échec asynchrone');await expect(output).toContainText('Ligne 1');
 await run('setTimeout(() => { throw new Error("erreur différée"); }, 10);');await expect(output).toContainText('erreur différée');
 report.checks.push('async-logs-and-errors');
 await run('setTimeout(() => console.log("ancien résultat"), 1000);');
 await run('console.log("nouveau résultat");');await done();await expect(output).toHaveText('nouveau résultat');
 await expect(page.locator('iframe[title="Exécution isolée"]')).toHaveCount(0);
 await run('while (true) {}');await editor.fill('console.log("modification pendant la boucle");');
 await root.getByRole('button',{name:'Exécuter',exact:true}).click();await done();await expect(output).toHaveText('modification pendant la boucle');
 report.checks.push('rapid-rerun-and-edit-cancel-old-execution');
 await run('console.log(typeof document, typeof window);\ntry { indexedDB.open("student-code"); } catch(e) { console.log(e.name); }\nfetch("'+base+'/api/session").then(() => console.log("NETWORK ALLOWED"), () => console.log("réseau bloqué"));\ntry { importScripts("'+base+'/code-runner-frame.js"); console.log("IMPORT ALLOWED"); } catch(e) { console.log("import bloqué"); }');await done();
 await expect(output).toContainText('undefined undefined');await expect(output).toContainText('SecurityError');await expect(output).toContainText('réseau bloqué');await expect(output).toContainText('import bloqué');
 report.checks.push('opaque-worker-no-dom-storage-network-or-imports');
 assert.deepEqual(validationRequests,[]);
 await editor.fill('function peutEntrer(aCarte, aReserve) { return aCarte && aReserve; }');
 await page.locator('[data-activity=guided-code]').getByRole('button',{name:'Vérifier mon code',exact:true}).click();
 await expect(page.locator('#console-guided-code')).toContainText('test');
 assert.deepEqual(validationRequests,['/api/demo/lesson/test']);
 report.checks.push('execution-does-not-validate-pedagogical-check-still-works');
 await run('console.log("Bonjour", "tout le monde");\nconsole.log([1, 2, 3].map(n => n * 2));');await done();
 await root.screenshot({path:directory+'/console-desktop.png'});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
 await root.screenshot({path:directory+'/console-mobile.png'});
 report.checks.push('console-visible-desktop-mobile-no-overflow');
 await page.setViewportSize({width:1440,height:1050});
 const lesson=demoLesson();lesson.diagnostic.tasks=practicalBaseline([{n3_code:'BC05-C1-2'}],library,()=>[]);
 const spec=studentSpec(lesson),attempt={id:'console-attempt',answers:{},submissionId:null},studentWrites=[];
 await page.route('**/api/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;let data={};
  if(request.method()==='POST')studentWrites.push(path);
  if(path==='/api/session')data={setupRequired:false,user:{id:'console-student',role:'student',classId:'DEMO',displayName:'Élève de test'}};
  else if(path==='/api/today')data={lesson:{id:'console-lesson',versionId:'console-v1',status:'published',spec},attempt,progress:{stepId:'diagnostic'}};
  else if(path.endsWith('/start'))data=attempt;
  else if(path.endsWith('/save')){attempt.answers=request.postDataJSON().answers;data={receivedAt:new Date().toISOString()};}
  else if(path==='/api/events')data={};
  else throw Error('Unexpected API route '+path);
  await route.fulfill({json:data});
 });
 await page.goto(base+'/today');
 const panels=page.locator('[data-code-runner]');await expect(panels.first()).toBeVisible();assert.ok(await panels.count()>=2);
 for(let i=0;i<2;i++){
  const panel=panels.nth(i);await panel.locator('..').locator('textarea').fill(`console.log("exercice ${i}");`);await panel.locator('[data-code-execute]').click();
  await expect(panel.locator('[data-code-output]')).toHaveText(`exercice ${i}`);
 }
 await expect(panels.first().locator('[data-code-output]')).toHaveText('exercice 0');
 assert.equal(studentWrites.some(path=>/submit|code\/run|\/test$/.test(path)),false);
 await page.reload();await expect(page.locator('[data-answer=baseline-condition]')).toHaveValue('console.log("exercice 0");');
 await expect(panels.first().locator('[data-code-output]')).toBeEmpty();
 await panels.first().locator('..').locator('textarea').fill('while (true) {}');await panels.first().locator('[data-code-execute]').click();
 await page.locator('[data-workbench=baseline-condition]').evaluate(node=>node.remove());await expect(page.locator('iframe[title="Exécution isolée"]')).toHaveCount(0);
 report.checks.push('shared-student-diagnostic-editors-independent-consoles-saved-code-cleanup');
 assert.deepEqual(errors,[]);report.status='PASS';
}catch(error){report.status='FAIL';report.error=error.stack;await page?.screenshot({path:directory+'/failure.png',fullPage:true});throw error;}
finally{await writeFile(directory+'/report.json',JSON.stringify(report,null,2)+'\n');await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await store.close();}
console.log(JSON.stringify(report,null,2));
