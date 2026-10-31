import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {attachNetServer} from '../net-server.mjs';

function client(port) {
  const ws=new WebSocket(`ws://127.0.0.1:${port}/net`),queue=[],waiters=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data);const w=waiters.findIndex(w=>w.t===m.t);if(w>=0)waiters.splice(w,1)[0].resolve(m);else queue.push(m);};
  return {
    open:new Promise(r=>{ws.onopen=r;}),
    send:m=>ws.send(JSON.stringify(m)),
    next:t=>{const i=queue.findIndex(m=>m.t===t);if(i>=0)return Promise.resolve(queue.splice(i,1)[0]);return new Promise(resolve=>waiters.push({t,resolve}));},
    close:()=>ws.close(),ws,
  };
}

test('sessions: host, list, join, relay, start hides, host leaving closes (net-server.mjs)',async()=>{
  const server=http.createServer();attachNetServer(server);
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
  const host=client(port),guest=client(port);await Promise.all([host.open,guest.open]);
  host.send({t:'host',name:'Bulík',total:2});const hosted=await host.next('hosted');assert.equal(hosted.peer,0);
  guest.send({t:'list'});const {list}=await guest.next('sessions');assert.deepEqual(list,[{id:hosted.id,name:'Bulík',players:1,total:2}]);
  guest.send({t:'join',id:hosted.id});assert.equal((await guest.next('joined')).peer,1);assert.equal((await host.next('peer-join')).peer,1);
  guest.send({t:'send',data:{chat:'ahoj'}});assert.deepEqual(await host.next('msg'),{t:'msg',from:1,data:{chat:'ahoj'}});
  const big='x'.repeat(70000);host.send({t:'send',to:1,data:big});assert.equal((await guest.next('msg')).data.length,70000,'64-bit length frames');
  const third=client(port);await third.open;third.send({t:'join',id:hosted.id});assert.equal((await third.next('error')).text,'Hra je plná.');
  host.send({t:'start'});third.send({t:'list'});assert.deepEqual((await third.next('sessions')).list,[]);
  host.close();await guest.next('closed');
  third.close();guest.close();server.close();
});

import netsock from 'node:net';
const raw=(port,text)=>new Promise(r=>{const c=netsock.connect(port,'127.0.0.1',()=>{c.write(text);setTimeout(()=>{c.destroy();r();},60);});c.on('error',()=>r());});
const upgrade=path=>`GET ${path} HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: a\r\nSec-WebSocket-Version: 13\r\n\r\n`;

test('bad clients cannot take the server down',async()=>{
  const server=http.createServer();attachNetServer(server);
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
  await raw(port,upgrade('//'));await raw(port,upgrade('/jinde'));
  // Unmasked frame, reserved bits, oversized ping, a claimed 8 EiB length.
  for(const bytes of [[0x81,1,65],[0xf1,0x80,0,0,0,0],[0x89,0xfe,1,0,0,0,0,0],[0x81,0xff,127,255,255,255,255,255,255,255,0,0,0,0]])await raw(port,Buffer.concat([Buffer.from(upgrade('/net')),Buffer.from(bytes)]));
  const bad=client(port);await bad.open;
  for(const m of [null,1,[],{t:'host',name:{toString:1},total:{valueOf:1}},{t:'join',id:{}},{t:'send',to:{},data:1},{t:'nic'}])bad.send(m);
  bad.send({t:'list'});assert.equal(Array.isArray((await bad.next('sessions')).list),true,'still answers');
  bad.close();server.close();
});

test('a flood is disconnected, abandoned sessions expire and guests are told',async()=>{
  const server=http.createServer(),state=attachNetServer(server,{gameIdle:40,lobbyIdle:40,sweep:10,heartbeat:1e6});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
  const host=client(port),guest=client(port);await Promise.all([host.open,guest.open]);
  host.send({t:'host',name:'A',total:2});const {id}=await host.next('hosted');guest.send({t:'join',id});await guest.next('joined');
  host.send({t:'start'});await guest.next('closed');await host.next('closed');assert.equal(state.sessions.size,0);
  const flood=client(port);await flood.open;const gone=new Promise(r=>{flood.ws.onclose=r;});for(let i=0;i<400;i++)flood.send({t:'nic'});await gone;
  host.close();guest.close();server.close();
});
