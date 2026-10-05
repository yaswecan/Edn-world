import {readFileSync} from 'node:fs';
import {hash} from './importer.mjs';
const units=JSON.parse(readFileSync(new URL('../legacy/pedagolab/public/data/resources.json',import.meta.url))).units;
const stop=new Set(['les','des','une','dans','pour','avec','sur','par','aux','est','qui','que','du','de','la','le','un','et','en','au']);
const tokens=text=>String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().match(/[a-z0-9]+/g)?.filter(t=>t.length>1&&!stop.has(t))||[];
export async function indexResources(store,classId){return store.transaction(async tx=>{for(const unit of units){const text=JSON.stringify(unit),digest=hash(text),id=`${classId}:resource:${unit.code}:${digest.slice(0,12)}`;if(await tx.get('resource_documents',id))continue;const words=tokens(text),frequencies={};for(const word of words)frequencies[word]=(frequencies[word]||0)+1;await tx.insert('resource_documents',{id,classId,resourceId:unit.code,source:'pedagolab',sourceVersion:digest,title:unit.title||unit.code,criteria:[unit.code],text,frequencies,length:words.length});}return (await tx.list('resource_documents',classId)).length;});}
export async function retrieveResources(store,classId,{query='',criteria=[],limit=8}={}){
 let documents=await store.list('resource_documents',classId);if(!documents.length){await indexResources(store,classId);documents=await store.list('resource_documents',classId);}
 const terms=[...new Set(tokens(query))],average=documents.reduce((n,d)=>n+d.length,0)/Math.max(1,documents.length),df=new Map(terms.map(t=>[t,documents.filter(d=>d.frequencies[t]).length]));
 return documents.map(d=>{let score=d.criteria.some(c=>criteria.includes(c))?20:0;for(const term of terms){const frequency=d.frequencies[term]||0,inverse=Math.log(1+(documents.length-df.get(term)+.5)/(df.get(term)+.5));score+=inverse*frequency*2.2/(frequency+1.2*(.25+.75*d.length/average));}return {...d,score};}).filter(d=>d.score>0||!query&&!criteria.length).sort((a,b)=>b.score-a.score).slice(0,Math.max(1,Math.min(30,limit))).map(({frequencies,length,...d})=>({...d,resource:JSON.parse(d.text)}));
}
