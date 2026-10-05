import {parse as parseHTML} from 'parse5';
import * as css from 'css-tree';
const review=feedback=>({ratio:null,confidence:0,status:'review_required',feedback,observations:[]});
export function structuralGrade(task,text){try{
 if(text.length>100000||!task.tests.length||task.tests.length>50)return review('Configuration ou taille non prise en charge.');
 const observations=[];
 if(task.correctionMode==='html'){
  const tree=parseHTML(text),nodes=[],queue=[tree];while(queue.length){const n=queue.pop();if(n.tagName)nodes.push(n);queue.push(...(n.childNodes||[]));}
  const content=node=>{let value='',pending=[node];while(pending.length){const n=pending.pop();if(n.nodeName==='#text')value+=n.value;pending.push(...(n.childNodes||[]).toReversed());}return value;};
  for(const test of task.tests){const rule=JSON.parse(test.argsJSON);if(!rule.tag||Object.keys(rule).some(k=>!['tag','attribute','value','text','minCount'].includes(k)))return review('Test HTML non pris en charge.');const found=nodes.filter(n=>n.tagName===rule.tag&&(!rule.attribute||n.attrs.some(a=>a.name===rule.attribute&&(rule.value===undefined||a.value===rule.value)))&&(rule.text===undefined||content(n).includes(rule.text)));observations.push({label:test.invoke,ok:found.length>=(rule.minCount??1),found:found.length});}
 }else{
  let invalid=false;const tree=css.parse(text,{onParseError:()=>{invalid=true;}});if(invalid)return review('CSS partiellement illisible : relecture requise.');
  const declarations=[];css.walk(tree,{visit:'Rule',enter(node){if(this.atrule)return;const selector=css.generate(node.prelude);node.block.children.forEach(d=>{if(d.type==='Declaration')declarations.push({selector,property:d.property,value:css.generate(d.value),important:!!d.important});});}});
  for(const test of task.tests){const rule=JSON.parse(test.argsJSON);if(!rule.selector||!rule.property||typeof rule.value!=='string')return review('Test CSS invalide.');const selector=css.generate(css.parse(rule.selector,{context:'selectorList'})),value=css.generate(css.parse(rule.value,{context:'value'}));const matches=declarations.filter(d=>d.selector.split(',').includes(selector)&&d.property===rule.property);const effective=matches.findLast(d=>d.important)||matches.at(-1);observations.push({label:test.invoke,ok:effective?.value===value});}
 }
 return {ratio:observations.filter(o=>o.ok).length/observations.length,confidence:1,status:'auto_corrected_to_review',feedback:'Tests structurels sans exécution de scripts. Vérifier aussi la présentation et la démarche.',observations};
}catch{return review('Production ou tests non interprétables : relecture requise.');}}
