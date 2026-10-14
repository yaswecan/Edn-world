import {createApp} from '../server/app.mjs';
import {openStore} from '../server/store.mjs';
import {seedTeacher} from '../server/auth.mjs';
import {seedCatalog} from '../server/game.mjs';
import {createServerlessHandler} from '../server/serverless.mjs';

async function initialize(){
 if(!process.env.DATABASE_URL)throw Error('DATABASE_URL is required for serverless deployment.');
 const store=await openStore();
 try {
  await seedTeacher(store);
  await seedCatalog(store);
  return createApp(store);
 }catch(error){await store.close().catch(()=>{});throw error;}
}
export default createServerlessHandler(initialize);
