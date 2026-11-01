// Network game relay for the web reconstruction (the original used DirectPlay sessions over
// TCP/IP or IPX). A minimal RFC 6455 WebSocket endpoint on /net, no dependencies. The server
// only keeps the list of sessions and relays JSON messages; the host browser runs the game
// (the original's authority checks, native 0x4a) and the other browsers send input to it.
//
// Client -> server:  {t:'list'} | {t:'host',name,total} | {t:'join',id} | {t:'leave'}
//                    {t:'start'} (host: hides the session from the list)
//                    {t:'send',to?,data,drop?} (drop: may be skipped for a slow receiver)
// Server -> client:  {t:'sessions',list} | {t:'hosted',id,peer:0} | {t:'joined',id,peer}
//                    {t:'peer-join',peer} | {t:'peer-leave',peer} | {t:'msg',from,data}
//                    {t:'closed'} (the host left or the session expired) | {t:'error',text}
//
// Nothing a client sends may take the server down or keep resources: connections answer pings
// or are dropped, floods and oversized frames disconnect, abandoned sessions expire.
import {createHash} from 'node:crypto';

const GUID='258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_MESSAGE=1<<20,MAX_SESSIONS=64,MAX_PEERS=4,MAX_CONNECTIONS=512;
const RATE_WINDOW=1000,RATE_LIMIT=300,SOFT_BACKLOG=1<<18,HARD_BACKLOG=1<<22;
const LIMITS={heartbeat:15000,lobbyIdle:30*60000,gameIdle:60000,loneConnection:10*60000,sweep:5000};

function frame(op,data) {
  const n=data.length;
  const head=n<126?Buffer.from([0x80|op,n]):n<65536?Buffer.from([0x80|op,126,n>>8,n&255]):Buffer.concat([Buffer.from([0x80|op,127]),(()=>{const b=Buffer.alloc(8);b.writeBigUInt64BE(BigInt(n));return b;})()]);
  return Buffer.concat([head,data]);
}

// One connection: parses client frames (always masked), answers pings, reassembles fragments.
function connection(socket,onText,onClose) {
  let buffer=Buffer.alloc(0),fragments=[],fragmentBytes=0,closed=false,windowStart=0,count=0;
  const finish=()=>{if(closed)return;closed=true;onClose();};
  const conn={
    alive:true,
    get backlog(){return socket.writableLength;},
    raw(data){if(closed||!socket.writable)return;if(socket.writableLength>HARD_BACKLOG){conn.kill();return;}socket.write(data);},
    send(obj){conn.raw(frame(1,Buffer.from(JSON.stringify(obj))));},
    ping(){conn.raw(frame(9,Buffer.alloc(0)));},
    close(){if(closed)return;conn.raw(frame(8,Buffer.alloc(0)));finish();socket.end();},
    kill(){finish();socket.destroy();},
  };
  socket.on('data',chunk=>{
    conn.alive=true;
    buffer=buffer.length?Buffer.concat([buffer,chunk]):chunk;
    while(!closed) {
      if(buffer.length<2)return;
      const fin=buffer[0]&0x80,rsv=buffer[0]&0x70,op=buffer[0]&15,masked=buffer[1]&0x80;let len=buffer[1]&127,at=2;
      if(len===126){if(buffer.length<4)return;len=buffer.readUInt16BE(2);at=4;}
      else if(len===127){if(buffer.length<10)return;len=Number(buffer.readBigUInt64BE(2));at=10;}
      const control=op>=8;
      if(rsv||!masked||len>MAX_MESSAGE||(control&&(len>125||!fin))||![0,1,8,9,10].includes(op)){conn.kill();return;}
      if(buffer.length<at+4+len)return;
      const mask=buffer.subarray(at,at+4),payload=Buffer.from(buffer.subarray(at+4,at+4+len));
      for(let i=0;i<payload.length;i++)payload[i]^=mask[i&3];
      buffer=buffer.subarray(at+4+len);
      if(op===8){conn.close();return;}
      if(op===9){conn.raw(frame(10,payload));continue;}
      if(op===10)continue;
      const now=Date.now();if(now-windowStart>RATE_WINDOW){windowStart=now;count=0;}
      if(++count>RATE_LIMIT){conn.kill();return;}
      fragmentBytes+=payload.length;if(fragmentBytes>MAX_MESSAGE){conn.kill();return;}
      fragments.push(payload);
      if(fin){const text=Buffer.concat(fragments).toString('utf8');fragments=[];fragmentBytes=0;onText(text);}
    }
  });
  socket.on('close',finish);
  return conn;
}

export function attachNetServer(server,options={}) {
  const limits={...LIMITS,...options},sessions=new Map(),connections=new Set();let nextId=1;
  const listing=()=>[...sessions.values()].filter(s=>!s.started).map(s=>({id:s.id,name:s.name,players:s.peers.size,total:s.total}));
  function dissolve(s) {
    sessions.delete(s.id);
    for(const p of s.peers.values()){p.session=null;p.touched=Date.now();p.conn.send({t:'closed'});}
    s.peers.clear();
  }
  function leave(c) {
    const s=c.session;if(!s)return;c.session=null;s.peers.delete(c.peer);c.touched=Date.now();
    if(c.peer===0)dissolve(s);
    else for(const p of s.peers.values())p.conn.send({t:'peer-leave',peer:c.peer});
  }
  function handle(c,msg) {
    if(msg===null||typeof msg!=='object')return;
    switch(msg.t) {
      case 'list':c.conn.send({t:'sessions',list:listing()});break;
      case 'host': {
        leave(c);if(sessions.size>=MAX_SESSIONS){c.conn.send({t:'error',text:'Příliš mnoho her.'});break;}
        const name=typeof msg.name==='string'&&msg.name.trim()?msg.name.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,40)||'Hra':'Hra',total=Number.isInteger(msg.total)?msg.total:2;
        const s={id:nextId++,name,total:Math.max(2,Math.min(MAX_PEERS,total)),peers:new Map(),started:false,next:1,touched:Date.now()};
        sessions.set(s.id,s);c.session=s;c.peer=0;s.peers.set(0,c);c.conn.send({t:'hosted',id:s.id,peer:0});break;
      }
      case 'join': {
        const s=sessions.get(msg.id);
        if(!s||s.started){c.conn.send({t:'error',text:'Hra už neexistuje.'});break;}
        if(s.peers.size>=s.total){c.conn.send({t:'error',text:'Hra je plná.'});break;}
        leave(c);c.session=s;c.peer=s.next++;s.touched=Date.now();
        for(const p of s.peers.values())p.conn.send({t:'peer-join',peer:c.peer});
        s.peers.set(c.peer,c);c.conn.send({t:'joined',id:s.id,peer:c.peer});break;
      }
      case 'leave':leave(c);break;
      case 'start':if(c.session&&c.peer===0){c.session.started=true;c.session.touched=Date.now();}break;
      case 'send': {
        const s=c.session;if(!s)break;
        if(c.peer===0||!s.started)s.touched=Date.now(); // a running game lives from the host's snapshots
        const text=frame(1,Buffer.from(JSON.stringify({t:'msg',from:c.peer,data:msg.data})));
        const deliver=p=>{if(!msg.drop||p.conn.backlog<SOFT_BACKLOG)p.conn.raw(text);};
        if(msg.to!==undefined){const p=s.peers.get(msg.to);if(p)deliver(p);}
        else for(const [peer,p] of s.peers)if(peer!==c.peer)deliver(p);
        break;
      }
    }
  }
  server.on('upgrade',(req,socket)=>{
    socket.on('error',()=>{});
    try {
      const key=req.headers['sec-websocket-key'];
      if(new URL(req.url,'http://x').pathname!=='/net'||!key||connections.size>=MAX_CONNECTIONS){socket.destroy();return;}
      const accept=createHash('sha1').update(key+GUID).digest('base64');
      socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
      socket.setNoDelay(true);
      const c={session:null,peer:null,touched:Date.now()};connections.add(c);
      c.conn=connection(socket,text=>{try{handle(c,JSON.parse(text));}catch{}},()=>{connections.delete(c);leave(c);});
    }catch{socket.destroy();}
  });
  // A dead phone never closes its socket: no answer to the previous ping means it is gone.
  const heartbeat=setInterval(()=>{for(const c of connections){if(!c.conn.alive){c.conn.kill();continue;}c.conn.alive=false;c.conn.ping();}},limits.heartbeat);
  const sweep=setInterval(()=>{
    const now=Date.now();
    for(const s of sessions.values())if(now-s.touched>(s.started?limits.gameIdle:limits.lobbyIdle))dissolve(s);
    for(const c of connections)if(!c.session&&now-c.touched>limits.loneConnection)c.conn.close();
  },limits.sweep);
  heartbeat.unref?.();sweep.unref?.();
  server.on('close',()=>{clearInterval(heartbeat);clearInterval(sweep);});
  return {sessions,connections};
}
