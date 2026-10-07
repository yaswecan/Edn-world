import Ajv from 'ajv';
import { fail } from './store.mjs';
import {depthSchema} from './pedagogy/contracts.mjs';
const str={type:'string'},identifier={type:'string',minLength:1,maxLength:200,pattern:'^[A-Za-z0-9_.:-]+$'},num={type:'number'},bool={type:'boolean'},strings={type:'array',items:str};
const obj=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
export const activitySchema=obj({id:identifier,type:{enum:['WriteResponse','CodeEditor','Quiz','Matching','FillBlank','Terminal','Preview','Reflection','Submission','CodeStationLauncher','TruthTable','CircuitExercise','DragDrop','Console','TestRunner','FileExplorer','MasteryCheck','Simulator']},title:str,instruction:str,objective:str,skills:strings,expectedEvidence:str,duration:{type:'integer',minimum:1},required:bool,correctionMode:{enum:['manual','exact','javascript','structured','html','css','sql','rubric','none']},expectedAnswer:str,reference:str,starter:str,options:strings,tests:{type:'array',items:obj({invoke:str,argsJSON:str,expectedJSON:str})}});
export const blockSchema=obj({id:identifier,type:{enum:['LessonHero','ConceptCard','LiveCode','Activity','Pause','Diagnostic','Reflection','CodeStationLauncher','Timeline','ObjectiveCard','Diagram','BlackboardDiagram']},title:str,content:str,minutes:{type:'integer',minimum:1},activityIds:strings,skills:strings});
export const teachingSchema=obj({steps:strings,hint:str,check:str,takeaways:strings,diagram:strings});
activitySchema.properties.type.enum.push('Blackboard');
// Authored by the server, never by the prose model. Optional for saved v1 lessons.
activitySchema.properties.workshop={type:'object',additionalProperties:false,properties:{language:{enum:['javascript','html','css','sql','text']},document:str,style:str,hints:strings,checks:strings,prediction:str,board:{enum:['01-parent','02-axes','03-espace-libre','04-aligner','05-espaces','06-une-regle','07-deboguer','08-refaire']}}};
blockSchema.properties.boards={type:'array',items:activitySchema.properties.workshop.properties.board};
// Optional on persisted v1 blocks, required in newly assembled lessons.
blockSchema.properties.phase={enum:['opening','diagnostic','understand','observe','guided','pause','autonomy','extend','summary']};
blockSchema.properties.teaching=teachingSchema;
blockSchema.properties.depth=depthSchema;
activitySchema.properties.workshop.properties.profile={enum:['html-css','algorithm','dom','shell-git','concepts']};
activitySchema.properties.workshop.properties.files={type:'array',items:obj({path:str,content:str})};
activitySchema.properties.workshop.properties.visual=obj({id:{type:'string',pattern:'^[a-f0-9]{64}$'},alt:str,width:num,height:num});
activitySchema.properties.publicTests={...activitySchema.properties.tests,maxItems:20};
activitySchema.properties.validationVariants=obj({wrong:str,wrongExplanation:str,alternative:str});
export const contentSchema=obj({title:{type:'string',minLength:1},objectives:{type:'array',minItems:1,items:{type:'string',minLength:1}},sections:{type:'array',items:obj({id:identifier,title:str,content:str,teaching:teachingSchema})},activities:{type:'array',items:obj({id:identifier,title:str,instruction:str,objective:str,expectedEvidence:str,reference:str})},teacherGuide:str});
export const diagnosticSchema=obj({id:str,kind:{enum:['baseline','previous_lesson']},sourceLessonRunId:{type:['string','null']},sourceLessonVersion:{type:['string','null']},duration:{type:'integer',minimum:5,maximum:20},criteria:strings,tasks:{type:'array',items:activitySchema},rubric:{type:'array',items:obj({id:str,criterion:str,taskId:str,label:str,max:{type:'number',minimum:0},a1:num,a2:num})}});
diagnosticSchema.properties.tasks.minItems=2;
diagnosticSchema.properties.tasks.maxItems=4;
diagnosticSchema.properties.rubric.minItems=1;
export const lessonSchema=obj({schemaVersion:{const:'1.0'},lessonId:identifier,lessonVersion:{type:'integer',minimum:1},classId:str,date:str,planEntryId:str,planVersion:{type:'integer'},sequence:str,title:str,skills:strings,objectives:strings,prerequisites:strings,reactivation:strings,diagnostic:diagnosticSchema,timeline:{type:'array',items:obj({blockId:str,minutes:num})},blocks:{type:'array',items:blockSchema},activities:{type:'array',items:activitySchema},slides:{type:'array',items:obj({title:str,body:str})},resources:strings,codeStation:{anyOf:[{type:'null'},obj({missionId:str,missionVersion:{type:'integer'},worldId:str,duration:num,required:bool,unlockAfter:str,completionRule:str})]},teacherGuide:str,studentFlow:strings,sourceVersions:obj({curriculumVersion:str,planVersion:{type:'integer'},previousLessonRunId:{type:['string','null']}})});
export const intentSchema=obj({classId:str,intent:{type:'string',minLength:1,maxLength:4000},targetDate:{type:['string','null']},constraints:strings,requestedChanges:{type:'array',items:obj({entryId:str,date:str,reason:str})},mode:{enum:['prepare','remediation','change_plan']}});
lessonSchema.properties.sourceNotes={type:'array',items:obj({blockId:str,title:str,location:str,note:str,url:{type:['string','null']}})};
const ajv=new Ajv({allErrors:true});const validators=new Map();
export function validate(schema,value){let validator=validators.get(schema);if(!validator){validator=ajv.compile(schema);validators.set(schema,validator);}if(!validator(value))fail(422,'Le document ne respecte pas le schéma.',validator.errors);return value;}
