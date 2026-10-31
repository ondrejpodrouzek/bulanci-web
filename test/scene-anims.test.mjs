import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../dist/engine.js';
import {MALARIA_BASE_MS,LOOP,CRANE_BASE_MS,CRANE_HOLD_MS} from '../dist/scene-anims.js';
const maps=JSON.parse(readFileSync(new URL('../dist/assets/original/maps.json',import.meta.url),'utf8'));
const run=(g,seconds)=>{for(let i=0;i<Math.round(seconds*60);i++)g.update(1/60);};
const malaria=(random=()=>0)=>new Game({mapData:maps.malaria,mode:'local',random});

test('Malárie: all eight animations stand on frame 0 (create_animation flags 0)',()=>{
 const g=malaria();assert.equal(maps.malaria.animations.length,8);
 assert.ok(maps.malaria.animations.every(a=>a.flags===0&&a.layer===2));
 run(g,4.9);assert.ok(g.sceneAnims.anims.every(a=>a.shown===0&&!a.playing));
});

test('Malárie: timer rand(0..10)*1000+5000 ms repeats and plays every animation once (322 block 0x284)',()=>{
 assert.equal(malaria(()=>0).sceneAnims.timer.period,MALARIA_BASE_MS);
 assert.equal(malaria(()=>.999).sceneAnims.timer.period,15000);
 const g=malaria(()=>0);run(g,5.2);
 assert.ok(g.sceneAnims.anims.every(a=>a.playing&&a.shown>=1),'all started together');
 run(g,4.35);const fly=g.sceneAnims.anims[5];                  // res 253: 52 frames / 3763 ms
 assert.equal(fly.playing,false);assert.equal(fly.shown,fly.frames-1,'stops on its last frame');
 run(g,0.55);assert.ok(fly.playing,'second period starts it again');
});

test('looping animations keep their clock: Vybíjená DJ and Noční směna smoke (flags 3)',()=>{
 assert.ok(maps.disco.animations.every(a=>a.flags&LOOP));
 const smoke=maps.factory.animations.find(a=>a.resource===244);assert.ok(smoke&&smoke.flags&LOOP&&smoke.layer===0);
 assert.equal(new Game({mapData:maps.disco,mode:'local',random:()=>0}).sceneAnims.timer,null,'no script timer');
});

test('Noční směna crane: 30-60 s after the start it lowers the crate, holds 10 s in the furnace, rises (321 0x565/0x6f6/0x3d5)',()=>{
 const sounds=[];const g=new Game({mapData:maps.factory,mode:'local',random:()=>0,onEvent:e=>{if(e.type==='sound')sounds.push(g.elapsed);}});
 const i=maps.factory.animations.findIndex(a=>a.resource===245),c=()=>g.sceneAnims.anims[i];
 const until=(cond,limit=120)=>{const t0=g.elapsed;while(!cond()){g.update(1/60);assert.ok(g.elapsed-t0<limit,'timed out');}return g.elapsed;};
 const fire=until(()=>c().playing);assert.ok(Math.abs(fire-CRANE_BASE_MS/1000)<.05,'first fire 30 s after start (rand 0)');
 assert.equal(sounds.length,1,'level sample 0');
 const held=until(()=>!c().playing);assert.equal(c().shown,60,'stopped on chunk-12 event 0');
 assert.deepEqual([c().dx,c().dy],[287,247],'root motion carried the crate over the furnace');
 const resumed=until(()=>c().playing);assert.ok(Math.abs(resumed-held-CRANE_HOLD_MS/1000)<.1,'held 10 s');assert.equal(sounds.length,2);
 const up=until(()=>!c().playing);assert.equal(c().shown,119,'back up on the last frame');
 const next=until(()=>c().playing);assert.ok(Math.abs(next-up-CRANE_BASE_MS/1000)<.1,'next cycle 30-60 s later');
});
