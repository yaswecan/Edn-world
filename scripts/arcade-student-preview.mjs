// Interactive local preview in disposable memory. An explicit source is read-only;
// --school-accounts allows existing learner passwords, without copying sessions.
import {parseArgs} from 'node:util';
import {studentPreview} from './lib/student-preview.mjs';

if(process.env.NODE_ENV==='production')throw new Error('Cet aperçu est réservé aux tests locaux.');
const port=Number(process.env.EDEN_ARCADE_PREVIEW_PORT||4179);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Port de test invalide.');
const {values}=parseArgs({options:{source:{type:'string'},lesson:{type:'string'},date:{type:'string'},'school-accounts':{type:'boolean'}}});
const fixture=await studentPreview({port,source:values.source,lessonId:values.lesson,date:values.date,schoolAccounts:values['school-accounts']});

// A distinct loopback hostname keeps preview cookies apart from the usual app.
console.log(`Test élève prêt : http://arcade.localhost:${port}/today`);
console.log(`Séance : ${fixture.lesson.title} · ${fixture.lesson.date}`);
console.log(`Lien direct : http://arcade.localhost:${port}/today?lesson=${encodeURIComponent(fixture.lesson.id)}`);
if(fixture.schoolAccounts)console.log(`Connexion avec les identifiants et mots de passe élèves existants : ${fixture.accountsWithAccess} comptes activés. SQLite en mémoire uniquement.`);
else {
 console.log('Compte de test : student-a · classe A1. SQLite en mémoire uniquement.');
 console.log(`Mot de passe de test : ${fixture.password}`);
}
console.log(values.source?'Copie locale de la séance ouverte pour cet essai uniquement. La base source reste en lecture seule.':'Séance de démonstration et comptes fictifs.');
console.log('Les modifications de test sont conservées jusqu’à l’arrêt de ce processus. Ctrl+C pour arrêter.');
let stopping=false;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{
  if(stopping)return;stopping=true;
  await fixture.close();process.exit(0);
});
