import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
import {competencyFixture} from '../tests/fixtures/competency-v2.mjs';
process.env.EDEN_WORLD_ARCADE='1';
const f=await competencyFixture(),dir='test-results/student-hub';await mkdir(dir,{recursive:true});
const chrome=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const report={scope:'Comptes fictifs, base en mémoire, services externes bloqués',checks:[]},errors=[];
const check=message=>{report.checks.push(message);console.log('PASS',message);};
let browser,page;
try{
 browser=await chromium.launch({headless:true,...existsSync(chrome)?{executablePath:chrome}:{}});
 const context=await browser.newContext();await context.addCookies([{name:'eden_session',value:f.cookies.alice.split('=')[1],url:f.base}]);
 await context.route('**/*',r=>new URL(r.request().url()).origin===f.base?r.continue():r.abort());
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const copy=await f.copy();
 const receipt=await f.ok('/api/lessons/lesson/work/submit',{requestId:'hub-receipt',assignmentId:f.assignment.id,lessonVersionId:'lesson:v1',progressVersion:0,answers:{'guided-code':'return true;'}},'alice');
 const nav=()=>page.getByRole('navigation',{name:'Mon espace',exact:true});
 const labels=['Aujourd’hui','Mes séances','Mes évaluations','Mes compétences','Mode arcade'];
 async function shell(active){
  await expect(nav()).toHaveCount(1);await expect(page.locator('.student-hub-header')).toHaveCount(1);
  assert.deepEqual(await nav().getByRole('link').allTextContents(),labels);
  await expect(nav().locator('[aria-current=page]')).toHaveText(active);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Débordement horizontal : '+page.url());
  // Every primary link is visible and operable at all target widths.
  for(const label of labels)await expect(nav().getByRole('link',{name:label,exact:true})).toBeVisible();
 }
 const routes=[['home','/today','Aujourd’hui'],['lesson','/today?assignment='+f.assignment.id,'Mes séances'],['lessons','/suivi.html?view=lessons','Mes séances'],['evaluations','/suivi.html?view=evaluations','Mes évaluations'],['competencies','/suivi.html?view=competencies','Mes compétences'],['assignment','/suivi.html?assignment='+f.assignment.id,'Mes séances'],['attempt','/suivi.html?attempt='+copy.attempt.id,'Mes évaluations'],['receipt','/work-receipt.html?id='+receipt.id,'Mes évaluations']];
 for(const width of [1440,768,390]){
  await page.setViewportSize({width,height:1000});let headerStyle;
  for(const [name,path,active]of routes){
   await page.goto(f.base+path);await page.waitForLoadState('networkidle');await shell(active);
   await expect(page.locator('main')).toHaveCount(1);
   const style=await page.locator('.student-hub-nav a').first().evaluate(el=>{const s=getComputedStyle(el);return {font:s.fontFamily,size:s.fontSize,height:el.getBoundingClientRect().height,padding:s.padding,border:s.borderRadius};});
   headerStyle??=style;assert.deepEqual(style,headerStyle,'La navigation doit conserver ses dimensions');
   await expect(page.locator('#main')).not.toContainText('PRIVATE_Q');
   await page.screenshot({path:`${dir}/after-${name}-${width}.png`,fullPage:true});
  }
  await page.goto(f.base+'/arcade#arcade');await expect(page.getByRole('heading',{name:'Choisis ton monde'})).toBeVisible();await shell('Mode arcade');
  await nav().getByRole('link',{name:'Mes séances',exact:true}).click();await expect(page.getByRole('heading',{name:'Mes séances',exact:true})).toBeVisible();
  check(`${width} px : 9 vues, shell unique, navigation, aucune fuite de corrigé ni débordement`);
 }
 // Same document for read-only tracking, including history and filters.
 await page.goto(f.base+'/suivi.html?view=lessons');await expect(page.locator('.student-session-card')).toBeVisible();
 await page.evaluate(()=>window.hubDocumentMarker='same-document');
 await nav().getByRole('link',{name:'Mes évaluations',exact:true}).click();await expect(page.getByRole('heading',{name:'Mes évaluations',exact:true})).toBeFocused();
 await page.getByRole('link',{name:'Premier diagnostic',exact:true}).click();await expect(page.getByRole('heading',{name:'Copie et retours'})).toBeVisible();
 await expect(page.locator('#main')).toContainText('Résultats en préparation');
 await page.getByRole('link',{name:'Retour à mes évaluations'}).click();await expect(page.getByRole('heading',{name:'Mes évaluations',exact:true})).toBeVisible();
 await page.goBack();await expect(page.getByRole('heading',{name:'Copie et retours'})).toBeVisible();await page.goForward();
 await page.getByLabel('Rechercher une séance ou une notion').fill('aucun-resultat-fictif');await page.getByRole('button',{name:'Rechercher',exact:true}).click();await expect(page.locator('#main')).toContainText('Aucun travail ne correspond');
 assert.equal(await page.evaluate(()=>window.hubDocumentMarker),'same-document');
 await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle),'solid');
 check('Navigation sans rechargement, filtres, retour contextuel, précédent/suivant et focus clavier');
 // Loading, failures, forbidden, retries, and a late response after navigation.
 let release,seen,handled;const held=new Promise(r=>release=r),captured=new Promise(r=>seen=r),handledRequest=new Promise(r=>handled=r);
 await page.route('**/api/tracking/mine*',async r=>{const response=await r.fetch();seen();await held;try{await r.fulfill({response});}finally{handled();}});
 await nav().getByRole('link',{name:'Mes séances',exact:true}).click();await captured;await expect(page.getByText('Chargement de ton espace…')).toBeVisible();await shell('Mes séances');
 await nav().getByRole('link',{name:'Mes compétences',exact:true}).click();await expect(page.getByText('Aucun résultat de compétence publié pour le moment.',{exact:false})).toBeVisible();release();await handledRequest;await page.unroute('**/api/tracking/mine*');
 await page.waitForLoadState('networkidle');await expect(page.getByRole('heading',{name:'Mes compétences',exact:true})).toBeVisible();
 for(const status of [503,403]){
  await page.route('**/api/tracking/mine*',r=>r.fulfill({status,contentType:'application/json',body:JSON.stringify({error:'Fetch failed INTERNAL_SECRET'})}));
  await nav().getByRole('link',{name:'Mes séances',exact:true}).click();await expect(page.locator('#main [role=alert]')).toBeVisible();await expect(page.locator('#main')).not.toContainText('INTERNAL_SECRET');await shell('Mes séances');
  await page.unroute('**/api/tracking/mine*');await page.getByRole('button',{name:'Réessayer',exact:true}).click();await expect(page.locator('.student-session-card')).toBeVisible();
 }
 check('Chargement, absence de résultat, 503, accès interdit, réessai et rejet des réponses de navigation périmées');
 // Published grades and contributing copies, without inventing mastery levels.
 await f.store.put('lesson_runs',{...await f.store.get('lesson_runs','run'),availability:'closed'});
 await f.ok('/api/tracking/submissions/'+copy.submission.submissionId+'/publish',{version:copy.correction.version});
 await nav().getByRole('link',{name:'Mes compétences',exact:true}).click();await expect(page.locator('.student-competency-card')).toHaveCount(2);
 await expect(page.locator('#main')).toContainText('DEMO-COMP-01');await expect(page.locator('#main')).toContainText('Aucun niveau publié');
 await page.getByText('Observations et preuves (1)',{exact:true}).first().click();await page.getByRole('link',{name:'Voir la copie du',exact:false}).first().click();await expect(page.locator('#main')).toContainText('14 / 20');await expect(page.locator('#main')).toContainText('Résultat publié.');await shell('Mes évaluations');
 await page.screenshot({path:dir+'/published-mobile.png',fullPage:true});
 check('Compétences publiées, niveaux conservés et preuve liée au résultat 14 / 20');
 // Errors on detail routes keep the shell and return path.
 for(const path of ['/today?assignment=missing','/suivi.html?attempt=missing','/work-receipt.html?id=missing']){
  await page.goto(f.base+path);await expect(page.locator('#main [role=alert]')).toBeVisible();await expect(page.locator('.student-hub-back a')).toBeVisible();await expect(nav()).toBeVisible();
 }
 // Teacher layout and server rights are unchanged.
 const teacher=await browser.newContext();await teacher.addCookies([{name:'eden_session',value:f.cookies.teacher.split('=')[1],url:f.base}]);const prof=await teacher.newPage();await prof.goto(f.base+'/suivi.html');await expect(prof.getByRole('heading',{name:'Élèves',exact:true})).toBeVisible();await expect(prof.locator('.student-hub')).toHaveCount(0);await teacher.close();
 assert.equal((await f.call('/api/tracking/students',{as:'alice'})).status,403);
 await page.goto(f.base+'/suivi.html?view=framework');await expect(page.locator('#main [role=alert]')).toContainText('Tu n’as pas accès');
 process.env.EDEN_WORLD_ARCADE='0';await page.goto(f.base+'/suivi.html?view=lessons');await expect(nav().getByRole('link',{name:'Mode arcade',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Se déconnecter',exact:true}).click();await expect(page.locator('input[name=username]')).toBeVisible();
 check('Erreurs de détail, droits serveur, layout professeur, option Arcade et déconnexion');
 assert.deepEqual(errors,[]);report.status='PASS';
}catch(error){report.status='FAIL';report.error=error.stack;report.browserErrors=errors;await page?.screenshot({path:dir+'/failure.png',fullPage:true});throw error;}
finally{await writeFile(dir+'/report.json',JSON.stringify(report,null,2)+'\n');await browser?.close();await f.close();}
console.log(JSON.stringify(report,null,2));
