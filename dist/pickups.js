// Weapons lying on the ground, recovered from the supplied EXE (evidence: reconstruction.md,
// "Spawn zbraní"). With all weapons nothing lies on the map at the start and a repeating
// timer adds them; in shotgun-only mode a single shotgun circulates.
import {blocksActors,playerRect,rectsOverlap} from './collision.js';

// Pickup animations (table 0x4827f4) with their frame size; ammunition capacity table 0x481a60.
export const PICKUP_ART={1:{resource:179,w:52,h:24},2:{resource:268,w:25,h:26},4:{resource:222,w:52,h:22},5:{resource:219,w:52,h:31}};
export const CAPACITY=[5,4,4,1,4,2];
// "Mód zbraní" (saved settings +0x88 = game config +0x19d, texts 0x1b0..0x1b8): 1 = všechny zbraně (+0x368 = 6),
// 0 = pouze brokovnice (+0x368 = 2). Timer1 of the game object (0x41c1f6) only exists with all weapons,
// 5000 ms with several players, 10000 ms with one (0x41c1ff).
export const spawnPeriod=game=>game.mode==='training'?10:5;
export const weaponsEnabled=game=>game.weaponMode==='classic';
const SHOTGUN_SLOT=0x64,OTHER_SLOTS=[0x65,0x66,0x67,0x68,0x69,0x6a,0x6b];

export function pickupAt(type,x,y){const a=PICKUP_ART[type];return {type,x,y,w:a.w,h:a.h,resource:a.resource,slot:null,shownAt:0};}
export const shotgunOnly=game=>game.weaponMode==='shotgun';
export function createPickups(game) {
  game.nextPickupAt=weaponsEnabled(game)?game.elapsed+spawnPeriod(game):Infinity;game.pickups=[];
  // Shotgun-only: one shotgun is laid at the start (0x4202f6 -> 0x41f1d0, not with one player).
  if(shotgunOnly(game)&&game.mode!=='training')spawnPickup(game,1);
  return game.pickups;
}
// 0x41f1d0: the single circulating shotgun returns to the map when its holder empties it
// (weapon animation end, 0x42151c) or dies (0x41fb3a).
function returnShotgun(game,p){if(!p.shotgunToken)return;p.shotgunToken=false;spawnPickup(game,1);}
export function weaponEnded(game,p){if(p.shotgunToken&&p.ammo[1]<=0)returnShotgun(game,p);}
// 0x41f900 for an actor without sensors (a human): back to the pistol, weapons 1..5 emptied.
export function humanDied(game,p) {
  if(p.bot||p.npc)return;
  returnShotgun(game,p);
  for(let t=1;t<6;t++)p.ammo[t]=0;p.weapon=0;
}

function free(game,r) {
  if(r.x<0||r.y<0||r.x+r.w>800||r.y+r.h>515)return false;
  if(game.map.obstacles.some(o=>blocksActors(o)&&rectsOverlap(r,o)))return false;
  return !game.actors().some(a=>a.active!==false&&a.dead<=0&&rectsOverlap(r,playerRect(a.x,a.y)));
}
// 0x41b390 -> 0x41a140: uniform spot in (801-w)x(516-h), retried until nothing collides.
function place(game,item) {
  for(let i=0;i<256;i++){item.x=Math.floor(game.random()*(0x321-item.w));item.y=Math.floor(game.random()*(0x204-item.h));if(free(game,item))return true;}
  return false;
}
// 0x41e350: with six weapon kinds r = rand*125/25 + 1 (1..5), r>=3 skips the detonator (3);
// a shotgun already lying turns the roll into the SMG; the roll 6 spawns nothing.
export function rollPickup(game) {
  let r=Math.floor(Math.floor(game.random()*125)/25)+1;
  if(r>=3)r++;
  if(r===1&&game.pickups.some(p=>p.slot===SHOTGUN_SLOT))r=4;
  return r<6?r:null;
}
// 0x41e2c0: the shotgun has one object slot (0x64), the others the first free of 0x65..0x6b.
export function spawnPickup(game,type) {
  const used=new Set(game.pickups.map(p=>p.slot));
  const slot=type===1?(used.has(SHOTGUN_SLOT)?null:SHOTGUN_SLOT):OTHER_SLOTS.find(s=>!used.has(s));
  if(slot==null)return null;
  const item={...pickupAt(type,0,0),slot,shownAt:game.elapsed};
  if(!place(game,item))return null;
  game.pickups.push(item);return item;
}
// 0x41eba0: the item disappears; the mine adds one up to its capacity, others refill and are
// selected (0x41ea90, a no-op for the Exitus undead).
function collect(game,actor,item) {
  game.pickups.splice(game.pickups.indexOf(item),1);
  actor.ammo[item.type]=item.type===2?Math.min(CAPACITY[2],(actor.ammo[2]??0)+1):CAPACITY[item.type];
  if(!actor.undead)game.equipWeapon(actor,item.type);
  if(item.type===1&&shotgunOnly(game))actor.shotgunToken=true; // 0x41ec48 sets +0x16b
  game.onEvent({type:'pickup',player:actor,item});
}
export function updatePickups(game) {
  // 0x41f0c0: any live actor whose collision rectangle overlaps a lying weapon takes it.
  for(const item of [...game.pickups]) {
    const taker=game.actors().find(a=>a.active!==false&&a.dead<=0&&a.spawned!==false&&rectsOverlap(playerRect(a.x,a.y),item));
    if(taker)collect(game,taker,item);
  }
  // Timer1 handler 0x41f083: rand*101 < 80 per tick, then the roll above.
  while(game.elapsed+1e-9>=game.nextPickupAt) {
    game.nextPickupAt+=spawnPeriod(game);
    if(Math.floor(game.random()*101)<80){const type=rollPickup(game);if(type!=null)spawnPickup(game,type);}
  }
}
