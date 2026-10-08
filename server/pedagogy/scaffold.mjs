import {orderAndTime} from '../lesson-structure.mjs';
export function prepareScaffold(spec,{diagnosticMinutes=spec.diagnostic.duration}={}){
 const result=structuredClone(spec),tasks=result.diagnostic.tasks;
 // A practical diagnostic must retain the time authored for its code and tests.
 const duration=Math.max(result.diagnostic.policyVersion?result.diagnostic.duration:5,Math.min(20,Number(diagnosticMinutes)||result.diagnostic.duration));
 if(duration!==result.diagnostic.duration)tasks.forEach((t,i)=>t.duration=Math.floor(duration/tasks.length)+(i<duration%tasks.length?1:0));result.diagnostic.duration=duration;
 for(const a of result.activities){
  if(a.workshop?.language)a.workshop.profile={html:'html-css',css:'html-css',javascript:'algorithm',sql:'algorithm',text:'concepts'}[a.workshop.language];
  const terminalSkill=a.skills.find(c=>['BC02-C3-1','BC09-C2-1','BC10-C3-1'].includes(c));
  const phase=result.blocks.find(b=>b.activityIds.includes(a.id))?.phase;
  if(a.skills.includes('BC06-C1-1')&&a.type==='CodeEditor'&&['guided','autonomy','extend'].includes(phase)){
   Object.assign(a,{correctionMode:'manual',starter:'const button = document.querySelector("button");\n// Écouter un clic puis modifier le compteur.',reference:'let count = 0; document.querySelector("button").addEventListener("click", () => { count += 1; document.querySelector("output").textContent = String(count); });',tests:[{invoke:'dom-behavior',argsJSON:JSON.stringify({label:'Chaque clic incrémente le compteur',steps:[{action:'text',selector:'output',value:'0'},{action:'click',selector:'button'},{action:'text',selector:'output',value:'1'},{action:'click',selector:'button'},{action:'text',selector:'output',value:'2'}]}),expectedJSON:'true'}],workshop:{profile:'dom',language:'javascript',files:[{path:'index.html',content:'<!doctype html><html lang="fr"><meta charset="utf-8"><link rel="stylesheet" href="/style.css"><button>Compter</button><output>0</output><script src="/main.js"></script></html>'},{path:'style.css',content:'body { font: 20px sans-serif; padding: 24px; } button { padding: 12px; } output { margin: 16px; }'},{path:'main.js',content:''}],hints:['Quelle fonction doit être exécutée au moment du clic ?']}});
  }
  if(terminalSkill&&['guided','autonomy','extend'].includes(phase)&&!['Blackboard','Reflection'].includes(a.type)){
   Object.assign(a,{type:'Terminal',correctionMode:'manual',starter:'',expectedAnswer:'',instruction:'Explore le projet avec pwd, ls et cat. Prévois le résultat puis range brouillon/notes.txt dans projet/notes.txt. Conserve le contenu et explique comment tu le vérifies.',reference:'mkdir -p projet\nmv brouillon/notes.txt projet/notes.txt\ncat projet/notes.txt',tests:[{invoke:'file',argsJSON:JSON.stringify({path:'projet/notes.txt',content:'Une trace à conserver.\n',label:'La trace est conservée dans projet'}),expectedJSON:'true'}],workshop:{profile:'shell-git',files:[{path:'brouillon/notes.txt',content:'Une trace à conserver.\n'}],hints:['Commence par localiser le fichier ; consulte help cd.']}});
  }
 }
 orderAndTime(result,result.blocks.reduce((n,b)=>n+b.minutes,0),duration);result.timeline=result.blocks.map(b=>({blockId:b.id,minutes:b.minutes}));return result;
}
