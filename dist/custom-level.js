// Add-on levels (.eap, tools/import_custom_maps.py). Their scripts use the same natives as the
// original levels. Regions (native_53) answer entry point 7 with try_move to one of a few places,
// the helper that picks among several starts at random and tries them in turn (0x55 -> 0x41e430).
import {playerRect,rectsOverlap} from './collision.js';
import {teleport} from './training.js';

function counts(actor,flags) {
  if(actor.bot||actor.npc)return (flags&8)!==0;
  return !(actor.effects?.invisible>0)||(flags&2)!==0;
}
export function updateRegions(g) {
  const regions=g.map.regions;if(!regions?.length)return;
  g.regionInside??=regions.map(()=>new Set());
  regions.forEach((r,i)=>{
    const now=new Set(g.actors().filter(a=>a.active!==false&&a.dead<=0&&a.spawned!==false&&counts(a,r.flags)&&rectsOverlap(playerRect(a.x,a.y),r)));
    for(const a of now)if(!g.regionInside[i].has(a)&&r.targets.length) {
      const first=Math.floor(g.random()*r.targets.length);
      for(let k=0;k<r.targets.length;k++)if(teleport(g,a,r.targets[(first+k)%r.targets.length]))break;
    }
    g.regionInside[i]=now;
  });
}
