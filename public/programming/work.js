// Shared transport contract. Results are learner observations, never grades.
export function parseWork(answer){
 if(typeof answer!=='string'||answer.length>100000)throw Error('Travail limité à 100 Ko.');
 const w=JSON.parse(answer),keys=['format','code','args','prediction','hints','reflection','responses','attempts','results'];
 if(!w||w.format!=='programming-work-1'||Object.keys(w).some(k=>!keys.includes(k))||typeof w.code!=='string'||w.code.length>10000||typeof w.args!=='string'||w.args.length>16000||typeof w.reflection!=='string'||w.reflection.length>20000||!Number.isInteger(w.hints)||w.hints<0||w.hints>100||!Number.isInteger(w.attempts)||w.attempts<0||w.attempts>100000||w.prediction!==null&&(!Number.isInteger(w.prediction)||w.prediction<0||w.prediction>100)||!w.responses||Array.isArray(w.responses)||typeof w.responses!=='object'||Object.entries(w.responses).some(([k,v])=>!/^choice$|^\d+$/.test(k)||!['number','string'].includes(typeof v)))throw Error('Travail de programmation invalide.');
 if(w.results){const r=w.results;if(Object.keys(r).some(k=>!['code','args','status','passed','certified'].includes(k))||r.code!==w.code||JSON.stringify(JSON.parse(r.args))!==JSON.stringify(JSON.parse(w.args))||r.certified!==false||!['OK','SYNTAX','UNSUPPORTED','LIMIT','RUNTIME','STOPPED','TEST_FAILED'].includes(r.status)||r.passed!==null&&(!Number.isInteger(r.passed)||r.passed<0||r.passed>100))throw Error('Résultats périmés ou invalides. Exécutez à nouveau.');}
 return w;
}
