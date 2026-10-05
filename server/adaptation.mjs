import {compileCorpus} from './corpus.mjs';
import {uid,now,scoped,requireValue,fail} from './store.mjs';
import {editLesson,lessonQuality} from './domain.mjs';
export async function proposeAdaptation(store,id,actor,input){
 const lesson=await scoped(store,'lessons',id,actor);requireValue(['draft','published'].includes(lesson.status),'Adaptez un brouillon ou une séance ouverte.');requireValue(input.version===lesson.version,'Rechargez la version actuelle.');requireValue(['practice','remediation'].includes(input.strategy),'Adaptation inconnue.');
 const original=(await store.get('lesson_versions',lesson.versionId)).spec,spec=structuredClone(original),changes=[];
 const visited=lesson.status==='published'?await visitedBlocks(store,lesson,original):new Set();const editable=b=>!visited.has(b.id)&&b.type!=='Diagnostic';
 if(input.strategy==='practice'){
  const practice=spec.blocks.filter(b=>editable(b)&&b.type==='Activity'&&b.activityIds.length),concepts=spec.blocks.filter(b=>editable(b)&&['ConceptCard','LiveCode'].includes(b.type)&&b.minutes>5);
  requireValue(practice.length&&concepts.length,'Pas de redistribution de durée possible dans ce brouillon.');let total=0;
  for(const b of concepts){const freed=Math.min(5,b.minutes-5);b.minutes-=freed;total+=freed;changes.push(`${b.title} : −${freed} min`);}
  practice.forEach((b,i)=>{const extra=Math.floor(total/practice.length)+(i<total%practice.length?1:0);b.minutes+=extra;const activities=b.activityIds.map(id=>spec.activities.find(a=>a.id===id)).filter(Boolean);if(activities[0])activities[0].duration+=extra;changes.push(`${b.title} : +${extra} min`);});
  spec.teacherGuide+='\nAdaptation pratique : démonstrations raccourcies ; temps libéré consacré à produire, tester puis expliquer une solution.';
 }else{
  const snapshot=(await store.list('remediation_snapshots',actor.classId)).sort((a,b)=>a.version-b.version).at(-1);requireValue(snapshot,'Calculez les groupes avant la remédiation.');
  const criteria=new Set([...spec.skills,...spec.prerequisites,...spec.diagnostic.criteria]);
  const activities=snapshot.groups.flatMap(g=>g.activities.filter(a=>criteria.has(a.criterion)).map(a=>({...a,group:g.id})));
  requireValue(activities.length,'Aucun critère commun avec les groupes de remédiation.');
  const block=spec.blocks.find(b=>editable(b)&&b.type==='Activity'&&b.activityIds.length);requireValue(block,'Aucun atelier adaptable.');
  const teacherWorkshops=activities.map(a=>`${a.group} · ${a.criterion} : ${a.mode}. ${a.evidence}`).join('\n');
  block.title='Entraînement';block.content='';
  for(const id of block.activityIds){const task=spec.activities.find(a=>a.id===id);if(task)task.instruction+='\nDemande au professeur quelle aide utiliser. Garde ton travail et explique comment tu l’as vérifié.';}
  spec.teacherGuide+=`\nGroupes de remédiation figés depuis ${snapshot.id} (version ${snapshot.version}).\n`+teacherWorkshops;changes.push(`Atelier différencié relié aux groupes v${snapshot.version}`);
 }
 spec.timeline=spec.blocks.map(b=>({blockId:b.id,minutes:b.minutes}));
 const proposal={id:uid('adaptation'),classId:actor.classId,kind:'adaptation_proposal',lessonId:id,version:lesson.version,strategy:input.strategy,changes,spec,reason:input.reason||`Adaptation ${input.strategy}`,live:lesson.status==='published',affectedBlocks:spec.blocks.filter((b,i)=>JSON.stringify(b)!==JSON.stringify(original.blocks[i])).map(b=>b.id)};
 if(proposal.live){spec.lessonVersion=lesson.version+1;proposal.candidateVersionId=`${id}:${proposal.id}`;await store.transaction(async tx=>{const current=await scoped(tx,'lessons',id,actor);if(current.versionId!==lesson.versionId)fail(409,'Séance modifiée pendant la préparation.');await tx.insert('lesson_versions',{id:proposal.candidateVersionId,classId:actor.classId,lessonId:id,baseVersionId:lesson.versionId,version:spec.lessonVersion,spec,authorId:actor.id,reason:proposal.reason});});await compileCorpus(store,id,actor,{candidateVersionId:proposal.candidateVersionId});}
 return store.insert('lesson_adaptations',proposal);
}
async function visitedBlocks(store,lesson,spec){const events=(await store.list('learning_events',lesson.classId)).filter(e=>e.lessonId===lesson.id&&['step_started','step_completed','answer_saved'].includes(e.type)),visited=new Set();for(const event of events){const block=spec.blocks.find(b=>b.id===event.activityId||b.activityIds.includes(event.activityId));if(block)visited.add(block.id);}return visited;}
export async function applyAdaptation(store,id,actor,input){requireValue(input.confirmed===true,'Relisez et validez cette adaptation.');const proposal=await scoped(store,'lesson_adaptations',input.proposalId,actor);requireValue(proposal.lessonId===id,'Proposition liée à une autre séance.');
 if(!proposal.live)return editLesson(store,id,{version:proposal.version,spec:proposal.spec,reason:proposal.reason},actor);
 return store.transaction(async tx=>{const lesson=await scoped(tx,'lessons',id,actor);if(lesson.version!==proposal.version||lesson.status!=='published')fail(409,'La séance a changé depuis l’aperçu.');const run=await scoped(tx,'lesson_runs',lesson.runId,actor);requireValue(!run.closedAt,'La séance est clôturée.');const original=(await tx.get('lesson_versions',lesson.versionId)).spec,visited=await visitedBlocks(tx,lesson,original);if(proposal.affectedBlocks.some(id=>visited.has(id)))fail(409,'Un élève a commencé un atelier concerné depuis l’aperçu. Recréez la proposition.');
 const candidate={...lesson,version:lesson.version+1,versionId:proposal.candidateVersionId},review=await lessonQuality(tx,candidate);if(!review.quality.publishable)fail(422,'Contrôles bloquants pour l’adaptation.',review.quality);
 candidate.diagnosticVersionId=lesson.diagnosticVersionId||lesson.versionId;candidate.previousVersionId=lesson.versionId;candidate.quality=review.quality;candidate.title=proposal.spec.title;
 const publication=await tx.insert('lesson_publications',{id:uid('publication'),classId:actor.classId,lessonId:id,lessonVersionId:candidate.versionId,version:candidate.version,publishedBy:actor.id,publishedAt:now(),corpusId:review.pack.id,adaptationId:proposal.id});candidate.publicationId=publication.id;
 for(const progress of (await tx.list('learning_progress',actor.classId)).filter(p=>p.lessonVersionId===lesson.versionId))await tx.insert('learning_progress',{...progress,id:`${progress.learnerId}:${candidate.versionId}`,lessonVersionId:candidate.versionId,createdAt:now()});
 run.lessonVersionId=candidate.versionId;await tx.put('lesson_runs',run);await tx.put('lessons',candidate);await tx.insert('teacher_approvals',{id:uid('approval'),classId:actor.classId,entityId:proposal.id,version:candidate.version,actorId:actor.id,action:'live_adaptation'});await tx.audit(actor,'lesson.adapted_live',id,{version:candidate.version,previousVersionId:lesson.versionId,diagnosticVersionId:candidate.diagnosticVersionId,reason:proposal.reason});return candidate;
 });
}
