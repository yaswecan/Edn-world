/** Local HTTP harness using the same API handler as Vercel. It is NOT a production daemon. */
import http from 'node:http';
import {readFile,stat,realpath} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {handle as productionHandle} from '../server/handler.mjs';
const root=fileURLToPath(new URL('../docs',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.mjs':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.pdf':'application/pdf','.txt':'text/plain; charset=utf-8','.json':'application/json; charset=utf-8'};
export function routeFor(path){if(/^\/api\/teacher\/learner\/[^/]+$/.test(path))return 'teacher/learner';return path.replace(/^\/api\//,'');}
export function createDevServer(apiHandler=productionHandle){
 return http.createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path.startsWith('/api/'))return apiHandler(req,res,routeFor(path));
  try{
   if(!['GET','HEAD'].includes(req.method))throw Error('method');
   let target=resolve(root,'.'+decodeURIComponent(path));
   if(target!==root&&!target.startsWith(root+sep))throw Error('path');
   if((await stat(target)).isDirectory())target=resolve(target,'index.html');
   target=await realpath(target);if(!target.startsWith(root+sep))throw Error('path');
   const data=await readFile(target);
   res.writeHead(200,{'Content-Type':mime[extname(target)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(req.method==='HEAD'?undefined:data);
  }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Ressource introuvable.');}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const port=Number(process.env.PORT||4173),host=process.env.HOST||'127.0.0.1';
 const server=createDevServer();server.listen(port,host,()=>console.log(`EDEN : http://${host}:${port}/\nProfesseur : http://${host}:${port}/prof.html`));
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
}
