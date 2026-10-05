import {handle} from '../server/handler.mjs';
export default function handler(req,res) { return handle(req,res,'health'); }
