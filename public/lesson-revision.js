const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const javascriptRevisionPrompt='Garde uniquement JavaScript dans ce cours : retire toutes les mentions et tous les exemples Python. Remplace les tableaux à dessiner et les activités de dessin par des exercices de code plus exigeants : débogage de boucles, parcours de tableaux JavaScript, cas limites et justification des choix. Conserve les notions de tableaux JavaScript, les objectifs, la progression et la durée du créneau. Mets à jour les explications, consignes, indices et corrigés.';

export function revisionEditor(lesson){
 if(lesson.status!=='draft')return '';
 return `<section class="card pad spaced" id="revision-editor" aria-labelledby="revision-heading"><div class="eyebrow">Votre brouillon · version ${lesson.version}</div><h2 id="revision-heading">Modifier avec une consigne</h2><p>Décrivez ce que vous souhaitez changer. Relisez la proposition avant de l’enregistrer dans une nouvelle version.</p><form data-form="revise-lesson" data-id="${esc(lesson.id)}" data-version="${lesson.version}"><div class="field"><label for="revision-prompt">Votre demande de modification</label><textarea id="revision-prompt" name="prompt" rows="4" maxlength="4000" required placeholder="Retire les dessins, garde uniquement JavaScript et ajoute des exercices de débogage…"></textarea></div><div class="flex wrap"><button type="button" class="btn small" data-action="revision-js">JavaScript · sans dessins</button><button type="submit" class="btn primary">Proposer les modifications</button><button type="button" class="btn subtle small" data-action="revision-history" data-id="${esc(lesson.id)}">Retrouver mes propositions</button></div><p class="section-note">Utilise votre connexion IA configurée. Le diagnostic et la planification restent liés à leur version source. La publication se fait après votre validation.</p><p data-revision-progress role="status" hidden></p><p data-revision-error role="alert" hidden></p></form></section>`;
}

function readable(value){
 if(value==null)return 'Supprimé';
 if(typeof value==='string')return value;
 if(Array.isArray(value))return value.map(readable).join('\n');
 const format={Blackboard:'Dessin',BlackboardDiagram:'Tableau à dessiner',CodeEditor:'Exercice de code',FillBlank:'Texte ou code à compléter',WriteResponse:'Réponse argumentée',Quiz:'Questionnaire',Reflection:'Bilan',Terminal:'Terminal'}[value.type];
 return [value.title,format?`Format : ${format}`:null,value.minutes||value.duration?`Durée : ${value.minutes||value.duration} min`:null,
  value.content,value.instruction,value.objective,value.expectedEvidence,value.starter,value.options?.length?readable(value.options):null,
  value.teaching?readable(Object.values(value.teaching)):null,value.depth?readable(Object.entries(value.depth).filter(([key])=>key!=='citations').map(([,v])=>v)):null,
  value.reference?`Corrigé professeur\n${value.reference}`:null,value.expectedAnswer?`Réponse attendue : ${value.expectedAnswer}`:null,value.workshop?.hints?readable(value.workshop.hints):null,
  value.workshop?.language?`Langage : ${value.workshop.language}`:null,value.workshop?.document,value.workshop?.style,value.workshop?.prediction,value.workshop?.checks?readable(value.workshop.checks):null,
  value.workshop?.files?.map(f=>`${f.path}\n${f.content}`).join('\n'),value.tests?.length?`Tests : ${value.tests.map(t=>`${t.invoke}(${t.argsJSON}) → ${t.expectedJSON}`).join('\n')}`:null].filter(Boolean).join('\n\n');
}

export function revisionComparison(proposal,original){
 const updated=proposal.spec,items=[];
 const add=(title,before,after)=>{if(JSON.stringify(before)!==JSON.stringify(after))items.push({title,before,after});};
 for(const [key,title] of [['title','Titre'],['objectives','Objectifs'],['reactivation','Rappels'],['teacherGuide','Guide professeur']])add(title,original[key],updated[key]);
 if(JSON.stringify(original.studentFlow)!==JSON.stringify(updated.studentFlow))add('Ordre des étapes',original.studentFlow.map(id=>original.blocks.find(b=>b.id===id)?.title||id),updated.studentFlow.map(id=>updated.blocks.find(b=>b.id===id)?.title||id));
 for(const key of ['blocks','activities'])for(const id of new Set([...original[key],...updated[key]].map(item=>item.id))){const before=original[key].find(item=>item.id===id),after=updated[key].find(item=>item.id===id);add(`${key==='blocks'?'Étape':'Exercice'} · ${(after||before).title}`,before,after);}
 return `<p class="block-content">${esc(proposal.summary)}</p><p>${items.length} élément(s) modifié(s). Ouvrez-les pour comparer.</p>${items.map(item=>`<details class="block-card"><summary>${esc(item.title)}</summary><h4>Avant</h4><pre class="block-content" style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(item.before==null?'Absent':readable(item.before))}</pre><h4>Après</h4><pre class="block-content" style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(readable(item.after))}</pre></details>`).join('')}${proposal.checks.some(c=>!c.ok)?`<div class="alert info"><div><strong>À corriger avant publication</strong><ul>${proposal.checks.filter(c=>!c.ok).map(c=>`<li>${esc(c.message)}</li>`).join('')}</ul></div></div>`:'<p>Les contrôles du contenu et des corrigés sont réussis. La publication vérifiera aussi les supports et la planification.</p>'}`;
}
