/** Petit interpréteur, pas eval(), Function(), vm ni accès au vrai navigateur/serveur.
 * Accepte les fonctions et les expressions étudiées. Tout autre AST est refusé avant exécution.
 * Budget borné : 10 000 caractères, 1500 nœuds, 6000 opérations, profondeur 24, texte 3000.
 */
import {parse} from '../legacy/eden-october/docs/vendor/acorn.mjs';
const TYPES=new Set(['Program','VariableDeclaration','VariableDeclarator','Identifier','Literal','FunctionDeclaration','FunctionExpression','ArrowFunctionExpression','BlockStatement','ReturnStatement','ExpressionStatement','CallExpression','MemberExpression','BinaryExpression','LogicalExpression','UnaryExpression','AssignmentExpression','ConditionalExpression','IfStatement','EmptyStatement','TemplateLiteral','TemplateElement','ArrayExpression','ObjectExpression','Property','SpreadElement','ForStatement','ForOfStatement','UpdateExpression']);
const failure=(message,code='UNSUPPORTED')=>Object.assign(new Error(message),{code});
export function parseSafe(source){
 if(typeof source!=='string'||source.length>10000)throw failure('Code limité à 10 000 caractères.');
 let ast;try{ast=parse(source,{ecmaVersion:2022,sourceType:'script',locations:true});}catch(e){throw failure(`Syntaxe à vérifier : ligne ${e.loc?.line||'?'} — ${e.message}`,'SYNTAX');}
 let nodes=0;function walk(n,depth=0){if(!n||typeof n!=='object')return;if(depth>90)throw failure('Code trop imbriqué.');if(Array.isArray(n)){n.forEach(v=>walk(v,depth+1));return;}if(!n.type)return;
 if(++nodes>1500||!TYPES.has(n.type))throw failure(`Ce mini-labo ne prend pas en charge ${n.type}. Le professeur peut relire ton code.`);
 if(n.type==='Literal'&&(n.regex||n.bigint||!['string','number','boolean','undefined','object'].includes(typeof n.value)))throw failure('Valeur non prise en charge.');
 if(n.type==='Literal'&&typeof n.value==='object'&&n.value!==null)throw failure('Objet non pris en charge.');
 if(n.type==='MemberExpression'&&(n.optional||(!n.computed&&['__proto__','prototype','constructor'].includes(n.property?.name))))throw failure('Propriété non disponible.');
 if(n.type==='Property'&&(n.kind!=='init'||n.method||n.computed))throw failure('Propriété calculée ou accesseur non disponible.');
 if(n.type==='UpdateExpression'&&(n.argument.type!=='Identifier'||!['++','--'].includes(n.operator)))throw failure('Mise à jour non disponible.');
 if(n.type==='SpreadElement'&&n.argument.type==='SpreadElement')throw failure('Décomposition non disponible.');
 if(n.type==='UnaryExpression'&&!['!','+','-','typeof'].includes(n.operator))throw failure('Opérateur non disponible.');
 if(n.type==='BinaryExpression'&&!['+','-','*','/','%','>','>=','<','<=','===','!==','==','!='].includes(n.operator))throw failure('Opérateur non disponible.');
 if(n.type==='LogicalExpression'&&!['&&','||','??'].includes(n.operator))throw failure('Opérateur non disponible.');
 if(n.type==='AssignmentExpression'&&(n.left.type!=='Identifier'||!['=','+=','-='].includes(n.operator)))throw failure('Affectation non prise en charge.');
 if(/Function/.test(n.type)&&(n.async||n.generator||n.params.some(p=>p.type!=='Identifier')))throw failure('Utilise des paramètres simples, sans async ni générateur.');
 if(n.type==='VariableDeclarator'&&n.id.type!=='Identifier')throw failure('Un nom de variable simple est attendu.');
 if(n.type==='CallExpression'&&(n.optional||n.arguments.length>10))throw failure('Appel non pris en charge.');
 for(const [k,v] of Object.entries(n))if(!['loc','start','end'].includes(k))walk(v,depth+1);
 }walk(ast);return ast;
}
class Scope{
 constructor(parent=null){this.parent=parent;this.map=new Map();}
 get(k){if(this.map.has(k))return this.map.get(k).value;if(this.parent)return this.parent.get(k);if(k==='undefined')return undefined;throw failure(`« ${k} » n’est pas défini.`,'RUNTIME');}
 declare(k,v,constant=false){if(this.map.has(k))throw failure(`« ${k} » est déjà déclaré.`,'RUNTIME');this.map.set(k,{value:v,constant});}
 set(k,v){if(this.map.has(k)){const b=this.map.get(k);if(b.constant)throw failure(`« ${k} » est une constante.`,'RUNTIME');b.value=v;}else if(this.parent)this.parent.set(k,v);else throw failure(`Déclare « ${k} » avant de l’utiliser.`,'RUNTIME');return v;}
}
const FN=Symbol('student-function'),RETURN=Symbol('return'),PAUSE=Symbol('debug-pause');
const show=v=>v===undefined?'undefined':v===null?'null':String(v);
export function runSafe(source,{invoke=null,args=[],variables={},debug=null}={}){
 const out={ok:false,logs:[],calls:[],variables:{},value:undefined,ast:null,error:'',unsupported:false};let budget=6000,depth=0;
 const tick=()=>{if(--budget<0)throw failure('Trop d’opérations : exécution arrêtée.','LIMIT');};
 const bound=v=>{let size=0;const visit=(value,level=0)=>{if(++size>1000||level>24||(typeof value==='string'&&value.length>3000)||(Array.isArray(value)&&value.length>256))throw failure('Résultat trop volumineux.','LIMIT');if(value&&typeof value==='object'){if(value[FN])throw failure('Une fonction ne peut pas être stockée dans une production.');for(const item of Object.values(value))visit(item,level+1);}};visit(v);return v;};
 const global=new Scope();let last;
 let steps=0;
 if(debug)out.debug={paused:false,steps:0,current:null,trace:[]};
 function observe(node,scope){
  if(!debug||['FunctionDeclaration','BlockStatement','EmptyStatement'].includes(node.type))return;
  const values={},chain=[];for(let s=scope;s;s=s.parent)chain.unshift(s);
  for(const s of chain)for(const [name,binding] of s.map)values[name]=binding.value?.[FN]?'[fonction]':structuredClone(binding.value);
  const frame={step:++steps,line:node.loc.start.line,column:node.loc.start.column,type:node.type,variables:values};
  out.debug.steps=steps;out.debug.current=frame;if(out.debug.trace.length<200)out.debug.trace.push(frame);
  if(steps>=Number(debug.pauseAt??Infinity)||(steps>Number(debug.afterStep||0)&&(debug.breakpoints||[]).includes(frame.line))){out.debug.paused=true;throw {[PAUSE]:true};}
 }
 const keyOf=(n,s)=>{const key=n.computed?expr(n.property,s):n.property.name;if(!['string','number'].includes(typeof key)||['__proto__','prototype','constructor'].includes(String(key)))throw failure('Propriété non disponible.');return key;};
 const read=(value,key)=>{if(value==null)throw failure('Valeur absente.','RUNTIME');if(Array.isArray(value)||typeof value==='string'){if(key==='length')return value.length;if(/^(0|[1-9][0-9]*)$/.test(String(key)))return value[key];throw failure('Propriété non disponible.');}if(typeof value==='object'&&!value[FN])return Object.hasOwn(value,key)?value[key]:undefined;throw failure('Propriété non disponible.');};
 const primitive=v=>{if(v!==null&&['object','function'].includes(typeof v))throw failure('Une valeur simple est attendue.');return v;};
 const methods=(receiver,key,values)=>{
  if(!Array.isArray(receiver))throw failure('Méthode de tableau attendue.');tick();
  if(key==='push'){bound([...receiver,...values]);const length=receiver.length;receiver.push(...values);try{bound(receiver);}catch(e){receiver.length=length;throw e;}return receiver.length;}
  if(key==='slice')return receiver.slice(...values.map(primitive));
  if(key==='includes')return receiver.includes(primitive(values[0]));
  if(key==='indexOf')return receiver.indexOf(primitive(values[0]));
  if(key==='map'||key==='filter'){const result=[];for(const [i,value] of [...receiver].entries()){tick();const v=call(values[0],[value,i,receiver],key);if(key==='map')result.push(v);else if(v)result.push(value);}return bound(result);}
  if(key==='sort'){return receiver.sort(values[0]?(a,b)=>Number(primitive(call(values[0],[a,b],'comparateur'))):(a,b)=>{tick();return String(primitive(a))<String(primitive(b))?-1:String(a)>String(b)?1:0;});}
  throw failure('Méthode non disponible.');
 };
 function fn(n,scope){return {[FN]:true,node:n,scope};}
 function hoist(nodes,scope){for(const n of nodes)if(n.type==='FunctionDeclaration'&&!scope.map.has(n.id.name))scope.declare(n.id.name,fn(n,scope));}
 function call(f,values,name){tick();if(!f?.[FN])throw failure(`« ${name} » n’est pas une fonction.`,'RUNTIME');if(++depth>24)throw failure('Trop d’appels imbriqués.','LIMIT');const local=new Scope(f.scope);f.node.params.forEach((p,i)=>local.declare(p.name,values[i]));let value;
 try{if(f.node.body.type!=='BlockStatement'){observe(f.node.body,local);value=expr(f.node.body,local);}else{hoist(f.node.body.body,local);for(const n of f.node.body.body)stmt(n,local);}}catch(e){if(e?.[RETURN])value=e.value;else throw e;}finally{depth--;}
 if(out.calls.length<150)out.calls.push({name,args:values.map(v=>v?.[FN]?'[fonction]':v),value});return value;
 }
 function expr(n,s){tick();switch(n.type){
 case 'Literal':return n.value;
 case 'Identifier':return s.get(n.name);
 case 'ArrayExpression':{const values=[];for(const item of n.elements){if(!item){values.push(undefined);continue;}if(item.type==='SpreadElement'){const v=expr(item.argument,s);if(!Array.isArray(v))throw failure('Un tableau est attendu.');values.push(...v);}else values.push(expr(item,s));bound(values);}return values;}
 case 'ObjectExpression':{const value=Object.create(null);for(const p of n.properties){if(p.type!=='Property')throw failure('Objet simple attendu.');const key=p.key.name??p.key.value;if(['__proto__','prototype','constructor'].includes(String(key)))throw failure('Clé non disponible.');value[key]=expr(p.value,s);}return bound(value);}
 case 'MemberExpression':return read(expr(n.object,s),keyOf(n,s));
 case 'UpdateExpression':{const old=s.get(n.argument.name),value=Number(primitive(old))+(n.operator==='++'?1:-1);s.set(n.argument.name,value);return n.prefix?value:old;}
 case 'FunctionExpression':case 'ArrowFunctionExpression':return fn(n,s);
 case 'TemplateLiteral':{let text='';for(let i=0;i<n.quasis.length;i++){text+=n.quasis[i].value.cooked??n.quasis[i].value.raw;if(i<n.expressions.length)text+=show(expr(n.expressions[i],s));bound(text);}return text;}
 case 'UnaryExpression':{let a;if(n.operator==='typeof'&&n.argument.type==='Identifier'){try{a=s.get(n.argument.name);}catch{return 'undefined';}}else a=expr(n.argument,s);return n.operator==='!'?!a:n.operator==='+'?+a:n.operator==='-'?-a:a?.[FN]?'function':typeof a;}
 case 'LogicalExpression':{const a=expr(n.left,s);return n.operator==='&&'?(a?expr(n.right,s):a):n.operator==='||'?(a?a:expr(n.right,s)):(a??expr(n.right,s));}
 case 'ConditionalExpression':return expr(n.test,s)?expr(n.consequent,s):expr(n.alternate,s);
 case 'BinaryExpression':{const a=expr(n.left,s),b=expr(n.right,s);if(a?.[FN]||b?.[FN])throw failure('Une valeur, pas une fonction, est attendue.','RUNTIME');const ops={'+':()=>a+b,'-':()=>a-b,'*':()=>a*b,'/':()=>a/b,'%':()=>a%b,'>':()=>a>b,'>=':()=>a>=b,'<':()=>a<b,'<=':()=>a<=b,'===':()=>a===b,'!==':()=>a!==b,'==':()=>a==b,'!=':()=>a!=b};return bound(ops[n.operator]());}
 case 'AssignmentExpression':{const v=expr(n.right,s),k=n.left.name;return s.set(k,bound(n.operator==='='?v:n.operator==='+='?s.get(k)+v:s.get(k)-v));}
 case 'CallExpression':{
  const vs=n.arguments.map(a=>expr(a,s));
  if(n.callee.type==='Identifier'&&['Number','String','Boolean'].includes(n.callee.name)){const convert={Number,String,Boolean};return bound(convert[n.callee.name](primitive(vs[0])));}
  if(n.callee.type==='MemberExpression'){
   const member=n.callee,key=keyOf(member,s),name=member.object.type==='Identifier'?member.object.name:null;
   if(name==='console'&&key==='log'){if(out.logs.length>=100)throw failure('Trop de messages console.','LIMIT');out.logs.push(vs.map(v=>typeof v==='object'?JSON.stringify(v):show(v)).join(' '));return undefined;}
   if(name==='Math'&&['max','min','round','floor','ceil','abs'].includes(key))return Math[key](...vs.map(primitive));
   if(name==='Number'&&key==='isFinite')return Number.isFinite(vs[0]);
   return methods(expr(member.object,s),key,vs);
  }
  return call(expr(n.callee,s),vs,n.callee.name||'fonction');
 }
 default:throw failure(`Expression ${n.type} non disponible.`);
 }}
 function stmt(n,s){tick();observe(n,s);switch(n.type){case 'ForStatement':{const loop=new Scope(s);if(n.init){if(n.init.type==='VariableDeclaration')stmt(n.init,loop);else expr(n.init,loop);}while(!n.test||expr(n.test,loop)){tick();stmt(n.body,loop);if(n.update)expr(n.update,loop);}return;}case 'ForOfStatement':{if(n.await||n.left.type!=='VariableDeclaration'||n.left.declarations.length!==1)throw failure('Boucle for…of simple attendue.');const values=expr(n.right,s);if(!Array.isArray(values))throw failure('Un tableau est attendu.');for(const value of [...values]){tick();const local=new Scope(s);local.declare(n.left.declarations[0].id.name,value,n.left.kind==='const');stmt(n.body,local);}return;}case 'FunctionDeclaration':return;case 'EmptyStatement':return;case 'VariableDeclaration':for(const d of n.declarations)s.declare(d.id.name,d.init?expr(d.init,s):undefined,n.kind==='const');return;case 'ExpressionStatement':last=expr(n.expression,s);return;case 'ReturnStatement':throw {[RETURN]:true,value:n.argument?expr(n.argument,s):undefined};case 'IfStatement':if(expr(n.test,s))stmt(n.consequent,s);else if(n.alternate)stmt(n.alternate,s);return;case 'BlockStatement':{const local=new Scope(s);hoist(n.body,local);for(const x of n.body)stmt(x,local);return;}default:throw failure(`Instruction ${n.type} non disponible.`);}}
 try{out.ast=parseSafe(source);for(const [k,v] of Object.entries(variables))global.declare(k,bound(structuredClone(v)));hoist(out.ast.body,global);for(const n of out.ast.body)stmt(n,global);out.value=last;out.ok=true;}catch(e){if(e?.[PAUSE])out.ok=true;else out.error=e.message||'Instruction incorrecte.';out.unsupported=['UNSUPPORTED','LIMIT'].includes(e.code);out.syntax=e.code==='SYNTAX';out.errorCode=e.code||'RUNTIME';}
 if(out.ok&&!out.debug?.paused&&invoke){out.logs=[];try{out.value=call(global.get(invoke),bound(structuredClone(args)),invoke);out.ok=true;out.error='';}catch(e){out.ok=!!e?.[PAUSE];out.error=e?.[PAUSE]?'':e.message;out.unsupported||=['UNSUPPORTED','LIMIT'].includes(e.code);}}
 for(const [k,b] of global.map)if(!b.value?.[FN])out.variables[k]=b.value;
 return out;
}
export function functionNode(ast,name){if(!ast)return null;for(const n of ast.body){if(n.type==='FunctionDeclaration'&&n.id.name===name)return n;if(n.type==='VariableDeclaration')for(const d of n.declarations)if(d.id.name===name&&['FunctionExpression','ArrowFunctionExpression'].includes(d.init?.type))return d.init;}return null;}
export function walkNodes(ast,predicate){const found=[];function visit(n){if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(visit);return;}if(n.type&&predicate(n))found.push(n);for(const [k,v] of Object.entries(n))if(!['loc','start','end'].includes(k))visit(v);}visit(ast);return found;}
