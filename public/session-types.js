export const SESSION_TYPES = [
  {id:'web-design',label:'Conception web'},
  {id:'programming',label:'Programmation'},
];
export const PROGRAMMING_TEMPLATES = [
  {id:'tableaux-complet',label:'Tableaux, parcours et fonctions · parcours complet',minutes:360,sessionIds:['s1','s2']},
  {id:'tableaux-s1',label:'Séance 1 · tableaux, for et fonctions',minutes:180,sessionIds:['s1']},
  {id:'tableaux-s2',label:'Séance 2 · while, forEach et décomposition',minutes:180,sessionIds:['s2']},
];
export const sessionTypeLabel=value=>SESSION_TYPES.find(t=>t.id===value)?.label||'À choisir';
export const sessionTypeOptions=(selected='web-design')=>SESSION_TYPES.map(t=>`<option value="${t.id}" ${t.id===selected?'selected':''}>${t.label}</option>`).join('');
export const programmingTemplateOptions=(selected='tableaux-complet')=>PROGRAMMING_TEMPLATES.map(t=>`<option value="${t.id}" ${t.id===selected?'selected':''}>${t.label} · ${t.minutes} min</option>`).join('');
