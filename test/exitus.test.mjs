import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {Game,muzzlePoint,playerRect,rectsOverlap} from '../dist/engine.js';
import {bodyResource,deathResource,actorLayout} from '../dist/actor-frames.js';
import {visibleTarget} from '../dist/exitus.js';
import {MOVEMENT_DATA,SHOT_DATA} from '../dist/original-data.js';
const maps=JSON.parse(readFileSync(new URL('../dist/assets/original/maps.json',import.meta.url)));
function exitus(random=()=>.5){const g=new Game({mapData:maps.exitus,random});g.pickups=[];return g;}
function step(g,n){for(let i=0;i<n;i++)g.update(1/60);}
function isolated(){const g=exitus();g.map.obstacles=[];const n=g.npcs[0];g.players.slice(1).forEach(p=>p.dead=100);Object.assign(n,{x:100,y:250,direction:1,motion:null,bodyFrame:0,wanderAt:1000});Object.assign(g.players[0],{x:500,y:250,cooldown:0});return {g,n,p:g.players[0]};}

test('Exitus allocates original IDs, activates the first undead and uses the original skin and SMG',()=>{
  const g=exitus();assert.equal(g.players.length,4);assert.equal(g.players.filter(p=>p.bot).length,3);assert.deepEqual(g.npcs.map(n=>n.id),[32,33,34,35]);
  assert.equal(g.npcs.filter(n=>n.active).length,1);
  for(const n of g.npcs){assert.equal(n.undead,true);assert.equal(n.speedPercent,40);assert.equal(n.weapon,4);n.direction=0;assert.equal(bodyResource(n),199);assert.equal(deathResource(n),207);}
  const manifest=JSON.parse(readFileSync(new URL('../dist/assets/original/sprites/manifest.json',import.meta.url)));
  assert.deepEqual(manifest.undead_variant.rgb,[95,95,95]);
  // The sheets exist only after an import of the EXE.
  if(existsSync(new URL('../dist/assets/original/sprites/197-undead-sheet.png',import.meta.url)))for(const id of manifest.undead_variant.resources)assert.ok(readFileSync(new URL(`../dist/assets/original/sprites/${id}-undead-sheet.png`,import.meta.url)).length>0);
});
test('spawn positions do not overlap active actors, including with a constant RNG',()=>{
  const g=exitus();for(const n of g.npcs){n.active=true;g.spawnNpc(n);}
  const actors=g.actors();for(let i=0;i<actors.length;i++)for(let j=i+1;j<actors.length;j++)assert.equal(rectsOverlap(playerRect(actors[i].x,actors[i].y),playerRect(actors[j].x,actors[j].y)),false);
});
test('undead movement applies the eight native deltas at 118ms intervals',()=>{
  const {g,n,p}=isolated();p.dead=100;const x=n.x,y=n.y;
  // Direct movement keeps AI turns out of this animation timing test.
  g.move(n,{direction:1},.117);assert.equal(n.x,x);
  g.move(n,{direction:1},.001);assert.equal(n.x,x+MOVEMENT_DATA.resources[201].cycle[0].delta[0]);
  g.move(n,{direction:1},.826);assert.equal(n.x,x+MOVEMENT_DATA.resources[201].cycle_delta[0]);assert.equal(n.y,y);assert.equal(n.bodyFrame,0);
});
test('NPC sight spans the level in four lanes, and solid scenery occludes a player',()=>{
  const {g,n,p}=isolated();p.x=740;assert.equal(visibleTarget(g,n)?.direction,1,'no invented 320px sight cutoff');
  p.y=400;assert.equal(visibleTarget(g,n),null,'diagonal players are outside directional sensors');p.y=250;
  g.map.obstacles=[{x:350,y:200,w:10,h:100}];assert.equal(visibleTarget(g,n),null);
  g.map.obstacles[0].solidForProjectiles=false;assert.equal(visibleTarget(g,n)?.player,p);
});
test('the native sight envelope preserves a lane past a partial obstacle',()=>{
  const {g,n}=isolated();g.map.obstacles=[{x:350,y:200,w:10,h:40}];assert.equal(visibleTarget(g,n)?.direction,1);
  g.map.obstacles.push({x:350,y:245,w:10,h:100});assert.equal(visibleTarget(g,n),null,'both transverse edges expanded by the occluders');
});
test('undead fires a timed four-round SMG burst at the player with original sounds and unlimited magazines',()=>{
  const {g,n,p}=isolated(),events=[];g.onEvent=e=>{if(e.type==='shot'&&e.player===n)events.push(e);};
  step(g,32);assert.equal(events.length,0,'500ms reaction plus 71ms first-round notification');
  step(g,40);assert.deepEqual(events.slice(0,4).map(e=>e.sound),[{bank:3,sample:3},{bank:3,sample:3},{bank:3,sample:3},{bank:3,sample:4}]);
  assert.equal(n.weapon,4);assert.equal(n.ammo[4],4);assert.ok(p.deaths>0,'NPC bullets actually kill the player');
});
test('an undead cannot shoot at a player through a wall',()=>{
  const {g,n}=isolated();g.map.obstacles=[{x:350,y:0,w:1,h:515}];let shots=0;g.onEvent=e=>{if(e.type==='shot'&&e.player===n)shots++;};step(g,100);assert.equal(shots,0);
});
test('river rectangles block walking but allow shots in Exitus',()=>{
  const g=exitus();const river=g.map.obstacles.find(o=>o.x===0&&o.y===140);assert.equal(river.solidForProjectiles,false);
  for(const n of g.npcs)n.active=false;g.players[0].dead=100;
  g.bullets=[{x:30,y:130,vx:0,vy:800,owner:0,life:1,type:0}];step(g,6);assert.equal(g.bullets.length,1);assert.ok(g.bullets[0].y>175);
});
test('an undead death awards one point, returns with its skin and can activate the next dormant slot',()=>{
  const {g,n,p}=isolated();g.random=()=>0;g.kill(n,p.id);g.kill(n,p.id);assert.equal(p.score,1);assert.equal(n.deaths,1);step(g,140);
  assert.equal(n.dead,0);assert.equal(n.undead,true);assert.equal(n.weapon,4);assert.equal(g.npcs.filter(n=>n.active).length,2);
});
test('SMG muzzle uses the body/weapon union and real direction-specific bullet art',()=>{
  const {g,n}=isolated();n.bodyFrame=3;n.cooldown=.3;n.lastShotWeapon=4;
  const l=actorLayout(n),m=muzzlePoint(n.x,n.y,n.direction,4,n);assert.equal(m.x,l.originX+77);assert.equal(m.y,l.originY+33);
  g.spawnBullet(n,4,1);const b=g.bullets[0];assert.equal(b.resource,81);assert.equal(b.width,9);assert.equal(b.height,4);assert.equal(SHOT_DATA[3][1].resource,81);
});
test('swept projectile collisions stop at the nearest contact even for a subpixel wall',()=>{
  const {g,n,p}=isolated();n.active=false;Object.assign(p,{x:500,y:250});g.map.obstacles=[{x:399.7,y:200,w:.1,h:100}];
  g.bullets=[{x:390,y:250,vx:800,vy:0,owner:32,life:1,type:4}];g.update(.05);assert.equal(g.bullets.length,0);assert.equal(p.deaths,0);
});
