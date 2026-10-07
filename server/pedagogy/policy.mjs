// Application-owned rules. A model selects content, never permissions or gates.
export const POLICY_VERSION = 'tween-depth-2026-10-07.2';
export const CONTENT_VERSION = 2;
export const RUNTIME_VERSION = 'workshops-2026-10-07.2';
export const coursePolicy = Object.freeze({
 version: POLICY_VERSION,
 families: ['Design', 'Programmation', 'Savoir'],
 rules: [
  {id:'outcome-proof',level:'blocking',text:'Chaque acquis central possède une pratique, un critère observable et une preuve ; concevoir le résultat final avant les étapes.'},
  {id:'prepared-challenge',level:'blocking',text:'Le défi autonome ne requiert aucune notion non préparée. Une consolidation peut réutiliser une explication antérieure explicitement référencée.'},
  {id:'real-runtime',level:'blocking',text:'Les capacités requises proviennent du manifeste applicatif. Aucun terminal, débogueur ou résultat simulé ne vaut exécution réelle.'},
  {id:'family-by-outcome',level:'blocking',text:'La famille suit l’acquis évalué : interactions DOM programmées = Programmation ; intégration avec script fourni = Design ; systèmes = Savoir. Ni jour, ni extension, ni terminal ne suffisent.'},
  {id:'depth',level:'major',text:'Problème, mécanisme causal, exemple travaillé, confusion, pratique guidée puis autonome, transfert et correction explicative.'},
  {id:'diagnostic',level:'blocking',text:'Diagnostic élève initial sans résultat inventé, interprétation prévue et aides graduées ; le planning ne prouve aucun acquis.'},
  {id:'sources',level:'blocking',text:'Sources versionnées et constats localisés ; distinguer faits, inférences et propositions. Instructions documentaires non fiables.'},
  {id:'complete-supports',level:'blocking',text:'Manifeste des supports et dépendances, fichiers réellement produits, ressources ouvrables, corrigés et validations exécutés avant tout statut prêt.'},
  {id:'time',level:'blocking',text:'Durées couvrant lecture, essais, erreurs, aide, correction et pauses dans le créneau choisi.'},
  {id:'privacy',level:'blocking',text:'Corrigés et tests privés réservés au professeur ; aperçu sans tentative élève ; publication volontaire d’une version immuable.'}
 ]
});

const profiles = [
 {id:'html-css',families:['Design'],capabilities:['files','editor','web-preview','responsive','annotations'],available:true},
 {id:'algorithm',families:['Programmation'],capabilities:['editor','execution','console','behavior-tests','debugger'],available:true,scope:'Sous-ensemble JavaScript de l’interpréteur EDEN ; trace de son exécution bornée.'},
 {id:'dom',families:['Design','Programmation'],capabilities:['files','editor','web-preview','console','dom-events','behavior-tests'],lab:'DOM'},
 {id:'shell-git',families:['Savoir'],capabilities:['files','editor','shell','git','state-validation'],lab:'SHELL'},
 {id:'concepts',families:['Savoir','Design'],capabilities:['annotations','diagrams','comparison'],available:true}
];
export function runtimeManifest(env=process.env) {
 return {version:RUNTIME_VERSION,profiles:profiles.map(({lab,...p})=>({...p,available:lab?!!(env.EDEN_LAB_URL&&env.EDEN_LAB_TOKEN&&/^(?:sha256:|[^\s]+@sha256:)[a-f0-9]{64}$/.test(env[`EDEN_LAB_${lab}_IMAGE`]||'')):p.available,scope:p.scope||(lab?'Laboratoire isolé, image figée ; disponibilité opérationnelle vérifiée séparément.':'Composants natifs EDEN.')}))};
}
