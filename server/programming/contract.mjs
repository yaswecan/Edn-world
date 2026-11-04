// Optional extension of DailyLessonSpec 1.0; no category-based reader switching.
export const ENGINE = 'tweenteach-js';
export const ENGINE_VERSION = '1.0.0';
export const CAPABILITIES = ['editor','execution','console','behavior-tests','trace','prediction','quiz','cloze','comparison','diagram:array','diagram:for','diagram:while','diagram:function','diagram:foreach','diagram:decompose'];
const str={type:'string'}, strings={type:'array',items:str};
const jsonValue=depth=>({anyOf:[{type:'null'},{type:'boolean'},{type:'number'},str,...depth?[{type:'array',maxItems:1000,items:jsonValue(depth-1)}]:[]]});
const json=jsonValue(2);
const obj=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false});
const array=items=>({type:'array',items});
const choice=obj({question:str,options:{type:'array',minItems:2,items:obj({text:str,feedback:str})},correct:{type:'integer',minimum:0},code:str},['question','options','correct']);
const table=obj({headers:strings,rows:array(strings)});
export const presentationSchema=obj({
 theme:{const:'array-lab'},
 headings:array(obj({blockId:str,title:str,lead:str})),
 openings:array(obj({blockId:str,tag:str,title:str,paragraphs:strings,actionLabel:str,nextBlockId:str,arrayName:str,values:array(json),stats:array(obj({value:str,label:str})),caption:str,note:str})),
 summaries:array(obj({blockId:str,note:str,actionLabel:str,nextBlockId:str,nextActivityId:str},['blockId','note'])),
 memo:array(obj({title:str,paragraphs:strings,code:str,table},['title','paragraphs'])),
 comparisons:array(obj({id:str,description:str,headers:strings,rows:array(strings),rules:array(obj({id:str,text:str}))})),
 workshop:obj({reflectionLabel:str,reflectionPlaceholder:str,continueNote:str,transferNote:str,transferContinueNote:str,predictionContext:str}),
 assessmentNote:str
});
presentationSchema.properties.sessionLabels=array(obj({id:str,title:str}));
export const interactiveSchema={anyOf:[
 obj({kind:{const:'code'},explanation:strings,demo:str,invoke:{type:'string',pattern:'^[A-Za-z_$][\\w$]*$'},args:{type:'array',maxItems:20,items:json},diagramType:{enum:['array','for','while','function','foreach','decompose']},prediction:choice,testLabels:strings,reflection:str}),
 obj({kind:{const:'quiz'},question:choice,sourceId:str},['kind','question']),
 obj({kind:{const:'cloze'},segments:array({anyOf:[str,obj({answer:str,alternatives:strings},['answer'])]}),bank:strings,explanation:str})
]};
export const programmingSchema=obj({format:{const:'programming-1'},family:{const:'Programmation'},contentVersion:{type:'string',minLength:1},workVersion:{const:1},language:{const:'javascript'},engine:obj({id:{const:ENGINE},version:{const:ENGINE_VERSION}}),requiredCapabilities:{type:'array',uniqueItems:true,items:{enum:CAPABILITIES}},sessions:array(obj({id:str,title:str,blockIds:strings,minutes:{type:'integer',minimum:1}})),optionalActivityIds:strings,comparisons:array(obj({id:str,title:str,blockId:str,invoke:str,args:array(json),programs:{type:'array',minItems:2,items:obj({id:str,title:str,code:str,diagramType:{enum:['array','for','while','function','foreach','decompose']}})}})),provenance:obj({adapter:str,sourceVersion:str,conversions:strings})});
// Optional, portable presentation content. Existing programming courses need no migration.
programmingSchema.properties.presentation=presentationSchema;
export function validateProgramming(spec,fail){
 if(spec.sessionType==='web-design'&&spec.programming)fail('/sessionType',spec.sessionType,'Un cours programming-1 porte le type Programmation.');
 if(spec.sessionType==='programming'&&!spec.programming)fail('/programming',null,'Le type Programmation nécessite le parcours interactif programming-1.');
 if(!spec.programming){if(spec.activities.some(a=>a.interactive))fail('/programming',null,'Déclarer programming-1 pour ces activités.');return;}
 const p=spec.programming,ids=new Set(spec.activities.map(a=>a.id)),blocks=new Map(spec.blocks.map(b=>[b.id,b]));
 const unique=xs=>new Set(xs).size===xs.length;
 if(JSON.stringify(spec.studentFlow)!==JSON.stringify(spec.blocks.map(b=>b.id)))fail('/studentFlow',spec.studentFlow,'Ordre identique aux blocs du cours.');
 if(!unique(p.optionalActivityIds)||!unique(p.comparisons.map(c=>c.id))||p.comparisons.some(c=>!unique(c.programs.map(p=>p.id)))||!unique(spec.diagnostic.activityIds||[]))fail('/programming',null,'Identifiants et références uniques.');
 const assigned=p.sessions.flatMap(s=>s.blockIds);
 if(new Set(p.sessions.map(s=>s.id)).size!==p.sessions.length||new Set(assigned).size!==assigned.length||assigned.length!==blocks.size||assigned.some(id=>!blocks.has(id)))fail('/programming/sessions',assigned,'Chaque bloc appartient exactement à une séance.');
 for(const s of p.sessions)if(s.minutes!==s.blockIds.reduce((n,id)=>n+blocks.get(id).minutes,0))fail('/programming/sessions/'+s.id,s.minutes,'Durée égale à la somme des blocs.');
 for(const id of p.optionalActivityIds)if(!ids.has(id)||spec.activities.find(a=>a.id===id).required||spec.blocks.some(b=>b.activityIds.includes(id)))fail('/programming/optionalActivityIds',id,'Prolongement facultatif hors déroulé.');
 for(const a of spec.activities){
  const path='/activities/'+a.id, i=a.interactive;
  if(!['CodeEditor','Quiz','FillBlank','Reflection'].includes(a.type)||a.type!=='Reflection'&&!i)fail(path,a.type,'Activité interactive prise en charge obligatoire.');
  if(i&&({code:'CodeEditor',quiz:'Quiz',cloze:'FillBlank'}[i.kind]!==a.type))fail(path,i.kind,'Type et interaction cohérents.');
  for(const q of [i?.prediction,i?.question].filter(Boolean))if(q.correct>=q.options.length)fail(path,q.correct,'Indice de choix existant.');
  if(i?.kind==='code'){
   if(a.starter.length>10000||a.reference.length>10000||i.demo.length>10000||a.tests.length>100)fail(path,null,'Code limité à 10 000 caractères et 100 tests.');
   if(i.testLabels.length!==a.tests.length)fail(path+'/tests',i.testLabels,'Un libellé par test.');
   for(const t of a.tests){try{if(!Array.isArray(JSON.parse(t.argsJSON)))throw Error();JSON.parse(t.expectedJSON);}catch{fail(path+'/tests',t,'Arguments et attendu JSON valides.');}}
  }
  if(!spec.blocks.some(b=>b.activityIds.includes(a.id))&&!p.optionalActivityIds.includes(a.id))fail(path,a.id,'Activité rattachée ou facultative.');
 }
 if(!Array.isArray(spec.diagnostic.activityIds)||!spec.diagnostic.activityIds.length||spec.diagnostic.tasks.length||spec.diagnostic.rubric.length)fail('/diagnostic',null,'Diagnostic formatif par références, sans tâches dupliquées ni barème.');
 for(const id of spec.diagnostic.activityIds||[])if(!ids.has(id))fail('/diagnostic/activityIds',id,'Référence vers une activité existante.');
 for(const c of p.comparisons)if(!blocks.has(c.blockId))fail('/programming/comparisons',c.blockId,'Bloc existant.');
 if(p.presentation){
  const view=p.presentation;
  if(view.sessionLabels&&(!unique(view.sessionLabels.map(item=>item.id))||view.sessionLabels.some(item=>!p.sessions.some(session=>session.id===item.id))))fail('/programming/presentation/sessionLabels',null,'Un libellé par séance existante.');
  for(const key of ['headings','openings','summaries']){
   if(!unique(view[key].map(item=>item.blockId)))fail('/programming/presentation/'+key,null,'Une présentation par bloc.');
   for(const item of view[key]){
    if(key==='summaries'&&(Boolean(item.actionLabel)!==Boolean(item.nextBlockId)||item.nextActivityId&&!item.nextBlockId))fail('/programming/presentation/summaries',item.blockId,'Destination et libellé présents ensemble, ou bilan sans action.');
    if(!blocks.has(item.blockId)||item.nextBlockId&&!blocks.has(item.nextBlockId))fail('/programming/presentation/'+key,item.blockId,'Référence vers un bloc existant.');
    if(item.nextActivityId&&!ids.has(item.nextActivityId))fail('/programming/presentation/'+key,item.nextActivityId,'Référence vers une activité existante.');
   }
  }
  if(!unique(view.comparisons.map(item=>item.id)))fail('/programming/presentation/comparisons',null,'Une présentation par comparatif.');
  for(const item of view.comparisons){
   const comparison=p.comparisons.find(c=>c.id===item.id);
   if(!comparison||!unique(item.rules.map(rule=>rule.id))||item.rules.some(rule=>!comparison.programs.some(program=>program.id===rule.id)))fail('/programming/presentation/comparisons',item.id,'Comparatif et programmes existants.');
  }
 }
 const needed=new Set(['editor','execution','console','behavior-tests','trace','prediction']);
 for(const a of spec.activities){if(a.interactive?.diagramType)needed.add('diagram:'+a.interactive.diagramType);if(['quiz','cloze'].includes(a.interactive?.kind))needed.add(a.interactive.kind);}
 if(p.comparisons.length)needed.add('comparison');
 for(const c of p.comparisons)for(const program of c.programs)needed.add('diagram:'+program.diagramType);
 for(const c of needed)if(!p.requiredCapabilities.includes(c))fail('/programming/requiredCapabilities',c,'Capacité nécessaire déclarée.');
}
