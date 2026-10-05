import {observeDiagnostic,DIAGNOSTIC_IDS,DIAGNOSTIC_VERSION} from '../docs/app/diagnostic.js';
import {ITEMS,aggregate,RUBRIC_VERSION} from './rubric.mjs';
import {gradeDiagnostic as gradeLegacy,correctionExample as legacyExample} from './grade-legacy.mjs';
const source=(s,id)=>s.responses?.[id]?.input?.code||'';
export function gradeDiagnostic(state){
 if(state.diagnosticVersion!==DIAGNOSTIC_VERSION)return gradeLegacy(state);
 const observed=Object.fromEntries(DIAGNOSTIC_IDS.map(id=>[id,observeDiagnostic(id,source(state,id))]));
 function makeItem(spec,obs){
  const point=obs.manual?null:obs.metrics[spec.id]?1:0;
  const tests=obs.rows.filter(r=>!r.ok).map(r=>r.label+': '+r.got).slice(0,3).join(' | ');
  return {...spec,point,autoPoint:point,source:spec.step+'.js',reviewRequired:obs.manual,
   evidence:`Console : ${obs.run.logs.join(' / ')||'(aucun affichage)'} | ${obs.score}/${obs.total} contrôles. ${tests}`.slice(0,1700),
   comment:obs.manual?'Relecture requise : syntaxe ou construction hors du mini-labo. Aucun zéro automatique pour cette ambiguïté.':point?'Indicateur observé dans le code et les tests.':'Indicateur non observé. Relire le code avant de valider.'};
 }
 const items=ITEMS.map(i=>makeItem(i,observed[i.step]));
 const firstObs=Object.fromEntries(DIAGNOSTIC_IDS.map(id=>{const first=state.responses?.[id]?.practice?.firstAttempt;return [id,first?observeDiagnostic(id,first.code):null];}));
 const initialItems=ITEMS.map(i=>firstObs[i.step]?makeItem(i,firstObs[i.step]):({...i,point:null,comment:'Aucun premier essai transmis.',reviewRequired:true}));
 const attempts=DIAGNOSTIC_IDS.map(id=>{const rec=state.responses?.[id]||{},o=observed[id],f=firstObs[id];return {id,executions:rec.practice?.executions||0,validations:rec.practice?.validations||0,hints:rec.hints||0,skipped:rec.input?.skip==='yes',firstAttemptAvailable:!!f,firstPassed:f?.score??null,firstTotal:f?.total??null,finalPassed:o.score,finalTotal:o.total,verified:o.ok,rows:o.rows,history:rec.practice?.history||[]};});
 return {version:RUBRIC_VERSION,status:'a-relire',items,...aggregate(items),initial:{...aggregate(initialItems),items:initialItems},practice:attempts,errors:Object.values(observed).map(o=>o.error).filter(Boolean),note:'Diagnostic formatif : note sur le code remis après essais. Premier essai, indices et tests sont séparés. L’historique du navigateur est déclaratif ; il ne certifie pas l’autonomie. Pré-correction à relire par le professeur.'};
}
export const correctionExample={
 'depart.js':'function annoncerDepart() {\n  console.log("La partie commence");\n}\nannoncerDepart();\n',
 'saluer.js':'function saluer(prenom) {\n  console.log("Bonjour " + prenom);\n}\nsaluer("Nora");\nsaluer("Sami");\n',
 'doubler.js':'function doubler(nombre) {\n  return nombre * 2;\n}\nconst scoreDouble = doubler(6);\nconsole.log(scoreDouble);\n',
 'additionner.js':'function additionner(pommes, poires) {\n  return pommes + poires;\n}\nconst total = additionner(2, 3);\nconst totalSuivant = additionner(total, 4);\nconsole.log(total);\nconsole.log(totalSuivant);\n'
};
export const examplesFor=version=>version===DIAGNOSTIC_VERSION?correctionExample:legacyExample;
