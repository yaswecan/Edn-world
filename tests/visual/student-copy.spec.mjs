import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const user={id:'sample',role:'student',classId:'DEMO',displayName:'Camille'};
const spec=JSON.parse(await readFile('public/demo-lesson.json','utf8'));
async function routeStudent(page,{empty=false,submitted=false,step='diagnostic'}={}){
 const state={saveFails:false,submitFails:false,result:{score:null,level:'NE',items:[]},attempt:{id:'attempt',answers:{},submissionId:submitted?'copy':null}};
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;let data={},status=200;
  if(path==='/api/session')data={user,setupRequired:false};
  else if(path==='/api/today')data=empty?{lesson:null}:{lesson:{id:'lesson',versionId:'v1',spec},attempt:state.attempt,progress:{stepId:step}};
  else if(path.endsWith('/start'))data=state.attempt;
  else if(path.endsWith('/save')){if(state.holdSave)await state.holdSave;if(state.saveFails){status=503;data={error:'Provider fallback payload trace',details:{secret:'internal'}};}else{state.attempt.answers=route.request().postDataJSON().answers;data={receivedAt:'2026-10-05T08:00:00Z'};}}
  else if(path.endsWith('/submit')){if(state.submitFails){status=503;data={error:'Runtime provider failed'};}else{state.attempt.submissionId='copy';data={submissionId:'copy',sha256:'INTERNAL-HASH'};}}
  else if(path.endsWith('/result'))data=state.result;
  else if(path==='/api/events')data={receivedAt:'2026-10-05T08:00:00Z'};
  else throw Error('Unexpected API route '+path);
  await route.fulfill({status,json:data});
 });return state;
}
test('student login: minimal form, role switching, keyboard and useful errors',async({page},info)=>{
 await page.route('**/api/**',route=>route.fulfill({status:route.request().url().endsWith('/api/login')?401:200,json:route.request().url().endsWith('/api/login')?{error:'Identifiants incorrects.'}:{user:null,setupRequired:false}}));
 await page.goto('/today');await expect(page.getByRole('heading',{name:'Connexion',exact:true})).toBeVisible();
 await expect(page.locator('body')).not.toContainText(/TEACHER TWIN|Reprendre le fil|Une classe|code d’accès/);
 await expect(page.getByLabel('Identifiant',{exact:true})).toBeVisible();await expect(page.getByLabel('Mot de passe',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Professeur',exact:true}).click();await expect(page.locator('.brand')).toContainText('TEACHER TWIN');
 await page.getByRole('button',{name:'Élève',exact:true}).click();await page.getByLabel('Identifiant',{exact:true}).fill('camille');await page.getByLabel('Mot de passe',{exact:true}).fill('incorrect');await page.keyboard.press('Enter');
 await expect(page.getByRole('alert')).toHaveText('Identifiant ou mot de passe incorrect.');await page.keyboard.press('Escape');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`test-results/student-wording/after-${info.project.name}-login.png`,fullPage:true});
});
test('empty student session has a truthful short message and logout',async({page},info)=>{
 await routeStudent(page,{empty:true});await page.goto('/today');await expect(page.locator('.empty')).toHaveText('Aucune séance pour le moment.');
 await expect(page.getByRole('button',{name:'Se déconnecter'})).toBeVisible();await expect(page.locator('body')).not.toContainText(/prochaine|professeur ouvrira|version/i);
 await page.screenshot({path:`test-results/student-wording/after-${info.project.name}-empty.png`,fullPage:true});
});
test('save, send failure and successful receipt reflect confirmed responses; assessment gate stays',async({page},info)=>{
 const state=await routeStudent(page);await page.goto('/today');await expect(page.getByRole('heading',{name:'Évaluation',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Continuer',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Rends ton travail');await page.keyboard.press('Escape');
 await page.locator('[data-answer="demo-diag"]').fill('Une carte et une réservation.');
 state.saveFails=true;await page.getByRole('button',{name:'Enregistrer',exact:true}).click();await expect(page.getByRole('alert')).toContainText('n’a pas pu être confirmé');await expect(page.locator('#save-status')).not.toContainText('Travail enregistré');await page.keyboard.press('Escape');
 state.saveFails=false;await page.getByRole('button',{name:'Enregistrer',exact:true}).click();await expect(page.locator('#save-status')).toHaveText('Travail enregistré.');
 state.submitFails=true;await page.getByRole('button',{name:'Rendre mon travail'}).click();await page.getByRole('button',{name:'Confirmer l’envoi'}).click();await expect(page.getByRole('alert')).toContainText('L’envoi n’a pas pu être confirmé');await expect(page.locator('.lesson-receipt')).toHaveCount(0);await page.keyboard.press('Escape');
 state.submitFails=false;await page.getByRole('button',{name:'Rendre mon travail'}).click();await page.getByRole('button',{name:'Confirmer l’envoi'}).click();await expect(page.locator('.lesson-receipt')).toContainText('Travail envoyé.');
 await expect(page.locator('body')).not.toContainText(/INTERNAL-HASH|serveur|Provider|Runtime|payload/);
 await page.screenshot({path:`test-results/student-wording/after-${info.project.name}-receipt.png`,fullPage:true});
 await page.getByRole('button',{name:'Continuer',exact:true}).click();await expect(page.locator('[data-component="BlackboardSchema"]')).toBeVisible();
});
test('result modal preserves NE, zero, levels, feedback and missing submission',async({page},info)=>{
 const state=await routeStudent(page,{submitted:true});await page.goto('/today');
 for(const result of [{status:'not_submitted',level:'NE'},{score:null,level:'NE',items:[]},{score:0,level:'NA',items:[]},{score:17,level:'A2',feedback:'Compare aussi le cas limite.',items:[{label:'Les tests',points:7,max:10,feedback:'Comparaison déterministe avec la réponse attendue.'}]}]){
  state.result=result;await page.getByRole('button',{name:'Voir le résultat'}).click();const dialog=page.getByRole('dialog');
  await expect(dialog).toContainText(result.status==='not_submitted'?'Aucun travail rendu.':result.score==null?'Non évalué':`${result.score} / 20 · ${result.level}`);
  await expect(dialog).not.toContainText(/déterministe|maîtrise durable|undefined|NE \/20/);
  if(result.score===17){await expect(dialog).toContainText('Compare aussi le cas limite.');await page.screenshot({path:`test-results/student-wording/after-${info.project.name}-result.png`,fullPage:true});}
  await page.getByRole('button',{name:'Fermer',exact:true}).click();
 }
});
test('embedded game preserves mission identity, code console, resources and avoids premature save claims',async({page},info)=>{
 const catalog=JSON.parse(await readFile('data/game-catalog.json','utf8'));const worldId='code-station',world=catalog[worldId],mission=world.missions[0],resourceCode=mission.resources[0];
 const context={type:'eden:init',worlds:{...catalog,[worldId]:{...world,missions:[mission]}},worldId,missionId:mission.id,user,resources:{blocks:[],units:[{code:resourceCode,blockId:'BC-INTERNAL',title:'Les variables',skillLabel:'Utiliser les variables',lesson:'JSON et API : lis le résultat du serveur.',example:'const batterie = 2;',task:'Observe la valeur.',proof:'Un résultat expliqué.',transfer:'Change la valeur.',questions:[]}]},progress:null};
 await page.goto('/game/index.html');await page.evaluate(c=>window.postMessage(c,'*'),context);await expect(page.locator('#missionCode')).toBeVisible();
 await expect(page.locator('h1')).toContainText(world.title);await expect(page.locator('.mission-stage')).toContainText(mission.title);
 await page.getByLabel(`Ton code · ${Object.keys(mission.files)[0]}`,{exact:true}).fill('return 42;');await page.getByRole('button',{name:'Enregistrer',exact:true}).click();
 await expect(page.locator('#missionResult')).not.toContainText('enregistré');
 await page.getByRole('button',{name:'Tester ce scénario'}).click();await expect(page.locator('#missionResult')).not.toContainText('Teste ce scénario');
 await page.locator('[data-help-resource]').first().click();await expect(page.locator('#resourceModal')).toContainText('JSON et API');await expect(page.locator('#resourceModal')).not.toContainText(/BC-INTERNAL|BC\d+-C\d+-\d+|Preuve attendue/);
 await page.screenshot({path:`test-results/student-wording/after-${info.project.name}-game-resource.png`,fullPage:true});
 await page.getByRole('button',{name:'Fermer',exact:true}).click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('a delayed save never confirms edits made after the request',async({page})=>{
 const state=await routeStudent(page);let release;state.holdSave=new Promise(resolve=>release=resolve);
 await page.goto('/today');const answer=page.locator('[data-answer="demo-diag"]');await answer.fill('Première réponse.');
 await page.getByRole('button',{name:'Enregistrer',exact:true}).click();await expect(page.locator('#save-status')).toHaveText('Enregistrement en cours…');
 await answer.fill('Nouvelle réponse.');release();await expect(page.getByRole('button',{name:'Enregistrer',exact:true})).toBeEnabled();
 await expect(page.locator('#save-status')).toHaveText('Enregistré sur cet appareil.');expect(state.attempt.answers['demo-diag']).toBe('Première réponse.');
});
