// Training opponents: computer CBulanek ids 0x7d..0x7f, created only when one human plays
// (0x4205a0, config+0xd8 == 1). Recovered from the supplied EXE; evidence in reconstruction.md.
import {sensorMasks,sensorTargets,sensorSees} from './exitus.js';
import {playerRect,canPlaceActor,BODY_WIDTH as BODY_W} from './collision.js';

// 0x41f805: on respawn a computer (id > 3) re-arms with type (rand*101>>15 < 10), i.e. the
// shotgun 10 times in 101, otherwise the pistol. Creation itself passes weapon 0 (0x420530).
export function trainingRespawnWeapon(random){return Math.floor(random()*101)<10?1:0;}

// Teleport (0x41db00 -> 0x41d090): a random free spot (0x41a140), sound 4/36, a CTeleportPoint
// (animation 304) at the old and the new place. +0x16a blocks turning (0x4197b0) until the
// old-place animation finishes its single play (0x41fed0): 497ms * 6/7 frames.
export const TELEPORT_RESOURCE=304,TELEPORT_MS=Math.floor(497*6/7);
// 0x417260: computers re-arm repeating timer2 to (rand(0..10)+5) s on respawn and after a teleport.
export function armTeleport(game,p){p.teleportPeriod=Math.floor(game.random()*11)+5;p.teleportAt=game.elapsed+p.teleportPeriod;}
export const teleporting=(game,p)=>p.teleportingUntil!=null&&game.elapsed+1e-9<p.teleportingUntil;
const effectAt=(game,p)=>{const r=playerRect(p.x,p.y);return{x:Math.round(r.x+r.w/2),y:Math.round(r.y+r.h/2),at:game.elapsed,resource:TELEPORT_RESOURCE};};
// With `to` (collision-rectangle top-left, script try_move 0x55 -> 0x41e430) the move fails
// when that spot is occupied (0x41d146 collision query); without it a free spot is drawn.
export function teleport(game,p,to=null) {
  if(teleporting(game,p)||p.dead>0)return false;
  let spot;
  if(to){spot={x:to.x+BODY_W/2-2,y:to.y+25};if(!canPlaceActor(spot.x,spot.y,game.map.obstacles,game.actors().filter(a=>a.active!==false&&a.dead<=0),p))return false;}
  else spot=game.spawnPoint(p);
  const from=effectAt(game,p);Object.assign(p,spot);
  game.teleports.push(from,effectAt(game,p));
  game.onEvent({type:'teleport',player:p,x:p.x});
  p.teleportingUntil=game.elapsed+TELEPORT_MS/1000;if(p.bot)armTeleport(game,p);
  return true;
}
// 0x421579: when a computer's weapon animation ends, 40 of 100 times it teleports away.
export function trainingWeaponEnded(game,p){if(p.bot&&Math.floor(game.random()*100)<40)teleport(game,p);}

// Computers have no wander timer (timer4 is NPC-only, 0x420bf6) and never walk. Four sensors
// (ctor 0x41e690) reach the battlefield edges. A human entering one (message 0x421047) turns
// the bot to that side and arms one-shot timer1 with rand(0..3)*500ms (0x42110c, 0x40ace0).
// Any sensor exit cancels it (0x421133). The sensor stays "taken" until that exit, so a
// human standing in the axis draws exactly one shot.
export function updateTrainingBot(game,p) {
  p.moving=false;
  if(p.teleportingUntil!=null&&!teleporting(game,p))p.teleportingUntil=null;
  // Timer2 (0x420bc6) teleports only while the weapon is idle, otherwise waits one more period.
  if(p.teleportAt!=null&&game.elapsed+1e-9>=p.teleportAt){if(!p.action&&p.cooldown<=0)teleport(game,p);else p.teleportAt+=p.teleportPeriod;}
  const masks=sensorMasks(game,p),previous=p.sightMasks??[0,0,0,0];
  const exited=masks.some((mask,d)=>(previous[d]&~mask)!==0);
  p.sightMasks=masks;
  if(exited){p.targetId=null;p.fireAt=null;}
  if(p.targetId==null) {
    const d=masks.findIndex((mask,d)=>(mask&~previous[d])!==0);
    if(d>=0) {
      // 0x421079 stores the sensor message before the visibility test, so an entry from
      // behind cover still occupies the sensor until the next exit.
      const entered=masks[d]&~previous[d];
      p.targetId=sensorTargets(game).find(q=>entered&(1<<q.id))?.id??null;
      // During a teleport the turn fails (0x4197b0), so no timer is armed.
      if(!teleporting(game,p)&&sensorTargets(game).some(q=>(entered&(1<<q.id))&&sensorSees(game,p,q,d))) {
        game.face(p,d);p.fireAt=game.elapsed+Math.floor(game.random()*4)*.5;
      }
    }
  }
  // 0x4208c0: the shot goes off only if the weapon is idle at that moment.
  if(p.fireAt!=null&&game.elapsed+1e-9>=p.fireAt){p.fireAt=null;game.shoot(p);}
}
