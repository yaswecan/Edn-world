import {edenLogo} from './brand.js';

export const hubEscape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sections=[['home','Aujourd’hui','/today'],['lessons','Mes séances','/suivi.html?view=lessons'],['evaluations','Mes évaluations','/suivi.html?view=evaluations'],['competencies','Mes compétences','/suivi.html?view=competencies']];

// A single route policy for headers, loading/error states and detail returns.
export function studentHubRoute(url){
 const {pathname,searchParams:p}=new URL(url,'https://tween.invalid');
 if(pathname==='/arcade'||pathname.startsWith('/world-arcade/'))return {section:'arcade',title:'Mode arcade'};
 if(pathname==='/work-receipt.html')return {section:'evaluations',title:'Mon travail remis',back:sections[2]};
 if(pathname==='/suivi.html'){
  if(p.has('attempt'))return {section:'evaluations',title:'Copie et retours',back:sections[2]};
  if(p.has('assignment'))return {section:'lessons',title:'Travail sauvegardé',back:sections[1]};
  const section=sections.find(([key])=>key===p.get('view'))||sections[1];
  return {section:section[0],title:section[1]};
 }
 return p.has('lesson')||p.has('assignment')?{section:'lessons',title:'Ma séance',back:sections[1]}:{section:'home',title:'Aujourd’hui'};
}

export function StudentHubHeader({session={},url='/today',displayDate,actions=''}={}){
 const route=studentHubRoute(url),items=[...sections];
 if(session.worldArcadeEnabled){const lesson=session.lessonId||new URL(url,'https://tween.invalid').searchParams.get('lesson');items.push(['arcade','Mode arcade','/arcade'+(lesson?'?lesson='+encodeURIComponent(lesson):'')+'#arcade']);}
 const date=displayDate||session.date;
 const dateLabel=date?new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Paris'}).format(new Date(date+'T12:00:00Z')):'';
 return `<div class="student-hub-chrome"><header class="lesson-topbar student-hub-header"><a href="/today" class="lesson-brand" aria-label="EDEN School, aujourd’hui">${edenLogo}${date?`<span class="lesson-brand-meta"><time datetime="${hubEscape(date)}">${hubEscape(dateLabel)}</time></span>`:''}</a><div><span class="lesson-stamp brand-tone">${hubEscape(session.user?.displayName||'Mon espace')}</span>${actions}<button type="button" class="btn" data-action="refresh-student">Actualiser</button><button type="button" class="btn" data-action="logout">Se déconnecter</button></div></header><nav class="student-hub-nav" aria-label="Mon espace">${items.map(([key,label,href])=>`<a class="btn${route.section===key?' is-active':''}" href="${href}"${route.section===key?' aria-current="page"':''}>${label}</a>`).join('')}</nav></div>`;
}

export function StudentHubLayout({session,url='/today',title,content='',workspace=false,displayDate,actions=''}={}){
 const route=studentHubRoute(url);
 return `<div class="lesson-view student-hub">${StudentHubHeader({session,url,displayDate,actions})}<main id="main" tabindex="-1" class="${workspace?'student-hub-workspace':'student-hub-content tracking-page'}">${route.back?`<div class="student-hub-back"><a href="${route.back[2]}">← Retour à ${route.back[1].toLocaleLowerCase('fr')}</a></div>`:''}${title?`<h1 tabindex="-1">${hubEscape(title)}</h1>`:''}${content}</main></div>`;
}

export function StudentHubState({kind='empty',message,action=''}={}){
 const defaults={loading:'Chargement de ton espace…',empty:'Aucun contenu disponible pour le moment.',error:'Impossible de charger ton espace. Réessaie.',forbidden:'Tu n’as pas accès à ce contenu.',unpublished:'Ton professeur prépare les retours. Ils apparaîtront ici après publication.',unobserved:'Aucun résultat de compétence publié pour le moment.'};
 return `<section class="card pad student-hub-state"${kind==='loading'?' aria-busy="true"':''}><p role="${kind==='error'||kind==='forbidden'?'alert':'status'}">${hubEscape(message||defaults[kind])}</p>${action}</section>`;
}
