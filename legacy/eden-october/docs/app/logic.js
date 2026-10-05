/** Mini-interpréteur pédagogique. AUCUN eval/Function, aucune exécution réseau.
 * Sous-ensemble JS : booléens, nombres, noms fournis, comparaisons, && || !,
 * parenthèses, et if/else avec console.log d'un message littéral.
 */
export function tokenize(source) {
 if(typeof source!=='string'||source.length>8000)throw Error('Code limité à 8 000 caractères.');
 const s=source.replace(/\/\*[\s\S]*?\*\//g,' ').replace(/\/\/[^\n]*/g,' '), out=[];let i=0;
 while(i<s.length){
  if(/\s/.test(s[i])){i++;continue;}
  const tail=s.slice(i);let m;
  if((m=/^(===|!==|>=|<=|&&|\|\||[!><(){};.,])/.exec(tail))){out.push({v:m[0],type:'symbol'});i+=m[0].length;}
  else if((m=/^-?\d+(?:\.\d+)?/.exec(tail))){out.push({v:Number(m[0]),type:'number'});i+=m[0].length;}
  else if((m=/^[A-Za-z_$][A-Za-z0-9_$]*/.exec(tail))){out.push({v:m[0],type:'name'});i+=m[0].length;}
  else if(s[i]==='"'||s[i]==="'"){
   const quote=s[i++];let v='',closed=false;
   while(i<s.length){let c=s[i++];if(c===quote){closed=true;break;}if(c==='\\'){if(i>=s.length)throw Error('Chaîne incomplète.');const e=s[i++];v+=({n:'\n',t:'\t',r:'\r'}[e]??e);}else v+=c;}
   if(!closed)throw Error('Ferme les guillemets du message.');out.push({v,type:'string'});
  }else throw Error(`Symbole non pris en charge : ${s[i]}. Utilise &&, ||, !, === et les comparaisons.`);
  if(out.length>600)throw Error('Expression trop longue pour ce mini-labo.');
 }
 return out;
}
function parser(source){
 const ts=tokenize(source);let i=0,depth=0;
 const peek=()=>ts[i]?.v, pop=()=>ts[i++];
 const need=v=>{if(peek()!==v)throw Error(`« ${v} » attendu${peek()===undefined?' en fin de code':` avant « ${peek()} »`}.`);pop();};
 function atom(){
  if(++depth>48)throw Error('Trop de parenthèses imbriquées.');let n;
  if(peek()==='!'){pop();n={op:'!',a:atom()};}
  else if(peek()==='('){pop();n=or();need(')');}
  else {const t=pop();if(!t)throw Error('Écris une condition dans le if.');
   if(t.type==='number'||t.type==='string')n={literal:t.v};
   else if(t.v==='true'||t.v==='false')n={literal:t.v==='true'};
   else if(t.type==='name')n={name:t.v};else throw Error(`Valeur attendue, pas « ${t.v} ».`);
  }depth--;return n;
 }
 const chain=(next,ops)=>{let n=next();while(ops.includes(peek())){const op=pop().v;n={op,a:n,b:next()};}return n;};
 const comparison=()=>chain(atom,['>=','<=','>','<']);
 const equality=()=>chain(comparison,['===','!==']);
 const and=()=>chain(equality,['&&']);
 const or=()=>chain(and,['||']);
 const end=()=>{if(i!==ts.length)throw Error(`Instruction non prévue : « ${peek()} ». Le cadre if / else est fourni.`);};
 function branch(){need('{');need('console');need('.');need('log');need('(');const t=pop();if(t?.type!=='string')throw Error('console.log attend un message entre guillemets dans ce labo.');need(')');if(peek()===';')pop();need('}');return t.v;}
 return {expression(){const n=or();end();return n;},program(){need('if');need('(');const condition=or();need(')');const yes=branch();need('else');const no=branch();end();return {condition,yes,no};}};
}
export const parseExpression=s=>parser(s).expression();
export const parseProgram=s=>parser(s).program();
export function evaluate(n,vars={}){
 if(Object.hasOwn(n,'literal'))return n.literal;
 if(n.name){if(!Object.hasOwn(vars,n.name))throw Error(`« ${n.name} » n’est pas une variable proposée. Vérifie l’orthographe.`);return vars[n.name];}
 const a=evaluate(n.a,vars);if(n.op==='!'){if(typeof a!=='boolean')throw Error('Dans ce labo, NON s’applique à un booléen.');return !a;}
 const b=evaluate(n.b,vars);
 if(['&&','||'].includes(n.op)){if(typeof a!=='boolean'||typeof b!=='boolean')throw Error('Compare les valeurs avant de les combiner : ET / OU attendent deux booléens ici.');return n.op==='&&'?a&&b:a||b;}
 if(n.op==='===')return a===b;if(n.op==='!==')return a!==b;
 if(typeof a!=='number'||typeof b!=='number')throw Error('Les comparaisons de ce labo portent sur des nombres.');
 return {'>':()=>a>b,'<':()=>a<b,'>=':()=>a>=b,'<=':()=>a<=b}[n.op]();
}
export function truthCases(names){return Array.from({length:2**names.length},(_,i)=>Object.fromEntries(names.map((n,j)=>[n,!!(i&(1<<(names.length-1-j)))])));}
export const expected=(mode,v)=>mode==='AND'?v[0]&&v[1]:mode==='OR'?v[0]||v[1]:mode==='NOT'?!v[0]:(v[0]||v[1])&&!v[2];
export function exerciseCases(kind){
 if(kind==='and')return truthCases(['aCarte','aReserve']).map(vars=>({vars,want:vars.aCarte&&vars.aReserve?'OK':'REFUS'}));
 if(kind==='combined')return truthCases(['aTicket','estInvite','estFerme']).map(vars=>({vars,want:(vars.aTicket||vars.estInvite)&&!vars.estFerme?'OK':'REFUS'}));
 if(kind==='threshold')return [13,14,15].flatMap(points=>[false,true].map(aAutorisation=>({vars:{points,aAutorisation},want:points>=14&&aAutorisation?'OK':'REFUS'})));
 throw Error('Exercice inconnu.');
}
export function testProgram(source,kind){try{const p=parseProgram(source);const rows=exerciseCases(kind).map(c=>{const choice=evaluate(p.condition,c.vars);if(typeof choice!=='boolean')throw Error('La condition doit produire true ou false.');const got=choice?p.yes:p.no;return {...c,got,ok:got===c.want};});return {ok:rows.every(r=>r.ok),rows,error:''};}catch(e){return {ok:false,rows:[],error:e.message};}}
