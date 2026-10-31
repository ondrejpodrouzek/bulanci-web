import {MINE_DATA as DATA,BEDTIME_DATA} from './original-data.js';
import {actorLayout} from './actor-frames.js';
import {playerRect,rectsOverlap,blocksShots} from './collision.js';
import {creatureVulnerable,hitCreature} from './bedtime.js';

export function placeMine(g,p,at=g.elapsed) {
  const layout=actorLayout(p,2),offset=DATA.placement.offsets[p.direction];
  const mine={x:layout.originX+offset[0],y:layout.originY+offset[1],w:31,h:18,owner:p.id,placedAt:at,armAt:at+2,armed:false,dead:false,resource:177};
  g.mines.push(mine);return mine;
}
export function startExplosion(g,rect,owner,at=g.elapsed) {
  const x=rect.x+Math.trunc((rect.w-101)/2),y=rect.y+Math.trunc((rect.h-84)/2);
  const e={x,y,w:101,h:84,owner,startedAt:at,damageAt:at+.142,endsAt:at+.710,damaged:false,resource:178};
  g.explosions.push(e);g.onEvent({type:'explosion',x:x+50,y:y+42,owner});return e;
}
export function detonateMine(g,m,at=g.elapsed) {
  if(m.dead||!m.armed)return false;
  m.armed=false;m.dead=true;startExplosion(g,m,m.owner,at);return true;
}
export function detonateOwned(g,p) {
  const owned=g.mines.filter(m=>!m.dead&&m.owner===p.id);let successes=0;
  for(const m of owned)if(detonateMine(g,m))successes++;
  if(successes&&successes===owned.length)p.ammo[3]=Math.max(0,p.ammo[3]-1);
  return successes>0;
}
export function explosionDamage(g,e,at) {
  const bounds={x:e.x-60,y:e.y-60,w:e.w+120,h:e.h+120};
  const candidates=[];
  for(const o of g.map.obstacles)if(blocksShots(o)&&rectsOverlap(bounds,o))candidates.push({rect:o,obstacle:o});
  for(const p of g.actors())if(p.active!==false&&rectsOverlap(bounds,playerRect(p.x,p.y))) {
    // Dead actors have a collidable CDeath replacement with ID255: it counts
    // in the broadphase, but is ignored by the damage probes.
    candidates.push(p.dead<=0?{rect:playerRect(p.x,p.y),actor:p}:{rect:playerRect(p.x,p.y),obstacle:{}});
  }
  if(!candidates.length)return; // Native 0x41e19d guard also gates chain reactions.
  function probe(r,direction) {
    for(const c of [...candidates].reverse())if(rectsOverlap(r,c.rect)) {
      if(c.actor){
        if(c.actor.dead<=0)g.kill(c.actor,e.owner,{direction,explosion:true});
        // CBulanek stays in its scene slot after death. The native probe
        // refreshes that slot up to four times, then returns true (ray stop).
        return true;
      }
      const creature=g.creatures.find(a=>a.id===c.obstacle.creatureId);
      if(creature&&creatureVulnerable(creature)){hitCreature(g,creature,{owner:e.owner});return true;}
      if(c.obstacle.explosionBlocker===true)return true;
      // Plain script objects have id255 and are skipped by 0x41b250.
    }
    return false;
  }
  const center={x:Math.trunc((e.x+e.x+e.w-4)/2),y:Math.trunc((e.y+e.y+e.h-4)/2),w:4,h:4};
  probe(center,0);
  const vectors=DATA.explosion.collision.vectors;
  for(let index=7;index>=0;index--) {
    const r={...center},[dx,dy]=vectors[index];
    for(let step=0;step<15;step++){r.x+=dx;r.y+=dy;if(probe(r,index%4))break;}
  }
  for(const m of g.mines)if(!m.dead&&rectsOverlap(bounds,m))detonateMine(g,m,at);
}
export function updateMines(g) {
  for(const m of g.mines) {
    if(m.dead)continue;
    const justArmed=!m.armed&&g.elapsed+1e-9>=m.armAt;
    if(justArmed)m.armed=true;
    m.arm=Math.max(0,m.armAt-g.elapsed);
    if(m.armed){const r={x:m.x-10,y:m.y-10,w:m.w+20,h:m.h+20};
      if(g.actors().some(p=>p.active!==false&&p.dead<=0&&rectsOverlap(r,playerRect(p.x,p.y))))detonateMine(g,m,justArmed?m.armAt:g.elapsed);
    }
  }
  for(const e of g.explosions)if(!e.damaged&&g.elapsed+1e-9>=e.damageAt){e.damaged=true;explosionDamage(g,e,e.damageAt);}
  g.mines=g.mines.filter(m=>!m.dead);g.explosions=g.explosions.filter(e=>g.elapsed<e.endsAt);
}
export function objectFrame(object,now) {
  const a=BEDTIME_DATA.animations[object.resource],started=object.placedAt??object.startedAt;
  const ms=Math.max(0,(now-started)*1000);let frame=0;
  while(frame<a.frames-1&&a.blocks[frame+1].timeMs<=ms+1e-7)frame++;
  return frame;
}
