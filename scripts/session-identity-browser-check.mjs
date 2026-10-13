import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {diagnosticRevisionFixture} from '../tests/fixtures/diagnostic-revision.mjs';
import {createApp} from '../server/app.mjs';
import {publishLesson} from '../server/domain.mjs';
import {saveIdentity} from '../server/session-identity.mjs';
import {passwordHash} from '../server/auth.mjs';

const f=await diagnosticRevisionFixture(),directory='test-results/session-identity';await mkdir(directory,{recursive:true});
const refs=[];
for(let i=1;i<=5;i++){const c=await f.store.insert('competency_n3',{id:'browser-competency-'+i,classId:'A1',n3_code:'SOURCE-'+i,n3_label:'Compétence CSS '+i,n2_code:'SOURCE-PARENT',n2_label:'Développement web',observable_criterion:'Expliquer les dimensions de la boîte'});refs.push({competencyId:c.id});}
await f.store.insert('learners',{id:'identity-student',classId:'A1',username:'identity-student',displayName:'Élève de recette',passwordHash:passwordHash('identity-browser-password')});
await f.store.transaction(tx=>saveIdentity(tx,f.lesson,{pedagogicalTitle:'CSS : modèle de boîte et dimensions',identityRevision:0,competencyRefs:refs},f.actor));
await publishLesson(f.store,f.lesson.id,f.actor,{version:1,confirmed:true,validationMode:'teacher'});
const server=createApp(f.store).listen(0,'127.0.0.1');await new Promise((r,j)=>{server.once('listening',r);server.once('error',j);});
const base='http://127.0.0.1:'+server.address().port,errors=[],report={scope:'Isolated in-memory fixtures; no production connection',checks:[]};let browser,page;
try{
 const chrome=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
 browser=await chromium.launch({headless:true,...existsSync(chrome)?{executablePath:chrome}:{}});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.request.post(base+'/api/login',{data:{role:'teacher',username:'professeur',password:'quality-preview-only'}});
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/?editLesson='+encodeURIComponent(f.lesson.id));await expect(page.getByRole('heading',{name:'CSS : modèle de boîte et dimensions',exact:true})).toBeVisible();
 await page.locator('.competency-detail summary').first().click();await expect(page.locator('.competency-popover').first()).toContainText('Développement web');await expect(page.locator('.competency-popover').first()).toContainText('Expliquer les dimensions');
 await page.locator('.competency-overflow>summary').first().click();await expect(page.getByText('SOURCE-5',{exact:true}).first()).toBeVisible();report.checks.push('exact source codes, parent and criteria; accessible overflow');
 await page.getByRole('button',{name:'Intitulé et compétences',exact:true}).click();await page.locator('[name=pedagogicalTitle]').fill('CSS : dimensions, marges et remplissage');await page.locator('#identity-picker input[type=search]').fill('SOURCE-5');await page.locator('#identity-picker input[type=checkbox]').uncheck();
 await expect(page.locator('#identity-preview')).toContainText('CSS : dimensions, marges et remplissage');await page.getByRole('button',{name:'Enregistrer et valider',exact:true}).click();await expect(page.getByRole('heading',{name:'CSS : dimensions, marges et remplissage',exact:true})).toBeVisible();
 assert.equal((await f.store.get('lessons',f.lesson.id)).competencyRefs.length,4);report.checks.push('teacher title edit, code search, association removal and student card preview');
 await page.getByRole('button',{name:'Modifier',exact:true}).click();await expect(page.locator('#lesson-title')).toHaveValue('CSS : dimensions, marges et remplissage');await page.getByText('Compétences et carte élève',{exact:true}).click();await page.locator('#editor-competencies input[type=search]').fill('Compétence CSS 5');await page.locator('#editor-competencies input[type=checkbox]').check();await page.locator('#lesson-title').fill('CSS : mesurer le modèle de boîte');await page.locator('[data-edit=save]').click();await expect(page.locator('#save-state')).toHaveText('Enregistré');await page.reload();await expect(page.locator('#lesson-title')).toHaveValue('CSS : mesurer le modèle de boîte');assert.equal((await f.store.get('lessons',f.lesson.id)).competencyRefs.length,5);report.checks.push('content editor persists canonical title and existing competency links');
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);await page.screenshot({path:directory+'/teacher-mobile.png',fullPage:true});
 const students=await browser.newContext({viewport:{width:390,height:844}});await students.request.post(base+'/api/login',{data:{role:'student',username:'identity-student',password:'identity-browser-password'}});const pupil=await students.newPage();pupil.on('pageerror',e=>errors.push(e.message));await pupil.goto(base+'/suivi.html?view=lessons');await expect(pupil.getByRole('heading',{name:'CSS : mesurer le modèle de boîte',exact:true})).toBeVisible();await expect(pupil.locator('.competency-detail')).toHaveCount(0);await pupil.locator('.competency-overflow>summary').click();await expect(pupil.getByText('SOURCE-5',{exact:true})).toBeVisible();assert.equal(await pupil.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);await pupil.screenshot({path:directory+'/student-mobile.png',fullPage:true});
 await pupil.goto(base+'/today?lesson='+encodeURIComponent(f.lesson.id));await expect(pupil.getByRole('heading',{name:'CSS : mesurer le modèle de boîte',exact:true}).first()).toBeVisible();await pupil.goto(base+'/suivi.html?view=evaluations');await expect(pupil.getByRole('heading',{name:'CSS : mesurer le modèle de boîte',exact:true})).toBeVisible();report.checks.push('same title in student history, today and evaluations; mobile without overflow');
 assert.deepEqual(errors,[]);report.status='PASS';
}catch(error){report.status='FAIL';report.error=error.stack;report.browserErrors=errors;await page?.screenshot({path:directory+'/failure.png',fullPage:true});throw error;}
finally{await writeFile(directory+'/report.json',JSON.stringify(report,null,2)+'\n');await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));await f.store.close();}
console.log(JSON.stringify(report,null,2));
