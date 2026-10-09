import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
import {trackingFixture} from '../tests/fixtures/student-tracking.mjs';
const f=await trackingFixture(),directory='test-results/student-tracking';await mkdir(directory,{recursive:true});
const chrome=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
let browser,pupil,teacher;const errors=[],report={scope:'Synthetic accounts; in-memory database; no external services',checks:[]};
try{
 browser=await chromium.launch({headless:true,...existsSync(chrome)?{executablePath:chrome}:{}});
 const pupilContext=await browser.newContext({viewport:{width:1280,height:900}}),teacherContext=await browser.newContext({viewport:{width:1440,height:1000}});
 for(const [context,as] of [[pupilContext,'alice'],[teacherContext,'teacher']]){await context.addCookies([{name:'eden_session',value:f.cookies[as].split('=')[1],url:f.base}]);await context.route('**/*',route=>new URL(route.request().url()).origin===f.base?route.continue():route.abort());}
 pupil=await pupilContext.newPage();teacher=await teacherContext.newPage();for(const page of [pupil,teacher])page.on('pageerror',e=>errors.push(e.message));
 await pupil.goto(f.base+'/today?assignment='+f.assignment.id);await expect(pupil.locator('.lesson-stage')).toBeVisible();
 await pupil.getByRole('button',{name:'Continuer',exact:true}).click();
 const answer=pupil.locator('[data-answer="demo-diag"]');await expect(answer).toBeVisible();await answer.fill('MON_BROUILLON_PRIVE — deux conditions sont nécessaires.');await pupil.locator('[data-answer="demo-diag-2"]').fill('return renvoie une valeur.');
 await expect(pupil.locator('#save-status')).toHaveText('Enregistré');await pupil.reload();await expect(answer).toHaveValue('MON_BROUILLON_PRIVE — deux conditions sont nécessaires.');
 report.checks.push('AC06 diagnostic autosave acknowledged and restored from server after reload');
 // A real failed save keeps editor contents and never announces success.
 await pupil.route('**/api/assessments/*/save',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Panne simulée de sauvegarde'})}));
 await answer.fill('BROUILLON_APRES_PANNE');await expect(pupil.locator('#save-status')).toContainText('non confirmé');await expect(answer).toHaveValue('BROUILLON_APRES_PANNE');await pupil.unroute('**/api/assessments/*/save');
 await pupil.getByRole('button',{name:'Enregistrer',exact:true}).click();await expect(pupil.locator('#save-status')).toHaveText('Enregistré');
 report.checks.push('AC06 failed save keeps text and can be retried');
 await pupil.locator('[data-action=submit-answers]').click();await pupil.locator('[data-action=confirm-submit]').click();await expect(pupil.getByRole('button',{name:'Voir le résultat'})).toBeVisible();
 const a=(await f.store.list('assessment_attempts')).find(a=>a.learnerId==='alice');
 await pupil.getByRole('link',{name:'Mes évaluations',exact:true}).click();await expect(pupil.getByRole('heading',{name:'Mes évaluations',exact:true})).toBeVisible();await pupil.getByRole('link',{name:'Premier diagnostic'}).click();
 await expect(pupil.locator('#main')).toContainText('BROUILLON_APRES_PANNE');await expect(pupil.locator('#main')).not.toContainText('PRIVATE_SOLUTION');await expect(pupil.locator('#main')).toContainText('Ton professeur prépare');
 report.checks.push('AC11 student copy visible before publication without private correction');
 await teacher.goto(f.base+'/suivi.html');await expect(teacher.getByRole('heading',{name:'Élèves',exact:true})).toBeVisible();await teacher.locator('a[href="?student=alice"]').click();await expect(teacher.locator('#main')).toContainText('Séances et évaluations');await teacher.getByRole('link',{name:'Premier diagnostic'}).click();
 await teacher.locator('input[name="points:item-0"]').fill('8');await teacher.locator('input[name="points:item-1"]').fill('7');await teacher.locator('textarea[name="feedback"]').fill('Tu identifies bien les conditions. Ajoute un exemple.');await teacher.getByLabel('Justification de la correction').fill('Lecture de chaque réponse.');await teacher.getByRole('button',{name:'Enregistrer la correction'}).click();await expect(teacher.locator('#notice')).toContainText('Correction enregistrée');
 await teacher.getByRole('link',{name:'Vue de classe'}).click();await expect(teacher.locator('#main')).toContainText('Aucun rendu');await teacher.getByRole('button',{name:'Fermer les rendus',exact:true}).click();await teacher.getByRole('link',{name:'Premier diagnostic'}).click();await teacher.getByRole('button',{name:'Publier cette révision'}).click();await expect(teacher.locator('#notice')).toContainText('visible');
 await pupil.reload();await expect(pupil.locator('#main')).toContainText('15 / 20');await expect(pupil.locator('#main')).toContainText('Tu identifies bien les conditions.');
 report.checks.push('AC09 AC19 class roster has missing copy; AC10 AC11 teacher correction and explicit publication');
 await teacher.locator('input[name="points:item-0"]').fill('10');await teacher.getByLabel('Justification de la correction').fill('Révision du premier critère.');await teacher.getByRole('button',{name:'Enregistrer la correction'}).click();await expect(teacher.locator('#notice')).toContainText('enregistrée');await pupil.reload();await expect(pupil.locator('#main')).toContainText('15 / 20');await teacher.getByRole('button',{name:'Publier cette révision'}).click();await pupil.reload();await expect(pupil.locator('#main')).toContainText('17 / 20');
 report.checks.push('AC12 published result stays unchanged until republication');
 await teacher.getByRole('button',{name:'Autoriser une reprise',exact:true}).click();await teacher.getByLabel('Motif pédagogique').fill('Revoir les conditions combinées.');await teacher.getByRole('button',{name:'Autoriser la reprise',exact:true}).click();await expect(teacher.locator('#main')).toContainText('Reprise 2 après corrigé');
 await pupil.goto(f.base+'/suivi.html?view=evaluations');await pupil.getByRole('link',{name:'Reprise 2 après corrigé'}).click();await pupil.getByRole('link',{name:'Reprendre',exact:true}).click();await expect(pupil.locator('.lesson-stage')).toBeVisible();if(!await pupil.locator('[data-answer="demo-diag"]').count())await pupil.getByRole('button',{name:'Continuer',exact:true}).click();await expect(pupil.locator('[data-answer="demo-diag"]')).toBeEditable();await pupil.locator('[data-answer="demo-diag"]').fill('REPRISE_PRIVEE');await expect(pupil.locator('#save-status')).toHaveText('Enregistré');
 assert.equal((await f.store.get('submissions',a.submissionId)).answers['demo-diag'],'BROUILLON_APRES_PANNE');
 report.checks.push('AC13 targeted retake writable after closure; original submission preserved');
 // Keyboard and narrow viewport in the history screens.
 await pupil.goto(f.base+'/suivi.html?view=lessons');await pupil.setViewportSize({width:390,height:844});await expect(pupil.getByRole('heading',{name:'Mes séances',exact:true})).toBeVisible();await pupil.keyboard.press('Tab');assert.equal(await pupil.evaluate(()=>document.activeElement!==document.body),true);assert.equal(await pupil.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await pupil.screenshot({path:directory+'/student-mobile.png',fullPage:true});
 await teacher.screenshot({path:directory+'/teacher-copy.png',fullPage:true});report.checks.push('AC20 keyboard navigation, mobile width, real links from student history and teacher profile');
 // Delay a real response started as Alice, change account in another tab, then
 // release the old response. The first page must be cleared, including workers.
 const reprise=await f.call('/api/tracking/reprises',{method:'POST',body:{learnerId:'alice',runId:'run',activityId:'guided-code',reason:'Recette de reprise du code'}});assert.equal(reprise.status,200);
 const other=await pupilContext.newPage();other.on('pageerror',e=>errors.push(e.message));
 await other.addInitScript(()=>window.addEventListener('message',event=>{if(event.data?.type==='tracking-test-result-held')window.trackingResultHeld=true;}));
 await other.route('**/code-runner-frame.js',async route=>{const response=await route.fetch(),source=await response.text();await route.fulfill({response,body:source.replace("const send=data=>parent.postMessage(data,'*');", "const send=data=>{if(data.type==='log'||data.type==='done'){window.trackingHeldResult=data;parent.postMessage({type:'tracking-test-result-held'},'*');}else parent.postMessage(data,'*');};")});});
 await other.goto(f.base+'/today?assignment='+reprise.data.assignmentId+'&activity=guided-code');await expect(other.locator('[data-answer="guided-code"]')).toBeEditable();
 await other.locator('[data-answer="guided-code"]').fill('console.log("EXECUTION_PRIVEE_ALICE");');await other.locator('[data-code-execute]').first().click();await other.waitForFunction(()=>window.trackingResultHeld===true);await expect(other.locator('[data-code-output]').first()).not.toContainText('EXECUTION_PRIVEE_ALICE');
 const loginPage=await pupilContext.newPage();await loginPage.goto(f.base+'/suivi.html?view=lessons');
 let release,seen;const held=new Promise(r=>release=r),captured=new Promise(r=>seen=r);let intercepted=false;
 await pupil.route('**/api/tracking/mine*',async route=>{if(intercepted)return route.continue();intercepted=true;const response=await route.fetch();seen();await held;try{await route.fulfill({response});}catch{}});
 await pupil.reload({waitUntil:'domcontentloaded'});await captured;
 await loginPage.getByRole('button',{name:'Se déconnecter'}).click();await expect(loginPage.locator('input[name=username]')).toBeVisible();await loginPage.locator('input[name=username]').fill('bob');await loginPage.locator('input[name=password]').fill(f.password);await loginPage.locator('form[data-form=login] button[type=submit]').click();release();
 await expect(other.locator('iframe[src="/code-runner-frame.html"]')).toHaveCount(0);await expect(other.locator('body')).not.toContainText('EXECUTION_PRIVEE_ALICE');
 await expect(other.locator('input[name=username]')).toHaveCount(0);await pupil.goto(f.base+'/suivi.html?view=evaluations');await expect(pupil.locator('#main')).not.toContainText('BROUILLON_APRES_PANNE');await expect(pupil.locator('#main')).not.toContainText('REPRISE_PRIVEE');await expect(pupil.locator('#main')).toContainText('Fermée — aucun rendu');
 assert.equal(await other.evaluate(()=>Object.entries(localStorage).some(([key,value])=>/^(eden:|eden-remise:|eden-lab-draft:)/.test(key)&&/BROUILLON|REPRISE_PRIVEE/.test(value))),false);
 report.checks.push('AC07 same browser account switch purges private drafts, invalidates delayed network response and removes a real runner with a held private execution result');
 assert.deepEqual(errors,[]);report.status='PASS';
}catch(error){report.status='FAIL';report.error=error.stack;await pupil?.screenshot({path:directory+'/failure.png',fullPage:true});throw error;}
finally{await writeFile(directory+'/report.json',JSON.stringify(report,null,2)+'\n');await browser?.close();await f.close();}
console.log(JSON.stringify(report,null,2));
