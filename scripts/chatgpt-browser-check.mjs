import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {mkdir,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {pedagogyFixture} from '../tests/fixtures/pedagogy.mjs';
import {chatgptFixture} from '../tests/fixtures/chatgpt.mjs';
import {createApp} from '../server/app.mjs';
import {runGenerationStep} from '../server/pedagogy/jobs.mjs';

const output=resolve('test-results/chatgpt');await mkdir(output,{recursive:true});
const {store,actor}=await pedagogyFixture(),server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');
const base=`http://127.0.0.1:${server.address().port}`,f=await chatgptFixture({origin:base});server.on('request',createApp(store,{chatgpt:f.client}));
const options={headless:true},chrome=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';if(existsSync(chrome))options.executablePath=chrome;
const report={date:new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris'}).format(new Date()),browser:'NOT RUN',authentication:'SIMULATED',inference:'NOT RUN',checks:[]};let browser;
try{
 browser=await chromium.launch(options);const context=await browser.newContext(),errors=[];context.setDefaultTimeout(20000);await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());let page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/ai-settings.html');await page.locator('#password').waitFor();assert.equal(new URL(page.url()).searchParams.get('next'),'ai-settings');
 await page.locator('#password').fill('quality-preview-only');await page.getByRole('button',{name:'Se connecter',exact:true}).click();await page.locator('#provider').waitFor();assert.equal(new URL(page.url()).pathname,'/ai-settings.html');
 const connect=page.getByRole('button',{name:'Continue with ChatGPT',exact:true});assert.equal(await connect.isEnabled(),true);
 await page.setViewportSize({width:390,height:844});assert.ok((await connect.boundingBox()).y<650);await page.screenshot({path:resolve(output,'connect-mobile.png'),fullPage:true});
 await page.goto(base);await page.getByRole('button',{name:'ChatGPT & API',exact:true}).click();await connect.waitFor();
 await page.goto(base+'/?next=https://example.invalid');await page.locator('.nav').waitFor();assert.equal(new URL(page.url()).origin,base);await page.setViewportSize({width:1280,height:960});
 report.checks.push('teacher-login-returns-to-ai-settings','chatgpt-button-visible-on-mobile','direct-teacher-menu-access','external-return-destination-ignored');
 await page.getByRole('button',{name:'Ma classe & réglages',exact:false}).click();await page.getByRole('link',{name:'Réglages IA · API ou ChatGPT'}).click();await page.locator('#provider').waitFor();
 await context.route('**/api/ai/chatgpt/connect',async route=>{
  const authorization=await route.fetch({maxRedirects:0});assert.equal(authorization.status(),303);const u=new URL(authorization.headers().location);assert.equal(u.origin,'https://auth.openai.com');f.authority.codes.set('browser-code',{nonce:u.searchParams.get('nonce')});const callback=new URL('/auth/callback',base);callback.search=new URLSearchParams({code:'browser-code',state:u.searchParams.get('state'),client_id:'oaiapp_browser'}).toString();
  await route.fulfill({response:authorization,status:303,headers:{...authorization.headers(),location:callback.href},body:''});
 });
 await page.getByRole('button',{name:'Continue with ChatGPT',exact:true}).click();await page.locator('#welcome').waitFor({state:'visible'});await page.getByRole('button',{name:'Compris',exact:true}).click();
 // Reproduce a successful sign-in followed by a preparation still using the unconfigured API.
 await page.getByRole('link',{name:'Préparer une séance',exact:true}).click();await page.locator('#activate-chatgpt').waitFor();
 const pendingBody=await page.evaluate(()=>{const form=document.querySelector('#generate');return {entryId:form.elements.entryId.value,intent:form.elements.intent.value,sourceIds:[]};});
 const blockedResponse=await context.request.post(base+'/api/preparation/jobs',{data:{...pendingBody,requestId:'before-chatgpt-setup'}});assert.equal(blockedResponse.status(),202);const blocked=await blockedResponse.json();assert.equal(blocked.status,'blocked');assert.equal(blocked.provider,'openai_api');
 await page.evaluate(body=>sessionStorage.setItem('tween-preparation-action',JSON.stringify({fingerprint:JSON.stringify(body),requestId:'before-chatgpt-setup'})),pendingBody);
 await page.goto(base+'/preparation.html?job='+encodeURIComponent(blocked.id));await page.locator('.preparation-nav [data-view=new]').click();await page.locator('#activate-chatgpt').waitFor();assert.equal(await page.getByRole('button',{name:'Lancer la préparation',exact:true}).isDisabled(),true);
 await page.locator('#activate-chatgpt [name=model]').selectOption('account-model');
 assert.equal((await store.get('teachers',actor.id)).aiPreferences,undefined);assert.equal((await store.list('generation_jobs',actor.classId)).length,1);
 await page.getByRole('button',{name:'Utiliser ChatGPT pour les préparations',exact:true}).click();await page.getByText('ChatGPT est sélectionné. Vous pouvez lancer une nouvelle préparation.',{exact:true}).waitFor();
 assert.equal((await store.get('teachers',actor.id)).aiPreferences.provider,'chatgpt_plan');assert.equal((await store.get('generation_jobs',blocked.id)).config.provider,'openai_api');assert.equal((await store.get('generation_jobs',blocked.id)).status,'blocked');
 assert.equal((await store.list('generation_jobs',actor.classId)).length,1);assert.equal(await page.locator('#generate [name=intent]').inputValue(),pendingBody.intent);assert.equal(await page.evaluate(()=>sessionStorage.getItem('tween-preparation-action')),null);assert.equal(await page.getByRole('button',{name:'Lancer la préparation',exact:true}).isEnabled(),true);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);await page.setViewportSize({width:1280,height:960});
 report.checks.push('connected-account-can-be-selected-from-preparation','provider-choice-explicit-without-generation','blocked-api-action-kept-and-new-action-prepared');
 await page.locator('#ai-options summary').click();await page.getByRole('link',{name:'Modifier les réglages IA',exact:true}).click();
 await page.getByRole('button',{name:'Vérifier les modèles et l’accès',exact:true}).click();await page.getByText('Catalogue actualisé. Choisissez le modèle puis enregistrez le mode.',{exact:true}).waitFor();
 await page.locator('[name=provider]').selectOption('chatgpt_plan');await page.locator('[name=model]').selectOption('account-model');await page.getByRole('button',{name:'Enregistrer ce choix',exact:true}).click();await page.getByText('Choix enregistré pour les prochaines préparations.',{exact:true}).waitFor();
 assert.equal((await store.get('teachers',actor.id)).aiPreferences.provider,'chatgpt_plan');
 await page.screenshot({path:resolve(output,'settings-desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:resolve(output,'settings-mobile.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
 report.checks.push('official-button-and-loopback-callback-with-synthetic-OIDC','first-connection-welcome','account-model-selection','provider-preference','mobile-no-overflow');
 await page.getByRole('link',{name:'Préparer une séance',exact:true}).click();await page.locator('#generate').waitFor();await page.getByRole('button',{name:'Lancer la préparation',exact:true}).click();await page.getByText('Votre demande est enregistrée. Vous pouvez suivre sa préparation ici.',{exact:true}).waitFor();
 const first=(await store.list('generation_jobs',actor.classId)).find(j=>j.id!==blocked.id);assert.equal(first.config.provider,'chatgpt_plan');
 const request=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('tween-preparation-action')));const repeated=await context.request.post(base+'/api/preparation/jobs',{data:{entryId:first.entryId,intent:first.brief.intent,sourceIds:first.sourceIds,requestId:request.requestId}});assert.equal((await repeated.json()).id,first.id);assert.equal((await store.list('generation_jobs',actor.classId)).length,2);
 await page.close();await runGenerationStep(store);const saved=await store.get('generation_jobs',first.id);assert.equal(saved.stage,'analysis');assert.ok(saved.lessonId);
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/preparation.html?job='+encodeURIComponent(first.id));await page.getByRole('button',{name:'Annuler la préparation',exact:true}).click();await page.locator('#job .preparation-badge').filter({hasText:'Annulée'}).waitFor();assert.equal((await store.get('generation_jobs',first.id)).status,'cancelled');
 await page.screenshot({path:resolve(output,'job-cancelled.png'),fullPage:true});report.checks.push('job-persists-after-tab-close','repeated-action-idempotent','reload-and-cancel');
 await page.goto(base+'/ai-settings.html');await page.getByRole('button',{name:'Déconnecter',exact:true}).click();await page.getByText('Connexion déconnectée et session révoquée.',{exact:true}).waitFor();assert.equal((await f.client.list(actor))[0].state,'not_connected');report.checks.push('disconnect-and-revoke');
 assert.deepEqual(errors,[]);report.browser='PASS';console.log(JSON.stringify(report,null,2));
}catch(error){report.browser='FAIL';report.error=error.message;const failedPage=browser?.contexts()[0]?.pages().at(-1);if(failedPage){report.pageMessage=await failedPage.locator('body').innerText().catch(()=>'unavailable');await failedPage.screenshot({path:resolve(output,'failure.png'),fullPage:true}).catch(()=>{});}throw error;}
finally{await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));await store.close();await f.close();}
