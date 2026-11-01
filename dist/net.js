// Network game over the WebSocket relay (server: net-server.mjs). The original created a
// DirectPlay session (Start hry 1: Vytvořit / Připojit se, TCP/IP); the host computer is the
// authority (script native 0x4a) and runs the game. Here the host browser runs the Game with
// every player, the other browsers send their keys and draw the snapshots the host sends.
//
// Lobby messages (relayed in {t:'send'} data):
//   hello   {humans:[{name,colorIndex}]}            guest -> host, also after any change
//   lobby   {players:[{name,colorIndex,peer}],total} host -> all
//   reject  {text}                                   host -> guest (no free slot)
//   chat    {text}                                   anyone -> all
//   start   {level,map,rules,players}                host -> all
// Game messages:
//   input   {inputs:[{direction,fire,presses}]}      guest -> host, on every change
//   weapon  {index}                                  guest -> host (local player index)
//   snap    {s,events}                               host -> all, every SNAP_TICKS ticks
//   end     {s}                                      host -> all
export const SNAP_TICKS=2,HOST_TIMEOUT=8000;
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
  net.ready=new Promise((ok,fail)=>{ws.onopen=()=>{net.open=true;ok(net);};ws.onerror=()=>fail(new Error('Hra po síti tady nejde, potřebuje běžící server. Hrajte na adrese svého serveru.'));});
  ws.onmessage=e=>{let m;try{m=JSON.parse(e.data);}catch{return;}
    if(m.t==='msg'&&m.data&&typeof m.data==='object')emit(m.data.kind,{...m.data,from:m.from});
    else{if(m.t==='hosted'||m.t==='joined'){net.peer=m.peer;net.sessionId=m.id;}emit(m.t,m);}};
  ws.onclose=()=>{net.open=false;emit('disconnect',{});};
  return net;
}

// Host lobby: own players first, then each guest's players in join order (max `total`).
export function hostLobby(net,{total,locals,onChange}) {
  const guests=new Map();const chat=[];
  const players=()=>[...locals.map(h=>({...h,peer:0})),...[...guests].flatMap(([peer,hs])=>hs.map(h=>({...h,peer})))];
  const publish=()=>{const list=players();net.post({kind:'lobby',players:list.map(({name,colorIndex,peer})=>({name,colorIndex,peer})),total});onChange?.(list,chat);};
  const offs=[
    net.on('hello',m=>{
      const humans=(m.humans??[]).slice(0,3).map(h=>({name:String(h.name??'').slice(0,40)||'Hráč',colorIndex:(h.colorIndex|0)&7}));
      const others=players().filter(p=>p.peer!==m.from).length;
      if(others+humans.length>total){net.post({kind:'reject',text:'Ve hře není dost volných míst.'},m.from);return;}
      guests.set(m.from,humans);publish();
    }),
    net.on('peer-leave',m=>{if(guests.delete(m.peer))publish();}),
    net.on('chat',m=>{chat.push(String(m.text).slice(0,160));onChange?.(players(),chat);}),
  ];
  return {
    players,chat,publish,
    say(text){const line=`${locals[0]?.name??'Host'}: ${text}`.slice(0,160);chat.push(line);net.post({kind:'chat',text:line});onChange?.(players(),chat);},
    full:()=>players().length===total,
    close(){offs.forEach(f=>f());},
  };
}

export function guestLobby(net,{humans,onChange,onStart,onReject}) {
  let players=[],total=0;const chat=[];
  const offs=[
    net.on('lobby',m=>{if(m.from!==0)return;players=m.players;total=m.total;onChange?.(players,chat,total);}),
    net.on('chat',m=>{chat.push(String(m.text).slice(0,160));onChange?.(players,chat,total);}),
    net.on('reject',m=>{if(m.from===0)onReject?.(m.text);}),
    net.on('start',m=>{if(m.from===0)onStart?.(m);}),
  ];
  const hello=()=>net.post({kind:'hello',humans:humans().map(({name,colorIndex})=>({name,colorIndex}))},0);
  hello();
  return {
    hello,chat,get players(){return players;},
    say(text){const line=`${humans()[0]?.name??'Hráč'}: ${text}`.slice(0,160);chat.push(line);net.post({kind:'chat',text:line});onChange?.(players,chat,total);},
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
  const remote=new Map(),events=[],gone=new Set();let tick=0;
  const offs=[
    net.on('input',m=>{let k=0;owners.forEach((peer,i)=>{if(peer===m.from){const input=m.inputs?.[k++];if(input){const prev=remote.get(i);remote.set(i,{direction:[0,1,2,3].includes(input.direction)?input.direction:undefined,fire:!!input.fire,presses:input.presses|0,used:prev?.used??0});}}});}),
    net.on('weapon',m=>{let k=0;owners.forEach((peer,i)=>{if(peer===m.from&&k++===(m.index|0))game.switchWeapon(i);});}),
    // A leaver's last keys must not stay held; with no guest left the round has no point.
    net.on('peer-leave',m=>{owners.forEach((peer,i)=>{if(peer===m.peer){remote.delete(i);gone.add(peer);}});if(owners.every(peer=>peer===0||gone.has(peer)))onEmpty?.();}),
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
export function guestGame(net,{start,onSnapshot,onEnd,onLost}) {
  const game={mirror:true,map:start.map,mode:'local',humans:start.players,rules:start.rules,players:[],npcs:[],bullets:[],pickups:[],powerups:null,creatures:[],mines:[],explosions:[],teleports:[],sceneAnims:null,time:0,elapsed:0,over:false,
    switchWeapon(){},finish(){}};
  let heard=Date.now();
  const apply=m=>{if(m.from!==0)return false;heard=Date.now();Object.assign(game,m.s);onSnapshot?.(game,(m.events??[]).map(e=>unpackEvent(e,game)));return true;};
  // The host's tab can sleep (phone locked, tab hidden) with its connection still open.
  const watchdog=setInterval(()=>{if(Date.now()-heard>HOST_TIMEOUT)onLost?.();},1000);watchdog.unref?.();
  const offs=[net.on('snap',apply),net.on('end',m=>{if(!apply(m))return;game.over=true;clearInterval(watchdog);onEnd?.(game);})];
  let presses=[],last='';
  return {
    game,
    sendInput(inputs){
      const out=inputs.map((x,i)=>{const p=presses[i]??={held:false,n:0};if(x.fire&&!p.held)p.n++;p.held=!!x.fire;return {direction:x.direction,fire:!!x.fire,presses:p.n};});
      const key=JSON.stringify(out);if(key!==last){last=key;net.post({kind:'input',inputs:out},0);}
    },
    weapon(index){net.post({kind:'weapon',index},0);},
    close(){clearInterval(watchdog);offs.forEach(f=>f());},
  };
}
