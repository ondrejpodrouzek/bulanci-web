// Scene CAnimation playback and the level-script timers that drive it, recovered from the EXE.
// create_animation (0x41d6e0) stores a flags byte from the bytecode in anim+0xc: bit0 playing,
// bit1 loop (0x4391e0). Flags 0 stand on frame 0. Native 0x50 (0x416dc0 -> 0x4390d0) plays
// once: the frame timer 0x439b90 shows frame[counter] (0x4399b0), advances it, and when the
// counter wraps to 0 without the loop bit it stops, so the last frame stays shown. Creation
// already showed frame 0 and left the counter at 1. Frame k lasts
// floor((k+1)*D/N)-floor(k*D/N) ms; a resumed frame timer waits out the last interval first.
// Stopping a running animation (0x439840: native 0x40, or the wrap) notifies 0xffff, which,
// like the chunk-12 events of a shown frame, reaches script entry 3 as (object, value)
// (0x418260). Chunk-10 deltas of each shown frame move the object (observer 0x436e80).
export const PLAYING=1,LOOP=2,STOPPED=0xffff;

// Script timers (0x42f210): flags 1 paused (pause count 1), 2 start now, 4 repeat with the same
// period (scheduler 0x42eb30). Native 0x45 resumes (count-1, start=now at 0), 0x46 pauses
// (count+1), 0x48 sets the period. Every script timer calls entry 6 (0x416a90).
const timer=(period,paused)=>({period,count:paused?1:0,start:0});
const pauseTimer=t=>{t.count++;};
const resumeTimer=(t,ms)=>{if(t.count>0&&--t.count===0)t.start=ms;};

// Malárie (322) block 0x93: timer_create(0, rand(0..10)*1000+5000, 6); entry 6 (block 0x284)
// plays objects 6..13 = all eight animations once: wind through the leaves and ferns.
export const MALARIA=322,MALARIA_BASE_MS=5000,MALARIA_STEP_MS=1000,MALARIA_STEPS=10;
// Noční směna (321): timer_create(0,0,7) waits paused. Round start (entry 10 from 0x41c140)
// and the crane's stop notice (entry 3, value != 0) call 0x565: period rand(0..6)*5000+30000,
// resume. The timer (entry 6 -> 0x6f6) plays the crane (object 6, animation 245) once, plays
// level sample 0 unpositioned (object_event(0,255) -> 0x418000) and pauses itself. Chunk-12
// event 0 (frame 60, crate in the furnace) stops the crane (native 0x40; its 0xffff notice
// re-enters 0x565) and sets the period to 10000 ms, so the crane hangs there for 10 s before
// the next fire resumes it upwards; its final stop arms the next 30-60 s wait.
export const FACTORY=321,CRANE_BASE_MS=30000,CRANE_STEP_MS=5000,CRANE_STEPS=6,CRANE_HOLD_MS=10000,CRANE=245;

const SCRIPTS={
 [MALARIA]:{
  create:g=>({...timer(MALARIA_BASE_MS+Math.floor(g.random()*(MALARIA_STEPS+1))*MALARIA_STEP_MS,false)}),
  fire:(g,s,ms)=>s.anims.forEach((_,i)=>play(s,i,ms)),
 },
 [FACTORY]:{
  create:()=>timer(0,true),
  start:(g,s,ms)=>arm(g,s,ms),
  fire(g,s,ms){const i=crane(s);if(i>=0)play(s,i,ms);g.onEvent({type:'sound',sample:0,x:400});pauseTimer(s.timer);},
  event(g,s,i,value,ms){
   if(s.anims[i].resource!==CRANE)return;
   if(value!==0){arm(g,s,ms);return;}
   stop(g,s,i,ms);s.timer.period=CRANE_HOLD_MS;
  },
 },
};
const crane=s=>s.anims.findIndex(a=>a.resource===CRANE);
function arm(g,s,ms){s.timer.period=CRANE_BASE_MS+Math.floor(g.random()*(CRANE_STEPS+1))*CRANE_STEP_MS;resumeTimer(s.timer,ms);}

export function createSceneAnims(game){
 const script=SCRIPTS[game.map.source_resource]??null;
 const anims=(game.map.animations??[]).map(a=>({resource:a.resource,oneShot:!(a.flags&LOOP),frames:a.frames??1,duration:a.duration_ms??1000,
  motion:a.motion??null,events:new Map(a.events??[]),shown:0,counter:1,playing:false,next:0,interval:0,dx:0,dy:0}));
 anims.forEach(a=>{a.interval=frameMs(a,0);});
 const s={anims,script,timer:null,started:false};
 if(script)s.timer=script.create(game);
 return s;
}

const frameMs=(a,k)=>Math.floor((k+1)*a.duration/a.frames)-Math.floor(k*a.duration/a.frames);
function play(s,i,ms){const a=s.anims[i];if(!a.oneShot)return;if(!a.playing){a.playing=true;a.next=ms+a.interval;}}
function stop(g,s,i,ms){const a=s.anims[i];if(!a.playing)return;a.playing=false;s.script?.event?.(g,s,i,STOPPED,ms);}

export function updateSceneAnims(game){
 const s=game.sceneAnims;if(!s)return;const ms=game.elapsed*1000;
 if(!s.started){s.started=true;s.script?.start?.(game,s,0);}
 const t=s.timer;
 if(t)while(t.count===0&&t.period>0&&ms>=t.start+t.period){t.start+=t.period;s.script.fire(game,s,t.start);}
 s.anims.forEach((a,i)=>{
  while(a.playing&&ms>=a.next){
   const k=a.counter;a.shown=k;a.interval=frameMs(a,k);a.next+=a.interval;
   if(a.motion){a.dx+=a.motion[k][0];a.dy+=a.motion[k][1];}
   a.counter=(k+1)%a.frames;
   if(a.events.has(k))s.script?.event?.(game,s,i,a.events.get(k),a.next-a.interval);
   if(a.counter===0)stop(game,s,i,a.next);
  }
 });
}

// Frame and root-motion offset to draw for map animation i; loops follow the clock (null).
export function sceneAnimFrame(game,object,i){
 if(object.flags!==undefined&&!(object.flags&LOOP))return game?.sceneAnims?.anims[i]?.shown??0;
 return null;
}
export function sceneAnimOffset(game,i){const a=game?.sceneAnims?.anims[i];return a?[a.dx,a.dy]:[0,0];}
