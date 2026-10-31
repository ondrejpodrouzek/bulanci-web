import {pickupAt} from '../dist/pickups.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game,WEAPONS} from '../dist/engine.js';
import {actorLayout} from '../dist/actor-frames.js';
import {placeMine,detonateMine,startExplosion,objectFrame} from '../dist/mines.js';
const maps=JSON.parse(readFileSync(new URL('../dist/assets/original/maps.json',import.meta.url)));
const empty={name:'Test',layers:[],obstacles:[]};
function advance(g,seconds,input=[]){let rest=seconds;while(rest>1e-10){const dt=Math.min(.01,rest);g.update(dt,input);rest-=dt;}}
function bedtime(layout=0){const seq=[layout?.75:.25,.5,.5,.5,.5];const g=new Game({mapData:maps.bedtime,mode:'local',random:()=>seq.shift()??.5});g.pickups=[];for(const p of g.players){p.dead=100;p.x=750;p.y=480;}return g;}
function arena(){const g=new Game({mapData:empty,mode:'local',random:()=>.5});g.pickups=[];Object.assign(g.players[0],{x:100,y:200,direction:1,cooldown:0});Object.assign(g.players[1],{x:700,y:450});return g;}
function mousePlayer(g,side=0){const c=g.creatures.find(c=>c.kind==='mouse'),p=g.players[0];Object.assign(p,{x:c.baseX+(side?-100:170),y:c.baseY+10,dead:0});return {c,p};}

test('Bedtime chooses one of the two original layouts and honors optional scenery',()=>{
  for(const [layout,x] of [[0,568],[1,195]]){const g=bedtime(layout);assert.equal(g.map.layout,layout);assert.equal(g.creatures.find(c=>c.kind==='rabbit').baseX,x);assert.equal(g.map.layers.filter(l=>l.resource===73).length,1);}
  const g=new Game({mapData:maps.bedtime,random:()=>0});assert.deepEqual(g.creatures.map(c=>c.kind),['window']);
});
test('rabbit chooses from all four original idle states on native animation completion',()=>{
  const g=bedtime(),c=g.creatures.find(c=>c.kind==='rabbit');advance(g,.42);assert.equal(c.res,223);assert.equal(c.frame,5);
  advance(g,.01);assert.equal(c.res,225);assert.ok(Math.abs(c.startedAt-.426)<1e-9);advance(g,.5);assert.equal(c.res,225);assert.ok(c.frame>=6&&c.frame<=7);
});
test('rabbit hit plays resource226 once, holds its corpse, and does not award invented points or respawn',()=>{
  const g=bedtime(),c=g.creatures.find(c=>c.kind==='rabbit'),r=c.hitRect,sounds=[];g.onEvent=e=>sounds.push(e);
  g.scriptShot(r.x+r.w+5,r.y+10,0,0);advance(g,.05);assert.equal(c.dead,true);assert.equal(c.res,226);assert.equal(c.frame,0);assert.equal(g.players[0].score,0);
  advance(g,.25);assert.equal(c.frame,3);advance(g,4);assert.equal(c.res,226);assert.equal(c.frame,19);assert.equal(c.ended,true);assert.ok(sounds.some(e=>e.bank===1&&e.sample===1));
});
test('rabbit image bounds are not its vulnerable rectangle, and the log protects it from above',()=>{
  const g=bedtime(),c=g.creatures.find(c=>c.kind==='rabbit');g.scriptShot(c.x-10,c.y+10,1,0);advance(g,.2);assert.equal(c.dead,false);
  g.scriptShot(c.baseX+100,c.baseY-10,3,0);advance(g,.2);assert.equal(c.dead,false);
});
test('mouse emerges, fires horizontally from the original opening, retracts, then waits a discrete cooldown',()=>{
  const g=bedtime(),{c}=mousePlayer(g),events=[];g.onEvent=e=>events.push(e);advance(g,.35);assert.equal(c.state,0);advance(g,.01);assert.equal(c.state,2);
  const b=g.bullets.find(b=>b.owner===9);assert.ok(b);assert.equal(b.x,c.baseX+65);assert.equal(b.y,c.baseY+10);assert.equal(b.vx,800);assert.equal(b.vy,0);
  assert.ok(events.some(e=>e.type==='sound'&&e.bank===1&&e.sample===4));advance(g,.57);assert.equal(c.state,1);advance(g,.36);assert.equal(c.ready,true);assert.ok(Math.abs(c.cooldownAt-10.278)<1e-8);
});
test('mouse can fire left, and does not aim diagonally at a nearby player',()=>{
  const g=bedtime(),{c,p}=mousePlayer(g,1);advance(g,.72);assert.equal(c.ready,true);g.random=()=>.99;c.cooldownAt=g.elapsed;advance(g,.01);assert.equal(c.state,4);advance(g,.36);assert.equal(c.state,6);const b=g.bullets.find(b=>b.owner===9);assert.equal(b.direction,0);
  const h=bedtime(),m=mousePlayer(h).c;h.players[0].y=m.baseY+150;advance(h,.36);assert.equal(m.state,1,'nearby diagonal actor does not keep the mouse exposed');
});
test('mouse is vulnerable only while firing and permanently plays the matching death state',()=>{
  const g=bedtime(),{c}=mousePlayer(g),r=c.hitRect;
  g.scriptShot(r.x+r.w+1,r.y+4,0,0);advance(g,.05);assert.equal(c.dead,false);
  advance(g,.31);assert.equal(c.state,2);g.scriptShot(r.x+r.w+1,r.y+4,0,0);advance(g,.05);assert.equal(c.dead,true);assert.equal(c.state,3);assert.equal(c.res,234);
  advance(g,3);assert.equal(c.res,234);assert.equal(c.frame,5);assert.equal(c.ended,true);
});
test('mushroom window leaves the original projectile gap and animates its original moving detail',()=>{
  const g=bedtime(),c=g.creatures.find(c=>c.kind==='window');advance(g,.1);assert.ok(c.offsetX!==0||c.offsetY!==0);
  const x=c.baseX+100,y=c.baseY+150;g.scriptShot(x-100,y,1,0);advance(g,.2);assert.ok(g.bullets.some(b=>b.x>x));
  g.scriptShot(x,c.baseY+70,3,0);advance(g,.1);assert.equal(g.bullets.some(b=>b.direction===3),false,'upper collision remains solid');
});
test('a player inside the mushroom can fire out left and right, while the roof stops an upward shot',()=>{
  for(const direction of [0,1,2]){const g=bedtime(),c=g.creatures.find(c=>c.kind==='window'),p=g.players[0];Object.assign(p,{dead:0,x:c.baseX+100,y:c.baseY+163,direction,weapon:0,cooldown:0});g.shoot(p);
    if(direction===2)assert.equal(g.bullets.length,0);else{assert.equal(g.bullets.length,1);const b=g.bullets[0];advance(g,.15);assert.ok(direction===0?b.x<c.baseX+27:b.x>c.baseX+180);}
  }
});
test('a mine pickup grants one mine up to capacity4',()=>{
  const g=arena(),p=g.players[0];for(let i=1;i<=5;i++){g.pickups=[pickupAt(2,p.x-12,p.y-13)];g.update(.01);assert.equal(p.ammo[2],Math.min(4,i));}assert.equal(p.ammo[3],0,'no invented automatic detonator grant');
});
test('mine is created and consumed at142ms, uses ground177 and arms2000ms later',()=>{
  const g=arena(),p=g.players[0];p.weapon=2;p.ammo[2]=4;g.shoot(p);advance(g,.141);assert.equal(g.mines.length,0);assert.equal(p.ammo[2],4);advance(g,.001);
  const m=g.mines[0],l=actorLayout(p,2);assert.equal(m.resource,177);assert.equal(m.x,l.originX+27);assert.equal(m.y,l.originY+33);assert.equal(p.ammo[2],3);assert.equal(m.armAt,2.142);
  p.x=400;p.y=400;advance(g,1.1);assert.equal(objectFrame(m,g.elapsed),15);advance(g,.89);assert.equal(m.armed,false);advance(g,.01);assert.equal(m.armed,true);assert.equal(objectFrame(m,g.elapsed),15);
});
test('the owner triggers a mine at activation and dies only at the142ms explosion damage frame',()=>{
  const g=arena(),p=g.players[0];p.weapon=2;const m=placeMine(g,p);p.x=m.x+15;p.y=m.y+9;advance(g,1.999);assert.equal(g.explosions.length,0);advance(g,.001);assert.equal(g.mines.length,0);assert.equal(g.explosions.length,1);assert.equal(p.dead,0);
  advance(g,.141);assert.equal(p.dead,0);advance(g,.001);assert.ok(p.dead>0);assert.equal(p.deaths,1);
});
test('mine trigger is strict rectangle overlap, including the owner, not player-center distance',()=>{
  const g=arena(),p=g.players[0],m=placeMine(g,p);m.armAt=0;p.x=m.x+31+10+25.5;p.y=m.y+9;g.update(.01);assert.equal(g.mines.length,1,'edge contact does not trigger');p.x-=.01;g.update(.01);assert.equal(g.mines.length,0);
});
test('detonator ignores unarmed mines, preserves itself after partial detonation and consumes only after all succeed',()=>{
  const g=arena(),p=g.players[0];p.weapon=3;p.ammo[3]=1;g.shoot(p);assert.equal(p.cooldown,0);assert.equal(p.ammo[3],1);
  const a=placeMine(g,p),b=placeMine(g,p);a.armed=true;b.armed=false;g.shoot(p);assert.equal(a.dead,true);assert.equal(b.dead,false);assert.equal(p.ammo[3],1);g.cancelWeaponAction(p);b.armed=true;g.shoot(p);assert.equal(b.dead,true);assert.equal(p.ammo[3],0);
});
test('explosion uses 15-step rays, delayed chain reactions and original removal710ms',()=>{
  const g=arena(),p=g.players[1],owner=g.players[0];owner.x=50;owner.y=50;const e=startExplosion(g,{x:285,y:291,w:31,h:18},0);const center={x:e.x+50,y:e.y+42};p.x=center.x+110;p.y=center.y;
  advance(g,.141);assert.equal(p.dead,0);advance(g,.001);assert.ok(p.dead>0,'native ray reaches a collision rectangle beyond the old46px circle');advance(g,.568);assert.equal(g.explosions.length,0);
  const h=arena();h.players.forEach(p=>{p.dead=100;});h.map.obstacles=[{x:200,y:200,w:100,h:100}];const a={x:250,y:250,w:31,h:18,owner:0,armed:true,dead:false},b={x:330,y:250,w:31,h:18,owner:1,armed:true,dead:false};h.mines=[a,b];detonateMine(h,a);advance(h,.141);assert.equal(b.dead,false);advance(h,.001);assert.equal(b.dead,true);assert.equal(h.explosions.length,2);assert.ok(h.explosions[1].damageAt>h.elapsed);
});
test('SMG clocks all four events, kinds3..6 and final sound; release does not interrupt the burst',()=>{
  const g=arena(),p=g.players[0],events=[];p.weapon=4;p.ammo[4]=1;g.onEvent=e=>{if(e.type==='shot')events.push({...e,at:g.elapsed});};g.shoot(p);
  advance(g,.07);assert.equal(events.length,0);advance(g,.001);assert.equal(events.length,1);advance(g,.426);assert.equal(events.length,4);assert.deepEqual(events.map(e=>e.sound.sample),[3,3,3,4]);assert.deepEqual(g.bullets.map(b=>b.shotKind),[3,4,5,6]);assert.equal(p.weapon,4);
  advance(g,.07);assert.equal(p.weapon,4);advance(g,.001);assert.equal(p.weapon,0,'native single-play ends at568ms, not header639ms');
});
test('plain ID255 scenery does not occlude native explosion rays, while an explicitly named blocker can',()=>{
  for(const named of [false,true]){const g=arena(),p=g.players[1];g.players[0].x=30;g.players[0].y=30;const e=startExplosion(g,{x:285,y:291,w:31,h:18},0);const cx=e.x+50,cy=e.y+42;p.x=cx+110;p.y=cy;g.map.obstacles=[{x:cx+20,y:cy-100,w:5,h:200,explosionBlocker:named}];advance(g,.142);assert.equal(p.dead>0,!named);}
});
test('the first player hit stops the native explosion ray before another player behind it',()=>{
  const g=arena(),e=startExplosion(g,{x:285,y:291,w:31,h:18},0),cx=e.x+50,cy=e.y+42;
  Object.assign(g.players[0],{x:cx+40,y:cy});Object.assign(g.players[1],{x:cx+110,y:cy});advance(g,.142);
  assert.ok(g.players[0].dead>0);assert.equal(g.players[1].dead,0);
});
test('turning or switching weapon cancels the rest of an SMG burst and consumes no extra magazine',()=>{
  for(const action of ['turn','switch']){const g=arena(),p=g.players[0],events=[];p.weapon=4;p.ammo[4]=4;g.onEvent=e=>{if(e.type==='shot')events.push(e);};g.shoot(p);advance(g,.08);if(action==='turn')g.move(p,{direction:2},.01);else g.switchWeapon(0);advance(g,.5);assert.equal(events.length,1);assert.equal(p.ammo[4],3);}
});
test('SMG projectiles advance40px at native50ms ticks with one recovered perpendicular drift',()=>{
  const g=arena(),p=g.players[0];p.weapon=4;g.random=()=>.99;const b=g.spawnBullet(p,4,1),x=b.x,y=b.y;advance(g,.049);assert.equal(b.x,x);advance(g,.001);assert.equal(b.x,x+40);assert.equal(b.y,y+4);advance(g,.05);assert.equal(b.x,x+80);assert.equal(b.y,y+8);
  assert.equal(WEAPONS[4].delay,.568);
});
test('a bullet can skim a wall edge and contacts at the next tick after an edge-only endpoint',()=>{
  const g=arena();g.map.obstacles=[{x:100,y:204,w:400,h:20}];const b=g.newBullet(150,200,1,0,4);advance(g,.1);assert.equal(g.bullets.length,1);assert.equal(b.x,230);
  const h=arena();h.map.obstacles=[{x:199,y:190,w:10,h:30}];h.newBullet(150,200,1,0,4);advance(h,.05);assert.equal(h.bullets.length,1);advance(h,.05);assert.equal(h.bullets.length,0);
});
