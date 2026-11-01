import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../dist/engine.js';
import {loopPoints} from '../dist/game-audio.js';
const make=()=>new Game({mapData:{name:'x',layers:[],obstacles:[]},mode:'training',random:()=>.5});

test('the loop runs from the first to the last sounding sample',()=>{
  const c=new Float32Array(10000).fill(.5);c.fill(0,0,1200);c.fill(0,9700);
  assert.deepEqual(loopPoints(c),{start:1200,end:9700});
});
test('a silent quiet stretch is never trimmed far',()=>{
  const c=new Float32Array(20000);c[10000]=.5;
  assert.ok(loopPoints(c).start<=4096);
});
test('stopping shows frame 0 and restores the walking line (0x417910)',()=>{
  const g=make(),p=g.players[0];Object.assign(p,{x:300,y:300,direction:3});
  for(let i=0;i<6;i++)g.move(p,{direction:3},1/60);
  assert.ok(p.bodyFrame>0);assert.notEqual(p.x,300);
  g.move(p,{},1/60);
  assert.equal(p.bodyFrame,0);assert.equal(p.x,300);assert.ok(p.y>300);
});
test('the clock ticks once per second through the last five (0x419d60)',()=>{
  const g=make(),ticks=[];g.onEvent=e=>{if(e.sample===18)ticks.push(Math.ceil(g.time));};
  g.time=6.5;for(let i=0;i<360;i++)g.update(1/60);
  assert.deepEqual(ticks,[5,4,3,2,1]);
});
