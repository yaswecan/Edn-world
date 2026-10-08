import {activity} from './activity.mjs';

const jsTest=(input,expected)=>({invoke:'main',argsJSON:JSON.stringify([input]),expectedJSON:JSON.stringify(expected)});
const cssTest=(selector,property,value)=>({invoke:({display:`${selector} organise ses enfants avec Flexbox`, 'flex-direction':value==='column'?'Les cartes se placent en colonne':'Les cartes se placent en ligne', 'justify-content':value==='center'?'Le groupe est centré sur l’axe principal':'Le groupe commence au début de l’axe principal', 'align-items':value==='center'?'Les cartes sont centrées sur l’axe transversal':'Les cartes commencent au début de l’axe transversal', gap:`L’espace entre les éléments est de ${value}`, padding:`L’espace intérieur des cartes est de ${value}`, 'flex-wrap':'Les cartes peuvent revenir à la ligne', 'box-sizing':'Le padding et la bordure sont inclus dans la largeur annoncée'}[property]||`${selector} · ${property}`),argsJSON:JSON.stringify({selector,property,value}),expectedJSON:'true'});
const htmlTest=(tag,extra={})=>({invoke:`Élément ${tag}`,argsJSON:JSON.stringify({tag,...extra}),expectedJSON:'true'});
const baseStyle='* { box-sizing: border-box; } body { margin: 20px; font: 16px/1.5 Inter, Arial, sans-serif; color: #162b32; } button { font: inherit; } a { color: #246165; }';
const tiles='<section class="groupe"><article class="tuile">Photo</article><article class="tuile">Lecture</article><article class="tuile">Dessin</article></section>';
const tileStyle='.groupe { min-height: 260px; padding: 16px; border: 2px dashed #53676d; } .tuile { padding: 12px; width: 90px; min-height: 55px; background: #eaf7f7; border: 2px solid #162b32; border-radius: 8px; }';

export const flexProfile={
 title:'Quatre cartes. À toi de les organiser.',
 conceptTitle:'Le parent organise. Les cartes suivent.',
 observationTitle:'Prévois. Change. Observe.',
 objective:'Organiser des cartes avec Flexbox, expliquer les deux axes et vérifier le rendu quand la largeur change.',
 opening:'Des clubs à présenter, des cartes qui s’empilent. Repère leur parent, expérimente les axes, puis construis une page qui reste lisible sur un petit écran.',
 lesson:'Flexbox organise les enfants directs d’un même parent. La déclaration display: flex s’écrit sur ce parent : elle ne s’applique pas à tous ses descendants.\n\nflex-direction choisit l’axe principal. Dans notre page en français, row va de gauche à droite et column de haut en bas. justify-content répartit l’espace sur cet axe ; align-items agit sur l’axe transversal. Les noms des propriétés restent identiques quand la direction change.\n\ngap crée l’espace entre les cartes ; padding crée l’espace à l’intérieur d’une boîte. flex-wrap: wrap autorise un retour à la ligne quand les cartes ne tiennent plus. Grid permet, lui, d’organiser simultanément des lignes et des colonnes.',
 example:'.groupe {\n  display: flex;\n  flex-direction: row;\n  justify-content: center;\n  align-items: center;\n  gap: 16px;\n}',
 diagram:['Parent .groupe → enfants directs .tuile','flex-direction → axe principal → justify-content','Axe transversal → align-items'],
 steps:['Repère .groupe : il contient les trois cartes directement.','Prévois où seront les cartes avec row et justify-content: center.','Dans le laboratoire, change seulement la direction. Compare l’axe avant et après.'],
 hint:'Suis l’axe principal avant de choisir une propriété. En column, justify-content agit verticalement.',
 check:'En passant de row à column, peux-tu montrer l’axe principal et expliquer le déplacement des cartes ?'
};

function flexWorkshops(skills,i){
 const solutions={
  '01-parent':'.groupe { display: flex; }',
  '04-aligner':'.groupe { display: flex; flex-direction: row; justify-content: center; align-items: center; }',
  '02-axes':'.groupe { display: flex; flex-direction: column; justify-content: flex-start; align-items: center; gap: 12px; }',
  '08-refaire':'.clubs { display: flex; flex-wrap: wrap; gap: 16px; }\n.club { display: flex; flex-direction: column; gap: 12px; padding: 20px; }',
  '07-deboguer':'.groupe { display: flex; flex-direction: column; justify-content: center; align-items: flex-start; gap: 24px; }'
 };
 const code=(id,title,instruction,starter,tests,board)=>activity(id,title,instruction,skills,{type:'CodeEditor',starter,correctionMode:'css',tests,reference:solutions[board],expectedEvidence:'Le CSS, le rendu comparé à ta prévision et les tests de vérification.',workshop:{language:'css',document:tiles,style:baseStyle+'\n'+tileStyle,board,prediction:'Avant l’essai, repère le parent et prévois la position des trois cartes.',hints:['Repère le sélecteur qui contient toutes les cartes.','Ne modifie qu’une propriété, puis compare le rendu.'],checks:tests.map(t=>t.invoke)}});
 const guided=[
  code(`guided-${i}`,'01 · Trouve le bon parent','Les trois cartes doivent tenir sur une ligne. Complète la règle de .groupe pour activer Flexbox. Observe le rendu avant de lancer les tests.','.groupe {\n  /* Active la disposition flexible ici. */\n}',[cssTest('.groupe','display','flex')],'01-parent'),
  code(`align-${i}`,'02 · Centre sur les deux axes','Centre les trois cartes horizontalement et verticalement dans .groupe. Garde la direction row. Change une propriété à la fois.','.groupe {\n  display: flex;\n  flex-direction: row;\n  /* Centre sur les deux axes. */\n}',[cssTest('.groupe','display','flex'),cssTest('.groupe','justify-content','center'),cssTest('.groupe','align-items','center')],'04-aligner'),
  code(`direction-${i}`,'03 · Change de direction','Passe en colonne, avec 12px entre les cartes. Place-les au début de l’axe principal et au centre de l’axe transversal.','.groupe {\n  display: flex;\n  flex-direction: row;\n  justify-content: center;\n  align-items: flex-start;\n  gap: 0;\n}',[cssTest('.groupe','flex-direction','column'),cssTest('.groupe','justify-content','flex-start'),cssTest('.groupe','align-items','center'),cssTest('.groupe','gap','12px')],'02-axes')
 ];
 const lab=activity(`lab-${i}`,'Le laboratoire des axes','Prévois le déplacement des cartes. Modifie un seul réglage, lance l’essai, puis compare les positions. Essaie row puis column : les axes changent-ils ?',skills,{type:'Simulator',starter:JSON.stringify({preset:'flexbox'}),duration:12,expectedEvidence:'Deux essais comparés, leurs prévisions et une explication du changement d’axe.',reference:'La direction choisit l’axe principal. justify-content agit sur cet axe ; align-items sur le transversal.'});
 const draw=activity(`sketch-${i}`,'Au feutre · reconstruis les axes','Dessine le parent et trois cartes en colonne. Trace les deux axes et nomme la propriété qui agit sur chacun. Distingue ensuite un gap et un padding. Tu peux dessiner ou décrire les relations dans la légende.',skills,{type:'Blackboard',duration:8,expectedEvidence:'Un schéma légendé : parent, enfants, axe principal, axe transversal et espaces.',reference:'En column : principal vertical / justify-content ; transversal horizontal / align-items ; gap entre enfants, padding intérieur.',workshop:{board:'02-axes',hints:['Dessine d’abord la boîte du parent.','Trace deux flèches perpendiculaires. La direction donne l’axe principal.']}});
 const transfer=code('transfer','Ta production · la page des clubs','Organise quatre clubs dans .clubs : Flexbox, retour à la ligne, gap de 16px. Donne à chaque .club un padding de 20px. Dans chaque carte, empile le contenu avec Flexbox et un gap de 12px. Teste à 360px puis 900px : les textes doivent rester lisibles.','.clubs {\n  /* Organise les quatre cartes. */\n}\n.club {\n  /* Organise le contenu de chaque carte. */\n}',[cssTest('.clubs','display','flex'),cssTest('.clubs','flex-wrap','wrap'),cssTest('.clubs','gap','16px'),cssTest('.club','display','flex'),cssTest('.club','flex-direction','column'),cssTest('.club','gap','12px'),cssTest('.club','padding','20px')],'08-refaire');
 transfer.workshop.document='<h1>À chacun son club.</h1><section class="clubs">'+['Photo','Lecture','Dessin','Cinéma'].map(name=>`<article class="club"><h2>${name}</h2><p>Un atelier pour découvrir, essayer et partager ses idées.</p><a href="#">Découvrir le club</a></article>`).join('')+'</section>';
 transfer.workshop.style=baseStyle+' .club { width: 170px; max-width: 100%; border: 1px solid #cfdddd; border-radius: 12px; background: #eaf7f7; } h2,p { margin: 0; }';
 transfer.workshop.hints=[];transfer.duration=30;
 const extension=code('extension','Mission dépannage · les axes inversés','Le terminal demande des cartes en colonne, centrées verticalement, alignées à gauche et espacées de 24px. Le CSS a gardé le raisonnement d’une ligne. Trouve les trois réglages fautifs et répare-les.','.groupe {\n  display: flex;\n  flex-direction: column;\n  justify-content: flex-start;\n  align-items: center;\n  gap: 0;\n}',[cssTest('.groupe','flex-direction','column'),cssTest('.groupe','justify-content','center'),cssTest('.groupe','align-items','flex-start'),cssTest('.groupe','gap','24px')],'07-deboguer');
 return {guided,lab,draw,transfer,extension,boards:['01-parent','02-axes','05-espaces'],profile:flexProfile};
}

// Small executable contracts cover the programming resources. Their corrections
// stay server-side; public checks describe examples, never carry the answer key.
const javascript={
 'BC05-C1-1':['return input.a || input.b;','La porte AND doit renvoyer true uniquement si a ET b valent true.',[[{a:false,b:false},false],[{a:true,b:false},false],[{a:false,b:true},false],[{a:true,b:true},true]],'return input.a && input.b;'],
 'BC05-C1-2':['return input.badge || input.secteur;','Autorise uniquement un badge valide ET un secteur autorisé.',[[{badge:true,secteur:false},false],[{badge:false,secteur:true},false],[{badge:true,secteur:true},true],[{badge:false,secteur:false},false]],'return input.badge && input.secteur;'],
 'BC05-C1-3':['const secteurs = [];\n  for (let i = 1; i < input.n; i++) secteurs.push(i);\n  return secteurs;','Renvoie tous les secteurs de 1 à n, dernier inclus. Pour n = 0, renvoie une liste vide.',[[{n:0},[]],[{n:1},[1]],[{n:4},[1,2,3,4]]],'const secteurs = []; for (let i = 1; i <= input.n; i++) secteurs.push(i); return secteurs;'],
 'BC05-C1-4':['return input.energie + 5;','energie est un texte numérique. Ajoute un bonus de 5 et renvoie un nombre.',[[{energie:'10'},15],[{energie:'0'},5],[{energie:'25'},30]],'return Number(input.energie) + 5;'],
 'BC05-C1-5':['return input.drones.map(d => d.id);','Renvoie les identifiants des drones dont la batterie est au moins 50. Garde leur ordre.',[[{drones:[]},[]],[{drones:[{id:'A',batterie:49},{id:'B',batterie:50},{id:'C',batterie:90}]},['B','C']]],'return input.drones.filter(d => d.batterie >= 50).map(d => d.id);'],
 'BC05-C1-6':['return { id: input.id, secteur: input.secteur, actif: true };','Construis une fiche avec id, secteur et actif. actif vaut true seulement si batterie est strictement positive.',[[{id:'A',secteur:'Nord',batterie:0},{id:'A',secteur:'Nord',actif:false}],[{id:'B',secteur:'Sud',batterie:20},{id:'B',secteur:'Sud',actif:true}]],'return { id: input.id, secteur: input.secteur, actif: input.batterie > 0 };'],
 'BC05-C1-7':['return input.energie - input.cout;','Calcule l’énergie restante. Le résultat ne peut jamais être négatif.',[[{energie:10,cout:4},6],[{energie:10,cout:10},0],[{energie:4,cout:10},0]],'return Math.max(0, input.energie - input.cout);'],
 'BC06-C2-1':['return input.niveaux;','Convertis les textes numériques en nombres. Remplace les nombres négatifs par 0. Ici les entrées sont toutes des textes numériques.',[[{niveaux:['3','-2','0']},[3,0,0]],[{niveaux:[]},[]]],'return input.niveaux.map(n => Math.max(0, Number(n)));'],
 'BC06-C2-3':['return input.n || 10;','Le défaut vaut 10 uniquement si n est absent. Zéro est une valeur valide à conserver.',[[{n:0},0],[{},10],[{n:3},3]],'return input.n === undefined ? 10 : input.n;'],
 'BCT01-C2-1':['return input.a-input.b<0?0:input.a-input.b;','Refactorise sans changer les clés a et b, ni le résultat. Nomme les valeurs intermédiaires ; garde les trois cas de référence.',[[{a:10,b:4},6],[{a:2,b:2},0],[{a:1,b:4},0]],'return Math.max(0, input.a - input.b);'],
 'BCT02-C3-1':['return input.energie - input.cout;','Répare la fonction : énergie moins coût, avec un minimum de zéro. Prévois les résultats pour un coût inférieur, égal et supérieur.',[[{energie:8,cout:2},6],[{energie:8,cout:8},0],[{energie:8,cout:12},0]],'return Math.max(0, input.energie - input.cout);'],
 'BCT05-C3-2':['return input.niveaux.sort();','Renvoie les niveaux numériques dans l’ordre croissant. Vérifie les doublons, les négatifs et la liste vide. Évite de modifier la liste de départ.',[[{niveaux:[10,2,-1,2]},[-1,2,2,10]],[{niveaux:[]},[]]],'return [...input.niveaux].sort((a, b) => a - b);']
};

function jsWorkshop(r,skills,i){
 const [starter,instruction,cases,solution]=javascript[r.code];
 const task=activity(`guided-${i}`,'Répare, puis teste · '+r.title.split(' // ').at(-1),instruction,skills,{type:'CodeEditor',starter:`function main(input) {\n  ${starter}\n}`,correctionMode:'javascript',tests:cases.map(([input,expected])=>jsTest(input,expected)),reference:`function main(input) { ${solution} }`,expectedEvidence:'La fonction corrigée, les cas de test et une explication de l’erreur.',workshop:{language:'javascript',checks:cases.map(([input,expected])=>`${JSON.stringify(input)} → ${JSON.stringify(expected)}`),hints:[r.questions[0]?.feedback||'Compare une entrée et le résultat attendu.','Vérifie le cas limite avant de modifier une autre ligne.']}});
 const transfer={...structuredClone(task),id:'transfer',title:'Reconstruis sans le modèle',instruction:instruction+'\nRéécris la fonction sans reprendre le code de départ. Compare tes résultats aux cas annoncés.',starter:'function main(input) {\n  // Construis ta solution.\n}',duration:22,workshop:{...task.workshop,hints:[]}};
 // A changed rule makes transfer more than a second copy of the same exercise.
 if(['BC05-C1-1','BC05-C1-2'].includes(r.code)){
  transfer.instruction='Une alarme doit bloquer tous les accès. Écris main(input) : badge ET secteur autorisés, et PAS d’alarme. Teste aussi le cas où tout est valide sauf l’alarme.';
  transfer.tests=[[{badge:true,secteur:true,alarme:false},true],[{badge:true,secteur:true,alarme:true},false],[{badge:false,secteur:true,alarme:false},false],[{badge:true,secteur:false,alarme:false},false]].map(([a,b])=>jsTest(a,b));transfer.reference='return input.badge && input.secteur && !input.alarme;';
  transfer.workshop.checks=['Badge + secteur + aucune alarme → accès.','Alarme active → refus, même avec badge et secteur.','Badge ou secteur absent → refus.'];
 }
 if(r.code==='BC05-C1-3'){
  transfer.instruction='Inverse la patrouille : main({n: 4}) doit renvoyer [4,3,2,1]. Pour 0, renvoie []. Adapte le départ, la condition et la mise à jour.';transfer.tests=[[{n:0},[]],[{n:1},[1]],[{n:4},[4,3,2,1]]].map(([a,b])=>jsTest(a,b));transfer.reference='const out=[]; for(let i=input.n;i>=1;i--) out.push(i); return out;';transfer.workshop.checks=['n=4 → [4,3,2,1]','n=1 → [1]','n=0 → []'];
 }
 transfer.reference=transfer.reference.startsWith('function')?transfer.reference:`function main(input) { ${transfer.reference} }`;
 return {guided:[task],transfer};
}

function webWorkshop(r,skills,i){
 const css=/^BC04-C2|^BC04-C3-2/.test(r.code);
 const configs={
  'BC04-C1-1':['<div>État de NEXUS</div>\n<div>Le secteur est stable.</div>\n<div>Tester le signal</div>',[htmlTest('main'),htmlTest('h1',{text:'État de NEXUS'}),htmlTest('button',{text:'Tester le signal'})]],
  'BC04-C1-2':['<!-- Construis header, main avec h1, puis footer. -->',[htmlTest('header'),htmlTest('main'),htmlTest('h1'),htmlTest('footer')]],
  'BC04-C1-3':['<label>Secteur</label>\n<input id="sector" name="sector">\n<!-- Ajoute un select, une zone de détail et un indicateur. -->',[htmlTest('label',{attribute:'for',value:'sector'}),htmlTest('select'),htmlTest('textarea'),htmlTest('progress')]],
  'BC04-C1-4':['<article id="alerte"><h2>Alerte Nord</h2></article>\n<article id="alerte"><h2>Alerte Sud</h2></article>',[]],
  'BC04-C2-1':['.alert {\n  width: 300px;\n  padding: 20px;\n  border: 2px solid #162b32;\n  /* La largeur totale doit rester 300px. */\n}',[cssTest('.alert','box-sizing','border-box')]],
  'BC04-C2-3':['.alert-card { padding: 16px; background: #eaf7f7; }\n.alert-card--critical { padding: 16px; background: #eaf7f7; }',[]],
  'BC04-C3-2':['.panel { width: 1200px; }\n.cards { display: grid; grid-template-columns: 300px 300px; }',[]],
  'BC04-C4-2':['<title>Page</title>\n<main><div>Signaler une panne</div><p>Le plan des secteurs est indisponible.</p><a href="#">Clique ici</a></main>',[htmlTest('title',{text:'Signaler une panne'}),htmlTest('meta',{attribute:'name',value:'description'}),htmlTest('h1')]],
  'BCT04-C2-1':['<div>Code du sas</div>\n<input id="code" name="code">\n<span>Ouvrir le sas</span>',[htmlTest('label',{attribute:'for',value:'code'}),htmlTest('button',{text:'Ouvrir le sas'})]],
  'BCT06-C1-2':['<main>\n  <h1>Reconnaître une demande suspecte</h1>\n  <!-- Ajoute un avertissement et une action de signalement fictive. -->\n</main>',[htmlTest('aside'),htmlTest('button')]]
 };
 const [starter,tests]=configs[r.code]||[css?'/* Construis les règles demandées. */':'<main>\n  <!-- Construis la page demandée. -->\n</main>',[]];
 const references={
  'BC04-C1-1':'<main><h1>État de NEXUS</h1><p>Le secteur est stable.</p><button>Tester le signal</button></main>',
  'BC04-C1-2':'<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Journal des secteurs</title></head><body><header>Journal des secteurs</header><main><h1>État des secteurs</h1><p>Le signal est stable.</p></main><footer>Équipe NEXUS</footer></body></html>',
  'BC04-C1-3':'<label for="sector">Secteur</label><input id="sector" name="sector"><label for="level">Priorité</label><select id="level"><option>Normale</option><option>Urgente</option></select><label for="detail">Détail</label><textarea id="detail"></textarea><label for="state">Progression</label><progress id="state" value="1" max="4">1 sur 4</progress>',
  'BC04-C2-1':'.alert { width: 300px; padding: 20px; border: 2px solid #162b32; box-sizing: border-box; }',
  'BC04-C4-2':'<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Signaler une panne</title><meta name="description" content="Signaler une panne dans un secteur de NEXUS."></head><body><main><h1>Signaler une panne</h1><p>Le plan des secteurs est indisponible.</p><a href="/signalement">Ouvrir le formulaire de signalement</a></main><!-- Cette page textuelle ne nécessite pas d’image. --></body></html>',
  'BCT04-C2-1':'<label for="code">Code du sas</label><input id="code" name="code"><button>Ouvrir le sas</button>',
  'BCT06-C1-2':'<main><p>SIMULATION · Organisme fictif NEXUS · aucune collecte de données.</p><h1>Reconnaître une demande suspecte</h1><aside>Ne partage pas ton mot de passe. Vérifie la demande auprès du professeur.</aside><button type="button">Signaler cette demande — simulation</button></main>'
 };
 const instruction=r.code==='BC04-C2-1'?'La carte mesure trop large. Garde width: 300px, padding: 20px et la bordure de 2px. Corrige le calcul de la largeur totale pour qu’elle reste à 300px.':r.task;
 const task=activity(`guided-${i}`,'Atelier code · '+r.title.split(' // ').at(-1),instruction,skills,{type:'CodeEditor',starter,tests,correctionMode:tests.length?(css?'css':'html'):'manual',reference:r.proof+'\nExemple : '+r.example,expectedEvidence:r.proof,workshop:{language:css?'css':'html',document:css?'<main class="panel"><section class="cards"><article class="alert alert-card"><h2>Signal du Nord</h2><p>Un contenu long pour observer ce qui se passe quand la place manque.</p></article><article class="alert-card alert-card--critical"><h2>Signal du Sud</h2><p>Deux cartes, les mêmes repères.</p></article></section></main>':'',style:baseStyle,hints:[r.questions[0]?.feedback||'Compare la structure et le résultat.'],checks:tests.length?tests.map(t=>t.invoke):[r.proof]}});
 const transfer={...structuredClone(task),id:'transfer',title:'Produis une nouvelle version',instruction:r.task+'\nNouveau contexte à traiter dans ta production : '+r.transfer,starter:css?'/* Repars du document fourni et écris tes règles. */':'<main>\n  <!-- Ta nouvelle production. -->\n</main>',tests:[],correctionMode:'manual',duration:22,reference:r.proof+'\nVérifier également : '+r.transfer,workshop:{...task.workshop,hints:[]}};
 if(tests.length&&references[r.code])task.reference=references[r.code];
 return {guided:[task],transfer};
}

export function workshopsFor(r,c,i){
 const skills=[c.n3_code];
 if(r?.code==='BC04-C2-2')return flexWorkshops(skills,i);
 let result=javascript[r?.code]?jsWorkshop(r,skills,i):r?.mode==='html'?webWorkshop(r,skills,i):{};
 if(!result.guided){
  if(r?.sequence?.length){const sequence=[...r.sequence];result.guided=[activity(`guided-${i}`,'Remets le processus en mouvement',r.task+'\nReplace les étapes dans l’ordre. Explique ensuite le rôle du passage le plus fragile.',skills,{type:'DragDrop',options:[...sequence.slice(1),sequence[0]],correctionMode:'structured',expectedAnswer:JSON.stringify(sequence),reference:sequence.join(' → '),expectedEvidence:'Un processus ordonné et justifié.'})];}
  else {const questions=(r?.questions||[]).slice(0,3);result.guided=[activity(`guided-${i}`,'Associe les cas aux bons repères',r?.opening||c.n3_label,skills,{type:questions.length?'Matching':'WriteResponse',options:questions.map(q=>[q.prompt,...q.distractors,q.correct].join('|')),correctionMode:questions.length?'structured':'manual',expectedAnswer:JSON.stringify(Object.fromEntries(questions.map((q,j)=>[j,q.correct]))),reference:questions.map(q=>q.feedback).join('\n')||c.observable_criterion,expectedEvidence:'Des associations fondées sur les règles du cours.'})];}
 }
 result.draw=activity(`sketch-${i}`,'Au tableau · rends ton raisonnement visible',`À partir de ce cas : ${r?.example||c.observable_criterion}\nDessine les éléments importants, relie-les avec des flèches et légende les relations. Signale en couleur un endroit où une erreur pourrait se produire. Tu peux aussi décrire ces relations dans la légende.`,skills,{type:'Blackboard',duration:8,reference:r?.proof||c.observable_criterion,expectedEvidence:'Un schéma avec des éléments nommés, des relations expliquées et un point de vigilance.',workshop:{hints:[r?.questions?.[0]?.feedback||c.scaffolding_rule]}});
 result.transfer||=activity('transfer','À toi de produire · un autre cas',`${r?.task||c.expected_trace}\nNouvelle contrainte : ${r?.transfer||'Choisis un contexte différent et vérifie que ta méthode y fonctionne.'}`,skills,{duration:22,expectedEvidence:r?.proof||c.expected_trace,reference:c.observable_criterion});
 // A concrete investigation sheet makes the extension a test construction task.
 result.extension=activity('extension','Défi · construis le cas qui résiste',r?.transfer||'Introduis une contrainte différente et mets ta production à l’épreuve.',skills,{type:'FillBlank',options:['La nouvelle donnée ou contrainte','Le résultat que je prévois','Le résultat observé après mon essai','Ce que je dois modifier et pourquoi'],expectedEvidence:'Un cas nouveau, une prévision, une observation et une décision.',reference:r?.proof||c.observable_criterion});
 if(['BC05-C1-1','BC05-C1-2'].includes(r?.code))result.guided.unshift(activity(`table-${i}`,'Construis les quatre cas','La porte exige les deux entrées vraies. Prévois la sortie pour chaque combinaison avant de lancer le code.',skills,{type:'TruthTable',options:['A=0, B=0','A=0, B=1','A=1, B=0','A=1, B=1'],correctionMode:'structured',expectedAnswer:'{"0":"0","1":"0","2":"0","3":"1"}',reference:'Seul le cas 1 / 1 satisfait ET.',expectedEvidence:'Les quatre sorties de la porte ET.'}));
 return result;
}
