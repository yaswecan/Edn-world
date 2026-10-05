/** Repository: parameterized PostgreSQL queries, compatible with Neon HTTP batches. */
const PUBLIC=`id,alias,updated,summary,core_completed,validation,teacher_note,validated_at`;
function normalize(row) {
  if(!row)return null;
  const copy={...row};
  for(const key of ['expires','created','updated','last_order','validated_at','received'])if(copy[key]!==undefined&&copy[key]!==null)copy[key]=Number(copy[key]);
  return copy;
}
export function createStore(db) {
 return {
  async ready(){await db.migrate();},
  async rate(bucket,max,windowMs,now){
    const r=await db.query(`INSERT INTO eden_logic_261001.rate_limits AS r(bucket,expires,n) VALUES ($1,$2,1)
      ON CONFLICT(bucket) DO UPDATE SET n=CASE WHEN r.expires <= $3 THEN 1 ELSE r.n+1 END,
      expires=CASE WHEN r.expires <= $3 THEN $2 ELSE r.expires END RETURNING n`,[bucket,now+windowMs,now]);
    return r.rows[0].n<=max;
  },
  async enroll(l){await db.query(`INSERT INTO eden_logic_261001.learners(id,class_id,alias,token_hash,credential_version,expires,created,updated)
    VALUES($1,$2,$3,$4,$5,$6,$7,$7)`,[l.id,l.scope,l.alias,l.tokenHash,l.credentialVersion,l.expires,l.now]);},
  async learnerAuth(tokenHash,scope,credentialVersion,now){
    return normalize((await db.query(`SELECT id,alias,last_order FROM eden_logic_261001.learners
     WHERE token_hash=$1 AND class_id=$2 AND credential_version=$3 AND expires>$4`,[tokenHash,scope,credentialVersion,now])).rows[0]);
  },
  async createTeacher(tokenHash,scope,credentialVersion,expires){
    await db.query(`INSERT INTO eden_logic_261001.teacher_sessions(token_hash,class_id,credential_version,expires) VALUES($1,$2,$3,$4)`,[tokenHash,scope,credentialVersion,expires]);
  },
  async teacherAuth(tokenHash,scope,credentialVersion,now){
    return !!(await db.query(`SELECT 1 FROM eden_logic_261001.teacher_sessions WHERE token_hash=$1 AND class_id=$2 AND credential_version=$3 AND expires>$4`,[tokenHash,scope,credentialVersion,now])).rowCount;
  },
  async logout(tokenHash,scope){await db.query(`DELETE FROM eden_logic_261001.teacher_sessions WHERE token_hash=$1 AND class_id=$2`,[tokenHash,scope]);},
  async ingest({id,scope,credentialVersion,now,order,summary,coreCompleted,events}){
    // Row lock serializes concurrent packets for this learner across Vercel instances.
    // Every statement rechecks scope and expiration: a deleted/expired session cannot write.
    const guard=`SELECT id FROM eden_logic_261001.learners WHERE id=$1 AND class_id=$2 AND credential_version=$3 AND expires>$4`;
    const common=[id,scope,credentialVersion,now];
    const r=await db.transaction([
      {text:guard+' FOR UPDATE',params:common},
      {text:`INSERT INTO eden_logic_261001.events(learner_id,event_id,received,event)
        SELECT $1,e.value->>'id',$4,e.value FROM jsonb_array_elements($5::jsonb) AS e
        WHERE EXISTS (${guard}) ON CONFLICT DO NOTHING RETURNING event_id`,params:[...common,JSON.stringify(events)]},
      {text:`UPDATE eden_logic_261001.learners SET summary=$5::jsonb,updated=$4,last_order=$6,core_completed=$7,
        validation=CASE WHEN summary IS DISTINCT FROM $5::jsonb THEN 'a-valider' ELSE validation END,
        validated_at=CASE WHEN summary IS DISTINCT FROM $5::jsonb THEN NULL ELSE validated_at END
        WHERE id=$1 AND class_id=$2 AND credential_version=$3 AND expires>$4 AND last_order<$6 RETURNING id`,
        params:[...common,JSON.stringify(summary),order,coreCompleted]},
      {text:`DELETE FROM eden_logic_261001.events WHERE learner_id=$1 AND event_id IN (
        SELECT event_id FROM eden_logic_261001.events WHERE learner_id=$1 ORDER BY received DESC,event_id DESC OFFSET 2000
      )`,params:[id]}
    ]);
    return {authorized:r[0].rowCount>0,acceptedEvents:r[1].rowCount,duplicateOrOlder:r[2].rowCount===0};
  },
  async list(scope,cutoff){const r=await db.query(`SELECT ${PUBLIC.replace('summary',"summary - 'state' AS summary")} FROM eden_logic_261001.learners WHERE class_id=$1 AND updated>=$2 ORDER BY updated DESC LIMIT 500`,[scope,cutoff]);return r.rows.map(normalize);},
  async detail(id,scope,cutoff){
    const learner=normalize((await db.query(`SELECT ${PUBLIC} FROM eden_logic_261001.learners WHERE id=$1 AND class_id=$2 AND updated>=$3`,[id,scope,cutoff])).rows[0]);
    if(!learner)return null;
    const r=await db.query(`SELECT e.event,e.received FROM eden_logic_261001.events e JOIN eden_logic_261001.learners l ON l.id=e.learner_id
      WHERE l.id=$1 AND l.class_id=$2 AND l.updated>=$3 ORDER BY e.received DESC,e.event_id DESC LIMIT 1000`,[id,scope,cutoff]);
    return {learner,events:r.rows.map(v=>({...v.event,receivedAt:Number(v.received)}))};
  },
  async validate({id,scope,validation,note,now,expectedRevision,expectedRunId}){
    const r=await db.query(`UPDATE eden_logic_261001.learners SET validation=$3,teacher_note=$4,validated_at=$5
      WHERE id=$1 AND class_id=$2 AND (summary->>'revision') IS NOT DISTINCT FROM $6::text
      AND (summary->>'runId') IS NOT DISTINCT FROM $7::text RETURNING id`,[id,scope,validation,note,now,expectedRevision===null?null:String(expectedRevision),expectedRunId]);
    return r.rowCount>0;
  },
  async remove(id,scope){return !!(await db.query(`DELETE FROM eden_logic_261001.learners WHERE id=$1 AND class_id=$2 RETURNING id`,[id,scope])).rowCount;},
  async cleanup(scope,cutoff,now){
    const results=await db.transaction([
     {text:`DELETE FROM eden_logic_261001.learners WHERE class_id=$1 AND updated<$2 RETURNING id`,params:[scope,cutoff]},
     {text:`DELETE FROM eden_logic_261001.teacher_sessions WHERE class_id=$1 AND expires<=$2`,params:[scope,now]},
     {text:`DELETE FROM eden_logic_261001.rate_limits WHERE expires<=$1`,params:[now]},
     {text:`DELETE FROM eden_logic_261001.events e USING eden_logic_261001.learners l WHERE e.learner_id=l.id AND l.class_id=$1 AND e.received<$2`,params:[scope,cutoff]}
    ]);
    return {deletedLearners:results[0].rowCount};
  }
 };
}
