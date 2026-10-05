/** JavaScript réel, thread séparé, limite 1 s. Seule la cible #score est simulée.
 * Ce mini-labo n’est ni VS Code ni un environnement de développement complet.
 * CSP du document : suivi même origine autorisé ; API réseau du Worker désactivées ci-dessous. script-src self/blob sans unsafe-eval.
 */
export function runCode(code,{timeout=1000}={}){
 return new Promise(resolve=>{
  if(typeof Worker==='undefined'){resolve({ok:false,output:'',logs:[],error:'Les Web Workers ne sont pas disponibles dans ce navigateur.'});return;}
  if(typeof code!=='string'||code.length>8000){resolve({ok:false,output:'',logs:[],error:'Limite de 8 000 caractères dans ce mini-labo.'});return;}
  const source=`"use strict";\nconst __send=self.postMessage.bind(self);\nconst __logs=[];\nconst __score={textContent:"Score en attente"};\nconst document=Object.freeze({querySelector:(selector)=>{if(selector!=="#score")throw new Error("Seule la zone #score existe dans ce mini-labo.");return __score;}});\nconst console=Object.freeze({log:(...args)=>{if(__logs.length<10)__logs.push(args.map(String).join(" ").slice(0,200));}});\n// Aucune API réseau ou stockage utile dans cet exercice.\nfor (const key of ["fetch","XMLHttpRequest","WebSocket","EventSource","importScripts","Worker","SharedWorker","indexedDB","caches","BroadcastChannel"]) {try{Object.defineProperty(self,key,{value:undefined,writable:false,configurable:false});}catch{}}\ntry {\n${code}\n;__send({ok:true,output:String(__score.textContent).slice(0,500),logs:__logs,error:""});\n} catch(error) {__send({ok:false,output:String(__score.textContent).slice(0,500),logs:__logs,error:String(error.name+": "+error.message).slice(0,500)});}\n//# sourceURL=app-eleve.js`;
  let worker,url,timer,done=false;
  const finish=(r)=>{if(done)return;done=true;clearTimeout(timer);worker?.terminate();if(url)URL.revokeObjectURL(url);resolve(r);};
  try{
   url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));worker=new Worker(url);
   timer=setTimeout(()=>finish({ok:false,output:'',logs:[],error:'Exécution arrêtée après 1 seconde. Vérifie notamment les boucles.'}),timeout);
   worker.onmessage=({data})=>{
    if(!data||typeof data.ok!=='boolean'||typeof data.output!=='string')return;
    finish({ok:data.ok,output:data.output.slice(0,500),logs:Array.isArray(data.logs)?data.logs.slice(0,10).map(x=>String(x).slice(0,200)):[],error:typeof data.error==='string'?data.error.slice(0,500):''});
   };
   worker.onerror=e=>{e.preventDefault();finish({ok:false,output:'',logs:[],error:(e.message||'Erreur de syntaxe dans le code.').slice(0,500)});};
  }catch(e){finish({ok:false,output:'',logs:[],error:`Le mini-labo n’a pas pu démarrer : ${e.message}`});}
 });
}
