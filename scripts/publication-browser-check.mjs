import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {diagnosticRevisionFixture} from '../tests/fixtures/diagnostic-revision.mjs';
import {passwordHash} from '../server/auth.mjs';
import {createApp} from '../server/app.mjs';

const directory='test-results/publication';await mkdir(directory,{recursive:true});
const {store,actor,lesson}=await diagnosticRevisionFixture(),entry=await store.get('plan_entries','box'),plan=await store.get('plan_versions','quality-plan');
plan.entries=[entry];await store.put('plan_versions',plan);await store.insert('plan_versions',{...plan,id:'later-plan',version:2,entries:[entry,{id:'another-date'}]});
await store.insert('learners',{id:'student',classId:actor.classId,username:'student',displayName:'Élève de recette',passwordHash:passwordHash('student-check-only')});
const server=createApp(store).listen(0,'127.0.0.1');await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
const base=`http://127.0.0.1:${server.address().port}`,chrome=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
let browser,page;const errors=[],report={scope:'Isolated publication and authenticated student access, real browser and HTTP; no AI calls',checks:[]};
try{
 browser=await chromium.launch({headless:true,...existsSync(chrome)?{executablePath:chrome}:{}});
 const teacher=await browser.newContext({viewport:{width:1440,height:1050}});await teacher.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
 await teacher.request.post(base+'/api/login',{data:{role:'teacher',username:'professeur',password:'quality-preview-only'}});
 page=await teacher.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.locator('.nav [data-id=lessons]').click();await page.locator(`[data-action=open-lesson][data-id="${lesson.id}"]`).click();
 await page.getByRole('button',{name:'Publier cette version',exact:true}).click();await expect(page.getByRole('heading',{name:'Publier cette séance ?',exact:true})).toBeVisible();
 assert.equal((await store.list('corpus_packages')).length,1);assert.equal((await store.get('lessons',lesson.id)).status,'draft');
 await page.getByRole('button',{name:'Valider et publier',exact:true}).click();await expect(page.getByRole('heading',{name:'Accès élèves',exact:true})).toBeVisible();
 await expect(page.locator('#student-link')).toHaveValue(base+'/today?lesson='+encodeURIComponent(lesson.id));await expect(page.locator('#dialog')).toContainText('uniquement sur cet ordinateur');await page.screenshot({path:directory+'/teacher-access.png'});
 const published=await store.get('lessons',lesson.id);assert.equal(published.status,'published');assert.equal((await store.list('lesson_publications')).length,1);
 report.checks.push('unrelated-plan-change-does-not-block','missing-corpus-compiled-once','teacher-confirmation-publishes-exact-version','direct-link-and-local-hosting-explanation');
 const student=await browser.newContext({viewport:{width:1280,height:900}});await student.route('**/*',route=>{
  const url=new URL(route.request().url());if(url.origin!==base)return route.abort();
  return url.pathname==='/api/today'&&!url.search?route.continue({url:base+'/api/today?date=2099-01-01'}):route.continue();
 });
 await student.request.post(base+'/api/login',{data:{role:'student',username:'student',password:'student-check-only'}});
 const studentPage=await student.newPage();studentPage.on('pageerror',e=>errors.push(e.message));await studentPage.goto(base+'/today');await expect(studentPage.getByRole('heading',{name:'Séances disponibles'})).toBeVisible();
 await studentPage.getByRole('link',{name:'Ouvrir la séance',exact:true}).click();await expect(studentPage.locator('.lesson-stage')).toBeVisible();assert.equal(new URL(studentPage.url()).searchParams.get('lesson'),lesson.id);
 await studentPage.getByRole('button',{name:'Continuer',exact:true}).click();await expect(studentPage.locator('[data-component=DiagnosticIntro]')).toBeVisible();await studentPage.reload();await expect(studentPage.locator('[data-component=DiagnosticIntro]')).toBeVisible();
 await studentPage.setViewportSize({width:390,height:844});assert.equal(await studentPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await studentPage.screenshot({path:directory+'/student-mobile.png'});
 assert.equal((await store.list('assessment_attempts')).length,1);assert.equal((await store.list('submissions')).length,0);report.checks.push('student-list-on-another-date','direct-link-survives-reload','one-owned-diagnostic-attempt','student-mobile-no-overflow');
 const blocked={...lesson,id:'cancelled-draft',versionId:'cancelled-draft:v1',qualityRequired:true,qualityJobId:'cancelled'};
 const version=await store.get('lesson_versions',lesson.versionId);await store.insert('lessons',blocked);await store.insert('lesson_versions',{...version,id:blocked.versionId,lessonId:blocked.id,spec:{...version.spec,lessonId:blocked.id}});await store.insert('generation_jobs',{id:'cancelled',classId:actor.classId,status:'cancelled',lessonId:blocked.id,sources:[]});
 await page.getByRole('button',{name:'Fermer',exact:true}).first().click();await page.reload();await page.locator('.nav [data-id=lessons]').click();await page.locator(`[data-action=open-lesson][data-id="${blocked.id}"]`).click();await page.getByRole('button',{name:'Publier cette version',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Ce qu’il reste avant de publier'})).toBeVisible();await expect(page.locator('#dialog')).toContainText('annulée avant validation');await expect(page.getByRole('button',{name:'Préparer une nouvelle version',exact:true})).toBeVisible();await page.screenshot({path:directory+'/actionable-blocker.png'});
 assert.equal((await store.get('lessons',blocked.id)).status,'draft');assert.equal((await store.list('generation_calls')).length,0);assert.deepEqual(errors,[]);report.checks.push('cancelled-preparation-has-specific-actions-and-stays-unpublished','no-ai-calls-or-browser-errors');report.status='PASS';
}catch(error){report.status='FAIL';report.error=error.stack;await page?.screenshot({path:directory+'/failure.png'});throw error;}
finally{await writeFile(directory+'/report.json',JSON.stringify(report,null,2)+'\n');await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await store.close();}
console.log(JSON.stringify(report,null,2));
