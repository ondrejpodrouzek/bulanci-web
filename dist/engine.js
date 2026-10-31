// Browser reconstruction from the supplied EXE. Exitus undead, six weapon identities,
// sprite anchors, Bedtime script and mine event clocks have recovered source data.
// CShot advances 40px per 50ms on its primary axis; SMG adds a native random perpendicular
// drift (-4..4px/step). Brokovnice is one CShot kind1 carrying a five-pellet mask (0x41df60).
import {WEAPON_DATA,PIPE_NETWORK,MOVEMENT_DATA,SHOT_DATA} from './original-data.js';
import {blocksActors,blocksShots,clipActorAxis,canPlaceActor,segmentRectTime} from './collision.js';
import {actorLayout,bodyResource,actorAnchor,deathChoice,deathSeconds} from './actor-frames.js';
import {isExitus,prepareExitus,updateUndead,resetWander} from './exitus.js';
import {isBedtime,prepareBedtime,createCreatures,updateCreatures,creatureVulnerable,hitCreature} from './bedtime.js';
import {updateTrainingBot,trainingRespawnWeapon,trainingWeaponEnded,armTeleport,TELEPORT_MS} from './training.js';
import {createPowerups,updatePowerups,hasEffect} from './powerups.js';
import {isEightBit,prepareEightBit,createEightBit,updateEightBit,eightBitShotHit} from './eightbit.js';
import {teleporting} from './training.js';
import {resolveRules,refreshScores,afterKill,afterDeath,eliminated} from './rules.js';
import {createPickups,updatePickups,humanDied,weaponEnded} from './pickups.js';
import {defaultHumans,colorCss} from './players.js';
import {createSceneAnims,updateSceneAnims} from './scene-anims.js';
import {placeMine,detonateOwned,startExplosion,updateMines} from './mines.js';
export const W=800,H=515,RADIUS=9;
export const SHOT_SPEED=800;            // confirmed: 40 px / 50 ms
export const BODY_W=55,BODY_H=62;
export const MINE_ARM=2.0; // Original ground-mine activation delay; rectangular trigger in mines.js.
// Exitus undead: native skin, palette, root motion and directional sensors in exitus.js.
// Six original weapon types (0x41dbc0 / table 0x482820 / dispatch 0x420650). ammo, delay,
// resources, pickup, muzzle, events are exact. A CShot has no lifetime: 0x41de60 ends it on a
// hit or once any edge of its rectangle leaves the 800x515 field (l<0, t<0, r>799, b>515).
export const WEAPONS=WEAPON_DATA.map(w=>({
 type:w.type,name:w.name,ammo:w.ammo,delay:w.delay,durationMs:w.durationMs,
 resources:w.resources,pickup:w.pickup,muzzle:w.muzzle,events:w.events,
 shotKind:w.shotKind,shotKinds:w.shotKinds,
}));
// Shotgun CShot kind1 (fire 0x41fdf0 creates a single shot): mask 0x1f = five pellets
// (ctor 0x41ef0c). Each 40px step widens the shot rect by 5px on both perpendicular sides
// (timer 0x419b40). Pellet i sits at edge+trunc((rect-bitmap)*i/4) (0x417b30) and is cleared
// from the mask on its own hit (0x41e016); the shot ends when the mask is empty.
export const outOfField=(x,y,w,h)=>x<0||y<0||x+w>0x31f||y+h>0x203;
export const SHOTGUN_PELLETS=5,SHOTGUN_WIDEN=5;
export function shotPellets(b){
 const out=[];if(!b.mask)return out;const horizontal=b.direction<2;
 for(let i=0;i<SHOTGUN_PELLETS;i++)if(b.mask&(1<<i))out.push(horizontal?{i,x:b.x,y:b.y+Math.trunc((b.height-b.bitmapHeight)*i/4)}:{i,x:b.x+Math.trunc((b.width-b.bitmapWidth)*i/4),y:b.y});
 return out;
}
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function circleRect(x,y,r,o){return (x-clamp(x,o.x,o.x+o.w))**2+(y-clamp(y,o.y,o.y+o.h))**2<r*r;}
export function blocked(x,y,r,obstacles){return x<r||x>W-r||y<r||y>H-r||obstacles.some(o=>blocksActors(o)&&circleRect(x,y,r,o));}
export function segmentDistance(px,py,ax,ay,bx,by){const dx=bx-ax,dy=by-ay;const t=clamp(((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(px-ax-t*dx,py-ay-t*dy);}
// Player collision is a rectangle (CBulanek ctor 0x41e963: body-local [2,25,BODY_W-2,BODY_H]);
// the body sprite top-left is drawn at (x-BODY_W/2, y-BODY_H+12).
export function playerRect(x,y){return {x:x-BODY_W/2+2,y:y-BODY_H+12+25,w:BODY_W-4,h:BODY_H-25};}
export function rectsOverlap(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
export function pointInRect(px,py,r){return px>=r.x&&px<=r.x+r.w&&py>=r.y&&py<=r.y+r.h;}
export function blockedRect(x,y,obstacles){const r=playerRect(x,y);if(r.x<0||r.y<0||r.x+r.w>W||r.y+r.h>H)return true;return obstacles.some(o=>blocksActors(o)&&rectsOverlap(r,o));}
export const DIRECTIONS=[[-1,0],[1,0],[0,-1],[0,1]];
// Native muzzle vectors are relative to the union of body and attached weapon bounds.
export function muzzlePoint(x,y,direction,type,actor={}){const m=WEAPONS[type].muzzle?.[direction];if(!m)return{x,y};const layout=actorLayout({...actor,x,y,direction,weapon:type},type,direction);return{x:layout.originX+m[0],y:layout.originY+m[1]};}
export class Game{
 constructor({mapData,mode='training',humans,duration,gameType,limit,weapons='classic',random=Math.random,onEvent=()=>{}}){this.map=prepareEightBit(prepareBedtime(prepareExitus(mapData,random),random));mapData=this.map;this.npcs=[];this.mode=mode;this.weaponMode=mode==='training'||weapons!=='shotgun'?'classic':'shotgun'; // training forces all weapons (0x4136f9)
  this.random=random;this.onEvent=onEvent;this.rules=resolveRules({mode,gameType:gameType??'time',limit:limit??duration});this.time=this.rules.type==='time'?this.rules.limit:Infinity;this.elapsed=0;this.over=false;this.bullets=[];this.pickups=[];this.mines=[];this.explosions=[];this.pending=[];this.pipes=(mapData&&mapData.source_resource===PIPE_NETWORK.source_resource)?PIPE_NETWORK.pipes:[];this.teleports=[];this.creatures=isEightBit(this.map)?createEightBit(this):createCreatures(this);this.powerups=createPowerups(this);this.sceneAnims=createSceneAnims(this);this.humans=humans??defaultHumans(mode==='training'?1:2);
  // Computers (ids > 3) get a random colour (0x41e7f0); training adds three of them.
  this.players=Array.from({length:mode==='training'?4:this.humans.length},(_,id)=>{const h=this.humans[id],colorIndex=h?h.colorIndex:Math.floor(random()*8);return {id,bot:!h,spawned:false,speedPercent:100,name:h?h.name:'Soupeř '+id,colorIndex,keys:h?.keys,color:colorCss(colorIndex),x:0,y:0,direction:3,dead:0,score:0,kills:0,deaths:0,weapon:0,ammo:[5,0,0,0,0,0],cooldown:0,reloading:0,moving:false,walk:0,think:random()*2,deathElapsed:0};});for(const p of this.players)this.spawn(p);refreshScores(this);
  // Exitus allocates four undead slots; the native initializer enables the first one.
  this.npcs=[];const npcN=(mapData&&mapData.npcs)||0;for(let i=0;i<npcN;i++){const n={id:isExitus(mapData)?32+i:200+i,npc:true,undead:isExitus(mapData),active:!isExitus(mapData)||i===0,spawned:false,speedPercent:isExitus(mapData)?40:100,colorIndex:1+i%3,x:0,y:0,direction:Math.floor(random()*4),dead:0,score:0,deaths:0,weapon:0,ammo:[5,0,0,0,0,0],cooldown:0,reloading:0,moving:false,walk:0,think:random()*0.3,deathElapsed:0,lastShotWeapon:0};this.npcs.push(n);this.spawnNpc(n);}
  this.pickups=createPickups(this);}
 reloadTime(){return this.mode==='local'?0.5:0.15;} // pistol auto-reload: 500 ms 2P / 150 ms solo (0x41e9f0)
 actors(){return this.players.concat(this.npcs);}
 actorBlocked(self,x,y){return !canPlaceActor(x,y,this.map.obstacles,this.actors().filter(a=>a.active!==false),self);}
 spawnPoint(actor){
  const actors=this.actors().filter(a=>a.active!==false);
  for(let i=0;i<128;i++){const x=25.5+Math.floor(this.random()*749),y=25+Math.floor(this.random()*478);if(canPlaceActor(x,y,this.map.obstacles,actors,actor))return{x,y};}
  // A deterministic fallback also handles a constant test RNG without overlapping actors.
  for(let y=25;y<=503;y+=10)for(let x=25.5;x<=774.5;x+=10)if(canPlaceActor(x,y,this.map.obstacles,actors,actor))return{x,y};
  throw new Error('Mapa nemá volné místo pro hráče.');
 }
 spawnNpc(n){const pt=this.spawnPoint(n);Object.assign(n,pt,{spawned:n.active!==false,dead:0,cooldown:0,reloading:0,ammo:n.undead?[5,0,0,0,4,0]:[5,0,0,0,0,0],weapon:n.undead?4:0,direction:Math.floor(this.random()*4),moving:false,walk:0,deathElapsed:0,bodyFrame:0,motion:null,targetId:null,fireAt:null,sensorId:null,sightMasks:null,paused:false,fade:1,fadeMs:undefined});resetWander(this,n);}
 spawn(p,respawn=false){
  // A human keeps the pistol rounds through death (0x41f900 clears only types 1..5).
  // No spawn protection or fire delay: respawn 0x41f770 only shows the actor (0x42c990) and
  // fire 0x4208c0 needs just a visible actor with an idle weapon.
  const keep=respawn&&!p.bot&&!p.npc?{ammo:[p.ammo[0],0,0,0,0,0],reloading:p.ammo[0]>0?0:(p.reloading>0?p.reloading:this.reloadTime())}:{ammo:[5,0,0,0,0,0],reloading:0};
  Object.assign(p,this.spawnPoint(p),{spawned:true,dead:0,cooldown:0,...keep,weapon:0,moving:false,walk:0,deathElapsed:0,bodyFrame:0,motion:null,targetId:null,fireAt:null,sightMasks:null});
  if(p.bot&&respawn&&this.weaponMode==='classic'){p.weapon=trainingRespawnWeapon(this.random);p.ammo[p.weapon]=WEAPONS[p.weapon].ammo;}
  if(p.bot){p.teleportingUntil=null;armTeleport(this,p);}}
 cancelWeaponAction(p,ended=true){p.weaponEpoch=(p.weaponEpoch??0)+1;p.action=null;p.cooldown=0;p.lastShotWeapon=-1;this.finishWeaponAction(p,ended);}
 finishWeaponAction(p,ended=true){p.action=null;p.cooldown=0;if(ended){weaponEnded(this,p);trainingWeaponEnded(this,p);}if(!p.undead&&p.weapon!==0&&p.ammo[p.weapon]<=0){let next=0;for(let i=WEAPONS.length-1;i>0;i--)if(p.ammo[i]>0){next=i;break;}p.weapon=next;}}
 equipWeapon(p,type){if(p.weapon!==type)this.cancelWeaponAction(p);p.weapon=type;p.lastShotWeapon=-1;}
 switchWeapon(id){const p=this.players[id];if(!p||p.dead)return;for(let i=1;i<=WEAPONS.length;i++){const next=(p.weapon+i)%WEAPONS.length;if(next===0||p.ammo[next]>0){this.equipWeapon(p,next);return;}}}
 face(p,direction){if(p.direction!==direction&&p.action)this.cancelWeaponAction(p);p.direction=direction;}
 move(p,input,dt){
  p.moving=input?.direction!==undefined;p.motionBlocked=false;
  if(!p.moving){p.motion=null;return;}
  // +0x16a: while a teleport effect plays the actor cannot turn (0x4197b0).
  if(input.direction!==p.direction&&teleporting(this,p)){p.moving=false;p.motion=null;return;}
  this.face(p,input.direction);
  const resource=bodyResource(p),motion=MOVEMENT_DATA.resources[resource];
  const speed=p.speedPercent??100;
  if(!p.motion||p.motion.resource!==resource){p.motion={resource,frame:0,ms:0};p.bodyFrame=0;}
  const state=p.motion;state.ms+=dt*1000;p.walk+=dt*speed/100;
  let delay=speed===100?motion.frame_delays_ms[state.frame]:Math.trunc(47.25/(speed/100));
  while(state.ms+1e-7>=delay){
   state.ms-=delay;
   const step=motion.cycle[state.frame],others=this.actors().filter(a=>a!==p&&a.spawned!==false&&a.active!==false).map(a=>playerRect(a.x,a.y));
   const obstacles=this.map.obstacles.filter(blocksActors).concat(others);
   const dx=clipActorAxis(playerRect(p.x,p.y),step.delta[0],'x',obstacles);p.x+=dx;
   const dy=clipActorAxis(playerRect(p.x,p.y),step.delta[1],'y',obstacles);p.y+=dy;
   if(dx!==step.delta[0]||dy!==step.delta[1])p.motionBlocked=true;
   state.frame=(state.frame+1)%motion.frame_count;p.bodyFrame=step.visual_frame;
   delay=speed===100?motion.frame_delays_ms[state.frame]:Math.trunc(47.25/(speed/100));
  }
 }
 newBullet(x,y,dir,owner,type,at=this.elapsed,kind=type===4?3:type===5?2:type===1?1:0){
  const [dx,dy]=DIRECTIONS[dir],art=SHOT_DATA[Math.min(kind,3)][dir],drift=kind>=3?Math.min(8,Math.floor(this.random()*9))-4:0;
  const b={x,y,vx:dx*SHOT_SPEED+dy*drift*20,vy:dy*SHOT_SPEED+dx*drift*20,direction:dir,drift,owner,type,shotKind:kind,explodes:type===5,createdAt:at,nextStepAt:at+.05,...art};
  if(kind===1)Object.assign(b,{mask:(1<<SHOTGUN_PELLETS)-1,bitmapWidth:art.width,bitmapHeight:art.height});
  if(!this.advanceBullet(b,x,y,at))this.bullets.push(b);return b;
 }
 scriptShot(x,y,dir,owner=9,at=this.elapsed){return this.newBullet(x,y,dir,owner,0,at);}
 spawnBullet(p,type,dir,crossOffset=0,explodes=false,at=this.elapsed,kind){const[dx,dy]=DIRECTIONS[dir],m=muzzlePoint(p.x,p.y,dir,type,p);return this.newBullet(m.x-dy*crossOffset,m.y+dx*crossOffset,dir,p.id,type,at,kind);}
 // 0x417500: +0x199 (computers, or the ammo power-up) or id >= 4 never spends ammunition.
 freeAmmo(p){return p.undead||p.bot||hasEffect(p,'ammo');}
 shoot(p){
  if(p.dead||p.cooldown>0||(p.weapon===0&&p.reloading>0)||this.over)return;
  const type=p.weapon,w=WEAPONS[type];
  const free=this.freeAmmo(p);
  if(!free&&p.ammo[type]<=0){if(type===0)this.onEvent({type:'sound',bank:4,sample:19,x:p.x});return;}
  if(type===3&&!detonateOwned(this,p))return;
  const epoch=p.weaponEpoch=(p.weaponEpoch??0)+1;
  p.action={weapon:type,startedAt:this.elapsed,epoch};p.lastShotWeapon=type;p.cooldown=w.delay;
  const schedule=(offset,fields)=>this.pending.push({kind:'weapon',owner:p.id,weapon:type,epoch,at:this.elapsed+offset,...fields});
  if(type===4){if(!free)p.ammo[4]--;w.events.forEach(e=>schedule(e.offsetMs/1000,{round:e.event}));}
  else if(type===2||type===5)schedule(.142,{event:0});
  else if(type===1){if(!free)p.ammo[1]--;this.spawnBullet(p,1,p.direction);this.onEvent({type:'shot',player:p,weapon:1});}
  else if(type===0){if(!free)p.ammo[0]--;this.spawnBullet(p,0,p.direction);this.onEvent({type:'shot',player:p,weapon:0});if(p.ammo[0]<=0)p.reloading=this.reloadTime();}
 }
 hit(target,bullet){this.kill(target,bullet.owner,{direction:bullet.direction??(bullet.vx<0?0:bullet.vx>0?1:bullet.vy<0?2:3)});}
 kill(target,ownerId,options={}){if(target.dead)return;if(hasEffect(target,'shield'))return; // death message ignored under +0x19a (0x420d80)
 this.cancelWeaponAction(target,false);target.deathAnchor=actorAnchor(target);const fall=deathChoice(target.direction,options.direction??target.direction,options.blast,target.undead);target.direction=fall.direction;target.deathRes=fall.resource;target.dead=deathSeconds(fall.resource);target.deathElapsed=0;target.deaths++;target.moving=false;humanDied(this,target);const owner=this.actors().find(p=>p.id===ownerId);
 // Message 0xd8 credits the shooter with no check for a suicide (0x420dd6); per-victim kills: record +0xea+4*victim.
 if(owner){owner.kills=(owner.kills??0)+1;(owner.victims??={})[target.id]=(owner.victims[target.id]??0)+1;}
 this.onEvent({type:'kill',player:owner,victim:target,blast:!!options.blast,shotgun:owner?.weapon===1});
  if(owner&&ownerId!==target.id)afterKill(this,owner);afterDeath(this,target);}
 finish(){if(this.over)return;this.over=true;this.onEvent({type:'end'});}
 explode(x,y,ownerId,rect={x:x-1,y:y-1,w:2,h:2},at=this.elapsed){return startExplosion(this,rect,ownerId,at);}
 // First thing a bitmap rect of size w×h meets while its top-left moves (sx,sy)->(ex,ey).
 shotHit(sx,sy,ex,ey,w,h,owner){
  let first=null;
  const consider=(rect,kind,target)=>{const t=segmentRectTime(sx,sy,ex,ey,{x:rect.x-w,y:rect.y-h,w:rect.w+w,h:rect.h+h});if(t!==null&&(!first||t<first.t))first={t,kind,target};};
  for(const pipe of this.pipes)consider(pipe,'pipe',pipe);
  for(const o of this.map.obstacles)if(blocksShots(o)){
   const c=o.creatureId!==undefined?this.creatures.find(c=>c.id===o.creatureId):null;
   consider(o,c&&creatureVulnerable(c)?'creature':'wall',c??o);
  }
  // 0x418300 does not skip the shooter (a pipe can return a shot to it), and CDeath takes over the
  // character's rectangle with +0x69 set (0x41c82b): a lying body stops shots like a wall.
  for(const p of this.actors())if(p.active!==false&&p.spawned!==false)consider(playerRect(p.x,p.y),p.dead>0?'wall':'actor',p.dead>0?{}:p);
  return first;
 }
 advanceShotgun(b,ex,ey,at){
  const before=shotPellets(b),moved=ex!==b.x||ey!==b.y;
  b.x=ex;b.y=ey;
  if(moved){if(b.direction<2){b.y-=SHOTGUN_WIDEN;b.height+=2*SHOTGUN_WIDEN;}else{b.x-=SHOTGUN_WIDEN;b.width+=2*SHOTGUN_WIDEN;}}
  const after=shotPellets(b);
  for(let k=0;k<before.length;k++){const a=before[k],z=after[k];
   const first=this.shotHit(a.x,a.y,z.x,z.y,b.bitmapWidth,b.bitmapHeight,b.owner);
   // Each pellet runs its own 0x41de60 test, field edge included.
   if(first)this.applyShotHit(b,first,at);
   if(first||outOfField(z.x,z.y,b.bitmapWidth,b.bitmapHeight))b.mask&=~(1<<a.i);
  }
  return !b.mask;
 }
 advanceBullet(b,ex,ey,at=this.elapsed){
  if(b.mask!==undefined)return this.advanceShotgun(b,ex,ey,at);
  const first=this.shotHit(b.x,b.y,ex,ey,b.width??0,b.height??0,b.owner);
  if(first){b.x+=(ex-b.x)*first.t;b.y+=(ey-b.y)*first.t;this.applyShotHit(b,first,at);return true;}
  b.x=ex;b.y=ey;return outOfField(b.x,b.y,b.width??0,b.height??0);
 }
 applyShotHit(b,first,at){
   if(first.kind==='pipe'){const pipe=first.target,dir=b.direction??(b.vx<0?0:b.vx>0?1:b.vy<0?2:3);if(dir===pipe.incoming_direction)this.pending.push({kind:'pipe',owner:b.owner,dir:pipe.exit.direction,x:pipe.exit.x,y:pipe.exit.y,type:0,at:at+PIPE_NETWORK.delay_ms/1000});}
   else if(b.explodes)this.explode(b.x,b.y,b.owner,{x:b.x,y:b.y,w:b.width??2,h:b.height??2},at);
   else if(first.kind==='actor')this.kill(first.target,b.owner,{direction:b.direction??(b.vx<0?0:b.vx>0?1:b.vy<0?2:3)});
   else if(first.kind==='creature')hitCreature(this,first.target,b);
   else if(first.target.hitCallback!=null&&this.eight)eightBitShotHit(this,first.target.hitCallback);
 }
 update(dt,inputs=[]){if(this.over)return;dt=clamp(dt,0,.05);this.time=Math.max(0,this.time-dt);this.elapsed+=dt;if(!this.time){this.finish();return;}
  for(const p of this.players){p.cooldown=Math.max(0,p.cooldown-dt);if(p.action&&p.cooldown<=1e-9)this.finishWeaponAction(p);if(p.dead>0){p.deathElapsed+=dt;p.dead-=dt;if(p.dead<=0){if(eliminated(this.rules,p)){p.dead=Infinity;p.active=false;}else this.spawn(p,true);}continue;}if(p.reloading>0){p.reloading-=dt;if(p.reloading<=0){p.reloading=0;p.ammo[0]=WEAPONS[0].ammo;}}if(!p.bot){const input=inputs[p.id]||{};this.move(p,input,dt);
   // 0x4121a0 compares this and the previous DirectInput key state: fire (command 4) is sent only
   // on the press edge, and 0x4208c0 fires only if the weapon is idle at that moment. Holding the
   // key does not repeat.
   if(input.fire&&!p.fireHeld)this.shoot(p);p.fireHeld=!!input.fire;}else updateTrainingBot(this,p);}
  // Events belong to a particular live weapon animation. Turning/switching invalidates it.
  this.pending.sort((a,b)=>a.at-b.at);
  while(this.pending.length&&this.pending[0].at<=this.elapsed+1e-9){const event=this.pending.shift();
   if(event.kind==='pipe'||event.x!=null){this.scriptShot(event.x,event.y,event.dir,event.owner,event.at);continue;}
   const p=this.actors().find(p=>p.id===event.owner);
   if(!p||p.dead>0||p.active===false||p.weapon!==event.weapon||p.weaponEpoch!==event.epoch)continue;
   if(event.weapon===4){this.spawnBullet(p,4,p.direction,0,false,event.at,3+event.round);this.onEvent({type:'shot',player:p,weapon:4,round:event.round,sound:{bank:3,sample:event.round===3?4:3}});}
   else if(event.weapon===2){placeMine(this,p,event.at);if(!this.freeAmmo(p))p.ammo[2]--;}
   else if(event.weapon===5){this.spawnBullet(p,5,p.direction,0,true,event.at);if(!this.freeAmmo(p))p.ammo[5]--;this.onEvent({type:'shot',player:p,weapon:5});}
  }
  if(isEightBit(this.map))updateEightBit(this);else updateCreatures(this);updateMines(this);updatePowerups(this,dt);updateSceneAnims(this);
  this.teleports=this.teleports.filter(t=>this.elapsed-t.at<TELEPORT_MS/1000);
  // Exitus uses the original undead branch, independent of training opponents.
  for(const n of this.npcs){if(n.undead){updateUndead(this,n,dt);continue;}
   n.cooldown=Math.max(0,n.cooldown-dt);if(n.dead>0){n.deathElapsed+=dt;n.dead-=dt;if(n.dead<=0)this.spawnNpc(n);continue;}
   this.move(n,{direction:n.direction},dt);if(n.motionBlocked)n.direction=Math.floor(this.random()*4);
  }
  updatePickups(this);
  for(let i=this.bullets.length-1;i>=0;i--){
   const b=this.bullets[i];let gone=false;
   if(b.nextStepAt===undefined)b.nextStepAt=this.elapsed-dt+.05;
   while(!gone&&b.nextStepAt<=this.elapsed+1e-9){const at=b.nextStepAt;b.nextStepAt+=.05;gone=this.advanceBullet(b,b.x+b.vx*.05,b.y+b.vy*.05,at);}
   if(gone)this.bullets.splice(i,1);
  }
 }
}
