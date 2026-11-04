import {javascriptLanguage} from '@codemirror/lang-javascript';

// Read the data embedded in this legacy course, never evaluate its source.
// A syntax tree keeps comments, quoted examples and template interpolation from
// being mistaken for declarations. The imported programs remain plain text for
// the bounded teaching interpreter, just like canonical programming-1 courses.
export function readSourceComparison(buffer, bad) {
 const path='01_ELEVE/assets/lesson.js';
 const reject=message=>bad(path,'/comparison',null,message+' Déclarer les données dans lesson.json → programming.comparisons si nécessaire. Aucun script n’est exécuté.');
 if(!buffer||buffer.length>1024*1024)reject('Source du comparatif absente ou supérieure à 1 Mio.');
 const source=buffer.toString('utf8'),text=node=>node?source.slice(node.from,node.to):'';
 const children=node=>{const list=[];for(let child=node.firstChild;child;child=child.nextSibling)if(!['LineComment','BlockComment'].includes(child.name))list.push(child);return list;};
 const find=(node,predicate)=>{const found=[];node.cursor().iterate(ref=>{if(predicate(ref.node))found.push(ref.node);});return found;};
 const tree=javascriptLanguage.parser.parse(source);
 if(find(tree.topNode,node=>node.type.isError).length)reject('Syntaxe du fichier source illisible.');
 const functions=find(tree.topNode,node=>node.name==='FunctionDeclaration'&&text(node.getChild('VariableDefinition'))==='wireComparison');
 if(functions.length!==1)reject('Une seule déclaration wireComparison est attendue.');
 const scope=functions[0],body=scope.getChild('Block');
 const string=node=>{
  if(!['String','TemplateString'].includes(node.name)||find(node,child=>child.name==='Interpolation').length)reject('Texte littéral requis, sans interpolation.');
  const raw=text(node).slice(1,-1).replace(/\r\n?/g,'\n');let out='';
  for(let i=0;i<raw.length;i++){
   const char=raw[i];if(char!=='\\'){out+=char;continue;}
   const escape=raw[++i];
   if(escape==='\n')continue;
   const simple={b:'\b',f:'\f',n:'\n',r:'\r',t:'\t',v:'\v','0':'\0'};
   if(escape==='0'&&/\d/.test(raw[i+1]||''))reject('Échappement octal non pris en charge.');
   if(Object.hasOwn(simple,escape)){out+=simple[escape];continue;}
   if(escape==='x'||escape==='u'){
    const braced=escape==='u'&&raw[i+1]==='{',length=escape==='x'?2:4;
    const end=braced?raw.indexOf('}',i+2):i+1+length,hex=raw.slice(i+(braced?2:1),end);
    if(!/^[\da-f]+$/i.test(hex)||!braced&&hex.length!==length||parseInt(hex,16)>0x10ffff)reject('Échappement de texte invalide.');
    out+=String.fromCodePoint(parseInt(hex,16));i=braced?end:end-1;continue;
   }
   if(escape===undefined||/[1-9]/.test(escape))reject('Échappement de texte non pris en charge.');
   out+=escape;
  }
  return out;
 };
 const literal=(node,depth=0)=>{
  if(!node||depth>8)reject('Données littérales trop imbriquées.');
  if(['String','TemplateString'].includes(node.name))return string(node);
  if(node.name==='Number'){
   const value=Number(text(node).replaceAll('_',''));if(!Number.isFinite(value))reject('Nombre JSON fini requis.');return value;
  }
  if(node.name==='BooleanLiteral')return text(node)==='true';
  if(node.name==='null')return null;
  if(node.name==='UnaryExpression'){const parts=children(node);if(parts.length===2&&['-','+'].includes(text(parts[0]))&&parts[1].name==='Number')return (text(parts[0])==='-'?-1:1)*literal(parts[1],depth+1);}
  if(node.name==='ArrayExpression'){
   const parts=children(node).slice(1,-1),values=[];let expectValue=true;
   for(const part of parts){if(expectValue){if(part.name===',')reject('Tableau littéral sans case manquante requis.');values.push(literal(part,depth+1));}else if(part.name!==',')reject('Tableau littéral requis.');expectValue=!expectValue;}
   return values;
  }
  if(node.name==='ObjectExpression'){
   const value=Object.create(null),parts=children(node).slice(1,-1);let expectProperty=true;
   for(const part of parts){
    if(!expectProperty){if(part.name!==',')reject('Objet littéral requis.');expectProperty=true;continue;}
    const fields=children(part);
    if(part.name!=='Property'||fields.length!==3||fields[1].name!==':'||!['PropertyDefinition','String'].includes(fields[0].name))reject('Propriété littérale requise, sans calcul, méthode ni décomposition.');
    const key=fields[0].name==='String'?string(fields[0]):text(fields[0]);
    if(['__proto__','constructor','prototype'].includes(key)||Object.hasOwn(value,key))reject('Clé de données interdite ou dupliquée.');
    value[key]=literal(fields[2],depth+1);expectProperty=false;
   }
   return value;
  }
  reject('Valeur calculée non prise en charge dans les données du comparatif.');
 };
 const definitions=find(scope,node=>node.name==='VariableDefinition'&&text(node)==='programs');
 const declarations=children(body).filter(node=>node.name==='VariableDeclaration').map(children);
 const declaration=declarations.find(parts=>parts[0]?.name==='const'&&parts[1]?.name==='VariableDefinition'&&text(parts[1])==='programs');
 if(definitions.length!==1||!declaration||declaration[2]?.name!=='Equals'||declaration[3]?.name!=='ObjectExpression'||declaration[4]&&![';',','].includes(declaration[4].name))reject('Une déclaration const programs avec un objet littéral est attendue.');
 const programs=literal(declaration[3]),ids=['for','while','forEach'];
 if(Object.keys(programs).length!==ids.length||ids.some(id=>typeof programs[id]!=='string'||!programs[id].trim()||programs[id].length>10000))reject('Les trois programmes for, while et forEach sont requis (10 000 caractères maximum chacun).');
 for(const assignment of find(scope,node=>['AssignmentExpression','UpdateExpression'].includes(node.name))){
  const target=children(assignment)[0];
  if(target&&find(target,node=>node.name==='VariableName'&&text(node)==='programs').length)reject('Les programmes doivent être déclarés sans modification ultérieure.');
 }
 for(const reference of find(scope,node=>node.name==='VariableName'&&text(node)==='programs')){
  // Passing the object to a helper could mutate the initial literal. Only the
  // source reader's selected-program lookups can be translated without running it.
  if(reference.parent?.name!=='MemberExpression'||children(reference.parent).map(text).join('')!=='programs[selected]')reject('Les programmes doivent être consultés directement, sans transformation dynamique.');
 }
 const calls=find(scope,node=>node.name==='CallExpression'&&node.firstChild?.name==='MemberExpression'&&children(node.firstChild).map(text).join('')==='R.run');
 if(calls.length!==1)reject('Un seul appel R.run du comparatif est attendu.');
 const args=children(calls[0].getChild('ArgList')).filter(node=>!['(',')',','].includes(node.name));
 if(args.length!==2||args[0].name!=='MemberExpression'||children(args[0]).map(text).join('')!=='programs[selected]'||args[1].name!=='ObjectExpression')reject('Appel littéral R.run(programs[selected], {invoke, args}) attendu.');
 const options=literal(args[1]);
 if(Object.keys(options).some(key=>!['invoke','args'].includes(key))||typeof options.invoke!=='string'||!(/^[A-Za-z_$][\w$]*$/).test(options.invoke)||!Array.isArray(options.args)||JSON.stringify(options.args).length>16000)reject('Nom de fonction et tableau JSON d’arguments requis (16 Ko maximum).');
 return {id:'compare-traversals',title:'Comparer for, while et forEach sur les mêmes données',blockId:'s2-bloc-3',invoke:options.invoke,args:options.args,programs:ids.map(id=>({id,title:id,code:programs[id],diagramType:id.toLowerCase()}))};
}
