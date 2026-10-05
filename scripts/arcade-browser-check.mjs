import {chromium,expect} from '@playwright/test';
import {existsSync} from 'node:fs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {arcadeFixture} from '../tests/fixtures/arcade.mjs';
import {parisDate} from '../server/generator.mjs';
process.env.EDEN_WORLD_ARCADE='1';
const fixture=await arcadeFixture();
const directory=process.env.ARCADE_REPORT_DIRECTORY||'TWEEN_TEACH_WORLD_ARCADE/SUIVI';
await mkdir(`${directory}/captures`,{recursive:true});
const systemChrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||(existsSync(systemChrome)?systemChrome:undefined)});
const errors=[],results=[],captures=[];
const context=await browser.newContext({viewport:{width:1440,height:1050},locale:'fr-FR',timezoneId:'Europe/Paris'});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
async function check(name,fn){await fn();results.push({name,status:'passed'});console.log('PASS',name);}
async function shot(name,role='student',target=page){await target.screenshot({path:`${directory}/captures/${name}.png`,fullPage:true});captures.push({file:`captures/${name}.png`,route:new URL(target.url()).pathname+new URL(target.url()).hash,role,viewport:target.viewportSize(),fixture:'tests/fixtures/arcade.mjs, SQLite :memory:'});}
async function visit(hash){if(page.url()===fixture.base+'/arcade'+hash)await page.reload();else await page.goto(fixture.base+'/arcade'+hash);await expect(page.locator('#main-content .notice').filter({hasText:'Chargement…'})).toHaveCount(0);}
async function login(role='student',username='student-a',ctx=context){const response=await ctx.request.post(fixture.base+'/api/login',{data:{role,username,password:fixture.password,classId:'A1'}});assert.equal(response.status(),200);}
try{
 await check('visitor entry, keyboard guard, closed registration and focus return',async()=>{
  await page.goto(fixture.base+'/arcade');await expect(page.locator('#start-button')).toBeVisible();await shot('01-entree','guest');
  await page.locator('#splash-account [data-action=auth]').click();await page.getByLabel('Identifiant',{exact:true}).fill('x');await page.keyboard.press('Enter');assert.equal(new URL(page.url()).hash,'');
  await page.getByRole('button',{name:'Créer un compte',exact:true}).click();await expect(page.getByText('Les inscriptions ne sont pas ouvertes pour le moment.')).toBeVisible();await shot('02-inscription-fermee','guest');
  await page.keyboard.press('Escape');await expect(page.locator('#modal')).not.toBeVisible();await expect(page.locator('#splash-account [data-action=auth]')).toBeFocused();
  await page.locator('#start-button').focus();await page.keyboard.press('Enter');await expect(page.locator('.cabinet')).toHaveCount(2);await expect(page.locator('[data-game=cyber-funk]')).toBeDisabled();await shot('03-salle-visiteur','guest');
  await page.goto(fixture.base+'/arcade');await page.locator('body').click({position:{x:5,y:5}});await page.keyboard.press('Enter');await expect(page.locator('.cabinets')).toBeVisible();
 });
 await check('real host login is required; profile persists with no credential storage',async()=>{
  await page.locator('[data-game=code-station]').click();await page.getByLabel('Identifiant',{exact:true}).fill('student-a');await page.getByLabel('Mot de passe',{exact:true}).fill('incorrect');await page.locator('[data-form=login] [type=submit]').click();await expect(page.locator('.form-status')).toContainText('Identifiants incorrects');
  await page.getByLabel('Mot de passe',{exact:true}).fill(fixture.password);await page.locator('[data-form=login] [type=submit]').click();await expect(page.getByRole('heading',{name:'Choisis ton joueur',exact:true})).toBeVisible();await page.getByLabel('AKA — ton pseudo',{exact:true}).fill('Aster');await page.getByRole('button',{name:'Entrer dans l’arcade',exact:true}).click();await expect(page.locator('#game-modal')).toBeVisible();await expect(page.frameLocator('.game-frame').locator('#missionCode')).toBeVisible();
  await page.getByRole('button',{name:'Quitter le jeu',exact:true}).click();await expect(page.locator('#game-modal')).not.toBeVisible();
  await page.locator('.main-nav [data-route=profil]').click();await page.getByRole('link',{name:'Personnaliser',exact:true}).click();await page.getByLabel('AKA — ton pseudo',{exact:true}).fill('Aster');await page.getByRole('radio',{name:'Choisir cet avatar — Avatar 4',exact:true}).check();await page.getByLabel('Visibilité du profil').selectOption('class');await page.locator('[data-form=profile] [type=submit]').click();await expect(page.locator('.form-status')).toHaveText('Modifications enregistrées.');await page.reload();await expect(page.getByLabel('AKA — ton pseudo',{exact:true})).toHaveValue('Aster');await shot('04-profil');
  const storage=await page.evaluate(()=>({...localStorage}));assert.deepEqual(Object.keys(storage),['eden.world-arcade.preferences.v1']);assert.doesNotMatch(JSON.stringify(storage),/Aster|password|token|grade|xp/);
 });
 await check('scoped directory pagination, search and accessible profile dialog',async()=>{
  await page.locator('.main-nav [data-route=joueurs]').click();await expect(page.locator('.player-card')).toHaveCount(24);await page.getByRole('button',{name:'Suivant',exact:true}).click();await expect(page.locator('.player-card')).toHaveCount(4);
  await page.getByLabel('Rechercher un joueur').fill('Pilote 03');await page.getByRole('button',{name:'Rechercher',exact:true}).click();await expect(page.locator('.player-card')).toHaveCount(1);await page.locator('.player-card').click();await expect(page.locator('#modal h3')).toHaveText('Pilote 03');await page.keyboard.press('Escape');await expect(page.locator('.player-card')).toBeFocused();
  await page.getByLabel('Rechercher un joueur').fill('');await page.getByRole('button',{name:'Rechercher',exact:true}).click();await shot('05-joueurs');
 });
 await check('top and grades explicitly unavailable, without prototype points',async()=>{
  await page.locator('.main-nav [data-route=classement]').click();await expect(page.locator('#main-content')).toContainText('Le classement n’est pas disponible');assert.equal(await page.locator('.leaderboard-list li').count(),0);await shot('06-classement-indisponible');
  await page.locator('.main-nav [data-route=badges]').click();await expect(page.locator('#main-content')).toContainText('Les grades ne sont pas disponibles');await shot('07-grades-indisponibles');
 });
 await check('true runtime, deep link, persistent save and retry after network failure',async()=>{
  await page.locator('.main-nav [data-route=arcade]').click();await expect(page.locator('[data-game=code-station]')).toContainText('Reprendre');
  await page.locator('[data-game=code-station]').dblclick();await expect(page.frameLocator('.game-frame').locator('#missionCode')).toBeVisible();
  const frame=page.frameLocator('.game-frame');await frame.locator('#missionCode').fill('return 42;');
  await page.route('**/api/game/runs/*/progress',route=>route.fulfill({status:503,json:{error:'PRIVATE trace'}}));
  await frame.locator('#saveDraft').click();await expect(page.locator('#game-save')).toContainText('n’a pas encore été enregistrée');assert.doesNotMatch(await page.locator('body').innerText(),/PRIVATE trace/);await shot('08-sauvegarde-erreur');
  await page.unroute('**/api/game/runs/*/progress');await page.locator('[data-action=retry-save]').click();await expect(page.locator('#game-save')).toHaveText('Partie enregistrée.');
  const url=page.url();await shot('09-jeu');await page.reload();await expect(page.frameLocator('.game-frame').locator('#missionCode')).toHaveValue('return 42;');assert.equal(page.url(),url);
  await page.getByRole('button',{name:'Quitter le jeu',exact:true}).click();await expect(page.locator('[data-game=code-station]')).toBeFocused();assert.equal(new URL(page.url()).hash,'#arcade');
  assert.equal((await fixture.store.list('game_runs','A1')).length,1);
 });
 await check('slow launch ignores late response after navigation and never launches a demo',async()=>{
  let release,finished;const hold=new Promise(r=>release=r),continued=new Promise(r=>finished=r);
  await page.route('**/api/arcade/launch',async route=>{await hold;await route.continue();finished();});
  await page.locator('[data-game=code-station]').click();await page.locator('.main-nav [data-route=badges]').click();release();await continued;await page.unroute('**/api/arcade/launch');await expect(page.locator('#main-content')).toContainText('Les grades');
  await page.waitForTimeout(200);assert.equal(new URL(page.url()).hash,'#badges');assert.equal(await page.locator('canvas,.game-frame').count(),0);
 });
 await check('500, forbidden, empty and offline have distinct UI states',async()=>{
  await page.route('**/api/arcade/players?**',r=>r.fulfill({status:500,json:{error:'SECRET backend stack'}}));await visit('#joueurs');await expect(page.locator('#main-content')).toContainText('Ce service n’est pas disponible');assert.doesNotMatch(await page.locator('#main-content').innerText(),/SECRET|Aucun joueur/);await shot('10-service-indisponible');await page.unroute('**/api/arcade/players?**');
  await page.route('**/api/arcade/players?**',r=>r.fulfill({status:403,json:{error:'Cette liste n’est pas accessible.'}}));await page.getByRole('button',{name:'Réessayer',exact:true}).click();await expect(page.locator('#main-content')).toContainText('Cette liste n’est pas accessible.');await page.unroute('**/api/arcade/players?**');
  await visit('#joueurs');await page.getByLabel('Rechercher un joueur').fill('Inexistant');await page.getByRole('button',{name:'Rechercher',exact:true}).click();await expect(page.locator('#main-content')).toContainText('Aucun joueur ne correspond');
  await context.setOffline(true);await page.locator('.main-nav [data-route=classement]').click();await expect(page.locator('#main-content')).toContainText('Connexion interrompue');await context.setOffline(false);
 });
 await check('desktop, compact desktop, tablet and stacked mobile without page overflow',async()=>{
  for(const [width,height] of [[1440,1050],[1280,720],[768,1024],[390,844],[360,800]]){
   await page.setViewportSize({width,height});await visit('#arcade');await expect(page.locator('.cabinet')).toHaveCount(2);await expect(page.locator('#players-slot .avatar-tile').first()).toBeVisible();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${width} overflow`);
   if(width<=390){const boxes=await page.locator('.cabinet').evaluateAll(nodes=>nodes.map(n=>({top:n.getBoundingClientRect().top,bottom:n.getBoundingClientRect().bottom})));assert.ok(boxes[1].top>boxes[0].bottom);}
   await shot(`11-salle-${width}x${height}`);
  }
 });
 await check('200 percent equivalent viewport, focus visibility, CRT and reduced motion',async()=>{
  await page.setViewportSize({width:720,height:525});await visit('#personnaliser');await expect(page.getByLabel('AKA — ton pseudo',{exact:true})).toBeVisible();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.getByLabel('AKA — ton pseudo',{exact:true}).focus();await page.keyboard.press('Tab');assert.notEqual(await page.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle),'none');await shot('12-profil-zoom-200');
  await page.emulateMedia({reducedMotion:'reduce'});await visit('#reglages');await expect(page.locator('[data-pref=reducedMotion]')).toBeChecked();await expect(page.locator('[data-pref=reducedMotion]')).toBeDisabled();await expect(page.locator('[data-pref=sound]')).not.toBeChecked();
  await page.locator('[data-pref=crt]').uncheck();await expect(page.locator('body')).toHaveClass(/no-crt/);await shot('13-reglages');
  await page.emulateMedia({reducedMotion:'no-preference'});
 });
 await check('ten module round trips preserve host pages, without listeners or styles leaking',async()=>{
  const lesson=await fixture.store.get('lessons','arcade-lesson'),version=await fixture.store.get('lesson_versions','arcade-lesson:v1');
  const spec=JSON.parse(await readFile('public/demo-lesson.json','utf8'));spec.codeStation={...version.spec.codeStation};
  await fixture.store.put('lesson_versions',{...version,spec});await fixture.store.put('lessons',{...lesson,date:parisDate()});
  await page.setViewportSize({width:1440,height:1050});
  for(let i=0;i<10;i++){await page.goto(fixture.base+'/today');await expect(page.locator('.lesson-stage')).toBeVisible();assert.equal(await page.locator('link[href*="world-arcade"],.game-frame').count(),0);await page.locator('a[href="/arcade"]').click();await expect(page.locator('#start-button')).toBeVisible();}
  await page.goto(fixture.base+'/today');await expect(page.locator('.lesson-stage')).toBeVisible();await shot('14-cours-eleve');
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await shot('14-cours-eleve-mobile');
  const teacherContext=await browser.newContext({viewport:{width:1440,height:1050}});await login('teacher','teacher-a',teacherContext);const teacher=await teacherContext.newPage();teacher.on('pageerror',e=>errors.push(e.message));await teacher.goto(fixture.base+'/teacher');await expect(teacher.getByRole('heading',{name:'Chaque séance fait avancer la classe.'})).toBeVisible();await shot('15-professeur','teacher',teacher);
  assert.equal(await teacher.locator('link[href*="world-arcade"]').count(),0);await teacher.setViewportSize({width:390,height:844});assert.equal(await teacher.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await shot('15-professeur-mobile','teacher',teacher);await teacherContext.close();
 });
 await check('logout clears host session and no profile is reused for the next account',async()=>{
  await visit('#reglages');await page.getByRole('button',{name:'Se déconnecter',exact:true}).click();await expect(page.locator('#account-slot [data-action=auth]')).toBeEnabled();await expect(page.locator('.cabinet')).toHaveCount(2);
  const result=await context.request.get(fixture.base+'/api/arcade/profile');assert.equal(result.status(),401);
  await login('student','student-b');await visit('#profil');await expect(page.getByLabel('AKA — ton pseudo',{exact:true})).toHaveValue('');
 });
 assert.deepEqual(errors,[]);console.log('No uncaught browser errors.');
}catch(e){results.push({name:'Failure',status:'failed',error:e.message});await page.screenshot({path:`${directory}/captures/erreur-test.png`}).catch(()=>{});console.error(e);process.exitCode=1;}
finally{
 await writeFile(`${directory}/navigateur.json`,JSON.stringify({results,captures,errors,browser:browser.version(),database:'SQLite memory only'},null,2)+'\n');
 await browser.close();await fixture.close();
}
