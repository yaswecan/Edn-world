import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {createApp} from '../server/app.mjs';
import {backupFixture,emptyDestination,populatedDestination,rawTables} from '../tests/fixtures/database-backup.mjs';

async function checkImport(replacing){
const store=await (replacing?populatedDestination():emptyDestination()),fixture=await backupFixture();
const server=createApp(store).listen(0,'127.0.0.1');
await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.locator('#username').fill('remote-prof');
 await page.locator('#password').fill('remote-test-password');
 await page.getByRole('button',{name:'Se connecter',exact:true}).click();
 await page.locator('[data-action=nav][data-id=settings]').click();
 await page.getByRole('button',{name:'Importer ma base locale',exact:true}).click();
 const before=await rawTables(store);
 await page.locator('#database-file').setInputFiles({name:'classe.eden-db.gz',mimeType:'application/gzip',buffer:fixture.buffer});
 await page.getByRole('button',{name:'Analyser ma base',exact:true}).click();
 await page.getByRole('heading',{name:'Vérifier la base locale'}).waitFor();
 if(replacing){
  await page.getByRole('button',{name:'Préparer le remplacement',exact:true}).click();
  await page.locator('#database-replace-confirm').waitFor();
  assert.match(await page.locator('#dialog').innerText(),/1 élèves, 1 séances et 2 remises/);
  assert.equal(await page.getByRole('button',{name:'Effacer et importer cette base',exact:true}).isDisabled(),true);
  // Cancelling a destructive preview must leave every original row intact.
  await page.locator('.modal-actions').getByRole('button',{name:'Fermer',exact:true}).click();
  assert.deepEqual(await rawTables(store),before);
  await page.getByRole('button',{name:'Importer ma base locale',exact:true}).click();
  await page.locator('#database-file').setInputFiles({name:'classe.eden-db.gz',mimeType:'application/gzip',buffer:fixture.buffer});
  await page.locator('#database-mode').selectOption('replace');
  await page.getByRole('button',{name:'Analyser ma base',exact:true}).click();
  await page.locator('#database-replace-confirm').waitFor();
 }
 assert.match(await page.locator('#dialog').innerText(),/Quatre cartes/);
 assert.match(await page.locator('#dialog').innerText(),/version 4/);
 assert.deepEqual(await rawTables(store),before);
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 if(replacing){
  const apply=page.getByRole('button',{name:'Effacer et importer cette base',exact:true});
  assert.equal(await apply.isDisabled(),true);
  await page.locator('#database-replace-confirm').check();
  assert.equal(await apply.isEnabled(),true);
  await page.locator('#database-replace-confirm').uncheck();
  assert.equal(await apply.isDisabled(),true);
  await page.locator('#database-replace-confirm').check();
  await apply.click();
 }else await page.getByRole('button',{name:'Confirmer l’import de ma base',exact:true}).click();
 await page.getByRole('heading',{name:'Base importée',exact:true}).waitFor();
 assert.deepEqual(await rawTables(store),{...fixture.tables,sessions:[]});
 await page.getByRole('button',{name:'Se reconnecter',exact:true}).click();
 assert.equal(await page.locator('#username').inputValue(),'local-prof');
 await page.locator('#password').fill('local-test-password');
 await page.getByRole('button',{name:'Se connecter',exact:true}).click();
 await page.setViewportSize({width:1280,height:900});
 await page.locator('[data-action=nav][data-id=lessons]').click();
 await page.getByText('Quatre cartes. À toi de les organiser.',{exact:true}).waitFor();
 await page.locator('[data-action=nav][data-id=settings]').click();
 await page.getByRole('button',{name:'Importer ma base locale',exact:true}).click();
 await page.locator('#database-file').setInputFiles({name:'classe.eden-db.gz',mimeType:'application/gzip',buffer:fixture.buffer});
 await page.getByRole('button',{name:'Analyser ma base',exact:true}).click();
 await page.getByText('Cette base est déjà importée. Aucune copie supplémentaire n’est nécessaire.',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Confirmer l’import de ma base',exact:true}).count(),0);
 assert.deepEqual(errors,[]);
 console.log(`Browser ${replacing?'replacement':'initial import'} passed: file selection, read-only preview, confirmation, mobile layout, restored login, lesson listing and duplicate detection.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));await store.close();}
}
await checkImport(false);
await checkImport(true);
