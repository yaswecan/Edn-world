import {parentPort,workerData} from 'node:worker_threads';
import {isDeepStrictEqual} from 'node:util';
import {run} from '../../public/programming/runtime.js';
const {task,code}=workerData;
const examples=task.tests.map((t,n)=>{const expected=JSON.parse(t.expectedJSON),r=run(code,{invoke:t.invoke,args:JSON.parse(t.argsJSON)});return {label:task.interactive.testLabels[n],call:t.invoke,expected,actual:r.result,error:r.error,errorCode:r.errorCode,ok:!r.error&&isDeepStrictEqual(r.result,expected)};});
parentPort.postMessage({ok:examples.every(t=>t.ok),pending:examples.some(t=>['LIMIT','UNSUPPORTED'].includes(t.errorCode)),examples,checks:examples.map(t=>({label:t.label,ok:t.ok})),logs:examples.map(t=>`${t.ok?'✓':'↻'} ${t.label} : ${t.error||JSON.stringify(t.actual)}`),error:null});
