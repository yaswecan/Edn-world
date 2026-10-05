const SC='eden_logic_261001';
const num=r=>r?{...r,...Object.fromEntries(['started','created','duration_ms','review_version'].filter(k=>r[k]!=null).map(k=>[k,Number(r[k])]))}:null;
export function createAssessmentStore(db){return {
 async start(id,now){await db.query(`INSERT INTO ${SC}.assessment_sessions(learner_id,started) VALUES($1,$2) ON CONFLICT DO NOTHING`,[id,now]);return this.session(id);},
 async session(id){return num((await db.query(`SELECT * FROM ${SC}.assessment_sessions WHERE learner_id=$1`,[id])).rows[0]);},
 async findRequest(id,requestId){return num((await db.query(`SELECT * FROM ${SC}.submissions WHERE learner_id=$1 AND request_id=$2`,[id,requestId])).rows[0]);},
 async get(id,scope){return num((await db.query(`SELECT s.*,l.alias FROM ${SC}.submissions s JOIN ${SC}.learners l ON s.learner_id=l.id WHERE s.id=$1 AND l.class_id=$2`,[id,scope])).rows[0]);},
 async history(id,scope){const r=await db.query(`SELECT s.id,s.kind,s.created,s.attempt,s.digest,s.review_version FROM ${SC}.submissions s JOIN ${SC}.learners l ON s.learner_id=l.id WHERE l.id=$1 AND l.class_id=$2 ORDER BY s.created DESC,s.id DESC LIMIT 200`,[id,scope]);return r.rows.map(num);},
 async save({id,learnerId,scope,requestId,kind,now,digest,state,grade}){
 const q={text:`INSERT INTO ${SC}.submissions(id,learner_id,request_id,kind,attempt,created,duration_ms,digest,state,grade)
 SELECT $1,l.id,$3,$4,coalesce(a.attempt,1),$5,CASE WHEN $4='diagnostic' THEN greatest(0,$5-a.started) ELSE NULL END,$6,$7::jsonb,$8::jsonb
 FROM ${SC}.learners l LEFT JOIN ${SC}.assessment_sessions a ON a.learner_id=l.id
 WHERE l.id=$2 AND l.class_id=$9 AND ($4<>'diagnostic' OR (a.final_id IS NULL AND a.started IS NOT NULL))
 ON CONFLICT(learner_id,request_id) DO NOTHING RETURNING *`,params:[id,learnerId,requestId,kind,now,digest,JSON.stringify(state),grade?JSON.stringify(grade):null,scope]};
 const queries=[{text:`SELECT id FROM ${SC}.learners WHERE id=$1 AND class_id=$2 FOR UPDATE`,params:[learnerId,scope]},q];
 if(kind==='diagnostic')queries.push({text:`UPDATE ${SC}.assessment_sessions SET final_id=$1 WHERE learner_id=$2 AND final_id IS NULL AND EXISTS(SELECT 1 FROM ${SC}.submissions WHERE id=$1)`,params:[id,learnerId]});
 queries.push({text:`UPDATE ${SC}.learners SET updated=greatest(updated,$3) WHERE id=$1 AND class_id=$2 AND EXISTS(SELECT 1 FROM ${SC}.submissions WHERE id=$4)`,params:[learnerId,scope,now,id]});
 const r=await db.transaction(queries);return num(r[1].rows[0])||this.findRequest(learnerId,requestId);
 },
 async latestState(id,scope){const r=await db.query(`SELECT summary,updated FROM ${SC}.learners WHERE id=$1 AND class_id=$2`,[id,scope]);return {state:r.rows[0]?.summary?.state||null,updated:Number(r.rows[0]?.summary?.receivedAt||r.rows[0]?.updated||0)};},
 async list(scope){const r=await db.query(`SELECT l.id,l.alias,l.updated,a.final_id,a.started,a.attempt,
 s.grade - 'items' AS grade,s.review - 'items' AS review,s.review_version,s.created AS submitted_at,
 (SELECT count(*)::int FROM ${SC}.submissions x WHERE x.learner_id=l.id) AS saved_versions
 FROM ${SC}.learners l LEFT JOIN ${SC}.assessment_sessions a ON a.learner_id=l.id
 LEFT JOIN ${SC}.submissions s ON s.id=a.final_id WHERE l.class_id=$1 ORDER BY lower(l.alias),l.id LIMIT 500`,[scope]);return r.rows.map(num);},
 async review({submissionId,scope,expectedVersion,review,now,actor}){
 const r=await db.query(`WITH changed AS (
 UPDATE ${SC}.submissions s SET review=$4::jsonb,review_version=review_version+1 FROM ${SC}.learners l
 WHERE s.id=$1 AND s.learner_id=l.id AND l.class_id=$2 AND s.review_version=$3 AND s.kind='diagnostic' RETURNING s.id)
 INSERT INTO ${SC}.grade_history(submission_id,created,actor,action,payload)
 SELECT id,$5,$6,'review',$4::jsonb FROM changed RETURNING id`,[submissionId,scope,expectedVersion,JSON.stringify(review),now,actor]);
 return r.rowCount>0;
 },
 async reopen(id,scope,reason,now,actor){const r=await db.transaction([
 {text:`SELECT id FROM ${SC}.learners WHERE id=$1 AND class_id=$2 FOR UPDATE`,params:[id,scope]},
 {text:`INSERT INTO ${SC}.grade_history(submission_id,created,actor,action,payload) SELECT a.final_id,$3,$4,'reopen',jsonb_build_object('reason',$5::text) FROM ${SC}.assessment_sessions a JOIN ${SC}.learners l ON l.id=a.learner_id WHERE l.id=$1 AND l.class_id=$2 AND a.final_id IS NOT NULL`,params:[id,scope,now,actor,reason]},
 {text:`UPDATE ${SC}.assessment_sessions a SET final_id=NULL,started=$3,attempt=attempt+1,reopened_reason=$4 FROM ${SC}.learners l WHERE a.learner_id=l.id AND l.id=$1 AND l.class_id=$2 AND a.final_id IS NOT NULL RETURNING a.learner_id`,params:[id,scope,now,reason]}
 ]);return r[2].rowCount>0;},
 async reviewHistory(submissionId,scope){return (await db.query(`SELECT h.created,h.action,CASE WHEN h.action='review' THEN h.payload - 'items' ELSE h.payload END AS payload FROM ${SC}.grade_history h JOIN ${SC}.submissions s ON s.id=h.submission_id JOIN ${SC}.learners l ON l.id=s.learner_id WHERE s.id=$1 AND l.class_id=$2 ORDER BY h.created,h.id`,[submissionId,scope])).rows;}
};}
