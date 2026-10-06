// Runs only inside the dedicated laboratory, never on the application server.
// The page receives project files, never the validator, Node APIs or credentials.
import {chromium} from 'playwright';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
export async function renderDOM(input,{executablePath}={}){
 const files=input.files;
 if(!Array.isArray(files)||files.length!==3||new Set(files.map(f=>f.path)).size!==3||files.some(f=>!['index.html','style.css','main.js'].includes(f.path)||typeof f.content!=='string'||Buffer.byteLength(f.content)>30000))throw Error('Three bounded project files required');
 const actions=input.actions||[];if(!Array.isArray(actions)||actions.length>40)throw Error('Interaction limit reached');
 const browser=await chromium.launch({headless:true,chromiumSandbox:true,executablePath,timeout:5000});
 try{
  const context=await browser.newContext({viewport:{width:800,height:500},acceptDownloads:false,serviceWorkers:'block',javaScriptEnabled:true});
  const page=await context.newPage();page.setDefaultTimeout(2500);page.setDefaultNavigationTimeout(3000);
  const logs=[];const log=value=>{if(logs.length<40)logs.push(String(value).slice(0,1000));};
  page.on('console',message=>log(`${message.type()}: ${message.text()} (${message.location().url}:${(message.location().lineNumber||0)+1})`));page.on('pageerror',error=>log(`Erreur: ${error.stack||error.message}`));page.on('popup',popup=>popup.close());page.on('dialog',dialog=>dialog.dismiss());
  const csp="default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; worker-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url()),name=url.pathname==='/'?'index.html':url.pathname.slice(1),file=files.find(f=>f.path===name);
   if(url.origin!=='http://project.test'||!file||route.request().method()!=='GET')return route.abort();
   await route.fulfill({status:200,headers:{'Content-Type':name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8','Content-Security-Policy':csp,'X-Content-Type-Options':'nosniff'},body:file.content});
  });
  await page.goto('http://project.test/',{waitUntil:'load'});
  const interact=async action=>{
   if(action.type==='click'&&Number.isFinite(action.x)&&Number.isFinite(action.y)&&action.x>=0&&action.x<=800&&action.y>=0&&action.y<=500)await page.mouse.click(action.x,action.y);
   else if(action.type==='text'&&typeof action.text==='string'&&action.text.length<=500)await page.keyboard.insertText(action.text);
   else if(action.type==='key'&&['Enter','Tab','Backspace','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(action.key))await page.keyboard.press(action.key);
   else throw Error('Unsupported interaction');
  };
  for(const action of actions)await interact(action);
  const checks=[];
  if(input.tests){
   if(!Array.isArray(input.tests)||!input.tests.length||input.tests.length>20)throw Error('Invalid behavior tests');
   for(const test of input.tests){
    if(test.invoke!=='dom-behavior')throw Error('Unsupported behavior test');
    const rule=JSON.parse(test.argsJSON);if(typeof rule.label!=='string'||!Array.isArray(rule.steps)||rule.steps.length>15)throw Error('Invalid behavior rule');
    await page.goto('http://project.test/',{waitUntil:'load'});let ok=true;
    for(const step of rule.steps){
     if(typeof step.selector!=='string'||step.selector.length>200)throw Error('Invalid selector');
     const target=page.locator(step.selector);
     const count=await target.count();if(step.action!=='count'&&count!==1){ok=false;continue;}
     const matches=async read=>{const deadline=Date.now()+750;let value=await read();while(value!==step.value&&Date.now()<deadline){await page.waitForTimeout(25);value=await read();}return value===step.value;};
     try{
      if(step.action==='click')await target.click();
      else if(step.action==='fill'&&typeof step.value==='string'&&step.value.length<=500)await target.fill(step.value);
      else if(step.action==='text')ok=(await matches(async()=>(await target.innerText()).trim()))&&ok;
      else if(step.action==='count')ok=ok&&(await target.count())===step.value;
      else if(step.action==='attribute'&&['aria-expanded','aria-pressed','disabled','hidden','class'].includes(step.name))ok=(await matches(()=>target.getAttribute(step.name)))&&ok;
      else throw Error('Unsupported assertion');
     }catch(error){if(error.name==='TimeoutError')throw Error('Interaction timed out: technical incident, no learning judgment');throw error;}
    }
    checks.push({label:rule.label,ok});
   }
  }
  const screenshot=await page.screenshot({type:'png',timeout:2000});if(screenshot.length>750000)throw Error('Screenshot quota exceeded');
  return {ok:checks.length?checks.every(c=>c.ok):null,checks,logs,screenshot:screenshot.toString('base64'),width:800,height:500,snapshotHash:createHash('sha256').update(JSON.stringify(files)).digest('hex'),runtime:`chromium/${browser.version()}`};
 }finally{await browser.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 let body='';for await(const chunk of process.stdin){body+=chunk;if(Buffer.byteLength(body)>250000)throw Error('Input quota exceeded');}
 const timer=setTimeout(()=>process.exit(124),12000);timer.unref();
 try{process.stdout.write(JSON.stringify(await renderDOM(JSON.parse(body))));}finally{clearTimeout(timer);}
}
