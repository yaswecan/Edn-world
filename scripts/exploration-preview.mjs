// Review all assigned catalogue missions through the production launchers.
// No .env, source accounts, production writes or changes to publication state.
import {parseArgs} from 'node:util';
import {studentPreview} from './lib/student-preview.mjs';
import {demoLesson} from '../server/demo-lesson.mjs';
import {catalog,explorationForMission} from '../server/game.mjs';
if(process.env.NODE_ENV==='production'||process.env.VERCEL)throw Error('Recette locale uniquement.');
const {values}=parseArgs({options:{source:{type:'string'},date:{type:'string'}}});
const port=Number(process.env.EDEN_EXPLORATION_PORT||4187);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Port invalide.');
const f=await studentPreview({port,source:values.source,date:values.date});
for(const [world,w] of Object.entries(catalog))for(const m of w.missions){
 const mission=await f.store.get('game_missions',`A1:${world}:${m.id}:v1`),def=explorationForMission(mission),id=`exploration-${world}-${m.id}`,versionId=id+':v1';
 const spec=demoLesson();spec.title=`Recette · ${w.title} · ${m.title}`;spec.lessonId=id;
 spec.codeStation={missionId:mission.id,missionVersion:1,worldId:world,duration:25,required:true,unlockAfter:'',completionRule:'Rétablir la liaison, réparer la commande, puis atteindre la destination finale.',mapId:def.map.id,missionSignature:def.signature};
 await f.store.insert('lesson_versions',{id:versionId,lessonId:id,classId:'A1',version:1,spec});
 await f.store.insert('lessons',{id,classId:'A1',title:spec.title,date:f.lesson.date,version:1,versionId,diagnosticVersionId:versionId,runId:id+':run',status:'published'});
}
console.log(`Recette exploration : http://arcade.localhost:${port}/arcade#arcade`);
console.log(`Séance du jour copiée : http://arcade.localhost:${port}/today?lesson=${encodeURIComponent(f.lesson.id)}`);
console.log('Compte synthétique : student-a · classe A1 · synthetic-test-password');
console.log('20 missions dans le menu de Code Station. Données en mémoire, perdues à l’arrêt. Aucun déploiement.');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{f.server.closeAllConnections();await f.close();process.exit(0);});
