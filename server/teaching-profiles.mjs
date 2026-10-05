// Reviewed explanations for the first programming sequence. These are content,
// not layouts; every profile uses the same renderer and phase contract.
export const teachingProfiles={
 'BC05-C1-1':{
  objective:'Prévoir la sortie d’une porte logique pour les quatre combinaisons d’entrées.',
  diagram:['A vrai + B vrai → ET → vrai','A vrai + B faux → ET → faux'],
  steps:['Choisis une ligne : elle correspond à une seule combinaison d’entrées.','Lis AND : les deux entrées doivent valoir 1.','Compare OR et XOR sur la ligne 1 / 1. OR vaut 1 ; XOR vaut 0.'],
  hint:'OR accepte aussi deux entrées vraies. XOR demande exactement une entrée vraie.',
  check:'As-tu vérifié 00, 01, 10 et 11 ? Explique la différence OR/XOR sur le cas 11.'
 },
 'BC05-C1-2':{
  objective:'Écrire une condition d’accès et vérifier les cas autorisés et refusés.',
  diagram:['Badge valide + secteur autorisé → ET → Accès autorisé','Une condition fausse → Accès refusé'],
  steps:['Repère les deux informations : badge valide et secteur autorisé.','En Python, and combine les deux conditions. En JavaScript, on écrit &&.','Si une seule condition est fausse, la décision est un refus. Vérifie les quatre combinaisons.'],
  hint:'Écris d’abord la règle en français. Remplace ensuite ET par && et NON par ! en JavaScript.',
  check:'Un badge valide ne doit jamais suffire si le secteur est interdit.'
 },
 'BC05-C1-3':{
  objective:'Écrire une boucle qui parcourt tous les secteurs, y compris le dernier.',
  diagram:['Départ : i = 1 → i ≤ 3 ? → Afficher i','Augmenter i de 1 → Refaire le test → Arrêter si faux'],
  example:'for (let i = 1; i <= 3; i++) {\n  console.log(i);\n}\n// Console : 1, puis 2, puis 3.',
  steps:['Au départ, i vaut 1. Le test 1 <= 3 est vrai : la boucle affiche 1.','i++ ajoute 1. Le même test décide si on recommence pour 2, puis pour 3.','Quand i vaut 4, le test est faux. La boucle s’arrête sans afficher 4.'],
  hint:'Avec i < 3, le dernier nombre affiché serait 2. Choisis la borne à partir de la liste exacte des valeurs attendues.',
  check:'Pour trois secteurs, obtiens-tu exactement 1, 2, 3 ? Essaie aussi avec un seul secteur.'
 },
 'BC05-C1-5':{
  objective:'Parcourir un tableau et construire une nouvelle liste sans modifier l’original.',
  diagram:['Liste de départ → Parcourir chaque élément → Tester la règle → Nouvelle liste'],
  example:'const scores = [8, 14, 11];\nconst retenus = [];\nfor (const score of scores) {\n  if (score >= 10) {\n    retenus.push(score);\n  }\n}\nconsole.log(retenus); // [14, 11]',
  steps:['Le tableau scores contient trois nombres. retenus est vide au départ.','8 ne passe pas le test. 14 et 11 passent : push les ajoute dans retenus.','Le résultat est [14, 11]. Le tableau scores contient toujours [8, 14, 11].'],
  hint:'Distingue le tableau que tu lis et celui que tu construis. Ne retire pas un élément de la liste pendant que tu la parcours.',
  check:'Le résultat contient-il seulement les éléments retenus ? La liste de départ est-elle intacte ?'
 }
};
