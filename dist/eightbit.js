// "V zajetí 8-bitu", level script 323, ported block by block (offsets are 323:0x...).
// Evidence and the native semantics used here: reconstruction.md, "Mapa 8-bit".
import {playerRect,rectsOverlap} from './collision.js';
import {teleport} from './training.js';
export const isEightBit=map=>map?.source_resource===323;
const randint=(g,lo,hi)=>lo+Math.min(hi-lo,Math.floor(g.random()*(hi-lo+1)));
const rect=(l,t,r,b)=>({x:l,y:t,w:r-l,h:b-t});

// Animation clocks and chunk-12 events (frame,value) from the original t52 resources.
const ANIM={254:[6,426,[[1,0],[2,1]]],255:[4,284,[[1,0]]],256:[6,426,[[1,0]]],257:[6,426,[[1,0]]],
 258:[19,1083,[[7,0],[10,1],[13,2]]],259:[13,741,[]],260:[19,1083,[[7,0],[13,1]]],261:[19,1083,[[7,0],[10,1],[13,2]]],
 262:[13,741,[]],263:[19,1083,[[7,0],[13,1]]],264:[19,1615,[]]};
const HEIGHT={254:88,255:84,256:59,257:67,258:44,259:44,260:44,261:44,262:44,263:44,264:101};
// Destructible 8-bit blocks: animation, hit body (callback id), hits to destroy, hits per stage.
const BLOCKS=[
 {id:10,res:254,x:54,y:49,z:-35,body:11,rect:rect(58,73,110,123),max:9,per:3},   // 0x71b
 {id:16,res:255,x:175,y:55,z:-25,body:17,rect:rect(191,73,251,123),max:2,per:1},  // 0x77a, the cage
 {id:12,res:256,x:506,y:256,z:-17,body:13,rect:rect(522,262,598,305),max:4,per:2}, // 0x7bc
 {id:14,res:257,x:507,y:376,z:-17,body:15,rect:rect(533,390,609,429),max:4,per:2}, // 0x81b
];
// Creature 9 states (create_animation order) and its two bodies at the cage rectangle:
// 18 blocks while it acts, 19 is the vulnerable one exposed between events 0 and the last.
const CREATURE_STATES=[259,262,260,263,258,261];
const CAGE=rect(191,73,251,123);
// native_53 regions: pads 0..2 (flags 6), cage 3 (10), right strip 5 / lower strip 4 (8), above 6 (8).
const REGIONS=[[rect(30,185,105,243),6],[rect(442,67,515,131),6],[rect(694,377,770,440),6],[CAGE,10],
 [rect(200,128,243,322),8],[rect(257,80,785,116),8],[rect(200,9,243,50),8]];
// try_move targets 0xa44 (collision top-left) and the two pads each pad can send to (0xc5f).
const SPOTS=[{x:40,y:195},{x:452,y:77},{x:704,y:387}],PAD_TARGETS=[[1,2],[0,2],[0,1]];
const SHOT_ART=[97,98,99,96]; // native_59/5f: left,right,up,down loaded in this order (0x0f0)

export function prepareEightBit(map) {
  if(!isEightBit(map))return map;
  const obstacles=map.obstacles.map(o=>({...o}));
  for(const b of BLOCKS)obstacles.push({...b.rect,hitCallback:b.body});
  obstacles.push({...CAGE,scriptBody:18,active:false},{...CAGE,scriptBody:19,hitCallback:19,active:false});
  return {...map,obstacles};
}
const body=(g,id)=>g.map.obstacles.find(o=>o.scriptBody===id||o.hitCallback===id);
const show=(g,id,on)=>{const o=body(g,id);if(o)o.active=on;};
const sound=(g,sample,x=225)=>g.onEvent({type:'sound',bank:0,sample,x});  // object_event(k,..) -> level bank0 sample k

function animation(o,res){o.res=res;const [count,ms,events]=ANIM[res];o.count=count;o.ms=ms;o.events=events;o.h=HEIGHT[res];}
function play(g,o,from=0,at=g.elapsed){o.playing=true;o.from=from;o.startedAt=at;o.frame=from;o.fired=new Set();}
export function createEightBit(g) {
  const s=g.eight={g3:0,g4:0,g5:0,g6:0,g7:0,g8:0,g9:0,g10:0,g13:0,g14:0,inside:REGIONS.map(()=>new Set()),nextThink:g.elapsed+3};
  const objects=[];
  for(const b of BLOCKS){const o={...b,kind:'block',layer:1,frame:0,playing:false};animation(o,b.res);objects.push(o);}
  const c={id:9,kind:'creature',x:199,y:77,z:-17,layer:1,frame:0,playing:false};animation(c,CREATURE_STATES[0]);objects.push(c);
  const r={id:20,kind:'remains',x:175,y:22,z:-17,layer:1,frame:0,playing:false,hidden:true};animation(r,264);objects.push(r);
  s.creature=c;s.remains=r;return objects;
}
const object=(g,id)=>g.creatures.find(o=>o.id===id);

function setState(g,state) { // 0xb55
  const s=g.eight,c=s.creature;s.g10=state;animation(c,CREATURE_STATES[state]);play(g,c);show(g,18,true);
}
function creatureShot(g,at) { // 0x656 / 0x68f: native_62(x,y,dir,owner9,flags2,8-bit shot type)
  const [x,y,dir]=g.eight.g10===4?[260,96,1]:[221,136,3];
  const b=g.newBullet(x,y,dir,9,0,at,0);b.resource=SHOT_ART[dir];[b.width,b.height]=dir<2?[9,5]:[5,9];
  sound(g,0,x);
}
function callback(g,o,value,at) { // entry 3, 0x4bc: value is the chunk-12 event, 'end' after the single play
  const s=g.eight;
  if(o.kind==='block') {
    o.playing=false; // native_40 stops on the event or at the end
    if(s[{10:'g3',16:'g6',12:'g4',14:'g5'}[o.id]]===o.max){g.map.obstacles=g.map.obstacles.filter(b=>b.hitCallback!==o.body);o.z=-120;}
    return;
  }
  if(o.kind==='remains'){show(g,18,false);o.z=-120;return;} // 0x61c
  if(s.g10<2){if(value==='end')show(g,18,false);return;}   // 0x5bb -> 0x5e7
  const exposedEnd=s.g10<=3?1:2;
  if(value===0){show(g,19,true);show(g,18,false);}           // 0x5f4
  else if(value===exposedEnd){show(g,19,false);show(g,18,true);} // 0x608
  else if(value===1&&s.g10>3)creatureShot(g,at);
  else if(value==='end')show(g,18,false);
}
function advance(g,o) {
  if(!o.playing||o.hidden)return;
  const frameMs=o.ms/o.count,last=o.count-1;
  for(;;) {
    const next=o.events.find(([f])=>f>o.from&&!o.fired.has(f)),endFrame=next?next[0]:last;
    const at=o.startedAt+(endFrame-o.from)*frameMs/1000;
    if(at>g.elapsed+1e-9)break;
    o.frame=endFrame;
    if(next){o.fired.add(next[0]);callback(g,o,next[1],at);}
    else{o.playing=false;callback(g,o,'end',at);}
    if(!o.playing)break;
  }
  if(o.playing)o.frame=Math.min(last,o.from+Math.floor((g.elapsed-o.startedAt)*1000/frameMs+1e-7));
}
const creatureBusy=g=>g.eight.creature.playing; // native_57
const aimed=s=>s.g14===0&&s.g8*s.g9===0;            // 0xbae
function think(g) { // timer0 every 3000ms (0x49a), handler 0x935
  const s=g.eight;
  if(randint(g,0,2)!==0||s.g10===10||s.g6<2||creatureBusy(g)||s.g7!==0)return;
  if(!aimed(s))return setState(g,randint(g,0,1));
  if(s.g9)return setState(g,randint(g,0,3)!==0?0:4);
  if(s.g8)return setState(g,randint(g,0,3)!==0?1:5);
  setState(g,randint(g,2,3));
}
function stripEntered(g,side) { // 0xbd6(side,1): side 0 = right strip, 1 = lower strip
  const s=g.eight;
  if(randint(g,0,1)!==0||s.g10===10||creatureBusy(g)||s.g7!==0)return;
  setState(g,s.g6>=2&&aimed(s)?4+side:side);
}
function padEntered(g,pad,actor) { // 0xa89: 5 of 11 tries the first target first
  const [a,b]=PAD_TARGETS[pad],order=randint(g,0,10)<5?[a,b]:[b,a];
  for(const i of order)if(teleport(g,actor,SPOTS[i]))return;
}
function counts(actor,flags) { // 0x417dd0: humans unless invisible without flag 2; computers need flag 8
  if(actor.bot||actor.npc)return (flags&8)!==0;
  return !(actor.effects?.invisible>0)||(flags&2)!==0;
}
function updateRegions(g) {
  const s=g.eight;
  REGIONS.forEach(([r,flags],i)=>{
    const now=new Set(g.actors().filter(a=>a.active!==false&&a.dead<=0&&a.spawned!==false&&counts(a,flags)&&rectsOverlap(playerRect(a.x,a.y),r)));
    for(const a of s.inside[i])if(!now.has(a)){if(i===3)s.g7--;else if(i===4)s.g8--;else if(i===5)s.g9--;else if(i===6)s.g14--;}
    for(const a of now)if(!s.inside[i].has(a)){
      if(i<3)padEntered(g,i,a);else if(i===3)s.g7++;else if(i===4){s.g8++;stripEntered(g,1);}else if(i===5){s.g9++;stripEntered(g,0);}else s.g14++;
    }
    s.inside[i]=now;
  });
}
export function updateEightBit(g) {
  updateRegions(g);
  while(g.elapsed+1e-9>=g.eight.nextThink){g.eight.nextThink+=3;think(g);}
  for(const o of g.creatures)advance(g,o);
}
// Entry 4 (0x914 -> 0x6e8): a shot stopped by a scripted body with a hit callback.
export function eightBitShotHit(g,id) {
  const s=g.eight;
  if(id===19) { // 0x87a
    s.g13++;
    if(s.g13<=7){sound(g,1);return;}
    sound(g,2);const c=s.creature;c.playing=false;c.hidden=true;show(g,19,false);show(g,18,true);
    s.remains.hidden=false;play(g,s.remains);s.g10=10;return;
  }
  const b=BLOCKS.find(b=>b.body===id);if(!b)return;
  const key={10:'g3',16:'g6',12:'g4',14:'g5'}[b.id],o=object(g,b.id),before=s[key];
  if(before>=b.max)return;
  const from=Math.floor(before/b.per);s[key]++;const to=Math.floor(s[key]/b.per);
  sound(g,to===b.max/b.per?4:3,b.x);                   // 0x6c2: object_event 4 on the last stage, else 3
  if(from!==to||b.per===1)play(g,o,from);              // native_58(frame) + native_50
}
