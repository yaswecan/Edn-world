import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('../docs',import.meta.url)));
const args=process.argv.slice(2),arg=(key,fallback)=>{const i=args.indexOf(key);return i>=0?args[i+1]:fallback;};
const port=Number(arg('--port',process.env.PORT||'4173')),host=arg('--host','127.0.0.1');
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Port invalide');
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.pdf':'application/pdf','.txt':'text/plain; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
 try{
  let pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);
  // --prefix permet aussi de vérifier une publication GitHub Pages /nom-du-repo/.
  const prefix=arg('--prefix','');if(prefix){if(!pathname.startsWith(prefix)){res.writeHead(404);res.end('Introuvable');return;}pathname=pathname.slice(prefix.length-1);}
  let target=resolve(root,'.'+pathname);
  if(target!==root&&!target.startsWith(root+sep)){res.writeHead(403);res.end('Accès interdit');return;}
  if((await stat(target)).isDirectory())target=resolve(target,'index.html');
  const data=await readFile(target);
  res.writeHead(200,{'Content-Type':mime[extname(target)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache','Referrer-Policy':'no-referrer'});
  res.end(req.method==='HEAD'?undefined:data);
 }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Ressource introuvable.');}
});
server.listen(port,host,()=>console.log(`EDEN Hub : http://${host}:${port}${arg('--prefix','/')}`));
server.on('error',e=>{console.error(e.message);process.exitCode=1;});
