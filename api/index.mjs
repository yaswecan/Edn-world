import {createApp} from '../server/app.mjs';
import {openStore} from '../server/store.mjs';
import {seedTeacher} from '../server/auth.mjs';
import {seedCatalog} from '../server/game.mjs';
let appPromise;
async function initialize(){if(!process.env.DATABASE_URL)throw Error('DATABASE_URL is required for serverless deployment.');const store=await openStore();await seedTeacher(store);await seedCatalog(store);return createApp(store);}
export default async function handler(req,res){try{appPromise??=initialize().catch(error=>{appPromise=null;throw error;});const app=await appPromise;return app(req,res);}catch(error){console.error('EDEN initialization failed:',error.message);res.statusCode=503;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:'Initialisation indisponible. Vérifiez la configuration serveur.'}));}}
