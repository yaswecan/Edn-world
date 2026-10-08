/* Runs in an opaque-origin iframe. Only this bootstrap touches the DOM;
 * student JavaScript runs in a disposable Worker, never in the application.
 * The Blob Worker inherits the frame's CSP, including the additional policy
 * below that denies all script imports once this trusted bootstrap is loaded.
 */
(()=>{
 const policy=document.createElement('meta');policy.httpEquiv='Content-Security-Policy';
 policy.content="script-src 'none'; worker-src blob:; connect-src 'none'";document.head.append(policy);
 let worker,url,timer,started=false;
 const send=data=>parent.postMessage(data,'*');
 const stop=()=>{clearTimeout(timer);worker?.terminate();worker=null;if(url)URL.revokeObjectURL(url);url=null;};
 const finish=data=>{stop();send(data);};
 const engineFailure=()=>finish({type:'error',kind:'engine',message:'Le moteur d’exécution n’a pas pu démarrer. Actualise la page puis réessaie. Si le problème persiste, préviens ton professeur.'});

 // Self-contained: copied into the Worker without eval or Function.
 function bootstrap(completionEvent){
  const send=self.postMessage.bind(self),close=self.close.bind(self);
  const later=self.setTimeout.bind(self),cancel=self.clearTimeout.bind(self);
  const repeat=self.setInterval.bind(self),cancelRepeat=self.clearInterval.bind(self);
  const timers=new Set();let ended=false,check=null,lines=0,size=0,stopped=false,formatBudget=0;
  const logLimit='Trop de messages dans la console. Réduis les console.log() ou le nombre de tours de boucle, puis relance.';
  const fail=message=>{if(stopped)return;stopped=true;send({type:'error',message});close();};
  function format(value,seen=new Set(),depth=0){
   if(++formatBudget>500)return '…';
   if(typeof value==='string')return value.length>4000?value.slice(0,4000)+'…':value;
   if(typeof value==='bigint')return String(value)+'n';
   if(typeof value==='function')return '[fonction'+(value.name?' '+value.name:'')+']';
   if(value===null||typeof value!=='object')return String(value);
   if(seen.has(value))return '[circulaire]';
   if(depth>=5)return Array.isArray(value)?'[…]':'{…}';
   seen.add(value);
   let result;
   if(value instanceof Error)result=value.name+': '+value.message;
   else{
    const array=Array.isArray(value),keys=Object.keys(value).slice(0,50);
    const items=keys.map(key=>{
     const descriptor=Object.getOwnPropertyDescriptor(value,key);
     const item=descriptor&&'value' in descriptor?descriptor.value:undefined;
     const text=descriptor&&'value' in descriptor?(typeof item==='string'?JSON.stringify(format(item)):format(item,seen,depth+1)):'[accesseur]';
     return array?text:JSON.stringify(key)+': '+text;
    });
    if(Object.keys(value).length>keys.length)items.push('…');
    result=(array?'[':'{')+items.join(', ')+(array?']':'}');
   }
   seen.delete(value);return result.length>8000?result.slice(0,8000)+'…':result;
  }
  const log=(...args)=>{
   if(stopped)return;
   // Bound argument traversal as well as the number and size of messages.
   formatBudget=0;const text=args.slice(0,50).map(value=>format(value)).join(' ');
   if(args.length>50||++lines>100||text.length>8000||(size+=text.length)>64000){fail(logLimit);throw new Error(logLimit);}
   send({type:'log',text});
  };
  self.console=Object.freeze({log,info:log,warn:log,error:log,debug:log,clear:()=>{}});
  const settle=()=>{
   if(!ended||timers.size||stopped)return;
   // Leave a brief idle turn for the browser's unhandled-rejection task,
   // which can be dispatched after a zero-delay timer.
   cancel(check);check=later(()=>{if(!timers.size&&!stopped){stopped=true;send({type:'done'});close();}},30);
  };
  self.setTimeout=(fn,delay,...args)=>{
   if(typeof fn!=='function')throw new TypeError('setTimeout attend une fonction.');
   const id=later(()=>{timers.delete(id);try{fn(...args);}finally{settle();}},delay);timers.add(id);return id;
  };
  self.setInterval=(fn,delay,...args)=>{
   if(typeof fn!=='function')throw new TypeError('setInterval attend une fonction.');
   const id=repeat(()=>fn(...args),delay);timers.add(id);return id;
  };
  self.clearTimeout=self.clearInterval=id=>{cancel(id);cancelRepeat(id);timers.delete(id);settle();};
  self.addEventListener('error',event=>{
   event.preventDefault();
   send({type:'runtime-error',message:String(event.message||'Erreur JavaScript.'),line:event.lineno});stopped=true;close();
  });
  self.addEventListener('unhandledrejection',event=>{
   event.preventDefault();
   const error=event.reason,match=String(error?.stack||'').match(/student-code\.js:(\d+):\d+/);
   formatBudget=0;
   send({type:'runtime-error',message:format(error),line:match?Number(match[1]):null});stopped=true;close();
  });
  self.addEventListener(completionEvent,()=>{ended=true;settle();},{once:true});
 }

 window.addEventListener('pagehide',stop);
 window.addEventListener('message',event=>{
  if(event.source!==parent)return;
  if(event.data?.type==='stop'){stop();return;}
  if(event.data?.type!=='run'||started)return;
  started=true;
  const code=event.data.code;
  if(typeof code!=='string'||code.length>100000){finish({type:'error',message:'Le code est trop long. Réduis-le à 100 000 caractères puis relance.'});return;}
  const completionEvent='finished-'+crypto.randomUUID();
  const prelude=`(${bootstrap.toString()})(${JSON.stringify(completionEvent)});\n`,offset=prelude.split('\n').length-1;
  const errorAt=(message,line)=>({type:'error',message:(line>offset?`Ligne ${line-offset} — `:'')+String(message).slice(0,1500)});
  try{
   url=URL.createObjectURL(new Blob([prelude,code,`\n;this.dispatchEvent(new this.Event(${JSON.stringify(completionEvent)}));\n//# sourceURL=student-code.js`],{type:'text/javascript'}));
   worker=new Worker(url);
   timer=setTimeout(()=>finish({type:'error',message:'Durée maximale dépassée (1,5 seconde). Vérifie les conditions de tes boucles, puis relance le code.'}),1500);
   let lines=0,size=0;
   worker.onmessage=({data})=>{
    if(data?.type==='log'&&typeof data.text==='string'){
     if(++lines>100||data.text.length>8000||(size+=data.text.length)>64000){finish({type:'error',message:'Trop de messages dans la console. Réduis les console.log(), puis relance.'});return;}
     send({type:'log',text:data.text});
    }else if(data?.type==='runtime-error')finish(errorAt(data.message,data.line));
    else if(data?.type==='error')finish({type:'error',message:String(data.message).slice(0,1500)});
    else if(data?.type==='done')finish({type:'done'});
   };
   // Syntax errors occur before the bootstrap can install its error listener.
   worker.onerror=event=>{
    event.preventDefault();
    // A CSP-blocked Worker emits a plain Event without a JavaScript error.
    // Do not attribute a failure to start the engine to the student's code.
    if(event.message)finish(errorAt(event.message,event.lineno));else engineFailure();
   };
  }catch{engineFailure();}
 });
 send({type:'ready'});
})();
