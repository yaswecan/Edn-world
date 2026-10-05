/** LOCAL TEST ONLY: volatile repository. Never imported by api/, never deployed. */
import {createHandler} from '../server/handler.mjs';
import {createDevServer} from '../scripts/dev.mjs';
import {createMemoryStore} from './helpers/memory-store.mjs';
const env={DATABASE_URL:'postgresql://test:unused@ep-test.neon.tech/unused',
 TEACHER_PASSWORD:'test-professeur-vercel-12345',CLASS_CODE:'test-classe-12345',
 CLASS_ID:'test-e2e',CRON_SECRET:'test-cron-secret-at-least-thirty-two-chars'};
const server=createDevServer(createHandler({env,store:createMemoryStore()}));
server.listen(4173,'127.0.0.1',()=>console.log('LOCAL TEST DOUBLE ONLY http://127.0.0.1:4173'));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>process.exit(0)));
