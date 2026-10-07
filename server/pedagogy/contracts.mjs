import {createHash} from 'node:crypto';
import {POLICY_VERSION} from './policy.mjs';
export const text={type:'string',minLength:1};
export const strings={type:'array',items:text};
export const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
export const array=items=>({type:'array',items});
export const digest=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
export const CHARTER_VERSION=POLICY_VERSION;
export const citationSchema=object({sourceId:text,segmentId:text,claim:text,kind:{type:'string',enum:['explicit','inference','proposal']}});
export const depthSchema=object({question:text,prerequisiteReminder:text,mechanism:text,workedExample:text,misconception:text,transfer:text,remediation:text,citations:array(citationSchema)});
export const documentarySchema=object({
 concepts:array(object({id:text,label:text,prerequisites:strings,examples:strings,misconceptions:strings,activityOpportunities:strings,citations:array(citationSchema)})),
 findings:array(object({claim:text,citations:array(citationSchema)})),
 contradictions:array(object({description:text,citations:array(citationSchema),resolution:text})),
 gaps:strings,uninterpretedFigures:strings
});
export const designContractSchema=object({
 family:{type:'string',enum:['Design','Programmation','Savoir']},familyReason:text,
 outcomes:array(object({skill:text,observable:text,criteria:strings,activityIds:strings,proof:text})),
 finalTask:object({activityId:text,production:text,requiredConceptIds:strings,criteria:strings,transferActivityId:text,transferVariation:text}),
 activities:array(object({activityId:text,action:text,initialState:text,providedInformation:text,result:text,constraints:strings,runtimeProfile:text,capabilities:strings,help:{type:'string',enum:['guided','reduced','autonomous']},verification:text,finalTaskLink:text,files:array(object({path:text,purpose:text,requirement:text}))})),
 teaching:array(object({skill:text,mode:{type:'string',enum:['acquisition','consolidation']},mechanism:text,workedExample:text,misconception:text,visual:text,priorResourceIds:strings})),
 timing:array(object({blockId:text,minutes:{type:'integer',minimum:1},includes:text})),
 supports:array(object({id:text,kind:{type:'string',enum:['student-course','teacher-guide','correction','starter','visual','export']},audience:{type:'string',enum:['student','teacher']},required:{type:'boolean'},purpose:text,activityIds:strings,dependsOn:strings})),
 summary:text,remediation:text,extension:text,assumptions:strings,unresolvedConstraints:strings
});
export const planSchema=object({
  contract:designContractSchema,
  analysis:array(object({conceptId:text,label:text,prerequisites:strings,relations:strings,citations:array(citationSchema),uncertainties:strings})),
  alternatives:array(object({id:text,order:strings,advantages:text,risks:text})),
  selectedOrder:strings,justification:text,
  coverage:array(object({skill:text,conceptIds:strings,sourceSegments:strings,explanationBlockId:text,activityIds:strings,evidence:text,remediation:text,mechanismId:text,runtimeProfile:text,reasoningDemand:text})),
  prerequisites:array(object({conceptId:text,status:{type:'string',enum:['known','unknown','reminder']},evidence:text,action:text})),
  duration:object({minutes:{type:'integer',minimum:1},uncertainty:text,includesReadingAttemptsHelpAndCorrection:{type:'boolean',const:true}}),
  diagnosticBranches:array(object({observation:text,action:text,commonObjective:text})),deferred:strings,gaps:strings
});
// Constrain identities before generation as well as validating them afterwards.
// The model writes explanations, never new curriculum codes or activity handles.
export function planSchemaFor(spec,sources){
 // JSON expansion intentionally breaks shared schema-node references (strings/text).
 const schema=JSON.parse(JSON.stringify(planSchema)),p=schema.properties,c=p.contract.properties;
 const enumeration=values=>({type:'string',enum:[...new Set(values)]});
 const activities=[...spec.activities,...spec.diagnostic.tasks].map(a=>a.id),blocks=spec.blocks.map(b=>b.id),skills=spec.skills;
 p.coverage.minItems=skills.length;p.coverage.maxItems=skills.length;
 const coverage=p.coverage.items.properties;coverage.skill=enumeration(skills);coverage.activityIds.items=enumeration(activities);coverage.explanationBlockId=enumeration(spec.blocks.filter(b=>b.phase==='understand').map(b=>b.id));coverage.sourceSegments.items=enumeration(sources.flatMap(s=>s.segments.map(x=>x.id)));
 for(const collection of [c.outcomes,c.teaching]){collection.minItems=skills.length;collection.maxItems=skills.length;collection.items.properties.skill=enumeration(skills);}
 c.outcomes.items.properties.activityIds.items=enumeration(activities);c.activities.items.properties.activityId=enumeration(activities);c.supports.items.properties.activityIds.items=enumeration(activities);
 c.timing.minItems=blocks.length;c.timing.maxItems=blocks.length;c.timing.items.properties.blockId=enumeration(blocks);
 for(const [key,phase] of [['activityId','autonomy'],['transferActivityId','extend']])c.finalTask.properties[key]=enumeration(spec.blocks.filter(b=>b.phase===phase).flatMap(b=>b.activityIds).filter(id=>activities.includes(id)));
 return schema;
}
export const planReviewSchema=object({decision:{type:'string',enum:['accept','revise','blocked']},issues:array(object({location:text,problem:text,requestedChange:text,resolutionCriterion:text}))});
const teaching=object({steps:strings,hint:{type:'string'},check:{type:'string'},takeaways:strings,diagram:strings});
export const unitSchema=object({skill:text,depth:depthSchema,
  sections:array(object({id:text,title:text,content:{type:'string'},teaching})),
  activities:array(object({id:text,title:text,instruction:text,objective:text,expectedEvidence:text,reference:text,starter:{type:'string'},expectedAnswer:{type:'string'},tests:array(object({invoke:text,argsJSON:text,expectedJSON:text})),publicTests:array(object({invoke:text,argsJSON:text,expectedJSON:text})),validationVariants:object({wrong:{type:'string'},wrongExplanation:{type:'string'},alternative:{type:'string'}}),hints:strings,files:array(object({path:text,content:{type:'string'}}))})),
  responses:array(object({issueId:text,change:text,location:text}))
});
export const DIMENSIONS={accuracy:25,mechanisms:20,activities:20,progression:15,tone:10,visuals:10};
export const reviewSchema=object({contentHash:text,briefHash:text,charterVersion:{type:'string',const:CHARTER_VERSION},decision:{type:'string',enum:['accept','revise','blocked']},
  dimensions:object(Object.fromEntries(Object.keys(DIMENSIONS).map(key=>[key,object({score:{type:'integer',minimum:0,maximum:4},justification:text,evidence:strings})]))),
  issues:array(object({id:text,rule:text,severity:{type:'string',enum:['critical','major','minor']},location:text,observation:text,problem:text,requestedChange:text,resolutionCriterion:text})),
  coverageGaps:strings,regressions:strings,uncertainties:strings,nextCorrections:strings,
  externalChecks:array(object({id:text,status:{type:'string',enum:['PASS','FAIL','NOT RUN']},evidence:text}))
});
