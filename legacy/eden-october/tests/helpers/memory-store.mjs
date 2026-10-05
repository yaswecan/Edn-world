/** TEST DOUBLE ONLY. Does not execute SQL or represent persistence on Vercel. */
const copy=v=>v==null?v:structuredClone(v);
export function createMemoryStore(){
 const data={learners:new Map(),events:new Map(),teachers:new Map(),rates:new Map()};
 const pub=l=>copy(Object.fromEntries(['id','alias','updated','summary','core_completed','validation','teacher_note','validated_at'].map(k=>[k,l[k]])));
 return {
  data,async ready(){},
  async rate(key,max,windowMs,now){let r=data.rates.get(key);if(!r||r.expires<=now)r={n:0,expires:now+windowMs};r.n++;data.rates.set(key,r);return r.n<=max;},
  async enroll(l){data.learners.set(l.id,{...l,created:l.now,updated:l.now,last_order:0,core_completed:0,summary:null,validation:'a-valider',teacher_note:'',validated_at:null});},
  async learnerAuth(tokenHash,scope,credentialVersion,now){return copy([...data.learners.values()].find(l=>l.tokenHash===tokenHash&&l.scope===scope&&l.credentialVersion===credentialVersion&&l.expires>now));},
  async createTeacher(h,scope,credentialVersion,expires){data.teachers.set(h,{scope,credentialVersion,expires});},
  async teacherAuth(h,scope,credentialVersion,now){const s=data.teachers.get(h);return !!s&&s.scope===scope&&s.credentialVersion===credentialVersion&&s.expires>now;},
  async logout(h,scope){if(data.teachers.get(h)?.scope===scope)data.teachers.delete(h);},
  async ingest(p){
   const l=data.learners.get(p.id);if(!l||l.scope!==p.scope||l.credentialVersion!==p.credentialVersion||l.expires<=p.now)return {authorized:false,acceptedEvents:0,duplicateOrOlder:true};
   const evs=data.events.get(p.id)||new Map();let count=0;
   for(const ev of p.events)if(!evs.has(ev.id)){evs.set(ev.id,{...copy(ev),receivedAt:p.now});count++;}
   while(evs.size>2000)evs.delete(evs.keys().next().value);data.events.set(p.id,evs);
   const old=p.order<=l.last_order;
   if(!old){if(JSON.stringify(l.summary)!==JSON.stringify(p.summary)){l.validation='a-valider';l.validated_at=null;}Object.assign(l,{summary:copy(p.summary),updated:p.now,last_order:p.order,core_completed:p.coreCompleted});}
   return {authorized:true,acceptedEvents:count,duplicateOrOlder:old};
  },
  async list(scope,cutoff){return [...data.learners.values()].filter(l=>l.scope===scope&&l.updated>=cutoff).sort((a,b)=>b.updated-a.updated).slice(0,500).map(pub);},
  async detail(id,scope,cutoff){const l=data.learners.get(id);if(!l||l.scope!==scope||l.updated<cutoff)return null;return {learner:pub(l),events:[...(data.events.get(id)||new Map()).values()].slice(-1000).reverse().map(copy)};},
  async validate(p){const l=data.learners.get(p.id);if(!l||l.scope!==p.scope||(l.summary?.revision??null)!==p.expectedRevision||(l.summary?.runId??null)!==p.expectedRunId)return false;Object.assign(l,{validation:p.validation,teacher_note:p.note,validated_at:p.now});return true;},
  async remove(id,scope){if(data.learners.get(id)?.scope!==scope)return false;data.learners.delete(id);data.events.delete(id);return true;},
  async cleanup(scope,cutoff,now){let n=0;for(const[id,l]of data.learners)if(l.scope===scope&&l.updated<cutoff){data.learners.delete(id);data.events.delete(id);n++;}for(const[h,s]of data.teachers)if(s.scope===scope&&s.expires<=now)data.teachers.delete(h);for(const[k,r]of data.rates)if(r.expires<=now)data.rates.delete(k);for(const[id,evs]of data.events)if(data.learners.get(id)?.scope===scope)for(const[k,e]of evs)if(e.receivedAt<cutoff)evs.delete(k);return {deletedLearners:n};}
 };
}
