import {block,firstSentence,shortTitle} from './lesson-structure.mjs';
import {teachingProfiles} from './teaching-profiles.mjs';
import {activity} from './activity.mjs';
import {workshopsFor} from './workshops.mjs';
export {activity};

export function localContent(entry,nodes,library){
 const resources=nodes.map(c=>library.find(u=>u.code===c.n3_code));
 const workshops=nodes.map((c,i)=>workshopsFor(resources[i],c,i));
 const activities=[],blocks=[],add=(...args)=>blocks.push(block(...args));
 const objectives=nodes.map((c,i)=>workshops[i].profile?.objective||teachingProfiles[c.n3_code]?.objective||resources[i]?.skillLabel||c.n3_label);
 const takeaway=resources.map((r,i)=>firstSentence(r?.lesson||nodes[i].notions_tools)).filter(Boolean);
 add('opening','LessonHero','opening',workshops[0]?.profile?.title||shortTitle(resources[0]?.title||entry.objective.split('\n')[0]),workshops[0]?.profile?.opening||resources[0]?.opening||entry.objective,4,[],entry.skills);
 add('diagnostic','Diagnostic','diagnostic','Évaluation','Réponds sans aide, puis rends ton travail. Tu peux rendre une réponse incomplète.',10);
 for(const [i,c] of nodes.entries()){
  const r=resources[i],w=workshops[i],profile=w.profile||teachingProfiles[c.n3_code],skills=[c.n3_code],lesson=profile?.lesson||r?.lesson||c.notions_tools,example=profile?.example||r?.example||c.observable_criterion;
  const sentences=String(lesson).split(/(?<=[.!?])\s+/).filter(Boolean);
  const diagram=profile?.diagram||(r?.sequence?.length?[r.sequence.join(' → ')]:r?.questions?.map(q=>`${q.prompt} → ${q.correct}`)||[`${c.n3_label} → ${c.expected_trace}`]);
  add(`concept-${i}`,'ConceptCard','understand',profile?.conceptTitle||shortTitle(r?.title||c.n3_label),lesson,12,[],skills,{takeaways:sentences.slice(0,2),hint:r?.questions?.[0]?.feedback||'Relie cette notion à l’exemple qui suit. Identifie ce qui entre, ce qui change et ce qui sort.',diagram});
  if(w.boards)blocks.at(-1).boards=w.boards;
  add(`demo-${i}`,'LiveCode','observe',profile?.observationTitle||`Pas à pas · ${shortTitle(r?.title||c.n3_label)}`,example,8,[],skills,{steps:profile?.steps||['Repère les données de départ et la règle utilisée.','Suis l’exemple. À chaque étape, nomme ce qui change.','Cache le résultat, puis retrouve-le avec la même règle.'],check:profile?.check||r?.questions?.[0]?.prompt||'Peux-tu expliquer le résultat sans réciter la définition ?',takeaways:[profile?.hint||r?.questions?.[0]?.feedback||firstSentence(lesson)]});
  if(w.lab){activities.push(w.lab);blocks.at(-1).activityIds.push(w.lab.id);blocks.at(-1).minutes+=10;}
  activities.push(w.draw);
  add(`board-${i}`,'Activity','guided','Au tableau · dessine pour comprendre','Cache le modèle. Reconstruis les relations, puis compare avec un camarade.',8,[w.draw.id],skills,{steps:['Pose les éléments importants sur le tableau.','Relie, légende et montre le cheminement.'],hint:profile?.hint||r?.questions?.[0]?.feedback||c.scaffolding_rule,check:w.draw.expectedEvidence});
  for(const [j,task] of w.guided.entries()){
   activities.push(task);
   add(j?`practice-${i}-${j}`:`practice-${i}`,'Activity','guided',task.title,profile?.opening||r?.opening||entry.activity,w.guided.length>1?8:18,[task.id],skills,{steps:['Prévois le résultat avant de modifier la production.','Change une chose, puis lance un essai.','Compare attendu et obtenu. Reprends le cas qui échoue.'],hint:profile?.hint||r?.questions?.[0]?.feedback||c.scaffolding_rule,check:task.expectedEvidence});
  }
 }
 if(entry.duration>=120)add('pause','Pause','pause','Pause','Éloigne les yeux de l’écran et lève-toi quelques instants.',15);
 const transfers=workshops.map((w,i)=>({...w.transfer,id:i?`transfer-${i}`:'transfer'}));activities.push(...transfers);
 add('autonomy','Activity','autonomy','À toi de construire','Produis une solution dans ce nouveau cas, sans le modèle. Garde un essai qui t’a aidé à comprendre.',25*transfers.length,transfers.map(a=>a.id),entry.skills,{check:'Ta production traite le nouveau cas. Tu peux expliquer ce que tu as changé et pourquoi.'});
 const extensions=workshops.map((w,i)=>({...w.extension,id:i?`extension-${i}`:'extension'}));activities.push(...extensions);
 add('extension','Activity','extend','Et si la règle changeait ?','Réutilise ce que tu viens d’apprendre. Teste aussi un cas inattendu.',10*extensions.length,extensions.map(a=>a.id),entry.skills,{check:'Tu as comparé une prévision avec un résultat et expliqué l’écart éventuel.'});
 const exit=activity('exit','Ton ticket de sortie','Écris une règle que tu retiens. Donne un exemple qui l’illustre. Termine par une question ou un point à retravailler.',entry.skills,{type:'Reflection',correctionMode:'none',duration:5,expectedEvidence:'Une règle, un exemple et ton prochain pas.'});activities.push(exit);
 add('exit','Reflection','summary','Bilan','Reviens à la question de départ. Explique ta démarche avec un exemple.',8,[exit.id],entry.skills,{takeaways:[...takeaway,'Une solution se vérifie sur plusieurs cas. Prévoir, essayer et comparer aide à comprendre une erreur.']});
 return {title:blocks[0].title,objectives,blocks,activities,teacherGuide:`Objectif : ${entry.objective}\nTrace : ${entry.activity}\nÉtayer : ${nodes.map(c=>c.scaffolding_rule).join('; ')}\nFaire verbaliser les prévisions. Comparer attendu et obtenu. Les manipulations matérielles des ressources restent supervisées. Ne pas confondre une réponse exacte avec une maîtrise durable.`};
}
