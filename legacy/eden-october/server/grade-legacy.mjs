import {runSafe,functionNode,walkNodes} from '../docs/app/safe-js.js';
import {ITEMS,RUBRIC_VERSION,aggregate} from './rubric-legacy.mjs';
const code=(state,id)=>state.responses?.[id]?.input?.code||'';
const hasCall=(run,name,args)=>run.calls.some(c=>c.name===name&&JSON.stringify(c.args)===JSON.stringify(args));
const clean=s=>String(s).trim().replace(/[!.,]+$/,'').replace(/\s+/g,' ').trim().toLowerCase();
export function gradeDiagnostic(state){
 const a=state.responses?.['diag-lire']?.input||{},bs=code(state,'diag-saluer'),cs=code(state,'diag-retour');
 const b=runSafe(bs),c=runSafe(cs),bn=functionNode(b.ast,'saluer'),cn=functionNode(c.ast,'additionner');
 const r23=runSafe(cs,{invoke:'additionner',args:[2,3]}),r47=runSafe(cs,{invoke:'additionner',args:[4,7]}),r00=runSafe(cs,{invoke:'additionner',args:[0,0]});
 const nora=runSafe(bs,{invoke:'saluer',args:['Nora']}),lina=runSafe(bs,{invoke:'saluer',args:['Lina']});
 const callInit=walkNodes(c.ast,n=>n.type==='VariableDeclarator'&&n.id.name==='total'&&n.init?.type==='CallExpression'&&n.init.callee.name==='additionner').length||walkNodes(c.ast,n=>n.type==='AssignmentExpression'&&n.left.name==='total'&&n.right?.type==='CallExpression'&&n.right.callee.name==='additionner').length;
 const printTotal=walkNodes(c.ast,n=>n.type==='CallExpression'&&n.callee?.type==='MemberExpression'&&n.arguments.some(v=>v.type==='Identifier'&&v.name==='total')).length;
 const tests={
 '1.1':!!bn,'1.2':bn?.params.length===1,'1.3':!!cn,'1.4':cn?.params.length===2,
 '2.1':hasCall(b,'saluer',['Nora']),'2.2':hasCall(b,'saluer',['Sami']),'2.3':hasCall(c,'additionner',[2,3]),
 '3.1':a.param==='nombre','3.2':a.argument==='6','3.3':a.count==='1','3.4':a.receive==='9',
 '4.1':a.display==='12','4.2':nora.ok&&lina.ok&&nora.logs.some(v=>clean(v)==='bonjour nora')&&lina.logs.some(v=>clean(v)==='bonjour lina'),'4.3':!!printTotal&&c.logs.some(v=>v==='5'),
 '5.1':!!cn&&(cn.body.type!=='BlockStatement'||walkNodes(cn.body,n=>n.type==='ReturnStatement'&&!!n.argument).length>0),
 '5.2':r23.ok&&r23.value===5,'5.3':r47.ok&&r00.ok&&r47.value===11&&r00.value===0,
 '6.1':a.stored==='12','6.2':!!callInit&&hasCall(c,'additionner',[2,3]),'6.3':c.variables.total===5
 };
 const items=ITEMS.map(it=>{const unit=it.step==='diag-saluer'?b:it.step==='diag-retour'?c:null;const src=it.step==='diag-saluer'?bs:cs;const manual=unit&&src.trim()&&(unit.syntax||unit.unsupported);
 const point=manual?null:tests[it.id]?1:0;
 const evidence=unit?`${unit.error?unit.error+' | ':''}Console : ${unit.logs.join(' / ')||'(aucun affichage)'}${it.step==='diag-retour'?' | total = '+String(unit.variables.total):''}`:`Réponse : ${a[{'3.1':'param','3.2':'argument','3.3':'count','3.4':'receive','4.1':'display','6.1':'stored'}[it.id]]||'(vide)'}`;
 return {...it,point,autoPoint:point,comment:manual?'Relecture requise : ce code ne peut pas être noté automatiquement sans risquer une double pénalité.':point?'Indicateur observé.':'Indicateur non observé dans ce rendu. Vérifier avant validation.',evidence,source:it.step+((it.step==='diag-lire')?'':'.js'),reviewRequired:!!manual};});
 return {version:RUBRIC_VERSION,items,...aggregate(items),status:'a-relire',note:'Pré-correction calculée sur le rendu. Les points et commentaires sont modifiables par le professeur. L’autonomie n’est pas déduite des résultats.',errors:[b.error,c.error].filter(Boolean)};
}
export const correctionExample={
 'saluer.js':'function saluer(prenom) {\n  console.log("Bonjour " + prenom);\n}\nsaluer("Nora");\nsaluer("Sami");\n',
 'additionner.js':'function additionner(pommes, poires) {\n  return pommes + poires;\n}\nconst total = additionner(2, 3);\nconsole.log(total);\n'
};
