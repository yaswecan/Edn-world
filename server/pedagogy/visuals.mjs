import {existsSync} from 'node:fs';
import {loggedIn} from '../auth.mjs';
import {fail,requireValue} from '../store.mjs';
import {digest} from './contracts.mjs';
import {previewDocument} from '../../public/workshop-ui.js';

// Only pixels leave the isolated render: the reference implementation stays private.
export async function prepareVisualReferences(store,spec,job){
 const tasks=spec.activities.filter(a=>a.type==='CodeEditor'&&a.workshop?.profile==='html-css');
 if(!tasks.length)return;
 const {chromium}=await import('@playwright/test'),chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
 const executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||(existsSync(chrome)?chrome:undefined);
 const browser=await chromium.launch({headless:true,...executablePath?{executablePath}:{}});
 try{
  for(const task of tasks){
   const document=previewDocument(task,task.reference),id=digest({classId:job.classId,document,width:900,height:600,version:'visual-1'});
   let asset=await store.get('lesson_assets',id);
   if(!asset){
    const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:900,height:600},serviceWorkers:'block'});
    try{
     await context.route('**/*',route=>route.abort());
     const page=await context.newPage();await page.setContent(document,{timeout:10000,waitUntil:'load'});
     const bytes=await page.screenshot({type:'png'});requireValue(bytes.length<=1000000,'Référence visuelle trop volumineuse.');
     asset={id,classId:job.classId,kind:'reference-render',mimeType:'image/png',sha256:digest(bytes),base64:bytes.toString('base64'),width:900,height:600};
     asset=await store.transaction(async tx=>await tx.get('lesson_assets',id)||tx.insert('lesson_assets',asset));
    }finally{await context.close();}
   }
   task.workshop.visual={id,alt:`Rendu de référence : ${task.title}. ${task.expectedEvidence}`,width:asset.width,height:asset.height};
  }
 }finally{await browser.close();}
}
export async function visualAssets(store,spec){
 const assets=[];
 for(const id of new Set(spec.activities.map(a=>a.workshop?.visual?.id).filter(Boolean))){
  const asset=await store.get('lesson_assets',id);requireValue(asset?.classId===spec.classId&&digest(Buffer.from(asset.base64,'base64'))===asset.sha256,'Référence visuelle absente ou altérée.');assets.push(asset);
 }return assets;
}
export function visualRoutes(app,store){
 app.get('/api/lesson-assets/:id',loggedIn,async(req,res)=>{
  const asset=await store.get('lesson_assets',req.params.id);if(!asset||asset.classId!==req.user.classId)fail(404,'Ressource introuvable.');
  const versions=await store.list('lesson_versions',req.user.classId),lessons=await store.list('lessons',req.user.classId);
  const allowed=versions.some(v=>v.spec.activities.some(a=>a.workshop?.visual?.id===asset.id)&&(req.user.role==='teacher'||lessons.some(l=>l.status==='published'&&l.versionId===v.id)));
  if(!allowed)fail(404,'Ressource introuvable.');
  const bytes=Buffer.from(asset.base64,'base64');requireValue(digest(bytes)===asset.sha256,'Ressource altérée.');res.type('png').send(bytes);
 });
}
