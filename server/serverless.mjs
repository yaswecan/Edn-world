function initializationFailure(error) {
 const quotaExceeded=/\b(?:account|project|database)\b.*\bexceeded\b.*\bquota\b/i.test(error?.message||'');
 if(quotaExceeded)return {
  code:'DATABASE_QUOTA_EXCEEDED',
  error:'Base de données indisponible : le quota de l’hébergeur est dépassé. L’administrateur doit vérifier les limites de la base de données.',
  retryMs:60000
 };
 return {code:'INITIALIZATION_FAILED',error:'Initialisation indisponible. Vérifiez la configuration serveur.',retryMs:5000};
}

// Share startup across concurrent requests and give a failing database time to
// recover. A later request retries automatically after the cooldown.
export function createServerlessHandler(initialize,{now=Date.now,logError=error=>console.error('EDEN initialization failed:',error.message)}={}) {
 let appPromise,failure,retryAt=0;
 function unavailable(res) {
  res.statusCode=503;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Retry-After',String(Math.max(1,Math.ceil((retryAt-now())/1000))));
  res.end(JSON.stringify({error:failure.error,code:failure.code}));
 }
 return async function handler(req,res) {
  if(!appPromise&&failure&&now()<retryAt)return unavailable(res);
  let app;
  try {
   appPromise??=Promise.resolve().then(initialize).catch(error=>{
    appPromise=null;
    failure=initializationFailure(error);
    retryAt=now()+failure.retryMs;
    logError(error);
    throw error;
   });
   app=await appPromise;
  }catch{return unavailable(res);}
  return app(req,res);
 };
}
