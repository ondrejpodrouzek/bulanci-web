// Network game over the WebSocket relay (server: net-server.mjs). The original created a
// DirectPlay session (Start hry 1: Vytvořit / Připojit se, TCP/IP); the host computer is the
// authority (script native 0x4a) and runs the game. Here the host browser runs the Game with
// every player, the other browsers send their keys and draw the snapshots the host sends.
//
// Lobby messages (relayed in {t:'send'} data):
//   hello   {humans:[{name,colorIndex}]}             guest -> host, also after any change
//   lobby   {players,info}                           host -> all; info: level, rules, playing
//   reject  {text}                                   host -> guest (no free place)
//   chat    {text}                                   anyone -> all
//   notice  {text}                                   host -> all, during a round
//   start   {level,map,rules,players}                host -> all
// Game messages:
//   input   {inputs:[{direction,fire,presses}]}      guest -> host, on every change
//   weapon  {index}                                  guest -> host (local player index)
//   snap    {s,events}                               host -> all, every SNAP_TICKS ticks
//   end     {s}                                      host -> all
import {eliminated} from './rules.js';
export const SNAP_TICKS=2,HOST_TIMEOUT=8000,STALL_NOTICE=2500,SNAP_MS=SNAP_TICKS*1000/60,GLIDE_LIMIT=80,MAX_PLAYERS=4;
export const netURL=()=>`${location.protocol==='https:'?'wss':'ws'}://${location.host}/net`;

export function connectNet(url=netURL()) {
  const ws=new WebSocket(url),handlers=new Map();
  const emit=(t,m)=>{for(const f of [...(handlers.get(t)??[])])try{f(m);}catch(e){console.error(e);}};
  const net={
    peer:null,sessionId:null,open:false,
    on(t,f){if(!handlers.has(t))handlers.set(t,new Set());handlers.get(t).add(f);return()=>handlers.get(t)?.delete(f);},
    once(t){return new Promise(r=>{const off=net.on(t,m=>{off();r(m);});});},
    send(o){if(ws.readyState===1)ws.send(JSON.stringify(o));},
    post(data,to,drop){net.send({t:'send',to,data,drop});},
    list(){const p=Promise.race([net.once('sessions'),net.once('disconnect')]);net.send({t:'list'});return p.then(m=>m.list??[]);},
    close(){try{ws.close();}catch{}},
  };
  net.ready=new Promise((ok,fail)=>{ws.onopen=()=>{net.open=true;ok(net);};ws.onerror=()=>fail(new Error('Herní server neodpovídá.'));});
  ws.onmessage=e=>{let m;try{m=JSON.parse(e.data);}catch{return;}
    if(m.t==='msg'&&m.data&&typeof m.data==='object')emit(m.data.kind,{...m.data,from:m.from});
    else{if(m.t==='hosted'||m.t==='joined'){net.peer=m.peer;net.sessionId=m.id;}emit(m.t,m);}};
  ws.onclose=()=>{net.open=false;emit('disconnect',{});};
  return net;
}

// Everybody in a game has an own name and colour, so nobody has to sort out two green Bulíks:
// who came first keeps theirs, the next one gets a number or the first free colour.
export function settle(list) {
  const names=new Set(),colors=new Set();
  return list.map(p=>{
    let name=p.name,n=1;while(names.has(name))name=`${p.name.slice(0,36)} ${++n}`;names.add(name);
    const colorIndex=colors.has(p.colorIndex)?[0,1,2,3,4,5,6,7].find(c=>!colors.has(c)):p.colorIndex;colors.add(colorIndex);
    return {...p,name,colorIndex};
  });
}

// Host lobby: own players first, then each guest's players in join order. info() describes the
// game for the guests and the server's list.
export function hostLobby(net,{locals,info,onChange,onJoin,onLeave}) {
  const guests=new Map(),chat=[];
  const players=()=>settle([...locals().map(h=>({...h,peer:0})),...[...guests].flatMap(([peer,hs])=>hs.map(h=>({...h,peer})))]);
  const publish=()=>{
    const list=players(),about=info();
    net.post({kind:'lobby',players:list.map(({name,colorIndex,peer})=>({name,colorIndex,peer})),info:about});
    net.send({t:'info',level:about.levelName,rule:about.summary,seats:list.length});onChange?.(list,chat);
  };
  const say=line=>{chat.push(line.slice(0,160));net.post({kind:'chat',text:line.slice(0,160)});onChange?.(players(),chat);};
  const offs=[
    net.on('hello',m=>{
      const humans=(m.humans??[]).slice(0,3).map(h=>({name:String(h.name??'').slice(0,40)||'Hráč',colorIndex:(h.colorIndex|0)&7})),fresh=!guests.has(m.from);
      const others=players().filter(p=>p.peer!==m.from).length;
      if(others+humans.length>MAX_PLAYERS){net.post({kind:'reject',text:fresh?'Ve hře není dost volných míst.':'Další hráč se už nevejde.'},m.from);return;}
      guests.set(m.from,humans);publish();
      if(fresh){const names=players().filter(p=>p.peer===m.from).map(p=>p.name);say(`Přichází: ${names.join(', ')}`);onJoin?.(names);}
    }),
    net.on('peer-leave',m=>{
      const names=players().filter(p=>p.peer===m.peer).map(p=>p.name);
      if(guests.delete(m.peer)){publish();say(`Odchází: ${names.join(', ')}`);onLeave?.(names);}
    }),
    net.on('chat',m=>{chat.push(String(m.text).slice(0,160));onChange?.(players(),chat);}),
  ];
  return {
    players,chat,publish,
    say(text){say(`${players()[0]?.name??'Host'}: ${text}`);},
    close(){offs.forEach(f=>f());},
  };
}

export function guestLobby(net,{humans,onChange,onStart,onReject,onNotice}) {
  let players=[],info=null;const chat=[];
  const offs=[
    net.on('lobby',m=>{if(m.from!==0)return;players=m.players;info=m.info;onChange?.(players,chat,info);}),
    net.on('chat',m=>{chat.push(String(m.text).slice(0,160));onChange?.(players,chat,info);}),
    net.on('reject',m=>{if(m.from===0)onReject?.(m.text);}),
    net.on('notice',m=>{if(m.from===0)onNotice?.(String(m.text).slice(0,160));}),
    net.on('start',m=>{if(m.from===0)onStart?.(m);}),
  ];
  const hello=()=>net.post({kind:'hello',humans:humans().map(({name,colorIndex})=>({name,colorIndex}))},0);
  hello();
  return {
    hello,chat,get players(){return players;},
    say(text){const line=`${players.find(p=>p.peer===net.peer)?.name??'Hráč'}: ${text}`.slice(0,160);chat.push(line);net.post({kind:'chat',text:line});onChange?.(players,chat,info);},
    close(){offs.forEach(f=>f());},
  };
}

// ---- running game -------------------------------------------------------------------------

const SNAP_FIELDS=['players','npcs','bullets','pickups','powerups','creatures','mines','explosions','teleports','time','elapsed','over','rules'];
export function snapshot(game) {
  const s={};for(const k of SNAP_FIELDS)s[k]=game[k];
  if(game.sceneAnims)s.sceneAnims={anims:game.sceneAnims.anims.map(a=>({shown:a.shown,dx:a.dx,dy:a.dy}))};
  return JSON.parse(JSON.stringify(s));
}
// Events carry actor objects; on the wire they carry ids.
const REFS=['player','victim','killer','owner','target'];
export function packEvent(e) {
  const out={};
  for(const [k,v] of Object.entries(e)){
    if(REFS.includes(k)&&v&&typeof v==='object')out[k]={ref:v.id,npc:!!v.npc};
    else if(v&&typeof v==='object'){try{out[k]=JSON.parse(JSON.stringify(v));}catch{}}
    else out[k]=v;
  }
  return out;
}
export function unpackEvent(e,game) {
  const out={...e};
  for(const k of REFS)if(e[k]?.ref!==undefined)out[k]=(e[k].npc?game.npcs:game.players).find(p=>p.id===e[k].ref)??null;
  return out;
}

// Host: remote inputs by player index, with presses counted so a short tap between two ticks
// still fires once (the engine fires on the press edge, 0x4121a0).
export function hostGame(net,{game,owners,onEmpty}) {
  const remote=new Map(),events=[];let tick=0;
  const offs=[
    net.on('input',m=>{let k=0;owners.forEach((peer,i)=>{if(peer===m.from){const input=m.inputs?.[k++];if(input){const prev=remote.get(i);remote.set(i,{direction:[0,1,2,3].includes(input.direction)?input.direction:undefined,fire:!!input.fire,presses:input.presses|0,used:prev?.used??0});}}});}),
    net.on('weapon',m=>{let k=0;owners.forEach((peer,i)=>{if(peer===m.from&&k++===(m.index|0))game.switchWeapon(i);});}),
    // A leaver vanishes from the field; the round goes on while two players can still fight.
    net.on('peer-leave',m=>{
      let left=false;owners.forEach((peer,i)=>{if(peer===m.peer){remote.delete(i);game.players[i].active=false;left=true;}});
      if(left&&game.players.filter(p=>!p.bot&&p.active!==false&&!eliminated(game.rules,p)).length<2)onEmpty?.();
    }),
  ];
  return {
    event(e){events.push(packEvent(e));},
    input(i){const r=remote.get(i);if(!r)return {};const pressed=r.presses>r.used;r.used=r.presses;
      if(pressed&&!r.fire)game.players[i].fireHeld=false;return {direction:r.direction,fire:r.fire||pressed};},
    afterUpdate(){if(++tick%SNAP_TICKS)return;const drop=!events.length;net.post({kind:'snap',s:snapshot(game),events:events.splice(0)},undefined,drop);},
    end(){net.post({kind:'end',s:snapshot(game),events:events.splice(0)});},
    close(){offs.forEach(f=>f());},
  };
}

// Guest: a mirror the renderer and the score screen read like a Game; it never simulates.
export function guestGame(net,{start,onSnapshot,onEnd,onLost,onStall}) {
  const game={mirror:true,map:start.map,mode:'local',humans:start.players,rules:start.rules,players:[],npcs:[],bullets:[],pickups:[],powerups:null,creatures:[],mines:[],explosions:[],teleports:[],sceneAnims:null,time:0,elapsed:0,over:false,
    switchWeapon(){},finish(){}};
  let heard=Date.now();
  // Snapshots come every 33 ms: a mover glides to the new place instead of jumping. A long way
  // is a respawn or a teleport and stays a jump.
  const glide=[];
  function prepare(before,now) {
    glide.length=0;
    for(const list of ['players','npcs'])for(const p of game[list]??[]) {
      const old=before.get(`${list}${p.id}`);
      if(old&&(old.x!==p.x||old.y!==p.y)&&Math.hypot(old.x-p.x,old.y-p.y)<GLIDE_LIMIT){glide.push({p,fromX:old.x,fromY:old.y,toX:p.x,toY:p.y,at:now});p.x=old.x;p.y=old.y;}
    }
  }
  const apply=(m,now=performance.now())=>{
    if(m.from!==0)return false;heard=Date.now();
    const before=new Map();for(const list of ['players','npcs'])for(const p of game[list]??[])before.set(`${list}${p.id}`,{x:p.x,y:p.y});
    for(const g of glide){g.p.x=g.toX;g.p.y=g.toY;}
    Object.assign(game,m.s);prepare(before,now);
    onSnapshot?.(game,(m.events??[]).map(e=>unpackEvent(e,game)));return true;
  };
  // The host's tab can sleep (phone locked, tab hidden) with its connection still open.
  const watchdog=setInterval(()=>{const quiet=Date.now()-heard;if(quiet>HOST_TIMEOUT)onLost?.();else if(quiet>STALL_NOTICE)onStall?.();},1000);watchdog.unref?.();
  const offs=[net.on('snap',apply),net.on('end',m=>{if(!apply(m))return;game.over=true;clearInterval(watchdog);onEnd?.(game);})];
  let presses=[],last='';
  return {
    game,
    sendInput(inputs){
      const out=inputs.map((x,i)=>{const p=presses[i]??={held:false,n:0};if(x.fire&&!p.held)p.n++;p.held=!!x.fire;return {direction:x.direction,fire:!!x.fire,presses:p.n};});
      const key=JSON.stringify(out);if(key!==last){last=key;net.post({kind:'input',inputs:out},0);}
    },
    weapon(index){net.post({kind:'weapon',index},0);},
    smooth(now){for(const g of glide){const t=Math.min(1,(now-g.at)/SNAP_MS);g.p.x=g.fromX+(g.toX-g.fromX)*t;g.p.y=g.fromY+(g.toY-g.fromY)*t;}},
    close(){clearInterval(watchdog);offs.forEach(f=>f());},
  };
}
