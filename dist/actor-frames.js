import {MOVEMENT_DATA,SPRITE_DATA,WEAPON_DATA} from './original-data.js';

export const bodyResource = p => (p.undead?[199,201,203,197]:[198,200,202,196])[p.direction];
export const deathResource = p => (p.undead?[207,209,211,205]:[206,208,210,204])[p.direction];
export function weaponFrame(p) {
  const w=WEAPON_DATA[p.weapon];
  return p.cooldown>0 && p.lastShotWeapon===p.weapon
    ? Math.min(w.frameCount-1,Math.floor((w.delay-p.cooldown)*1000/w.durationMs*w.frameCount+1e-8)) : 0;
}
export function actorLayout(p,type=p.weapon,direction=p.direction) {
  const body=(p.undead?[199,201,203,197]:[198,200,202,196])[direction];
  const motion=MOVEMENT_DATA.resources[body],frame=p.bodyFrame??0;
  const bodyAnchor=frame?motion.cycle[frame-1].anchor:motion.initialization.anchor;
  const weapon=WEAPON_DATA[type].resources[direction],gun=SPRITE_DATA[weapon];
  const gunAnchor=gun.anchors?.[weaponFrame({...p,weapon:type})]??gun.anchors?.[0]??[0,0];
  const x=p.x-motion.width/2,y=p.y-motion.height+12;
  const wx=x+bodyAnchor[0]-gunAnchor[0],wy=y+bodyAnchor[1]-gunAnchor[1];
  return {body,bodyX:x,bodyY:y,weapon,weaponX:wx,weaponY:wy,originX:Math.min(x,wx),originY:Math.min(y,wy)};
}
export function actorAnchor(p) {
  const data=MOVEMENT_DATA.resources[bodyResource(p)],frame=p.bodyFrame??0;
  const anchor=frame?data.cycle[frame-1].anchor:data.initialization.anchor;
  return {x:p.x-data.width/2+anchor[0],y:p.y-data.height+12+anchor[1]};
}
export function deathPose(p,resource=deathResource(p)) {
  const data=SPRITE_DATA[resource],elapsed=Math.max(0,p.deathElapsed??0);
  const frame=Math.min(data.frames-1,Math.floor(elapsed*1000/data.duration_ticks*data.frames));
  const anchor=data.anchors[frame],origin=p.deathAnchor??actorAnchor(p);
  const delta=data.deltas.slice(0,frame+1).reduce((sum,d)=>[sum[0]+d[0],sum[1]+d[1]],[0,0]);
  return {x:origin.x-anchor[0]+delta[0],y:origin.y-anchor[1]+delta[1],frame};
}
