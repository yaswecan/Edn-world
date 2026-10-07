import {runSafe} from '/runtime/safe-js.mjs';
self.onmessage=({data})=>{
 try{
  const result=runSafe(data.code,{invoke:data.invoke||null,args:data.args||[],debug:data.debug||null});
  delete result.ast;self.postMessage(result);
 }catch(error){self.postMessage({ok:false,error:error.message,logs:[]});}
};
