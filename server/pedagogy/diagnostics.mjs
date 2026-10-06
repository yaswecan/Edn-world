export function diagnosticObservation(attempt,correction){
 if(!attempt)return 'not_started';
 const lastIncident=attempt.history?.findLast(e=>e.payload?.result?.status==='technical_incident');
 if(lastIncident&&!correction)return 'technical_incident';
 if(!attempt.submissionId)return Object.keys(attempt.answers||{}).length?'insufficient_observation':'not_started';
 if(correction?.score==null)return 'insufficient_observation';
 if(correction.score===20)return 'correct';
 if(correction.score===0)return 'incorrect';
 return 'partially_correct';
}
export function diagnosticSupport(spec,correction){
 const weak=(correction?.items||[]).filter(i=>i.points!=null&&i.points<i.max*.75);
 if(!weak.length)return [];
 const skills=new Set(weak.map(i=>i.criterion)),baseline=skills.has('baseline');
 return spec.blocks.filter(b=>b.depth&&(baseline||b.skills.some(s=>skills.has(s)))).map(b=>({blockId:b.id,title:b.title,reminder:b.depth.prerequisiteReminder,action:b.depth.remediation}));
}
