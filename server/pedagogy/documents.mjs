import JSZip from 'jszip';
import sax from 'sax';
import ExcelJS from 'exceljs';
import {parse} from 'parse5';
import https from 'node:https';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {Worker} from 'node:worker_threads';
import {uid,now,fail,requireValue,scoped} from '../store.mjs';
import {digest} from './contracts.mjs';
export const sourceRoles=['curriculum','progression','technical','reference','exercise','solution','tone','visual'];
export const MAX_DOCUMENT_BYTES=8*1024*1024;
const textOf=node=>node.nodeName==='#text'?node.value:(node.childNodes||[]).map(textOf).join('');
function htmlBlocks(html){
 const tree=parse(html),blocks=[];
 const walk=node=>{if(['script','style','nav','iframe','object'].includes(node.tagName))return;
  if(['h1','h2','h3','h4','h5','h6','p','pre','table','ul','ol','figcaption'].includes(node.tagName)){
   let value=textOf(node);if(node.tagName==='table')value=(node.childNodes||[]).flatMap(n=>n.tagName==='tbody'||n.tagName==='thead'?n.childNodes:[n]).filter(n=>n.tagName==='tr').map(row=>(row.childNodes||[]).filter(n=>['td','th'].includes(n.tagName)).map(textOf).join(' | ')).join('\n');
   if(value.trim())blocks.push({type:/^h\d/.test(node.tagName)?'heading':node.tagName==='pre'?'code':node.tagName==='table'?'table':'text',text:value.trim(),location:`element:${blocks.length+1}`});return;
  }if(node.tagName==='img')blocks.push({type:'figure',text:node.attrs?.find(a=>a.name==='alt')?.value||'Figure sans description ; inspection requise.',location:`element:${blocks.length+1}`});
  (node.childNodes||[]).forEach(walk);
 };walk(tree);return blocks;
}
export function markdownBlocks(text){
 const lines=text.replace(/\r\n/g,'\n').split('\n'),blocks=[];let buffer=[],start=1,code=false;
 const flush=()=>{if(buffer.join('\n').trim())blocks.push({type:code?'code':'text',text:buffer.join('\n'),location:`lines:${start}-${start+buffer.length-1}`});buffer=[];};
 for(const [i,line] of lines.entries()){
  if(/^\s*```/.test(line)){if(code){buffer.push(line);flush();code=false;}else{flush();start=i+1;code=true;buffer.push(line);}continue;}
  if(!code&&/^#{1,6} /.test(line)){flush();blocks.push({type:'heading',text:line.replace(/^#+ /,''),location:`line:${i+1}`});start=i+2;}
  else{if(!buffer.length)start=i+1;buffer.push(line);}
 }flush();return blocks;
}
async function officeBlocks(buffer,extension){
 const zip=await JSZip.loadAsync(buffer),files=Object.values(zip.files);
 requireValue(files.length<=2000&&files.reduce((n,f)=>n+(f._data?.uncompressedSize||0),0)<=32*1024*1024,'Archive trop volumineuse après décompression.');
 const names=extension==='docx'?['word/document.xml']:files.map(f=>f.name).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a,b)=>Number(a.match(/\d+/)[0])-Number(b.match(/\d+/)[0]));
 const blocks=[];
 for(const name of names){const file=zip.file(name);requireValue(file,'Structure Office manquante.');const xml=await file.async('string');requireValue(!/<!DOCTYPE|<!ENTITY/i.test(xml),'Entités XML interdites.');
  const parser=sax.parser(true);let content='',capture=false,inTable=0,heading=false,number=0;
  parser.onopentag=n=>{if(/:(t|instrText)$/.test(n.name))capture=true;if(/:tbl$/.test(n.name))inTable++;if(/:pStyle$/.test(n.name)&&Object.values(n.attributes).some(v=>/heading|titre/i.test(v)))heading=true;if(/:tab$/.test(n.name))content+='\t';if(/:br$/.test(n.name))content+='\n';};
  parser.ontext=t=>{if(capture)content+=t;};
  parser.onclosetag=name=>{if(/:(t|instrText)$/.test(name))capture=false;if(/:tc$/.test(name))content+=' | ';if(/:tr$/.test(name))content+='\n';if(/:tbl$/.test(name))inTable--;
   if((/:p$/.test(name)&&!inTable)||/:tbl$/.test(name)){if(content.trim())blocks.push({type:heading?'heading':/:tbl$/.test(name)?'table':'text',text:content.trim(),location:`${file.name}:block:${++number}`});content='';heading=false;}
  };parser.write(xml).close();
 }return blocks;
}
function pdfBlocks(buffer){return new Promise((resolve,reject)=>{
 const worker=new Worker(new URL('./pdf-worker.mjs',import.meta.url),{workerData:buffer,resourceLimits:{maxOldGenerationSizeMb:192}});
 const timeout=setTimeout(()=>{worker.terminate();reject(Error('Extraction PDF interrompue après 30 secondes.'));},30000);
 worker.once('message',message=>{clearTimeout(timeout);worker.terminate();message.error?reject(Error(message.error)):resolve(message);});
 worker.once('error',error=>{clearTimeout(timeout);reject(error);});
 worker.once('exit',code=>{clearTimeout(timeout);if(code!==0)reject(Error('Extraction PDF interrompue.'));});
});}
export async function extractDocument(buffer,filename){
 requireValue(Buffer.isBuffer(buffer)&&buffer.length>0&&buffer.length<=MAX_DOCUMENT_BYTES,'Document vide ou supérieur à 8 Mio.');
 const extension=filename.split('.').at(-1).toLowerCase();let blocks=[],warnings=[];
 if(['md','txt','markdown'].includes(extension))blocks=markdownBlocks(buffer.toString('utf8'));
 else if(['js','mjs','ts','css','py','sh','sql','json','yaml','yml'].includes(extension))blocks=[{type:'code',text:buffer.toString('utf8'),location:`lines:1-${buffer.toString('utf8').split('\n').length}`}];
 else if(['html','htm'].includes(extension)){blocks=htmlBlocks(buffer.toString('utf8'));warnings.push('Scripts, styles et navigation exclus ; images non inspectées.');}
 else if(['docx','pptx'].includes(extension)){blocks=await officeBlocks(buffer,extension);warnings.push('Mise en page, images et notes non inspectées ; vérifier les figures centrales.');}
 else if(extension==='xlsx'){
  const zip=await JSZip.loadAsync(buffer);requireValue(Object.values(zip.files).reduce((n,f)=>n+(f._data?.uncompressedSize||0),0)<=32*1024*1024,'Classeur décompressé trop volumineux.');
  const book=new ExcelJS.Workbook();await book.xlsx.load(buffer);for(const sheet of book.worksheets){sheet.eachRow((row,i)=>blocks.push({type:'table',text:row.values.slice(1).map(v=>v&&typeof v==='object'?JSON.stringify(v):String(v??'')).join(' | '),location:`sheet:${sheet.name}:row:${i}`,parent:sheet.name}));}warnings.push('Formules conservées avec leur résultat enregistré ; aucune formule recalculée.');
 }else if(extension==='pdf'){const extracted=await pdfBlocks(buffer);blocks=extracted.blocks;warnings=extracted.warnings;}
 else fail(415,'Format non pris en charge. Utilisez PDF, DOCX, PPTX, XLSX, MD/TXT, HTML ou code texte.');
 requireValue(blocks.reduce((n,b)=>n+b.text.length,0)<=1000000,'Extraction trop volumineuse : scinder le document.');
 if(!blocks.length)warnings.push('Extraction vide. Un scan exige un OCR ; aucun OCR configuré.');
 if(blocks.some(b=>b.type==='figure'))warnings.push('Figure présente : inspection visuelle encore nécessaire.');
 return {blocks,warnings,status:blocks.length?(warnings.some(w=>/page.*vide|scan|ordre de lecture/i.test(w))?'needs_attention':'extracted'):'needs_attention'};
}
export function semanticSegments(blocks,sourceId,visibility){
 const groups=[];let parent='Document',group=[];
 const flush=()=>{if(group.length){const number=groups.length+1;groups.push({id:`${sourceId}:s${number}`,parent,location:group.map(b=>b.location).join('; '),blocks:group,text:group.map(b=>b.text).join('\n\n'),visibility});group=[];}};
 for(const b of blocks){if(b.type==='heading'){flush();parent=b.text;}group.push(b);}flush();return groups;
}
export async function importDocument(store,actor,input,buffer){
 requireValue(sourceRoles.includes(input.role),'Rôle de source invalide.');requireValue(typeof input.filename==='string'&&input.filename.length<=200,'Nom de fichier requis.');
 const contentHash=digest(buffer),identity=input.sourceKey||input.filename;
 const existing=(await store.list('pedagogical_sources',actor.classId)).find(s=>s.sourceKey===identity&&s.contentHash===contentHash&&s.role===input.role);if(existing)return existing;
 const extraction=await extractDocument(buffer,input.filename);
 return store.transaction(async tx=>{
  const versions=(await tx.list('pedagogical_sources',actor.classId)).filter(s=>s.sourceKey===identity),duplicate=versions.find(s=>s.contentHash===contentHash&&s.role===input.role);if(duplicate)return duplicate;
  const id=uid('source'),visibility=input.role==='solution'?'teacher':'student',version=versions.length+1;
  const record=await tx.insert('pedagogical_sources',{id,classId:actor.classId,version,sourceKey:identity,title:input.title||input.filename,filename:input.filename,role:input.role,visibility,author:input.author||null,sourceURL:input.sourceURL||null,declaredVersion:input.declaredVersion||null,consultedAt:now(),contentHash,originalBase64:buffer.toString('base64'),status:extraction.status,warnings:extraction.warnings,segments:semanticSegments(extraction.blocks,id,visibility),supersedes:versions.at(-1)?.id||null,analysisStatus:'not_analyzed'});
  for(const job of await tx.list('generation_jobs',actor.classId))if(job.sourceIds?.some(s=>versions.some(v=>v.id===s))&&!['cancelled','failed','blocked'].includes(job.status)){
   job.sourceChanged=true;job.invalidationReason='Nouvelle version de source : régénérer le brouillon. Les publications gardent leur version.';await tx.put('generation_jobs',job);
  }await tx.audit(actor,'source.imported',id,{version,contentHash});return record;
 });
}
export const sourceSummary=({originalBase64,...source})=>source;
export async function sourceDossier(store,actor,ids){
 requireValue(Array.isArray(ids)&&ids.length<=12,'Sélectionner au plus 12 documents.');
 const sources=[];for(const id of ids){const source=await scoped(store,'pedagogical_sources',id,actor);requireValue(source.status==='extracted',`Source ${source.title} : extraction à vérifier avant génération.`);sources.push(sourceSummary(source));}
 const keys=new Set();for(const s of sources){requireValue(!keys.has(s.sourceKey),`Versions contradictoires sélectionnées : ${s.title}.`);keys.add(s.sourceKey);}
 return sources;
}
export function publicAddress(address){
 if(isIP(address)===4){const [a,b]=address.split('.').map(Number);return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&[0,168].includes(b)||a===100&&b>=64&&b<=127||a===198&&[18,19,51].includes(b)||a===203&&b===0);}
 return isIP(address)===6&&/^[23][0-9a-f]{3}:/i.test(address)&&!/^2002:|^2001:(db8|0|10|20):/i.test(address);
}
export async function fetchAllowedURL(value,{allowedHosts=(process.env.EDEN_SOURCE_HOSTS||'').split(',').filter(Boolean),resolve=lookup}={}){
 let url=new URL(value);for(let redirects=0;redirects<=3;redirects++){
  requireValue(url.protocol==='https:'&&!url.username&&!url.password&&(!url.port||url.port==='443')&&allowedHosts.includes(url.hostname),'URL HTTPS hors des domaines autorisés par EDEN_SOURCE_HOSTS.');
  const addresses=await resolve(url.hostname,{all:true});requireValue(addresses.length&&addresses.every(a=>publicAddress(a.address)),'Destination privée ou réservée interdite.');
  const result=await new Promise((resolve,reject)=>{
   const request=https.get(url,{lookup:(_host,options,callback)=>options.all?callback(null,[addresses[0]]):callback(null,addresses[0].address,addresses[0].family),timeout:15000,headers:{Accept:'text/html,text/plain,application/pdf'}},response=>{
    if([301,302,303,307,308].includes(response.statusCode)){response.resume();resolve({redirect:response.headers.location});return;}
    if(response.statusCode!==200){response.resume();reject(Error(`Source HTTP ${response.statusCode}`));return;}
    const chunks=[];let length=0;response.on('data',chunk=>{length+=chunk.length;if(length>MAX_DOCUMENT_BYTES)request.destroy(Error('Source supérieure à 8 Mio.'));else chunks.push(chunk);});response.on('end',()=>resolve({buffer:Buffer.concat(chunks),contentType:response.headers['content-type']||'',url:url.href}));response.on('error',reject);
   });request.on('timeout',()=>request.destroy(Error('Source trop lente.')));request.on('error',reject);
  });if(!result.redirect)return result;url=new URL(result.redirect,url);
 }fail(400,'Trop de redirections.');
}
