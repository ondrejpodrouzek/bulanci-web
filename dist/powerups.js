// Solo power-ups (eye, shield, ammo, hourglass), recovered from the supplied EXE.
// Evidence in reconstruction.md. Only created when one human plays (0x42031b, config+0xd8 == 1).
import {blocksActors,playerRect,rectsOverlap} from './collision.js';

// Slot order of the game object (+0x324..+0x330) and the random pick (jump table 0x41b590).
export const POWERUPS=[
 {kind:0,name:'Oko',resource:293,width:19,height:18},      // invisibility (+0x198)
 {kind:1,name:'Štít',resource:294,width:20,height:38},     // no death (+0x19a)
 {kind:2,name:'Náboj',resource:221,width:22,height:15},    // ammo is not spent (+0x199)
 {kind:3,name:'Hodiny',resource:220,width:15,height:34},   // round time ±15 s
];
export const POWERUP_WAIT=25,POWERUP_SHOWN=10,POWERUP_EFFECT=20; // 0x417c80: 25000/10000 ms; 0x4145c4: 20000 ms
const EFFECTS=['invisible','shield','ammo'];
// 0x41a020: bank-0 (global bank 4) sample by kind for the first player, 0x22 for anyone else.
const HUMAN_SAMPLE=[0x20,0x23,0x21,0x1f],OTHER_SAMPLE=0x22;

export const powerupsEnabled=game=>game.mode==='training';
export function createPowerups(game){return powerupsEnabled(game)?{phase:0,at:game.elapsed+POWERUP_WAIT,item:null}:null;}
export const hasEffect=(actor,name)=>(actor.effects?.[name]??0)>0;

function free(game,r) {
 if(r.x<0||r.y<0||r.x+r.w>800||r.y+r.h>515)return false;
 if(game.map.obstacles.some(o=>blocksActors(o)&&rectsOverlap(r,o)))return false;
 return !game.actors().some(a=>a.active!==false&&a.dead<=0&&rectsOverlap(r,playerRect(a.x,a.y)));
}
// 0x41b390 -> 0x41a140: uniform position in (801-w)x(516-h), retried until nothing collides.
function place(game,def) {
 for(let i=0;i<256;i++) {
  const r={x:Math.floor(game.random()*(0x321-def.width)),y:Math.floor(game.random()*(0x204-def.height)),w:def.width,h:def.height};
  if(free(game,r))return r;
 }
 return null;
}
function apply(game,actor,def) {
 const human=!actor.bot&&!actor.npc;
 if(def.kind===3)game.time=human?game.time+15:Math.max(1,game.time-15); // 0x414572 / 0x41457c
 else (actor.effects??={})[EFFECTS[def.kind]]=POWERUP_EFFECT;          // re-pickup restarts the timer
 game.onEvent({type:'sound',bank:4,sample:actor.id===0&&human?HUMAN_SAMPLE[def.kind]:OTHER_SAMPLE,x:actor.x});
 game.onEvent({type:'powerup',player:actor,powerup:def});
}
export function updatePowerups(game,dt) {
 for(const a of game.actors())if(a.effects)for(const k of EFFECTS)if(a.effects[k]>0)a.effects[k]=Math.max(0,a.effects[k]-dt);
 const s=game.powerups;if(!s)return;
 if(s.item) {
  // 0x41f0c0: any live actor whose collision rectangle overlaps the visible item takes it.
  const taker=game.actors().find(a=>a.active!==false&&a.dead<=0&&a.spawned!==false&&rectsOverlap(playerRect(a.x,a.y),s.item));
  if(taker){const def=POWERUPS[s.item.kind];s.item=null;apply(game,taker,def);s.phase=0;s.at=game.elapsed+POWERUP_WAIT;return;}
 }
 if(game.elapsed+1e-9<s.at)return;
 if(s.phase===0) {
  // 0x41b500: rand*256>>15>>6 picks one of four with equal chance.
  const def=POWERUPS[Math.floor(game.random()*256)>>6];
  const r=place(game,def);
  s.item=r&&{...r,kind:def.kind,resource:def.resource,shownAt:game.elapsed};
  s.phase=1;s.at=game.elapsed+POWERUP_SHOWN;
 } else {
  s.item=null;s.phase=0;s.at=game.elapsed+POWERUP_WAIT; // 0x419e40 hides all four
 }
}
