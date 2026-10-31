import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../dist/engine.js';
import {rollPickup,spawnPickup,pickupAt,spawnPeriod} from '../dist/pickups.js';
const blank={name:'Test',layers:[],obstacles:[]};
const make=(mode='local',weapons='classic',random=()=>.5)=>{const g=new Game({mapData:blank,mode,weapons,random});g.players.forEach(p=>{p.x=-1000;p.dead=1e9;});return g;};
const run=(g,s)=>{for(let i=0;i<Math.round(s*60);i++)g.update(1/60);};

test('nothing lies on the map at the start; spawns every 5 s, or 10 s in training (0x41c1f6)',()=>{
 const g=make();assert.equal(g.pickups.length,0);assert.equal(spawnPeriod(g),5);
 run(g,4.9);assert.equal(g.pickups.length,0);run(g,.2);assert.equal(g.pickups.length,1);
 assert.equal(spawnPeriod(make('training')),10);
});

test('"pouze brokovnice": one shotgun at the start, back on the map when emptied or its holder dies (0x41f1d0)',()=>{
 let k=1;const g=make('local','shotgun',()=>(k=(k*7+3)%101)/101);assert.equal(g.pickups.length,1);assert.equal(g.pickups[0].type,1);
 run(g,30);assert.equal(g.pickups.length,1,'no timer spawns');
 const p=g.players[0],item=g.pickups[0];Object.assign(p,{x:item.x+26,y:item.y+12,dead:0,cooldown:0});g.update(1/60);
 assert.equal(g.pickups.length,0);assert.equal(p.weapon,1);assert.equal(p.shotgunToken,true);
 for(let i=0;i<4;i++){p.cooldown=0;p.fireHeld=false;g.shoot(p);run(g,1);}
 assert.equal(p.ammo[1],0);assert.equal(g.pickups.length,1,'emptied shotgun returns');
 const q=g.pickups[0];Object.assign(p,{x:q.x+26,y:q.y+12});g.update(1/60);assert.equal(p.shotgunToken,true);
 g.kill(p,1);assert.equal(g.pickups.length,1,'holder died: shotgun returns');assert.equal(p.ammo[1],0);
 assert.equal(make('training','shotgun').weaponMode,'classic','training forces all weapons');
});

test('a human loses weapons 1..5 at death but keeps the pistol rounds (0x41f900)',()=>{
 const g=make();const p=g.players[0];Object.assign(p,{x:300,y:250,dead:0,ammo:[3,4,2,0,4,2],weapon:4});
 g.kill(p,1);assert.deepEqual(p.ammo,[3,0,0,0,0,0]);assert.equal(p.weapon,0);
 run(g,2.3);assert.equal(p.dead,0);assert.equal(p.ammo[0],3,'pistol rounds kept after respawn');
});

test('a tick spawns with chance 80/101 (0x41f083)',()=>{
 const tick=first=>{const g=make();const seq=[first];g.random=()=>seq.length?seq.shift():.5;run(g,5.05);return g.pickups.length;};
 assert.equal(tick(79.99/101),1);assert.equal(tick(80/101),0);
});

test('the roll gives shotgun, mine, SMG, rocket or nothing, each 1/5; a lying shotgun turns into the SMG (0x41e350)',()=>{
 const roll=r=>{const g=make('local','classic',()=>r);return rollPickup(g);};
 assert.deepEqual([0,.2,.4,.6,.8].map(roll),[1,2,4,5,null]);
 const g=make('local','classic',()=>0);spawnPickup(g,1);assert.equal(rollPickup(g),4);
});

test('one shotgun at a time and at most seven other weapons (slots 0x64, 0x65..0x6b)',()=>{
 const g=make('local','classic',()=>.3);
 assert.ok(spawnPickup(g,1));assert.equal(spawnPickup(g,1),null);
 for(let i=0;i<7;i++)assert.ok(spawnPickup(g,4),'slot '+i);
 assert.equal(spawnPickup(g,2),null);
});

test('pickup is a rectangle overlap with the actor; the mine adds one, others refill (0x41f0c0, 0x41eba0)',()=>{
 const g=make();const p=g.players[0];Object.assign(p,{x:300,y:250,dead:0,ammo:[5,0,3,0,1,0]});
 g.pickups=[pickupAt(4,p.x+30,p.y)];g.update(1/60);assert.equal(g.pickups.length,1,'no overlap yet');
 g.pickups=[pickupAt(4,p.x+20,p.y)];g.update(1/60);assert.equal(p.ammo[4],4);assert.equal(p.weapon,4);
 g.pickups=[pickupAt(2,p.x-12,p.y-13)];g.update(1/60);assert.equal(p.ammo[2],4);
 g.pickups=[pickupAt(2,p.x-12,p.y-13)];g.update(1/60);assert.equal(p.ammo[2],4,'mine capped at 4');
});
