import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {diagnosticRevisionFixture} from '../tests/fixtures/diagnostic-revision.mjs';
import {createApp} from '../server/app.mjs';
import {revisionSchema} from '../server/lesson-revision.mjs';
import {validate} from '../server/contracts.mjs';

const directory='test-results/lesson-revision';await mkdir(directory,{recursive:true});
const {store,actor,lesson,spec}=await diagnosticRevisionFixture();
await store.put('lessons',{...lesson,qualityRequired:true,qualityJobId:'cancelled'});
await store.insert('generation_jobs',{id:'cancelled',classId:actor.classId,lessonId:lesson.id,status:'cancelled',stage:'analysis',sources:[]});
const original=await store.get('lesson_versions',lesson.versionId),patch=(path,value)=>({op:'replace',path,value});
let calls=0;
const server=createApp(store,{lessonRevision:{configure:async()=>({provider:'chatgpt_plan',roles:{write:{model:'fixture',billing:'chatgpt_plan'}}}),call:async()=>{
 calls++;if(calls===1)throw Object.assign(Error('Connexion de recette interrompue.'),{status:503});
 const index=spec.activities.findIndex(a=>a.type==='Blackboard');
 const task={publicTests:null,validationVariants:null,observation:null,...spec.activities[index],workshop:null,type:'FillBlank',title:'Expliquer un cas limite',instruction:'Complète : pour parcourir tous les indices, la condition i ___ valeurs.length exclut la borne finale.',options:['<'],expectedAnswer:'<',reference:'La condition i < valeurs.length exclut l’indice égal à la longueur.',correctionMode:'exact'};
 return {value:validate(revisionSchema,{summary:'Le dessin est remplacé par une condition à compléter et à justifier en JavaScript.',changes:[patch(`/activities/${index}`,task),patch('/teacherGuide','Faire justifier la borne finale de la boucle JavaScript.\nTester le cas "vide" et expliquer i < valeurs.length.')]})};
}}}).listen(0,'127.0.0.1');await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
const base=`http://127.0.0.1:${server.address().port}`,chrome=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
let browser,page;const errors=[],report={scope:'Isolated real HTTP/browser flow with simulated AI; no real course modified or published',checks:[]};
try{
 browser=await chromium.launch({headless:true,...existsSync(chrome)?{executablePath:chrome}:{}});
 const context=await browser.newContext({viewport:{width:1440,height:1100}});await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
 await context.request.post(base+'/api/login',{data:{role:'teacher',username:'professeur',password:'quality-preview-only'}});
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/?editLesson='+encodeURIComponent(lesson.id));
 await expect(page.getByRole('heading',{name:'Modifier avec une consigne',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'JavaScript · sans dessins',exact:true}).click();const prompt=await page.getByLabel('Votre demande de modification').inputValue();assert.match(prompt,/Conserve les notions de tableaux JavaScript/);
 await page.getByRole('button',{name:'Proposer les modifications',exact:true}).click();await expect(page.locator('[data-revision-error]')).toContainText('Connexion de recette interrompue');assert.equal(await page.getByLabel('Votre demande de modification').inputValue(),prompt);assert.equal((await store.get('lessons',lesson.id)).version,1);
 await page.getByRole('button',{name:'Proposer les modifications',exact:true}).click();await expect(page.getByRole('heading',{name:'Relire les modifications',exact:true})).toBeVisible();
 await expect(page.locator('#dialog')).toContainText('Expliquer un cas limite');assert.equal((await store.get('lessons',lesson.id)).version,1);
 await page.getByRole('button',{name:'Garder le brouillon actuel',exact:true}).click();await page.reload();await page.getByRole('button',{name:'Retrouver mes propositions',exact:true}).click();await page.getByRole('button',{name:'Relire cette proposition',exact:true}).click();
 await page.locator('#dialog details').first().locator('summary').click();await page.screenshot({path:directory+'/comparison-desktop.png'});
 await page.getByRole('button',{name:'Enregistrer cette version',exact:true}).click();await expect(page.locator('#revision-editor')).toContainText('version 2');
 assert.equal(calls,2);assert.equal((await store.get('lessons',lesson.id)).status,'draft');assert.deepEqual(await store.get('lesson_versions',lesson.versionId),original);
 await page.setViewportSize({width:390,height:844});await page.locator('#revision-editor').scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await page.screenshot({path:directory+'/editor-mobile.png'});
 await page.getByRole('button',{name:'Publier cette version',exact:true}).click();await expect(page.getByRole('heading',{name:'Ce qu’il reste avant de publier',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Reprendre en brouillon professeur',exact:true}).click();await page.getByRole('checkbox',{name:'Je prends en charge la validation pédagogique de cette version.'}).check();await page.getByRole('button',{name:'Créer mon brouillon professeur',exact:true}).click();await expect(page.locator('#revision-editor')).toContainText('version 3');
 await page.getByRole('button',{name:'Publier cette version',exact:true}).click();await expect(page.getByRole('heading',{name:'Publier cette séance ?',exact:true})).toBeVisible();assert.equal((await store.get('lessons',lesson.id)).status,'draft');
 await page.getByRole('button',{name:'Valider et publier',exact:true}).click();await expect(page.getByRole('heading',{name:'Accès élèves',exact:true})).toBeVisible();assert.equal((await store.get('lessons',lesson.id)).status,'published');assert.equal((await store.list('lesson_publications')).length,1);
 await page.getByRole('button',{name:'Fermer',exact:true}).first().click();await expect(page.locator('#revision-editor')).toHaveCount(0);
 assert.deepEqual(errors,[]);report.status='PASS';report.checks=['prompt-preset','error-keeps-prompt-and-draft','review-before-save','proposal-survives-reload','immutable-previous-version','mobile-no-overflow','blocked-preparation-explicit-teacher-takeover','supports-compiled','exact-version-publication','editor-hidden-after-publication','no-browser-errors'];
}catch(error){report.status='FAIL';report.error=error.stack;await page?.screenshot({path:directory+'/failure.png'});throw error;}
finally{await writeFile(directory+'/report.json',JSON.stringify(report,null,2)+'\n');await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await store.close();}
console.log(JSON.stringify(report,null,2));
