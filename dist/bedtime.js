// Script resource320. Coordinates, state order and clocks are recovered, not tuned.
import {BEDTIME_DATA as DATA} from './original-data.js';
import {playerRect,rectsOverlap} from './collision.js';
export const isBedtime=map=>map?.source_resource===320;
const randint=(g,lo,hi)=>lo+Math.min(hi-lo,Math.floor(g.random()*(hi-lo+1)));
const translated=(r,x,y)=>({x:x+r[0],y:y+r[1],w:r[2]-r[0],h:r[3]-r[1]});

export function prepareBedtime(map,random) {
  if(!isBedtime(map))return map;
  const layout=DATA.layouts[Math.min(1,Math.floor(random()*2))],layers=[{x:0,y:0,resource:83,fg:false}],obstacles=[],creatures=[];
  function creature(kind,spec,base,layer,z=0) {
    const [baseX,baseY]=base,offset=spec.animationOffset??spec.animationInitialOffset;
    const c={kind,id:spec.animationId,baseX,baseY,x:baseX+offset[0],y:baseY+offset[1],resources:spec.animationResources,layer,z,scripted:true};
    const art=DATA.animations[c.resources[0]];c.w=art.width;c.h=art.height;
    if(spec.hitRect){c.hitRect=translated(spec.hitRect,baseX,baseY);obstacles.push({...c.hitRect,creatureId:c.id});}
    if(spec.solidRects)obstacles.push(...spec.solidRects.map(r=>translated(r,baseX,baseY)));
    creatures.push(c);return c;
  }
  const include=denominator=>Math.floor(random()*denominator)!==0;
  if(include(8)) {
    const b=layout.logRabbit;layers.push({x:b[0],y:b[1],resource:73,fg:false});
    creature('rabbit',DATA.logRabbit,b,0);
  }
  if(include(10)) {
    const b=layout.gunMouse;layers.push({x:b[0],y:b[1],resource:70,fg:true,z:-25});
    creature('mouse',DATA.gunMouse,b,1,35).rightLimit=b[2];
  }
  const b=layout.mushroomBird,s=DATA.mushroomBird;
  layers.push({x:b[0]+8,y:b[1]+141,resource:107,fg:false},{x:b[0],y:b[1],resource:106,fg:true,z:-39});
  obstacles.push(translated(s.bitmapRect,...b),translated(s.upperRect,...b));
  creature('window',s,b,2);
  if(include(8)) {
    const b=layout.bushAnimal;layers.push({x:b[0],y:b[1],resource:71,fg:true,z:-25});
    creature('bush',DATA.bushAnimal,b,1,50);
  }
  if(include(7)) {
    const b=layout.bush72;layers.push({x:b[0],y:b[1],resource:72,fg:true,z:-40});
    obstacles.push(translated(DATA.bush72.rect,...b));
  }
  return {...map,layers,obstacles,creatures,animations:[],layout:layout.index};
}
export function animationInfo(c){return DATA.animations[c.res];}
export function setCreatureState(g,c,state,at=g.elapsed) {
  c.state=state;c.res=c.resources[state];c.startedAt=at;c.ended=false;c.frame=0;
  const a=animationInfo(c);c.nextAt=at+(c.kind==='window'?a.durationMs:a.stopMs)/1000;
}
export function createCreatures(g) {
  return (g.map.creatures??[]).filter(c=>c.scripted).map(record=>{
    const c={...record,dead:false,ready:false,sensors:[new Set(),new Set()],counts:[0,0],cooldownAt:Infinity};
    setCreatureState(g,c,0,0);return c;
  });
}
function sound(g,c,sample){g.onEvent({type:'sound',bank:1,sample,x:c.x,creature:c});}
function mouseSide(c){return c.state>=4?1:0;}
function mouseState(g,c,phase,side,at) {
  c.x=c.baseX+13;c.y=c.baseY+(side?-30:-25);
  setCreatureState(g,c,side*4+phase,at);
  if(phase===2){
    const dir=side?0:1,x=c.baseX+(side?-10:65),y=c.baseY+10;
    g.scriptShot(x,y,dir,9,at);sound(g,c,4);
  }
}
function emerge(g,c,side,at) {
  if(c.dead||!c.ready)return;
  c.ready=false;c.cooldownAt=Infinity;mouseState(g,c,0,side,at);
}
function complete(g,c,at) {
  if(c.dead){c.ended=true;c.nextAt=Infinity;return;}
  if(c.kind==='mouse') {
    const phase=c.state%4,side=mouseSide(c);
    if(phase===0)mouseState(g,c,c.counts[side]>0?2:1,side,at);
    else if(phase===2)mouseState(g,c,1,side,at);
    else {c.ended=true;c.nextAt=Infinity;c.ready=true;c.cooldownAt=at+randint(g,3,15);}
  } else {
    const state=randint(g,0,c.kind==='window'?2:3);
    setCreatureState(g,c,state,at);if(c.kind==='bush'&&state===1)sound(g,c,0);
  }
}
function updateSensors(g,c) {
  const regions=[{x:c.baseX+66,y:c.baseY-3,w:c.rightLimit-c.baseX-66,h:30},
    {x:0,y:c.baseY-3,w:c.baseX,h:30}];
  for(let side=0;side<2;side++) {
    const occupants=new Set(g.actors().filter(p=>p.active!==false&&p.dead<=0&&rectsOverlap(playerRect(p.x,p.y),regions[side])).map(p=>p.id));
    c.counts[side]=occupants.size;
    for(const id of occupants)if(!c.sensors[side].has(id)&&randint(g,0,3)===0)emerge(g,c,side,g.elapsed);
    c.sensors[side]=occupants;
  }
}
export function updateCreatures(g) {
  for(const c of g.creatures) {
    if(c.kind==='mouse'&&!c.dead)updateSensors(g,c);
    let guard=0;
    while(g.elapsed+1e-9>=c.nextAt&&guard++<128)complete(g,c,c.nextAt);
    if(c.kind==='mouse'&&!c.dead&&g.elapsed+1e-9>=c.cooldownAt)emerge(g,c,randint(g,0,1),c.cooldownAt);
    const a=animationInfo(c),max=c.kind==='window'?a.blocks.length-1:a.frames-1;
    const elapsedMs=Math.max(0,(g.elapsed-c.startedAt)*1000);
    let block=0;while(block<max&&a.blocks[block+1].timeMs<=elapsedMs+1e-7)block++;
    c.frame=a.blocks[block].frame;c.offsetX=0;c.offsetY=0;
    for(let i=0;i<=block;i++){c.offsetX+=a.blocks[i].delta[0];c.offsetY+=a.blocks[i].delta[1];}
  }
}
export function creatureVulnerable(c) {return !c.dead&&!!c.hitRect&&(c.kind!=='mouse'||c.state%4===2);}
export function hitCreature(g,c,bullet) {
  if(!creatureVulnerable(c))return;
  c.dead=true;c.ready=false;c.cooldownAt=Infinity;
  const state=c.kind==='mouse'?c.state+1:4;
  setCreatureState(g,c,state);sound(g,c,c.kind==='rabbit'?1:c.kind==='bush'?2:3);
  g.onEvent({type:'creatureHit',creature:c,player:g.players.find(p=>p.id===bullet.owner)});
}
