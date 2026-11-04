export function execute(request,{timeout=3000}={}){
 const worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});
 let finish,timer;
 const promise=new Promise(resolve=>{finish=value=>{clearTimeout(timer);worker.terminate();resolve(value);};worker.onmessage=e=>finish(e.data);worker.onerror=e=>finish({error:e.message||'Moteur indisponible.',errorCode:'RUNTIME'});timer=setTimeout(()=>finish({error:'Durée maximale atteinte. La trace peut être incomplète.',errorCode:'LIMIT'}),timeout);worker.postMessage(request);});
 return {promise,stop:()=>finish({error:'Exécution arrêtée à votre demande.',errorCode:'STOPPED'})};
}
