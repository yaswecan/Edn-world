/** Test double; persistence, SQL constraints and locking require the opt-in Neon tests. */
const clone=x=>x==null?x:structuredClone(x);
export function createAssessmentMemory(store){const sessions=new Map(),submissions=new Map(),audits=new Map();const owned=(id,scope)=>store.data.learners.get(id)?.scope===scope;return {
 data:{sessions,submissions,audits},
 async start(id,now){if(!sessions.has(id))sessions.set(id,{learner_id:id,started:now,attempt:1,final_id:null});return this.session(id);},
 async session(id){return clone(sessions.get(id));},
 async findRequest(id,requestId){return clone([...submissions.values()].find(s=>s.learner_id===id&&s.request_id===requestId));},
 async get(id,scope){const s=submissions.get(id);return s&&owned(s.learner_id,scope)?clone(s):null;},
 async history(id,scope){if(!owned(id,scope))return [];return [...submissions.values()].filter(s=>s.learner_id===id).sort((a,b)=>b.created-a.created||b.id.localeCompare(a.id)).slice(0,200).map(({id,kind,created,attempt,digest,review_version})=>({id,kind,created,attempt,digest,review_version}));},
 async save(p){if(!owned(p.learnerId,p.scope))return null;const prev=await this.findRequest(p.learnerId,p.requestId);if(prev)return prev;const a=sessions.get(p.learnerId);if(p.kind==='diagnostic'&&(!a||a.final_id))return null;const s={id:p.id,learner_id:p.learnerId,request_id:p.requestId,kind:p.kind,attempt:a?.attempt||1,created:p.now,duration_ms:p.kind==='diagnostic'?p.now-a.started:null,digest:p.digest,state:clone(p.state),grade:clone(p.grade),review:null,review_version:0};submissions.set(s.id,s);store.data.learners.get(p.learnerId).updated=p.now;if(p.kind==='diagnostic')a.final_id=s.id;return clone(s);},
 async latestState(id,scope){const l=store.data.learners.get(id);return owned(id,scope)?{state:clone(l.summary?.state||null),updated:l.summary?.receivedAt||l.updated}:{state:null,updated:0};},
 async list(scope){return [...store.data.learners.values()].filter(l=>l.scope===scope).map(l=>{const a=sessions.get(l.id),s=submissions.get(a?.final_id);const compact=g=>g?Object.fromEntries(Object.entries(clone(g)).filter(([k])=>k!=='items')):null;return {id:l.id,alias:l.alias,updated:l.updated,final_id:a?.final_id,started:a?.started,attempt:a?.attempt,grade:compact(s?.grade),review:compact(s?.review),review_version:s?.review_version,submitted_at:s?.created,saved_versions:[...submissions.values()].filter(s=>s.learner_id===l.id).length};});},
 async review(p){const s=submissions.get(p.submissionId);if(!s||!owned(s.learner_id,p.scope)||s.review_version!==p.expectedVersion)return false;s.review=clone(p.review);s.review_version++;const h=audits.get(s.id)||[];h.push({created:p.now,action:'review',payload:clone(p.review)});audits.set(s.id,h);return true;},
 async reopen(id,scope,reason,now,actor){const a=sessions.get(id);if(!owned(id,scope)||!a?.final_id)return false;const h=audits.get(a.final_id)||[];h.push({created:now,action:'reopen',payload:{reason}});audits.set(a.final_id,h);a.final_id=null;a.started=now;a.attempt++;return true;},
 async reviewHistory(id,scope){const s=await this.get(id,scope);return s?clone(audits.get(id)||[]):[];}
};}
