// Add-on levels (.eap): mines, walkers, undead and teleport regions from the level data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../dist/engine.js';
import {levelPicture} from '../dist/ui/counter-screen.js';
import {playerRect} from '../dist/collision.js';

const base={layers:[],obstacles:[],animations:[],custom:true,source_resource:1001};
const game=extra=>new Game({mapData:{...base,...extra},mode:'local',humans:[{name:'A',colorIndex:0},{name:'B',colorIndex:1}]});

test('script mines are there from the start and owned by nobody',()=>{
  const g=game({mines:[{x:100,y:100}]});
  assert.equal(g.mines.length,1);assert.equal(g.mines[0].owner,-1);assert.equal(g.mines[0].armed,false);
});
test('walkers keep their colour, clamped speed and gun; a negative gun is drawn from the table',()=>{
  const g=game({walkers:[{colorIndex:5,speed:60,weapon:5},{colorIndex:1,speed:300,weapon:-1}]});
  const [a,b]=g.npcs;assert.deepEqual([a.id,a.colorIndex,a.speedPercent,a.weapon,a.undead],[36,5,60,5,undefined]);
  assert.equal(b.speedPercent,200);assert.ok([0,1,4,5].includes(b.weapon));
  g.update(1/60,[]);assert.ok(g.freeAmmo(a));
});
test('the undead of native_64: four slots, one awake',()=>{
  const g=game({undead:true});
  assert.equal(g.npcs.length,4);assert.ok(g.npcs.every(n=>n.undead));assert.equal(g.npcs.filter(n=>n.active).length,1);
});
test('a region sends a player to its target once per entry',()=>{
  const g=game({regions:[{x:0,y:0,w:800,h:515,flags:14,targets:[{x:300,y:300}]}]}),[a,b]=g.players;
  b.x=700;b.y=100;a.x=100;a.y=100;g.regionInside=[new Set([b])];
  g.update(1/60,[]);
  const r=playerRect(a.x,a.y);assert.deepEqual([r.x,r.y],[300,300]);
  const at=[a.x,a.y];g.update(1/60,[]);assert.deepEqual([a.x,a.y],at,'staying inside does not repeat it');
});
test('the counter shows the level own picture',()=>{assert.equal(levelPicture({picture:'x.jpg'}),'x.jpg');assert.equal(levelPicture({source_resource:324}),'assets/original/53.png');assert.equal(levelPicture({}),null);});

test('logic audit: undead and walkers decide again when a weapon animation ends (0x421557)',()=>{
  const g=new Game({mapData:{...base,undead:true},mode:'local',humans:[{name:'A',colorIndex:0},{name:'B',colorIndex:1}],random:()=>.9}),n=g.npcs[0];n.direction=0;n.action={};n.wanderAt=999;g.finishWeaponAction(n);assert.equal(n.direction,3);assert.equal(n.wanderAt,999,'the wander timer stays');
});
test('logic audit: a computer teleports right after laying a mine (0x421343), a human does not',()=>{
  const g=new Game({mapData:{...base},mode:'training',humans:[{name:'A',colorIndex:0}]}),[a,b]=g.players;
  for(const [p,moves] of [[a,false],[b,true]]){p.weapon=2;p.ammo[2]=1;p.teleportAt=null;p.teleportingUntil=null;g.shoot(p);const at=[p.x,p.y];for(let i=0;i<20;i++)g.update(1/60,[]);assert.equal(at[0]!==p.x||at[1]!==p.y,moves);}
});
test('logic audit: one human alone keeps the solo rules',()=>{
  const g=new Game({mapData:{...base},mode:'local',humans:[{name:'A',colorIndex:0}],botCount:2});
  assert.ok(g.powerups);assert.equal(g.nextPickupAt,10);
});
