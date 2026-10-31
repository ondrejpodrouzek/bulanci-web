import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game,playerRect} from '../dist/engine.js';
const maps=JSON.parse(readFileSync(new URL('../dist/assets/original/maps.json',import.meta.url)));
const map=maps.eightbit;
function level(random=()=>.5,mode='local'){const g=new Game({mapData:map,mode,random});g.pickups=[];g.players.forEach(p=>{p.x=-1000;p.dead=1e9;});return g;}
const run=(g,s)=>{for(let i=0;i<Math.round(s*60);i++)g.update(1/60);};
const hit=(g,id,n=1)=>{const o=g.map.obstacles.find(o=>o.hitCallback===id);for(let i=0;i<n;i++)g.applyShotHit({owner:0},{kind:'wall',target:o},g.elapsed);};
const place=(p,r)=>Object.assign(p,{x:r.x+25.5,y:r.y+25,dead:0}); // collision top-left at r

test('8-bit map is listed with its original floor, scenery and bodies',()=>{
 assert.equal(map.source_resource,323);assert.equal(map.layers[0].resource,100);
 assert.deepEqual(map.layers.map(l=>l.resource),[100,95,101,93,94]);
 const g=level();assert.equal(g.map.obstacles.filter(o=>o.hitCallback!=null).length,5);
 assert.equal(g.creatures.length,6);
});

test('block 254 takes nine hits in three stages, then loses its body (0x71b, 0x4f7)',()=>{
 const g=level(),o=g.creatures.find(c=>c.id===10);let sounds=[];g.onEvent=e=>{if(e.type==='sound')sounds.push(e.sample);};
 hit(g,11,2);assert.equal(o.playing,false,'no stage change yet');
 hit(g,11);assert.equal(o.playing,true);run(g,.2);assert.equal(o.frame,1,'stops on event 0');
 hit(g,11,3);run(g,.2);assert.equal(o.frame,2,'stops on event 1');
 hit(g,11,3);run(g,.5);assert.equal(o.frame,5);assert.equal(o.z,-120,'lies flat');
 assert.equal(g.map.obstacles.some(b=>b.hitCallback===11),false,'body removed');
 assert.deepEqual(sounds,[3,3,3,3,3,3,3,3,4]);
});

test('the caged creature stays idle until block 255 breaks (two hits), then acts on its 3 s timer',()=>{
 const g=level(()=>0);const c=g.eight.creature;
 run(g,3.1);assert.equal(c.playing,false,'cage intact');
 hit(g,17,2);run(g,.5);assert.equal(g.eight.g6,2);
 run(g,3);assert.equal(c.playing,true,'rand(0,2)==0 -> acts');
});

test('body 19 is exposed only between events 0 and 1 of state 2; eight hits kill it (0x87a, 0x8a0)',()=>{
 const g=level(()=>.99);g.eight.g6=2;
 const nineteen=g.map.obstacles.find(o=>o.hitCallback===19),eighteen=g.map.obstacles.find(o=>o.scriptBody===18);
 // state 2 (resource 260): event0 at frame 7 exposes 19, event1 at frame 13 covers it again
 const c=g.eight.creature;
 g.eight.g10=2;c.res=260;c.count=19;c.ms=1083;c.events=[[7,0],[13,1]];c.playing=true;c.from=0;c.startedAt=g.elapsed;c.fired=new Set();eighteen.active=true;
 run(g,.42);assert.equal(nineteen.active,true);assert.equal(eighteen.active,false);
 run(g,.4);assert.equal(nineteen.active,false);assert.equal(eighteen.active,true);
 for(let i=0;i<7;i++)hit(g,19);assert.equal(g.eight.g10,2,'still alive after 7');
 hit(g,19);assert.equal(g.eight.g10,10);assert.equal(c.hidden,true);assert.equal(g.eight.remains.hidden,false);
 run(g,2);assert.equal(eighteen.active,false,'remains finish and leave no body');assert.equal(g.eight.remains.z,-120);
});

test('stepping on a teleport pad moves a human to one of the other two pads (0xc5f, 0xa89, try_move)',()=>{
 const g=level(()=>0),p=g.players[0];let tp=0;g.onEvent=e=>{if(e.type==='teleport')tp++;};
 place(p,{x:40,y:200});g.update(1/60);
 const r=playerRect(p.x,p.y);assert.equal(tp,1);assert.deepEqual([r.x,r.y],[452,77],'rand<5 -> first target (pad 1)');
 run(g,1);assert.equal(tp,1,'arrival on a pad does not bounce');
});

test('the lower strip may provoke an immediate downward attack (0xbd6 -> state 5 -> 0x656)',()=>{
 const g=level(()=>0),p=g.players[0];g.eight.g6=2;let shots=[];
 g.onEvent=e=>{if(e.type==='sound'&&e.bank===0&&e.sample===0)shots.push(g.elapsed);};
 place(p,{x:205,y:200});g.update(1/60);assert.equal(g.eight.g10,5);
 run(g,.7);assert.equal(shots.length,1,'fires at event 1 (frame 10)');
 const b=g.bullets.at(-1)??null;assert.ok(!b||b.resource===96,'8-bit down shot art');
});
