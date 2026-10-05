import {demoLesson} from './demo-lesson.mjs';
import {demoFlexbox} from './demo-flexbox.mjs';
import {testActivityCode} from './workshop-testing.mjs';
import {requireValue} from './store.mjs';
const demos={logic:demoLesson,flexbox:demoFlexbox};
export function demoRoutes(app){
 app.post('/api/demo/lesson/test',async(req,res)=>{
  const {demo,taskId,code}=req.body;
  requireValue(Object.hasOwn(demos,demo),'Démonstration inconnue.');
  requireValue(typeof code==='string'&&code.length<=10000,'Code limité à 10 000 caractères.');
  const spec=demos[demo]();
  const task=[...spec.activities,...spec.diagnostic.tasks].find(a=>a.id===taskId&&a.type==='CodeEditor');requireValue(task,'Exercice inconnu.');
  res.json(await testActivityCode(task,code));
 });
}
