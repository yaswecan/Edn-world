import {runSafe} from './safe-js.js';
const booleans=[false,true];
export const EXERCISES={
 major:{fn:'estMajeur',cases:[17,18,19,0,42].map(age=>({args:[age],want:age>=18}))},
 play:{fn:'peutJouer',cases:[13,14,15].flatMap(age=>booleans.map(a=>({args:[age,a],want:age>=14&&a})))},
 entry:{fn:'peutEntrer',cases:booleans.flatMap(a=>booleans.flatMap(b=>booleans.map(c=>({args:[a,b,c],want:(a||b)&&!c}))))},
 advanced:{fn:'accesParc',cases:[13,14,15].flatMap(age=>booleans.flatMap(t=>booleans.flatMap(a=>booleans.map(f=>({args:[age,t,a,f],want:t&&!f&&(age>=14||a)})))))}
};
export function testFunction(source,kind){const spec=EXERCISES[kind];if(!spec)return {ok:false,rows:[],error:'Exercice inconnu.'};const rows=spec.cases.map(c=>{const r=runSafe(source,{invoke:spec.fn,args:c.args});return {vars:Object.fromEntries(c.args.map((v,i)=>['argument'+(i+1),v])),want:String(c.want),got:r.ok?String(r.value):r.error,ok:r.ok&&r.value===c.want};});return {ok:rows.every(r=>r.ok),rows,score:rows.filter(r=>r.ok).length,total:rows.length,error:''};}
