import {createAssessmentMemory} from './helpers/assessment-memory.mjs';
// EXCLUSIVEMENT POUR LES TESTS : pas de persistance, jamais publié par Vercel.
import {createHandler} from '../server/handler.mjs';import {createDevServer} from '../scripts/dev.mjs';import {createMemoryStore} from './helpers/memory-store.mjs';
const env={DATABASE_URL:'postgresql://unit:unit@unit.neon.tech/test',TEACHER_PASSWORD:'TEST-only-teacher-password-123',CLASS_CODE:'TEST-CLASS-261001',CRON_SECRET:'TEST-only-cron-secret-32-characters-minimum'};
const store=createMemoryStore();const s=createDevServer(createHandler({env,store,assessmentStore:createAssessmentMemory(store),log:()=>{}}));s.listen(Number(process.env.PORT||4181),'127.0.0.1',()=>console.log('Serveur de TEST démarré.'));
