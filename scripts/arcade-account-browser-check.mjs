import {chromium,expect} from '@playwright/test';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {arcadeFixture} from '../tests/fixtures/arcade.mjs';
process.env.EDEN_WORLD_ARCADE='1';
const fixture=await arcadeFixture();
const directory='TWEEN_TEACH_WORLD_ARCADE/SUIVI/COMPTE_JOUEUR_CAPTURES';
await mkdir(directory,{recursive:true});
const systemChrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||(existsSync(systemChrome)?systemChrome:undefined)});
const context=await browser.newContext({viewport:{width:1440,height:1050},locale:'fr-FR',timezoneId:'Europe/Paris'});
const page=await context.newPage();const errors=[],results=[],captures=[];page.on('pageerror',e=>errors.push(e.message));
const newPassword='synthetic-account-browser-new';let runId;
async function check(name,fn){await fn();results.push({name,status:'PASS'});console.log('PASS',name);}
async function visit(hash){if(page.url()===fixture.base+'/arcade'+hash)await page.reload();else await page.goto(fixture.base+'/arcade'+hash);await expect(page.locator('#main-content .notice').filter({hasText:'Chargement…'})).toHaveCount(0);}
async function shot(name){const secrets=page.locator('input[autocomplete$="password"]');if(name!=='incident-test')assert.equal(await secrets.evaluateAll(nodes=>nodes.every(n=>!n.value)),true,'capturer uniquement des champs de mot de passe vides');await page.screenshot({path:`${directory}/${name}.png`,fullPage:true,mask:name==='incident-test'?[secrets]:[],maskColor:'#171722'});captures.push({file:`${name}.png`,viewport:page.viewportSize(),route:new URL(page.url()).hash});}
async function menu(){await page.locator('#account-slot summary').click();}
async function loginAPI(ctx,username='student-a',password=fixture.password,role='student') {const r=await ctx.request.post(fixture.base+'/api/login',{data:{role,username,password,classId:'A1'}});assert.equal(r.status(),200);}
try {
 await check('visiteur : Commencer, deux mondes, inscription fermée et récupération scolaire',async()=>{
  await page.goto(fixture.base+'/arcade');await page.locator('#start-button').focus();await page.keyboard.press('Enter');await expect(page.locator('.cabinet')).toHaveCount(2);
  await page.locator('#account-slot [data-action=auth]').click();await page.getByRole('button',{name:'Créer un compte',exact:true}).click();await expect(page.getByText('Les inscriptions ne sont pas ouvertes pour le moment.')).toBeVisible();await expect(page.getByLabel('Confirmer le mot de passe',{exact:true})).toBeDisabled();await shot('01-inscription-fermee');
  await page.getByRole('button',{name:'J’ai déjà un compte',exact:true}).click();await page.getByRole('button',{name:'Mot de passe oublié ?',exact:true}).click();await expect(page.locator('#modal')).toContainText('contacte ton professeur');await page.keyboard.press('Escape');
 });
 await check('connexion hôte puis AKA/avatar clavier et reprise de l’intention Code Station',async()=>{
  await page.locator('[data-game=code-station]').click();await page.getByLabel('Identifiant',{exact:true}).fill('student-a');await page.getByLabel('Mot de passe',{exact:true}).fill('incorrect');await page.locator('[data-form=login] [type=submit]').click();await expect(page.locator('.form-status')).toContainText('Identifiants incorrects');
  await page.getByLabel('Mot de passe',{exact:true}).fill(fixture.password);await page.locator('[data-form=login] [type=submit]').click();await expect(page.getByRole('heading',{name:'Choisis ton joueur',exact:true})).toBeVisible();
  await page.getByLabel('AKA — ton pseudo',{exact:true}).fill('Aster');await page.getByRole('radio',{name:'Choisir cet avatar — Avatar 1',exact:true}).focus();await page.keyboard.press('ArrowRight');await expect(page.getByRole('radio',{name:'Choisir cet avatar — Avatar 2',exact:true})).toBeChecked();await expect(page.locator('#identity-preview h2')).toHaveText('Aster');await shot('02-choisis-ton-joueur');
  await page.getByRole('button',{name:'Entrer dans l’arcade',exact:true}).click();await expect(page.frameLocator('.game-frame').locator('#missionCode')).toBeVisible();runId=decodeURIComponent(new URL(page.url()).hash.slice(5));
  await page.getByRole('button',{name:'Quitter le jeu',exact:true}).click();await expect(page.locator('#game-modal')).not.toBeVisible();
 });
 await check('aperçu local, annulation, erreur de sauvegarde et persistance après reconnexion',async()=>{
  await visit('#personnaliser');await page.getByLabel('AKA — ton pseudo',{exact:true}).fill('Brouillon');await expect(page.locator('#identity-preview')).toContainText('Brouillon');await page.getByRole('button',{name:'Annuler',exact:true}).click();await expect(page.getByLabel('AKA — ton pseudo',{exact:true})).toHaveValue('Aster');
  await page.route('**/api/arcade/profile',async route=>route.request().method()==='PUT'?route.fulfill({status:503,json:{error:'INTERNAL secret'}}):route.continue());
  await page.getByLabel('AKA — ton pseudo',{exact:true}).fill('Erreur');await page.getByRole('button',{name:'Enregistrer',exact:true}).click();await expect(page.locator('.form-status')).toContainText('n’ont pas été enregistrés');assert.doesNotMatch(await page.locator('body').innerText(),/INTERNAL secret|Modifications enregistrées/);await shot('03-erreur-sauvegarde');await page.unroute('**/api/arcade/profile');
  await page.getByRole('button',{name:'Annuler',exact:true}).click();await page.getByLabel('AKA — ton pseudo',{exact:true}).fill('Aster_Nova');await page.getByRole('radio',{name:'Choisir cet avatar — Avatar 4',exact:true}).check();await page.getByLabel('Visibilité du profil').selectOption('class');await page.getByRole('button',{name:'Enregistrer',exact:true}).click();await expect(page.locator('.form-status')).toHaveText('Modifications enregistrées.');
  const other=await browser.newContext();await loginAPI(other);const response=await other.request.get(fixture.base+'/api/arcade/profile');const p=await response.json();assert.equal(p.handle,'Aster_Nova');assert.equal(p.avatarId,'04');await other.close();
 });
 await check('avatar indisponible : repli explicite sans modifier le profil enregistré',async()=>{
  await page.route('**/assets/avatars/04.webp',r=>r.fulfill({status:404,body:''}));await visit('#personnaliser');
  await expect(page.getByRole('radio',{name:'Choisir cet avatar — Avatar 4',exact:true})).toBeDisabled();await expect(page.locator('#identity-preview [aria-label="Avatar indisponible"]')).toBeVisible();
  const profile=await (await context.request.get(fixture.base+'/api/arcade/profile')).json();assert.equal(profile.avatarId,'04');
  await shot('03-avatar-indisponible');await page.unroute('**/assets/avatars/04.webp');await page.reload();await expect(page.getByRole('radio',{name:'Choisir cet avatar — Avatar 4',exact:true})).toBeEnabled();
 });
 await check('Mon espace : identité réelle, aucune récompense inventée, carte privée et reprise autorisée',async()=>{
  await visit('#profil');await expect(page.locator('.identity-handle')).toHaveText('Aster_Nova');await expect(page.getByText('Aucun badge pour le moment.',{exact:true})).toBeVisible();await expect(page.getByText(/Les paliers de progression ne sont pas disponibles/)).toBeVisible();assert.doesNotMatch(await page.locator('#main-content').innerText(),/Identité privée|example.invalid|Rookie|\b0 XP\b/);
  await page.getByRole('button',{name:'Voir ma carte',exact:true}).click();await expect(page.locator('#modal')).toContainText('Cet aperçu ne publie pas ton profil.');await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Voir ma carte',exact:true})).toBeFocused();
  await page.locator('[data-action=resume]').click();await expect(page.frameLocator('.game-frame').locator('#missionCode')).toBeVisible();await page.getByRole('button',{name:'Quitter le jeu',exact:true}).click();
 });
 await check('badge obtenu par la vraie validation professeur, mise en avant, retrait et dialogue clavier',async()=>{
  await visit('#collection');await expect(page.getByText('Aucun badge pour le moment.',{exact:true})).toBeVisible();await page.locator('.badge-card').focus();await page.keyboard.press('Enter');await expect(page.locator('#modal')).toContainText('À débloquer');await expect(page.getByRole('button',{name:'Mettre en avant',exact:true})).toHaveCount(0);await page.keyboard.press('Escape');await expect(page.locator('.badge-card')).toBeFocused();
  const complete=await context.request.post(fixture.base+`/api/game/runs/${runId}/complete`,{data:{eventId:'browser-completion',payload:{files:{}}}});assert.equal(complete.status(),200);
  const proof=(await fixture.store.list('game_evidence','A1'))[0];const teacher=await browser.newContext();await loginAPI(teacher,'teacher-a',fixture.password,'teacher');
  const approved=await teacher.request.post(fixture.base+`/api/teacher/game-evidence/${proof.id}/approve`,{data:{reason:'Validation synthétique navigateur',criteria:fixture.mission.competencies.map(criterion=>({criterion,level:'A1'}))}});assert.equal(approved.status(),200);await teacher.close();
  await visit('#collection');await page.locator('.badge-card').click();await expect(page.locator('#modal')).toContainText('Obtenu le');await shot('04-badge-obtenu');await page.getByRole('button',{name:'Mettre en avant',exact:true}).click();await expect(page.locator('.equipped-panel')).toContainText('Premier signal');
  await page.locator('.equipped-panel button').click();await page.getByRole('button',{name:'Retirer de ma carte',exact:true}).click();await expect(page.locator('.equipped-panel')).toContainText('Aucun badge mis en avant.');
  await page.locator('.badge-card').click();await page.getByRole('button',{name:'Mettre en avant',exact:true}).click();await page.reload();await expect(page.locator('.equipped-panel')).toContainText('Premier signal');
 });
 await check('1440, 1024 et 390 px : espace, personnalisation, badges et compte sans débordement',async()=>{
  for(const width of [1440,1024,390]) {
   await page.setViewportSize({width,height:width===390?844:1050});
   for(const hash of ['profil','personnaliser','collection','compte']){await visit('#'+hash);await expect(page.locator('#main-content h1')).toContainText({profil:'Mon espace',personnaliser:'Personnaliser',collection:'Mes badges',compte:'Mon compte'}[hash]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${hash} ${width}`);await shot(`05-${hash}-${width}`);}
  }
  await page.emulateMedia({reducedMotion:'reduce'});await visit('#reglages');await expect(page.locator('[data-pref=reducedMotion]')).toBeChecked();await expect(page.locator('[data-pref=reducedMotion]')).toBeDisabled();await expect(page.locator('[data-pref=sound]')).not.toBeChecked();await page.setViewportSize({width:1440,height:1050});
 });
 await check('mot de passe : collage, afficher/masquer, confirmation, secret actuel et toutes les sessions',async()=>{
  await visit('#compte');await page.getByLabel('Mot de passe actuel',{exact:true}).fill(fixture.password);
  await context.grantPermissions(['clipboard-read','clipboard-write']);await page.evaluate(value=>navigator.clipboard.writeText(value),newPassword);await page.getByLabel('Nouveau mot de passe',{exact:true}).focus();await page.keyboard.press(process.platform==='darwin'?'Meta+V':'Control+V');
  assert.equal(await page.getByLabel('Nouveau mot de passe',{exact:true}).inputValue()===newPassword,true,'collage');
  await page.getByRole('button',{name:'Afficher : nouveau mot de passe',exact:true}).click();await expect(page.getByLabel('Nouveau mot de passe',{exact:true})).toHaveAttribute('type','text');await page.getByRole('button',{name:'Masquer : nouveau mot de passe',exact:true}).click();await expect(page.getByLabel('Nouveau mot de passe',{exact:true})).toHaveAttribute('type','password');
  await page.getByLabel('Confirmer le nouveau mot de passe',{exact:true}).fill('different');await page.getByRole('button',{name:'Modifier mon mot de passe',exact:true}).click();await expect(page.locator('.form-status')).toHaveText('Les mots de passe ne correspondent pas.');
  await page.getByLabel('Confirmer le nouveau mot de passe',{exact:true}).fill(newPassword);await page.getByLabel('Mot de passe actuel',{exact:true}).fill('incorrect');await page.getByRole('button',{name:'Modifier mon mot de passe',exact:true}).click();await expect(page.locator('.form-status')).toHaveText('Le mot de passe actuel est incorrect.');
  const other=await browser.newContext();await loginAPI(other);await page.getByLabel('Mot de passe actuel',{exact:true}).fill(fixture.password);await page.getByRole('button',{name:'Modifier mon mot de passe',exact:true}).click();await expect(page.locator('#modal')).toBeVisible();await expect(page.locator('#toasts')).toContainText('Toutes tes sessions ont été fermées');assert.equal((await other.request.get(fixture.base+'/api/arcade/account')).status(),401);await other.close();
  await page.getByLabel('Identifiant',{exact:true}).fill('student-a');await page.getByLabel('Mot de passe',{exact:true}).fill(newPassword);await page.locator('[data-form=login] [type=submit]').click();await expect(page.locator('#account-slot')).toContainText('Aster_Nova');
  const storage=await page.evaluate(()=>({local:{...localStorage},session:{...sessionStorage}}));assert.deepEqual(Object.keys(storage.local),['eden.world-arcade.preferences.v1']);assert.deepEqual(storage.session,{});assert.doesNotMatch(JSON.stringify(storage),/password|token|Aster/);
 });
 await check('réponse personnelle tardive, déconnexion, autre compte et bouton Retour',async()=>{
  assert.equal((await context.request.put(fixture.base+'/api/arcade/profile',{data:{handle:'Aster_Nova',avatarId:'04',visibility:'private'}})).status(),200);
  await visit('#profil');let release,started;const hold=new Promise(r=>release=r),seen=new Promise(r=>started=r);
  await page.route('**/api/arcade/space',async route=>{const response=await route.fetch();started();await hold;await route.fulfill({response}).catch(()=>{});});
  await page.locator('.main-nav [data-route=arcade]').click();await page.locator('.main-nav [data-route=profil]').click();await seen;
  await menu();await page.locator('#account-slot [data-action=logout]').click();await expect(page.locator('#account-slot')).toContainText('Se connecter');release();await page.unroute('**/api/arcade/space');
  await page.locator('#account-slot [data-action=auth]').click();await page.getByLabel('Identifiant',{exact:true}).fill('student-b');await page.getByLabel('Mot de passe',{exact:true}).fill(fixture.password);await page.locator('[data-form=login] [type=submit]').click();await expect(page.getByLabel('AKA — ton pseudo',{exact:true})).toHaveValue('');assert.doesNotMatch(await page.locator('body').innerText(),/Aster_Nova|student-a@example/);
  await page.goBack();await page.waitForLoadState('domcontentloaded');assert.doesNotMatch(await page.locator('body').innerText(),/Aster_Nova|student-a@example/);
 });
 await check('expiration de session et autre onglet : effacement immédiat des données privées',async()=>{
  await loginAPI(context,'student-a',newPassword);await visit('#profil');const tab=await context.newPage();tab.on('pageerror',e=>errors.push(e.message));await tab.goto(fixture.base+'/arcade#compte');await expect(tab.locator('.account-info')).toContainText('student-a');
  await page.bringToFront();await menu();await page.locator('#account-slot [data-action=logout]').click();await expect(tab.locator('#account-slot')).toContainText('Se connecter');await expect(tab.locator('.account-info')).toHaveCount(0);await tab.close();
  await loginAPI(context,'student-a',newPassword);await visit('#profil');await context.request.post(fixture.base+'/api/logout');await page.locator('.main-nav [data-route=profil]').click();await page.locator('.main-nav [data-route=arcade]').click();await page.locator('.main-nav [data-route=profil]').click();await expect(page.locator('#main-content')).toContainText('Connecte-toi pour accéder à ton espace.');await expect(page.locator('.identity-handle')).toHaveCount(0);
 });
 assert.deepEqual(errors,[]);console.log('No uncaught browser errors.');
} catch(e) {
 let message=e.message;for(const secret of [fixture.password,newPassword])message=message.replaceAll(secret,'[secret de test masqué]');
 results.push({name:'Failure',status:'FAIL',message});console.error(message);await shot('incident-test').catch(()=>{});process.exitCode=1;
} finally {
 await writeFile('TWEEN_TEACH_WORLD_ARCADE/SUIVI/COMPTE_JOUEUR_NAVIGATEUR.json',JSON.stringify({results,captures,errors,browser:browser.version(),database:'SQLite :memory:',identities:'synthetic only'},null,2)+'\n');
 await context.close();await browser.close();await fixture.close();
}
