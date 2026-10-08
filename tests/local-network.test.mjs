import test from 'node:test';
import assert from 'node:assert/strict';
import {lanAddress} from '../server/local-network.mjs';

const entry=(address,internal=false)=>({address,internal});
test('LAN selection uses an attached private address and excludes automatic tunnel selection',()=>{
 const interfaces={lo0:[entry('127.0.0.1',true)],en0:[entry('fe80::1'),entry('192.168.1.20')],utun0:[entry('10.9.0.2')]};
 assert.equal(lanAddress({interfaces}),'192.168.1.20');
 for(const address of ['0.0.0.0','127.0.0.1','8.8.8.8','192.168.1.99','::','192.168.1.999'])assert.throws(()=>lanAddress({interfaces,address}),/adresse IPv4 privée/);
 assert.throws(()=>lanAddress({interfaces:{en0:[entry('203.0.113.1')]}}),/Aucun réseau local/);
 interfaces.en1=[entry('172.20.1.2')];
 assert.throws(()=>lanAddress({interfaces}),/Plusieurs réseaux/);
 assert.equal(lanAddress({interfaces,address:'172.20.1.2'}),'172.20.1.2');
});
