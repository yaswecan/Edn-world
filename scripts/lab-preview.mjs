import {spawn,execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
if(process.env.NODE_ENV==='production')throw Error('Laboratoire de recette uniquement.');
const image=execFileSync('docker',['image','inspect','tweenteach-shell:quality-v2','--format','{{.Id}}'],{encoding:'utf8'}).trim();
if(!/^sha256:[a-f0-9]{64}$/.test(image))throw Error('Construisez docker build -t tweenteach-shell:quality-v2 labs.');
const directory=resolve('.data/quality-v2');await mkdir(directory,{recursive:true,mode:0o700});
let previous={};try{previous=JSON.parse(await readFile(resolve(directory,'lab.json'),'utf8'));}catch{}
const config={EDEN_LAB_URL:'http://127.0.0.1:4193',EDEN_LAB_TOKEN:/^[a-f0-9]{64}$/.test(previous.EDEN_LAB_TOKEN||'')?previous.EDEN_LAB_TOKEN:randomBytes(32).toString('hex'),EDEN_LAB_SHELL_IMAGE:image};
try{const dom=execFileSync('docker',['image','inspect','tweenteach-dom:quality-v2','--format','{{.Id}}'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();if(/^sha256:[a-f0-9]{64}$/.test(dom))config.EDEN_LAB_DOM_IMAGE=dom;}catch{/* Optional DOM image remains unavailable until built. */}
await writeFile(resolve(directory,'lab.json'),JSON.stringify(config),{mode:0o600});
const child=spawn('python3',['labs/broker.py'],{stdio:'inherit',env:{...process.env,TWEEN_LAB_TOKEN:config.EDEN_LAB_TOKEN,TWEEN_LAB_IMAGE:image,TWEEN_DOM_IMAGE:config.EDEN_LAB_DOM_IMAGE||'',TWEEN_LAB_PORT:'4193',TWEEN_LAB_STATE:resolve(directory,'lab-state')}});
console.log('Laboratoire de recette : http://127.0.0.1:4193. Configuration privée enregistrée dans .data/quality-v2/lab.json.');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>{process.exitCode=code||0;});
