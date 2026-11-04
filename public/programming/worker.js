import {run} from './runtime.js';
// Interpreted values have no host bindings. The worker adds termination and a
// separate thread; it is not used as an eval sandbox.
self.onmessage=({data})=>{
 try{
  const cases=data.tests||[{invoke:data.invoke,args:data.args}];
  if(cases.length>100)throw Error('100 tests au maximum.');
  const results=cases.map(t=>{
   const r=run(data.code,{invoke:t.invoke,args:t.args});
   // Do not structured-clone internal function closures returned by student code.
   let result=r.result;try{structuredClone(result);}catch{result='[fonction ou valeur non exportable]';}
   return {...r,result,...data.tests?{expected:t.expected,label:t.label,passed:!r.error&&JSON.stringify(result)===JSON.stringify(t.expected)}:{}};
  });
  self.postMessage({results});
 }catch(e){self.postMessage({error:e.message,errorCode:'RUNTIME'});}
};
