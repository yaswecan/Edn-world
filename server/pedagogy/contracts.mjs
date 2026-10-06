import {createHash} from 'node:crypto';
export const text={type:'string',minLength:1};
export const strings={type:'array',items:text};
export const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
export const array=items=>({type:'array',items});
export const digest=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
export const CHARTER_VERSION='tween-depth-2026-10-05.1';
export const citationSchema=object({sourceId:text,segmentId:text,claim:text,kind:{enum:['explicit','inference','proposal']}});
export const depthSchema=object({question:text,prerequisiteReminder:text,mechanism:text,workedExample:text,misconception:text,transfer:text,remediation:text,citations:array(citationSchema)});
export const planSchema=object({
  analysis:array(object({conceptId:text,label:text,prerequisites:strings,relations:strings,citations:array(citationSchema),uncertainties:strings})),
  alternatives:array(object({id:text,order:strings,advantages:text,risks:text})),
  selectedOrder:strings,justification:text,
  coverage:array(object({skill:text,conceptIds:strings,sourceSegments:strings,explanationBlockId:text,activityIds:strings,evidence:text,remediation:text,mechanismId:text,runtimeProfile:text,reasoningDemand:text})),
  prerequisites:array(object({conceptId:text,status:{enum:['known','unknown','reminder']},evidence:text,action:text})),
  duration:object({minutes:{type:'integer',minimum:1},uncertainty:text,includesReadingAttemptsHelpAndCorrection:{const:true}}),
  diagnosticBranches:array(object({observation:text,action:text,commonObjective:text})),deferred:strings,gaps:strings
});
export const planReviewSchema=object({decision:{enum:['accept','revise','blocked']},issues:array(object({location:text,problem:text,requestedChange:text,resolutionCriterion:text}))});
const teaching=object({steps:strings,hint:{type:'string'},check:{type:'string'},takeaways:strings,diagram:strings});
export const unitSchema=object({skill:text,depth:depthSchema,
  sections:array(object({id:text,title:text,content:{type:'string'},teaching})),
  activities:array(object({id:text,title:text,instruction:text,objective:text,expectedEvidence:text,reference:text,starter:{type:'string'},expectedAnswer:{type:'string'},tests:array(object({invoke:text,argsJSON:text,expectedJSON:text})),hints:strings,files:array(object({path:text,content:{type:'string'}}))})),
  responses:array(object({issueId:text,change:text,location:text}))
});
export const DIMENSIONS={accuracy:25,mechanisms:20,activities:20,progression:15,tone:10,visuals:10};
export const reviewSchema=object({contentHash:text,briefHash:text,charterVersion:{const:CHARTER_VERSION},decision:{enum:['accept','revise','blocked']},
  dimensions:object(Object.fromEntries(Object.keys(DIMENSIONS).map(key=>[key,object({score:{type:'integer',minimum:0,maximum:4},justification:text,evidence:strings})]))),
  issues:array(object({id:text,rule:text,severity:{enum:['critical','major','minor']},location:text,observation:text,problem:text,requestedChange:text,resolutionCriterion:text})),
  coverageGaps:strings,regressions:strings,uncertainties:strings,nextCorrections:strings,
  externalChecks:array(object({id:text,status:{enum:['PASS','FAIL','NOT RUN']},evidence:text}))
});
