import {validateReferences,encodePackage} from '../lesson-package.mjs';
import {sha256} from '../content-snapshots.mjs';
import {requireValue} from '../store.mjs';
export async function packageProgramming(spec,resources=[]){
 validateReferences(spec);requireValue(spec.programming?.format==='programming-1','Cours programming-1 attendu.');
 const files=new Map(),inventory=resources.map(r=>{requireValue(Buffer.isBuffer(r.bytes)&&['student','teacher'].includes(r.audience),'Ressource binaire avec audience explicite attendue.');const hash=sha256(r.bytes);files.set(hash,r.bytes);return {path:r.path,audience:r.audience,mimeType:r.mimeType,sha256:hash,bytes:r.bytes.length};});
 const payload={spec,sessionIdentity:{format:1,pedagogicalTitle:spec.title,missionTitle:null,titleSource:'imported',needsReview:true,associations:[]},context:{entry:{duration:spec.timeline.reduce((n,t)=>n+t.minutes,0),durationConfirmed:false,objective:spec.objectives.join('\n'),activity:'Programmation'},criteria:[],diagnosticSource:null},assets:[],documents:[],mission:null,corpus:{complete:true,files:inventory},preparation:{requiresReview:true,incomplete:false,state:'teacher_draft'},designContract:null,external:[]};
 const {validatePayload}=await import('../lesson-transfer-content.mjs');validatePayload(payload,files);
 // A teacher resource must never be surfaced by a student-facing link.
 const {studentSpec}=await import('../generator.mjs');const visible=JSON.stringify(studentSpec(spec));
 for(const r of inventory)if(r.audience==='teacher')requireValue(!visible.includes(`tweenteach-file:${r.sha256}:`),'Ressource professeur référencée dans la représentation élève.');
 return encodePackage([{portableId:sha256('canonical:'+spec.lessonId).slice(0,32),date:spec.date,sequence:spec.sequence,payload}],files);
}
