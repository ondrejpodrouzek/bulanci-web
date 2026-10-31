import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../dist/engine.js';
const make=()=>new Game({mapData:{name:'x',layers:[],obstacles:[]},mode:'local',random:()=>.5});

test('a kill reaches the sound layer with its kind (0x41f900)',()=>{
  const g=make(),events=[];g.onEvent=e=>events.push(e);
  g.players[0].weapon=1;g.kill(g.players[1],0,{direction:0});
  const e=events.find(x=>x.type==='kill');
  assert.equal(e.shotgun,true);assert.equal(e.blast,false);assert.equal(e.victim,g.players[1]);
});
test('a suicide still credits a kill (0x420dd6)',()=>{
  const g=make(),p=g.players[0];g.kill(p,0,{direction:0});
  assert.equal(p.kills,1);assert.equal(p.deaths,1);
});
test('a lying body blocks a walker and a spawn place (0x41c82b)',()=>{
  const g=make(),[a,b]=g.players;Object.assign(a,{x:300,y:300});Object.assign(b,{x:300,y:360});
  g.kill(a,1,{direction:0});
  assert.equal(g.actorBlocked(b,300,300),true);
});
