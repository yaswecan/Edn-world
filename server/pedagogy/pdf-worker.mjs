import {parentPort,workerData} from 'node:worker_threads';
try{
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const pdf=await getDocument({data:new Uint8Array(workerData),useSystemFonts:false,isEvalSupported:false,useWorkerFetch:false,disableFontFace:true}).promise;
 if(pdf.numPages>200)throw Error('PDF limité à 200 pages.');
 const blocks=[],warnings=['PDF : ordre de lecture et figures à vérifier ; aucun OCR ni analyse visuelle exécuté.'];
 for(let page=1;page<=pdf.numPages;page++){
  const p=await pdf.getPage(page),content=await p.getTextContent();let text='';
  for(const item of content.items)text+=(item.str||'')+(item.hasEOL?'\n':' ');
  if(!text.trim())warnings.push(`Page ${page} vide ou scannée : OCR requis.`);
  else blocks.push({type:'text',text:text.trim(),location:`page:${page}`,parent:`Page ${page}`});
 }await pdf.destroy();parentPort.postMessage({blocks,warnings});
}catch(error){parentPort.postMessage({error:error.message});}
