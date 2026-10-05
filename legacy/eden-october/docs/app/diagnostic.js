/** Shared, deterministic observation of the four practice tasks.
 * No solution injection; no eval/Function or external student-code execution.
 * The server recomputes this from submitted source, never from client 'passed'.
 */
import {runSafe,functionNode,walkNodes} from './safe-js.js';
export const DIAGNOSTIC_VERSION='fonctions-261001-pratique-v2';
export const DIAGNOSTIC_IDS=['diag-demarrer','diag-saluer','diag-doubler','diag-retour'];
export const valueText=v=>v===undefined?'undefined':v===null?'null':typeof v==='string'?v:String(v);
const norm=s=>String(s).trim().replace(/[!.,]+$/,'').replace(/\s+/g,' ').trim().toLowerCase();
const called=(r,name,args)=>r.calls.some(c=>c.name===name&&JSON.stringify(c.args)===JSON.stringify(args));
const print=(r,name)=>walkNodes(r.ast,n=>n.type==='CallExpression'&&n.callee.type==='MemberExpression'&&n.arguments.some(a=>a.type==='Identifier'&&a.name===name)).length>0;
const captured=(r,variable,name,args)=>{
 const nodes=walkNodes(r.ast,n=>(n.type==='VariableDeclarator'&&n.id.name===variable)||(n.type==='AssignmentExpression'&&n.left.name===variable));
 return nodes.some(n=>{const init=n.init||n.right;return init?.type==='CallExpression'&&init.callee.name===name&&(!args||JSON.stringify(init.arguments.map(a=>a.type==='Literal'?a.value:{variable:a.name}))===JSON.stringify(args));});
};
const decl=(r,name,arity)=>functionNode(r.ast,name)?.params.length===arity;
const returns=(r,name)=>{const n=functionNode(r.ast,name);return !!n&&(n.body.type!=='BlockStatement'||walkNodes(n.body,x=>x.type==='ReturnStatement'&&!!x.argument).length>0);};
const hasBody=(source)=>source.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'').trim().length>0;
export function observeDiagnostic(id,source=''){
 const run=runSafe(source),rows=[],metrics={};
 const row=(id,label,want,got,ok,hint)=>rows.push({id,label,want,got,ok:!!ok,hint});
 const invoke=(fn,args)=>runSafe(source,{invoke:fn,args});
 const retCase=(key,fn,args,want)=>{const r=invoke(fn,args);const ok=r.ok&&r.value===want;row(key,`${fn}(${args.map(a=>typeof a==='string'?JSON.stringify(a):a).join(', ')})`,`${want} · ${typeof want}`,r.ok?`${valueText(r.value)} · ${typeof r.value}`:r.error,ok,'Vérifie return et utilise les paramètres, pas un résultat fixé.');return ok;};
 const logs=run.logs.join(' → ');
 row('execution','Mon programme se lance','Aucune erreur',hasBody(source)?run.error||'Exécution terminée':'Code à écrire',hasBody(source)&&run.ok,'Lis la ligne signalée. Vérifie les parenthèses, accolades et noms.');
 if(id==='diag-demarrer'){
  metrics['1.1']=decl(run,'annoncerDepart',0);
  metrics['2.1']=run.ok&&called(run,'annoncerDepart',[]);
  const probe=invoke('annoncerDepart',[]);
  metrics['4.1']=run.ok&&probe.ok&&probe.logs.length===1&&norm(probe.logs[0])==='la partie commence'&&run.logs.length===1&&norm(run.logs[0])==='la partie commence';
  row('declaration','Une fonction sans paramètre','annoncerDepart()',metrics['1.1']?'Déclaration trouvée':'Déclaration à vérifier',metrics['1.1'],'Déclare une fonction nommée annoncerDepart sans paramètre.');
  row('appel','Un appel dans mon programme','annoncerDepart() appelée',metrics['2.1']?'Appel observé':'Aucun appel réussi',metrics['2.1'],'Une déclaration prépare la fonction ; un appel la lance.');
  row('console','Le message apparaît une fois','La partie commence',logs||'(console vide)',metrics['4.1'],'Mets console.log dans la fonction, puis appelle-la une fois.');
 }else if(id==='diag-saluer'){
  metrics['1.2']=decl(run,'saluer',1);metrics['2.2']=run.ok&&called(run,'saluer',['Nora']);metrics['2.3']=run.ok&&called(run,'saluer',['Sami']);
  row('declaration','Un paramètre dans la déclaration','saluer(prenom)',metrics['1.2']?'Un paramètre trouvé':'À vérifier',metrics['1.2'],'Le prénom attendu devient un paramètre de la fonction.');
  row('appels','Deux appels dans mon programme','Nora puis Sami',run.calls.filter(c=>c.name==='saluer').map(c=>c.args.join(',')).join(' → ')||'(aucun)',metrics['2.2']&&metrics['2.3'],'Appelle la même fonction deux fois, avec deux arguments différents.');
  row('console','La console de mon programme','Bonjour Nora → Bonjour Sami',logs||'(vide)',run.ok&&run.logs.length===2&&norm(run.logs[0])==='bonjour nora'&&norm(run.logs[1])==='bonjour sami','Le message utilise le paramètre reçu. Pense à l’espace.');
  const probes=['Nora','Sami','Lina'].map(name=>{const r=invoke('saluer',[name]),ok=r.ok&&r.logs.length===1&&norm(r.logs[0])===`bonjour ${name.toLowerCase()}`;row('nom-'+name,`saluer("${name}")`,`Bonjour ${name}`,r.error||r.logs.join(' → ')||'(console vide)',ok,'La fonction doit s’adapter à chaque prénom, sans être réécrite.');return ok;});metrics['3.1']=probes.every(Boolean);
 }else if(id==='diag-doubler'){
  metrics['1.3']=decl(run,'doubler',1);
  row('declaration','Une fonction avec un paramètre','doubler(nombre)',metrics['1.3']?'Déclaration trouvée':'À vérifier',metrics['1.3'],'Déclare la fonction avec une entrée.');
  const r6=retCase('retour6','doubler',[6],12),r9=retCase('retour9','doubler',[9],18);retCase('retour0','doubler',[0],0);
  metrics['3.2']=r6&&r9;metrics['5.1']=returns(run,'doubler')&&r6;
  metrics['6.1']=run.ok&&captured(run,'scoreDouble','doubler',[6])&&called(run,'doubler',[6])&&run.variables.scoreDouble===12;
  metrics['4.2']=run.ok&&print(run,'scoreDouble')&&run.logs.includes('12')&&run.variables.scoreDouble===12;
  row('variable','Le retour est gardé dans scoreDouble','12 · obtenu par doubler(6)',valueText(run.variables.scoreDouble),metrics['6.1'],'Affecte le résultat de l’appel à scoreDouble. Écrire 12 à la main ne montre pas la récupération du retour.');
  row('console','Afficher la variable scoreDouble','12',logs||'(console vide)',metrics['4.2'],'La variable garde ; console.log affiche.');
 }else if(id==='diag-retour'){
  metrics['1.4']=decl(run,'additionner',2);
  row('declaration','Une fonction, deux paramètres','additionner(pommes, poires)',metrics['1.4']?'Deux paramètres trouvés':'À vérifier',metrics['1.4'],'Deux entrées : sépare les paramètres par une virgule.');
  const a=retCase('somme23','additionner',[2,3],5),b=retCase('somme43','additionner',[4,3],7),c=retCase('somme27','additionner',[2,7],9),d=retCase('somme00','additionner',[0,0],0);retCase('somme47','additionner',[4,7],11);
  metrics['3.3']=a&&b;metrics['3.4']=a&&c;metrics['5.2']=returns(run,'additionner')&&a;metrics['5.3']=d&&returns(run,'additionner');
  metrics['6.2']=run.ok&&captured(run,'total','additionner',[2,3])&&called(run,'additionner',[2,3])&&run.variables.total===5;
  metrics['6.3']=run.ok&&captured(run,'totalSuivant','additionner',[{variable:'total'},4])&&called(run,'additionner',[5,4])&&run.variables.totalSuivant===9&&metrics['6.2'];
  metrics['4.3']=run.ok&&print(run,'total')&&print(run,'totalSuivant')&&run.logs.length===2&&run.logs[0]==='5'&&run.logs[1]==='9';
  row('total','Premier retour dans total','5 · obtenu par additionner(2, 3)',valueText(run.variables.total),metrics['6.2'],'Garde le premier appel dans total.');
  row('reutilise','Réutiliser total dans le second appel','totalSuivant = 9',valueText(run.variables.totalSuivant),metrics['6.3'],'Transmets la variable total et le nombre 4 à additionner. Garde le retour dans totalSuivant.');
  row('console','Afficher les deux variables','5 → 9',logs||'(console vide)',metrics['4.3'],'Affiche total, puis totalSuivant. Deux valeurs à vérifier.');
 }else{row('unknown','Défi inconnu','','',false,'Contacte le professeur.');}
 return {id,ok:rows.every(r=>r.ok),score:rows.filter(r=>r.ok).length,total:rows.length,rows,metrics,run,error:run.error||'',manual:!hasBody(source)?false:!!(run.syntax||run.unsupported),empty:!hasBody(source)};
}
export function testDiagnostic(source,id){const {run,metrics,manual,...result}=observeDiagnostic(id,source);return {...result,run};}
/** Bounded browser journal. Not proof of autonomy; teacher re-evaluates first source. */
export function recordPractice(rec,action,source,result){
 const p=rec.practice??={executions:0,validations:0,history:[]};const now=new Date().toISOString();
 if(action==='run'||action==='case')p.executions++;if(action==='test')p.validations++;
 const item={action,at:now,hints:rec.hints||0,ok:result.ok===true,passed:result.score??0,total:result.total??0,error:String(result.error||'').slice(0,400),fingerprint:fingerprint(source)};
 if(!p.firstAttempt&&action!=='skip')p.firstAttempt={code:source.slice(0,10000),action,at:now,hints:rec.hints||0};
 p.history=[...(p.history||[]),item].slice(-20);p.lastAttempt=item;
 return p;
}
export function fingerprint(source){let h=2166136261;for(const c of String(source)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');}
