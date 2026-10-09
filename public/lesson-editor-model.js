import {textDocument,richText} from './rich-document.js';
import {randomUUID as randomId} from './random-id.js';
const id=prefix=>prefix+'-'+randomId();
export const newId=id;
export function sectionItems(b,spec){
 if(b.editor)return b.editor.items;
 const items=[],text=(role,value,code=false)=>{if(value)items.push({id:`${b.id}:${role}`,kind:'rich',role,doc:textDocument(value,code)});};
 text('content',b.content,b.type==='LiveCode'&&/\b(const|let|function|console\.|return|SELECT)|[{}]/.test(b.content));
 for(const role of ['steps','takeaways','diagram'])text(role,(b.teaching?.[role]||[]).join('\n\n'));
 for(const role of ['hint','check'])text(role,b.teaching?.[role]);
 for(const board of b.boards||[])items.push({id:`${b.id}:board:${board}`,kind:'board',board});
 if(b.type==='LessonHero'||b.type==='ObjectiveCard')items.push({id:`${b.id}:objectives`,kind:'objectives'});
 if(b.type==='Timeline')items.push({id:`${b.id}:timeline`,kind:'timeline'});
 if(b.type==='Diagnostic'){items.push({id:`${b.id}:diagnostic`,kind:'diagnostic'});for(const a of spec.diagnostic.tasks)items.push({id:`${b.id}:task:${a.id}`,kind:'diagnosticActivity',activityId:a.id});}
 if(b.type==='CodeStationLauncher')items.push({id:`${b.id}:mission`,kind:'mission'});
 for(const activityId of b.activityIds)items.push({id:`${b.id}:activity:${activityId}`,kind:'activity',activityId});
 return items;
}
export function ensureSection(b,spec){b.editor??={version:1,items:sectionItems(b,spec)};return b.editor.items;}
export function synchronizeSpec(spec){
 for(const b of spec.blocks)if(b.editor){
  const items=b.editor.items;b.activityIds=items.filter(i=>i.kind==='activity').map(i=>i.activityId);
  b.content=items.filter(i=>i.kind==='rich'&&i.role==='content').map(i=>richText(i.doc)).join('\n\n');
  b.teaching={...b.teaching};for(const role of ['steps','takeaways','diagram'])b.teaching[role]=items.filter(i=>i.kind==='rich'&&i.role===role).flatMap(i=>richText(i.doc).split('\n\n'));
  for(const role of ['hint','check'])b.teaching[role]=items.filter(i=>i.kind==='rich'&&i.role===role).map(i=>richText(i.doc)).join('\n\n');
  b.boards=items.filter(i=>i.kind==='board').map(i=>i.board);
 }
 for(const a of [...spec.activities,...spec.diagnostic.tasks]){for(const [key,doc]of Object.entries(a.richText||{}))a[key]=richText(doc);if(a.workshop?.profile==='dom'){const f=a.workshop.files.find(f=>f.path==='main.js');if(f)f.content=a.starter;}}
 spec.timeline=spec.blocks.map(b=>({blockId:b.id,minutes:b.minutes}));spec.studentFlow=spec.blocks.map(b=>b.id);
 if(spec.editorVersion===1||spec.blocks.some(b=>b.editor))spec.slides=spec.blocks.map(b=>({title:b.title,body:b.content}));
 return spec;
}
export function removeItem(spec,b,itemId){const items=ensureSection(b,spec),item=items.find(i=>i.id===itemId);b.editor.items=items.filter(i=>i.id!==itemId);if(item?.kind==='activity'){b.activityIds=b.activityIds.filter(i=>i!==item.activityId);prune(spec,[item.activityId]);}if(item?.kind==='diagnosticActivity'){spec.diagnostic.tasks=spec.diagnostic.tasks.filter(a=>a.id!==item.activityId);spec.diagnostic.rubric=spec.diagnostic.rubric.filter(r=>r.taskId!==item.activityId);}synchronizeSpec(spec);}
function prune(spec,ids){spec.activities=spec.activities.filter(a=>!ids.includes(a.id)||spec.blocks.some(b=>b.activityIds.includes(a.id)));}
export function removeSection(spec,sectionId){const b=spec.blocks.find(b=>b.id===sectionId);spec.blocks=spec.blocks.filter(b=>b.id!==sectionId);prune(spec,b.activityIds);spec.sourceNotes=spec.sourceNotes?.filter(n=>n.blockId!==sectionId);if(!spec.sourceNotes)delete spec.sourceNotes;if(b.type==='Diagnostic'&&!spec.blocks.some(b=>b.type==='Diagnostic')){spec.diagnostic.tasks=[];spec.diagnostic.rubric=[];spec.diagnostic.criteria=[];}if(b.type==='CodeStationLauncher'&&!spec.blocks.some(b=>b.type==='CodeStationLauncher'))spec.codeStation=null;synchronizeSpec(spec);}
export function duplicateSection(spec,sectionId){
 const source=spec.blocks.find(b=>b.id===sectionId),b=structuredClone(source),mapping=new Map();b.id=id('section');b.title+=' (copie)';
 b.editor={version:1,items:structuredClone(sectionItems(source,spec))};
 for(const item of b.editor.items){item.id=id('bloc');if(['activity','diagnosticActivity'].includes(item.kind)){const a=structuredClone([...spec.activities,...spec.diagnostic.tasks].find(a=>a.id===item.activityId));if(!mapping.has(a.id)){mapping.set(a.id,id('activity'));a.id=mapping.get(a.id);spec.activities.push(a);}item.activityId=mapping.get(item.activityId);item.kind='activity';}}
 if(b.type==='Diagnostic'){b.type='Activity';b.phase='guided';b.editor.items=b.editor.items.filter(i=>i.kind!=='diagnostic');}
 b.activityIds=b.editor.items.filter(i=>i.kind==='activity').map(i=>i.activityId);spec.blocks.splice(spec.blocks.indexOf(source)+1,0,b);
 for(const n of spec.sourceNotes?.filter(n=>n.blockId===source.id)||[])spec.sourceNotes.push({...structuredClone(n),blockId:b.id});synchronizeSpec(spec);return b;
}
export function starterFiles(a){const w=a.workshop||{};
 if(w.files?.length)return w.files.map((f,i)=>({path:f.path,language:languageFor(f.path),get:()=>w.profile==='dom'&&f.path==='main.js'?a.starter:f.content,set:v=>{f.content=v;if(w.profile==='dom'&&f.path==='main.js')a.starter=v;},index:i}));
 const lang=w.language||a.correctionMode;const files=[{path:{javascript:'main.js',html:'index.html',css:'style.css',sql:'requete.sql'}[lang]||'production.txt',language:lang,get:()=>a.starter,set:v=>{a.starter=v;}}];
 if(lang==='css')files.unshift({path:'index.html',language:'html',get:()=>w.document??'',set:v=>{w.document=v;}});
 if(['html','css'].includes(lang))files.push({path:lang==='css'?'support.css':'style.css',language:'css',get:()=>w.style??'',set:v=>{w.style=v;}});
 return files;
}
export const languageFor=path=>({js:'javascript',mjs:'javascript',html:'html',css:'css',sql:'sql',sh:'shell',bash:'shell'})[path.split('.').at(-1)]||'text';
