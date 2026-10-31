// CBulanek Exitus branch, recovered from the supplied EXE. Evidence in exitus-re.md.
import {EXITUS_DATA} from './original-data.js';
import {playerRect,rectsOverlap,blocksShots} from './collision.js';
export const isExitus = map => map?.source_resource===324;
const rect=([l,t,r,b])=>({x:l,y:t,w:r-l,h:b-t});

export function prepareExitus(map,random) {
  if(!isExitus(map))return map;
  const d=EXITUS_DATA;
  const layers=[{x:0,y:0,resource:102,fg:false}];
  for(const s of d.pairedScenery) {
    const [x,y]=s.position;
    layers.push({x,y,resource:s.floorBitmap,fg:false});
    layers.push({x,y,resource:s.foregroundBitmap,fg:true,z:s.z});
  }
  for(const s of d.decorations)if(Math.floor(random()*6)!==0)layers.push({x:s.position[0],y:s.position[1],resource:s.bitmap,fg:true,overlay:true});
  const obstacles=d.bulletPassRects.map(r=>({...rect(r),solidForProjectiles:false}));
  obstacles.push(...d.solidRects.map(rect),...d.pairedScenery.flatMap(s=>s.rectsAbsolute.map(rect)));
  return {...map,layers,obstacles,npcs:4};
}

// Native sensors extend the actor's collision rectangle to the corresponding map edge.
export function sightCorridor(n,p) {
  if(!p||p.dead>0||p.active===false)return null;
  const a=playerRect(n.x,n.y),b=playerRect(p.x,p.y);
  let direction,c;
  if(a.y<b.y+b.h&&a.y+a.h>b.y) {
    if(b.x+b.w<=a.x){direction=0;c={x:b.x+b.w,y:Math.max(a.y,b.y),w:a.x-b.x-b.w,h:Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)};}
    else if(b.x>=a.x+a.w){direction=1;c={x:a.x+a.w,y:Math.max(a.y,b.y),w:b.x-a.x-a.w,h:Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)};}
  }
  if(direction===undefined&&a.x<b.x+b.w&&a.x+a.w>b.x) {
    if(b.y+b.h<=a.y){direction=2;c={x:Math.max(a.x,b.x),y:b.y+b.h,w:Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x),h:a.y-b.y-b.h};}
    else if(b.y>=a.y+a.h){direction=3;c={x:Math.max(a.x,b.x),y:a.y+a.h,w:Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x),h:b.y-a.y-a.h};}
  }
  return direction===undefined?null:{direction,rect:c};
}
// Sensor masks hold only the four human player slots (0x4194b0 tests mask & 0xf);
// training opponents (ids 0x7d..0x7f) and level NPCs never trigger another actor's sensor.
// An invisible actor (+0x198, eye power-up) only enters regions flagged 2 (0x417dfd); sensors are not.
export const sensorTargets=game=>game.players.filter(p=>!p.bot&&!(p.effects?.invisible>0));
// 0x4192b0 unions the overlapping scenery bounds (0x433200), then checks whether BOTH
// transverse edges expanded. A partial obstruction leaves a shooting lane. Preserve that
// native rectangle test rather than a raycast.
export function sensorSees(game,n,p,direction) {
  const sight=sightCorridor(n,p);
  if(sight?.direction!==direction)return false;
  const r=sight.rect,horizontal=direction<2;
  const lo=horizontal?r.y:r.x,hi=lo+(horizontal?r.h:r.w);
  let expandedLo=lo,expandedHi=hi;
  for(const o of game.map.obstacles)if(blocksShots(o)&&rectsOverlap(r,o)) {
    const edge=horizontal?o.y:o.x;
    expandedLo=Math.min(expandedLo,edge);expandedHi=Math.max(expandedHi,edge+(horizontal?o.h:o.w));
  }
  return !(expandedLo!==lo&&expandedHi!==hi);
}
export function sensorMasks(game,n) {
  const masks=[0,0,0,0];
  for(const p of sensorTargets(game)){const s=sightCorridor(n,p);if(s)masks[s.direction]|=1<<p.id;}
  return masks;
}
export function visibleTarget(game,n) {
  // Four native sensors, then the lowest player bit in the sensor mask.
  for(let direction=0;direction<4;direction++)for(const p of sensorTargets(game))
    if(sensorSees(game,n,p,direction))return {player:p,direction};
  return null;
}
export function resetWander(game,n) {
  n.wanderAt=game.elapsed+1+Math.min(9,Math.floor(game.random()*10));
  n.sightPollAt=game.elapsed+2;
}
function turn(game,n) {
  // 0x420a90: 1/13 of idle-weapon decisions release the current movement key.
  if(Math.floor(game.random()*13)===0&&n.moving)n.paused=true;
  else {game.face(n,Math.min(3,Math.floor(game.random()*4)));n.paused=false;}
  resetWander(game,n);n.sensorId=null;n.targetId=null;n.fireAt=null;
}
export function updateUndead(game,n,dt) {
  if(n.active===false)return;
  n.cooldown=Math.max(0,n.cooldown-dt);if(n.action&&n.cooldown<=1e-9)game.finishWeaponAction(n);
  if(n.dead>0) {
    n.deathElapsed+=dt;n.dead-=dt;
    if(n.dead<=0) {
      game.spawnNpc(n);n.fade=0;n.fadeMs=0;
      // 0x420480: one third of returns may bring another dormant undead into play.
      if(Math.floor(game.random()*3)===0) {
        const next=game.npcs.find(q=>q.active===false);
        if(next){next.active=true;game.spawnNpc(next);next.fade=0;next.fadeMs=0;}
      }
    }
    return;
  }
  if(n.fadeMs!==undefined){n.fadeMs+=dt*1000;n.fade=Math.min(1,Math.floor((n.fadeMs+1e-7)/100)*.1);}
  const target=visibleTarget(game,n);
  const masks=sensorMasks(game,n);
  const previous=n.sightMasks??[0,0,0,0];
  const entered=masks.some((mask,direction)=>(mask&~previous[direction])!==0);
  const exited=masks.some((mask,direction)=>(previous[direction]&~mask)!==0);
  n.sightMasks=masks;
  if(exited){n.sensorId=null;n.targetId=null;n.fireAt=null;}
  const poll=game.elapsed+1e-9>=n.sightPollAt;
  if(poll)n.sightPollAt=game.elapsed+2;
  if(target&&(poll||(entered&&n.sensorId==null))) {
    n.sensorId=target.direction;n.targetId=target.player.id;n.fireAt=game.elapsed+.5;
    game.face(n,target.direction);n.paused=false;
  }
  if(!target){n.targetId=null;n.fireAt=null;}
  // Timer1 is created with flags 2 only (0x4210bf -> 0x42f210): one-shot. The 2s sensor
  // poll (timer4, 0x420c30) re-arms it while a player is still visible.
  if(target&&n.fireAt!==null&&game.elapsed+1e-9>=n.fireAt) {
    n.fireAt=null;game.shoot(n);
  }
  if(game.elapsed>=n.wanderAt&&n.cooldown===0) {
    turn(game,n);
  }
  const beforeX=n.x,beforeY=n.y;
  game.move(n,n.paused?{}:{direction:n.direction},dt);
  if(n.motionBlocked&&n.cooldown===0) {
    turn(game,n);n.motionBlocked=false;
  }
  n.lastMove={x:n.x-beforeX,y:n.y-beforeY};
}
