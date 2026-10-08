/* One disposable Worker per attempt. Student code cannot access the world or
 * MessagePort, import scripts, post validation messages, or run without a limit.
 * The same timeout/log budgets as the lesson code runner apply here.
 */
globalThis.StationChallenge = (() => {
  function workerMain() {
    const send=self.postMessage.bind(self),close=self.close.bind(self);
    for(const name of ['postMessage','importScripts','fetch','XMLHttpRequest','WebSocket'])Object.defineProperty(self,name,{value:()=>{throw Error('Cette action n’est pas disponible dans le terminal.');},writable:false,configurable:false});
    let lines=0,size=0;
    const log=(...args)=>{const text=args.slice(0,20).map(x=>{try{return typeof x==='string'?x:JSON.stringify(x);}catch{return '[Valeur circulaire]';}}).join(' ').slice(0,8000);if(++lines>100||(size+=text.length)>64000)throw Error('Trop de messages dans la console. Réduis les sorties de logs.');send({type:'log',text});};
    self.console=Object.freeze({log,info:log,warn:log,error:log,debug:log});
    self.onmessage=event=>{
      const {code,params,args,invoke}=event.data;
      try {
        const names=Object.keys(params),values=Object.values(params);
        const source=invoke?`${code}\n;return typeof ${invoke} === 'function' ? ${invoke}(...__args) : (()=>{throw Error('Fonction ${invoke} introuvable.');})();`:code;
        const value=Function(...names,'__args',source)(...values,args);
        send({type:'result',value});
      }catch(e){send({type:'error',message:String(e?.message||e).slice(0,2000)});}finally{close();}
    };
    send({type:'ready'});
  }
  function equal(a,b){if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&equal(a[k],b[k]));}
  function setup(m,files,index){
    const input=m.scenarios[index].input,fn=StationModel.fnSpec[m.validator];
    if(fn)return {code:files[fn[0]],params:{},invoke:fn[1],args:fn[2](input)};
    const file={battery:'battery.js',motors:'motors.js',returnArray:'sequence.js'}[m.validator];
    return {code:files[file],params:m.validator==='motors'?{nombreModules:input.nombreModules}:{},args:[]};
  }
  function start(m,files,index,onLog=()=>{}) {
    if(['commandPwd','commandExact','answerExact'].includes(m.validator)){
      const raw=Object.values(files)[0].trim(),command=raw.replace(/\s+/g,' ').replace(/["']/g,'');
      const expected=String(m.scenarios[index].expected).replace(/\s+/g,' ');
      let message=command;
      if(m.validator!=='answerExact')message=command==='pwd'?'/bunker/maintenance':command==='systemctl status bunker-air'?'bunker-air · ventilation active':command==='ping 10.20.0.1'?'Passerelle 10.20.0.1 joignable dans le réseau simulé.':'Commande inconnue dans ce terminal de simulation.';
      onLog(message);return {promise:Promise.resolve({pass:command===expected,value:command,message:command===expected?'Résultat conforme.':'La commande ou la réponse ne correspond pas à la situation.'}),cancel(){}};
    }
    const url=URL.createObjectURL(new Blob([`(${workerMain.toString()})()`],{type:'text/javascript'}));
    let worker,timer,settled=false,finish;const promise=new Promise(resolve=>{
      finish=result=>{if(settled)return;settled=true;clearTimeout(timer);worker?.terminate();URL.revokeObjectURL(url);resolve(result);};
      try{worker=new Worker(url);}catch{finish({pass:false,message:'Exécution indisponible. Ton code est conservé.'});return;}
      timer=setTimeout(()=>finish({pass:false,message:'Le moteur n’a pas démarré. Réessaie cet essai.'}),5000);
      let count=0,length=0;
      worker.onmessage=e=>{
        const r=e.data;if(r.type==='ready'){clearTimeout(timer);timer=setTimeout(()=>finish({pass:false,message:'Temps maximal dépassé (1,5 seconde). Vérifie les conditions de tes boucles.'}),1500);worker.postMessage(setup(m,files,index));return;}
        if(r.type==='log'){if(++count>100||(length+=r.text.length)>64000){finish({pass:false,message:'Trop de messages dans la console.'});return;}onLog(r.text);return;}
        if(r.type==='error'){finish({pass:false,message:r.message});return;}
        if(r.type==='result'){const expected=m.scenarios[index].expected,pass=m.validator==='distance'?typeof r.value==='number'&&Math.abs(r.value-expected)<1e-9:equal(r.value,expected);finish({pass,value:r.value,message:pass?'Résultat conforme.':`Résultat obtenu : ${JSON.stringify(r.value)??'undefined'}. Compare-le au résultat attendu.`});}
      };
      worker.onerror=()=>finish({pass:false,message:'Erreur JavaScript : vérifie la syntaxe et les noms utilisés.'});
    });
    return {promise,cancel(){finish({pass:false,cancelled:true,message:'Essai interrompu.'});}};
  }
  return {start,equal};
})();
