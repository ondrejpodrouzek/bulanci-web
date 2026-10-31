import test from 'node:test';
import assert from 'node:assert/strict';
import {hostGame,guestGame,packEvent,unpackEvent,snapshot} from '../dist/net.js';
import {Game} from '../dist/engine.js';

// A fake relay: handlers by message kind, posted messages recorded.
function fakeNet(){const handlers=new Map(),posted=[];return {posted,on(t,f){handlers.set(t,f);return()=>handlers.delete(t);},post(data,to,drop){posted.push({data,to,drop});},emit(t,m){handlers.get(t)?.(m);}};}
const blank={name:'Test',layers:[],obstacles:[]};

test('a guest tap between two host ticks still fires once (press counter over the fire edge)',()=>{
  const net=fakeNet(),game=new Game({mapData:blank,mode:'local',random:()=>.5});
  const host=hostGame(net,{game,owners:[0,1]});
  net.emit('input',{from:1,inputs:[{fire:true,presses:1}]});net.emit('input',{from:1,inputs:[{fire:false,presses:1}]});
  assert.equal(host.input(1).fire,true,'the tap is seen on the next tick');
  assert.equal(host.input(1).fire,false,'and only once');
  net.emit('input',{from:1,inputs:[{direction:2,fire:false,presses:1}]});assert.equal(host.input(1).direction,2);
});

test('guest sends input only on change and counts presses',()=>{
  const net=fakeNet(),g=guestGame(net,{start:{map:blank,players:[],rules:{}}});
  g.sendInput([{fire:true}]);g.sendInput([{fire:true}]);g.sendInput([{fire:false}]);g.sendInput([{fire:true}]);
  assert.deepEqual(net.posted.map(p=>p.data.inputs[0].presses),[1,1,2]);
  assert.ok(net.posted.every(p=>p.to===0));
});

test('snapshots and events cross the wire as plain JSON and resolve actors again',()=>{
  const game=new Game({mapData:blank,mode:'local',random:()=>.5});
  const s=snapshot(game);assert.equal(s.players.length,2);assert.equal(JSON.stringify(JSON.parse(JSON.stringify(s))),JSON.stringify(s));
  const e=unpackEvent(JSON.parse(JSON.stringify(packEvent({type:'kill',player:game.players[0],victim:game.players[1]}))),{players:s.players,npcs:[]});
  assert.equal(e.player.id,0);assert.equal(e.victim.id,1);
});

test('a leaving guest stops at once and the last one leaving empties the game',()=>{
  const net=fakeNet(),game=new Game({mapData:blank,mode:'local',random:()=>.5});let empty=0;
  const host=hostGame(net,{game,owners:[0,1],onEmpty:()=>empty++});
  net.emit('input',{from:1,inputs:[{direction:1,fire:true,presses:1}]});assert.equal(host.input(1).direction,1);
  net.emit('peer-leave',{peer:1});assert.deepEqual(host.input(1),{});assert.equal(empty,1);
});

test('a guest cannot forge the host: only peer 0 drives the mirror, bad directions are ignored',()=>{
  const net=fakeNet(),g=guestGame(net,{start:{map:blank,players:[],rules:{}}});
  net.emit('snap',{from:2,s:{time:999}});assert.equal(g.game.time,0);
  net.emit('snap',{from:0,s:{time:5}});assert.equal(g.game.time,5);g.close();
  const h=fakeNet(),game=new Game({mapData:blank,mode:'local',random:()=>.5}),host=hostGame(h,{game,owners:[0,1]});
  h.emit('input',{from:1,inputs:[{direction:'x',presses:0}]});assert.equal(host.input(1).direction,undefined);
});
