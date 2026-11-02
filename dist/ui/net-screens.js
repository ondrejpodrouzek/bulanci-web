// Network play on a computer, in the look of the original screens: the same widgets on the menu
// picture as Start hry (the window of CStartGame2, the chat of CChatList 0x40d010). The state comes
// from app.js in the same form as for the phone page (net-ui.js).
import {StaticText,Button,Radio,Check,TextEdit,NumEdit,ColorSet,Picture,ListBox,Bulanek,Window,loadSpriteManifest,sunkenFrame,stateAlpha} from './widgets.js';
import {drawText} from './font.js';
import {PLAY_MODES,PLAY_NAMES,MAX_BOTS} from '../rules.js';
import {BOT_MODES} from '../training.js';

const NAME_MAX=16;
class ChatList {
  constructor(p){Object.assign(this,{lines:[],visible:true,disabled:false,focused:false,font:175,lineHeight:15},p);}
  contains(){return false;}
  draw(ctx,o) {
    const r={x:o.x+this.x,y:o.y+this.y,w:this.w,h:this.h};sunkenFrame(ctx,r,stateAlpha(this),-1);
    const rows=Math.floor((this.h-8)/this.lineHeight);
    this.lines.slice(-rows).forEach((line,i)=>drawText(ctx,this.font,line,{x:r.x+6,y:r.y+4+i*this.lineHeight,w:r.w-12,h:this.lineHeight},{flags:4,alpha:0x90/255}));
  }
  pointerDown(){} pointerUp(){} key(){return false;}
}
const small=p=>new StaticText({font:175,...p});

export function createNetScreens({dialogs,levels,ruleRanges}) {
  let manifest=null,view=null,hub=null,room=null,lastSig='',held=null;
  loadSpriteManifest().then(m=>{manifest=m;});
  const seatPreview=(x,y,colorIndex,seat)=>[new Picture({x,y,image:27,alpha:0x80/255}),new Bulanek({x:x+10,y:y+15,resource:180+seat%4,colorIndex,manifest})];

  // ---- list of games ---------------------------------------------------------------------
  const covers=on=>document.querySelector('#game-frame')?.classList.toggle('net-open',on); // the web's menu links would run under the status line
  async function showHub(state) {
    await loadSpriteManifest().then(m=>{manifest=m;});
    view='hub';room=null;lastSig='';covers(true);
    const h=state.humans[0],[frame,preview]=seatPreview(30,93,h.colorIndex,0);
    const colors=new ColorSet({x:27,y:50,selected:h.colorIndex,onChange:c=>{h.colorIndex=c;preview.colorIndex=c;state.onHumans();}});
    const name=new TextEdit({x:140,y:72,w:160,value:h.name,fallback:h.name,digits:NAME_MAX,onChange:t=>{h.name=t;state.onHumans();}});
    const create=new Button({x:140,y:110,text:'Založit',disabled:true,onClick:()=>{create.disabled=true;state.onCreate();}});
    const code=new TextEdit({x:330,y:72,w:90,value:'',digits:4});
    const goCode=()=>{const c=code.text.trim().toUpperCase();if(c.length===4)state.onJoin(c);};
    const list=new ListBox({x:30,y:215,w:450,h:190,items:[],selected:0});
    const join=new Button({x:30,y:416,text:'Připojit',disabled:true,onClick:()=>{const g=hub.games[list.selected];if(g)state.onJoin(g.id);}});
    const note=small({x:125,y:421,w:355,h:15,flags:4,text:state.notice??'',bright:true});
    const status=new StaticText({x:20,y:190,text:'Připojuji se k serveru...',spacing:2});
    const win=new Window({x:250,y:60,w:510,h:500,widgets:[
      new StaticText({x:20,y:20,text:'Hra po síti',spacing:2}),colors,frame,preview,
      small({x:140,y:52,text:'Jméno:'}),name,create,
      small({x:330,y:52,text:'Kód hry:'}),code,new Button({x:330,y:110,text:'Připojit',onClick:goCode}),
      status,list,join,note,new Button({x:20,y:456,text:'Zpět',onClick:()=>state.onBack()}),
    ]});
    win.onCancel=()=>state.onBack();
    hub={...state,win,list,join,create,note,status,games:[]};
    dialogs.show(win);
  }
  function setGames(games) {
    if(view!=='hub')return;hub.games=games;
    hub.list.items=games.map(g=>`${g.name}: ${[g.level,g.playing?'právě se hraje':null].filter(Boolean).join(', ')} (${g.players}/${g.total})`);
    hub.list.selected=Math.min(hub.list.selected,Math.max(0,games.length-1));
    hub.join.disabled=!games.some(g=>g.players<g.total);
    hub.status.text=games.length?'Čekající hry:':'Zatím tu žádná hra nečeká.';
  }
  function setOnline(){if(view==='hub')hub.create.disabled=false;}
  function setOffline(){if(view==='hub')hub.status.text='Herní server neodpovídá.';}
  function notice(text) {
    if(view==='hub'){hub.note.text=text;hub.create.disabled=false;}
    else if(room){room.status.text=text;room.noticeUntil=performance.now()+4000;}
  }

  // ---- room ------------------------------------------------------------------------------
  function seat(s,i,widgets) {
    const x0=18+124*i,p=s.players[i],mine=s.players.filter(q=>q.peer===s.peer),teams=s.info.rules?.play==='teams';
    if(!p) {
      widgets.push(new Picture({x:x0+3,y:44,image:27,alpha:0x30/255}),small({x:x0-5,y:130,w:100,h:20,flags:5,text:'Volné místo',disabled:true}));
      if(s.humans.length<3&&i===s.players.length)widgets.push(new Button({x:x0,y:156,text:'Přidat',onClick:()=>room.state.onLocalPlayers(s.humans.length+1)}));
      return;
    }
    const k=mine.indexOf(p);
    widgets.push(...seatPreview(x0+3,44,p.colorIndex,i));
    if(k<0) {
      widgets.push(small({x:x0-5,y:130,w:100,h:20,flags:5,text:p.name,bright:true}));
      if(teams)widgets.push(small({x:x0-5,y:147,w:100,h:15,flags:5,text:`Tým ${(p.team??0)+1}`}));
      else widgets.push(small({x:x0-5,y:147,w:100,h:15,flags:5,text:p.peer===0?'hostitel':'připojen'}));
      if(s.role==='host')widgets.push(new Button({x:x0,y:164,h:20,text:'Odebrat',onClick:()=>room.state.onKick(p.peer)}));
      return;
    }
    widgets.push(new ColorSet({x:x0,y:6,selected:p.colorIndex,onChange:c=>room.state.onHuman(k,{colorIndex:c})}),
      new TextEdit({tag:`name${k}`,isName:true,x:x0-5,y:128,w:100,value:p.name,fallback:p.name,digits:NAME_MAX,onChange:t=>{if(t!==p.name)room.state.onHuman(k,{name:t});else flush();}}));
    if(teams)widgets.push(new Button({x:x0,y:156,text:`Tým ${(p.team??0)+1}`,onClick:()=>room.state.onHuman(k,{team:(p.team??0)?0:1})}));
    else widgets.push(new Button({x:x0,y:156,text:k>0&&k===mine.length-1?'Odebrat':'Ovládání',onClick:()=>{if(k>0&&k===mine.length-1)room.state.onLocalPlayers(s.humans.length-1);else room.state.onKeys(s.humans[k]?.keys??0);}}));
  }
  function setup(s,widgets) {
    const host=s.role==='host',r=s.info.rules??{};
    widgets.push(small({x:20,y:330,w:490,h:15,flags:4,text:s.info.summary}));
    if(!host){
      widgets.push(new StaticText({x:20,y:200,text:'Level:',spacing:2}),small({x:20,y:224,text:s.info.levelName,bright:true}));
      return;
    }
    const all=levels();
    widgets.push(new StaticText({x:20,y:192,text:'Level:',spacing:2}),
      new ListBox({tag:'level',x:20,y:212,w:170,h:112,items:all.map(l=>l.name),selected:Math.max(0,all.findIndex(l=>l.key===s.info.level)),onChange:i=>room.state.onLevel(all[i].key)}),
      new StaticText({x:205,y:192,text:'Hra:',spacing:2}),
      new Radio({tag:'play',x:205,y:214,w:150,items:PLAY_MODES.map(m=>PLAY_NAMES[m]),selected:Math.max(0,PLAY_MODES.indexOf(r.play)),onChange:i=>room.state.onRules({play:PLAY_MODES[i]})}),
      new Button({tag:'type',x:205,y:278,text:'Typ hry',onClick:()=>room.state.onTypeDialog()}),
      new StaticText({x:370,y:192,text:'Boti:',spacing:2}),
      new NumEdit({tag:'bots',x:425,y:188,w:50,digits:1,min:0,max:MAX_BOTS,value:r.bots??0,onChange:v=>{if(v!==(room?.state.info.rules?.bots??0))room.state.onRules({bots:v});}}),
      new Radio({tag:'foes',x:370,y:216,w:140,items:['Stojí','Chodí','Loví'],selected:Math.max(0,BOT_MODES.indexOf(r.foes)),onChange:i=>room.state.onRules({foes:BOT_MODES[i]})}),
      new Check({tag:'fight',x:370,y:272,w:140,text:'Střílí i po sobě',checked:r.fight!==false,onChange:v=>room.state.onRules({fight:v})}));
  }
  function build(s) {
    const widgets=[];
    for(let i=0;i<s.maxPlayers;i++)seat(s,i,widgets);
    setup(s,widgets);
    const say=held?.say??new TextEdit({tag:'say',x:20,y:436,w:490,value:'',digits:120});
    const chat=held?.chat??new ChatList({x:20,y:352,w:490,h:80});
    say.commit=()=>{};say.onEnter=()=>{const t=say.text.trim();say.text='';if(t)room.state.onSay(t);};
    const status=small({x:20,y:490,w:490,h:15,flags:4,text:''});
    const start=new Button({x:338,y:463,text:'Spustit',visible:s.role==='host',onClick:()=>room.state.onStart()});
    const leave=new Button({x:428,y:463,text:s.role==='host'?'Ukončit':'Odejít',onClick:()=>room.state.onLeave()});
    const invite=new Button({tag:'invite',x:150,y:463,text:'Pozvat',onClick:async()=>{
      try{await navigator.clipboard.writeText(room.state.link);notice('Odkaz je ve schránce, pošlete ho kamarádům.');}catch{notice(room.state.link);}}});
    widgets.push(chat,say,new StaticText({x:20,y:467,text:`Kód: ${s.code}`,spacing:2}),invite,start,leave,status);
    const win=new Window({x:230,y:50,w:530,h:510,widgets});
    win.onCancel=()=>room.state.onLeave();
    const previous=room?.win.focus?.tag;
    room={state:s,win,chat,say,status,start,noticeUntil:0};held={say,chat};
    win.setFocus(widgets.find(w=>previous&&w.tag===previous)??say);
    dialogs.show(win);
  }
  function flush(){if(room?.pending){const s=room.pending;room.pending=null;showLobby(s);}}
  function showLobby(s) {
    if(view!=='lobby'){view='lobby';hub=null;held=null;room=null;lastSig='';}covers(true);
    const sig=JSON.stringify([s.role,s.players,s.humans.map(h=>h.name),s.info.level,s.info.summary,s.info.rules]);
    // A name being typed is not thrown away by somebody else's change.
    if(sig!==lastSig&&room?.win.focus?.isName){room.pending=s;room.state=s;}
    else if(sig!==lastSig||!room||hidden){lastSig=sig;hidden=false;build(s);}
    else room.state=s;
    const host=s.role==='host',enough=s.players.length>=2||s.alone;
    room.chat.lines=s.chat;room.start.disabled=!enough;
    if(performance.now()>room.noticeUntil)room.status.text=s.info.playing?'Právě se hraje kolo. Do dalšího se přidáte sami.':host?(enough?`Hráči: ${s.players.length} ze ${s.maxPlayers}. Spusťte hru, až budou všichni tady.`:'Zatím tu jste sami. Přidejte boty nebo pošlete kamarádům kód.'):'Hru spustí hostitel. Zatím si nastavte jméno a barvu.';
  }
  let hidden=false;
  function hide(){hidden=true;covers(false);dialogs.hide();}
  return {showHub,setGames,setOnline,setOffline,notice,showLobby,hide};
}
