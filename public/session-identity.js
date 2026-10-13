const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function competencyBadges(session,{teacher=false,limit=3}={}){
 const items=session.competencies||[];
 const badge=c=>teacher?`<details class="competency-detail"><summary class="pill brand-tone">${esc(c.code||c.label)}</summary><div class="competency-popover"><strong>${esc(c.code||'Compétence sans code source')}</strong><p>${esc(c.label)}</p>${c.parent?`<p>Compétence parente : ${esc([c.parent.code,c.parent.label].filter(Boolean).join(' · '))}</p>`:''}${c.criteria?.length?`<ul>${c.criteria.map(k=>`<li>${esc([k.code,k.label].filter(Boolean).join(' · '))}</li>`).join('')}</ul>`:''}</div></details>`:`<span class="pill brand-tone" title="${esc(c.label)}">${esc(c.code||c.label)}</span>`;
 return `<div class="session-competencies" aria-label="Compétences de la séance">${items.slice(0,limit).map(badge).join('')}${items.length>limit?`<details class="competency-overflow"><summary class="pill" aria-label="Voir ${items.length-limit} autres compétences">+${items.length-limit}</summary><div class="session-competencies">${items.slice(limit).map(badge).join('')}</div></details>`:''}${teacher&&(!items.length||session.missingCompetencies)?'<small class="muted">Compétences à associer ou à vérifier</small>':''}${teacher&&session.identityNeedsReview?'<small class="muted">Intitulé à valider</small>':''}</div>`;
}
export function SessionIdentity(session,{teacher=false,level=2,metadata=false}={}){
 const tag=[1,2,3,4].includes(level)?'h'+level:'h2';
 const date=session.date?new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(session.date+'T12:00:00Z')):'';
 return `<div class="session-identity"><${tag}>${esc(session.pedagogicalTitle||session.title||'Séance : intitulé pédagogique à valider')}</${tag}>${competencyBadges(session,{teacher})}${metadata?`<p class="muted">${esc([date,session.state].filter(Boolean).join(' · '))}</p>`:''}</div>`;
}
export const competencyKey=r=>JSON.stringify([r.frameworkVersionId||null,r.competencyId]);
// Same picker in the catalogue and the content editor. Labels are always read
// from the server catalogue; only existing reference identifiers are submitted.
export function mountCompetencyPicker(host,{catalog,refs,onChange}){
 let selected=new Set(refs.map(competencyKey));
 host.innerHTML='<label>Rechercher une compétence par code ou intitulé<input type="search" data-competency-search></label><div class="competency-picker" data-competency-choices></div>';
 const input=host.querySelector('input'),choices=host.querySelector('[data-competency-choices]');
 function draw(){const q=input.value.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();choices.innerHTML=catalog.map((c,index)=>({c,index})).filter(({c})=>[c.code,c.label].join(' ').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().includes(q)).map(({c,index})=>`<label class="check-label"><input type="checkbox" data-competency-index="${index}" ${selected.has(competencyKey(c.ref))?'checked':''}>${esc(c.code||'Sans code')} · ${esc(c.label)}${c.framework?` <small>${esc(c.framework)}</small>`:''}</label>`).join('')||'<p>Aucune compétence trouvée.</p>';}
 input.addEventListener('input',draw);choices.addEventListener('change',event=>{const c=catalog[Number(event.target.dataset.competencyIndex)];if(!c)return;const key=competencyKey(c.ref);event.target.checked?selected.add(key):selected.delete(key);onChange(catalog.filter(c=>selected.has(competencyKey(c.ref))).map(c=>c.ref));});draw();
}
