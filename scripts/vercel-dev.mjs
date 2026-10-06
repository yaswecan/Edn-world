import {createServer} from 'node:http';
import handler from '../api/index.mjs';

// Exercise the deployed handler under `vercel dev`, without starting background jobs.
const server=createServer(handler);
const port=Number(process.env.PORT||3000);
server.listen(port,'127.0.0.1',()=>console.log(`EDEN serverless handler → http://127.0.0.1:${port}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
