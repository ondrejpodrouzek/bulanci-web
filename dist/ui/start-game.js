// Original start screens: CStartGame1 (0x40c650) and CStartGame2 (0x4104f0), and the
// "Ovládání" dialog (0x40f7d0). Coordinates and texts from the EXE (analysis/ui-re.md).
import {StaticText,Radio,Button,TextEdit,ColorSet,Picture,ListBox,Bulanek,Window,loadSpriteManifest} from './widgets.js';
import {measure} from './font.js';
import {RULE_SUMMARY} from './game-type-dialog.js';
import {duplicateName,nameUsedText} from './msg-dialog.js';
import {KEYSETS,keyName,defaultHumans} from '../players.js';
import {ChatList} from './net-dialogs.js';

// Level list order: the original list as seen on a period screenshot (Na dobrou noc, Malárie,
// Noční směna, Vybíjená), then the two later levels.
export const LEVELS=[['bedtime','Na dobrou noc'],['malaria','Malárie'],['factory','Noční směna'],['disco','Vybíjená'],['eightbit','V zajetí 8-bitu'],['exitus','Exitus']];

// Screen 1 (window 250,60 - 760,560): game, total players, players on this computer, link.
// Vytvořit with fewer players on this computer than in total, or Připojit se, is a network game
// (TCP/IP over the web relay; IPX has no web counterpart). Joining takes the total from the host.
export function startGame1({total=2,local,join=false,onNext}) {
  const gameRadio=new Radio({x:30,y:45,w:200,items:['Vytvořit','Připojit se'],selected:join?1:0});
  const totalRadio=new Radio({x:30,y:130,w:200,items:['1 hráč (trénink)','2 hráči','3 hráči','4 hráči'],selected:total-1});
  const localRadio=new Radio({x:30,y:248,w:200,items:['1 hráč','2 hráči','3 hráči'],selected:Math.min(2,(local??total)-1)});
  const linkRadio=new Radio({x:30,y:350,w:200,items:['TCP/IP protokol','IPX protokol'],selected:0});
  const sync=()=>{
    const joining=gameRadio.selected===1,t=totalRadio.selected+1;
    totalRadio.disabledItems=joining?[0,1,2,3]:[];
    const max=joining?3:Math.min(3,t);
    localRadio.selected=Math.min(localRadio.selected,max-1);
    localRadio.disabledItems=[0,1,2].filter(i=>i>=max);
    const network=joining||localRadio.selected+1<t;
    linkRadio.disabledItems=network?[1]:[0,1];
  };
  // A new total offers all its players on this computer (the local game) by default.
  totalRadio.onChange=()=>{localRadio.selected=Math.min(2,totalRadio.selected);sync();};
  // Joining starts with one player on this computer; the host's game decides the total.
  gameRadio.onChange=()=>{if(gameRadio.selected===1)localRadio.selected=0;sync();};localRadio.onChange=sync;sync();
  const win=new Window({x:250,y:60,w:510,h:500,widgets:[
    new StaticText({x:20,y:20,text:'Hru:',spacing:2}),gameRadio,
    new StaticText({x:20,y:105,text:'Počet hráčů celkem:',spacing:2}),totalRadio,
    new StaticText({x:20,y:223,text:'Na tomto počítači:',spacing:2}),localRadio,
    new StaticText({x:20,y:325,text:'Způsob připojení:',spacing:2}),linkRadio,
    new Button({x:20,y:456,text:'Dále',onClick:()=>onNext({total:totalRadio.selected+1,local:localRadio.selected+1,join:gameRadio.selected===1})}),
  ]});
  win.setFocus(totalRadio);
  return win;
}

// "Ovládání" (window 280x180): the key names of the player's key set.
export function keysDialog(keys) {
  const names=KEYSETS[keys].map(keyName).join('\n');
  const win=new Window({w:280,h:180,widgets:[
    new StaticText({x:20,y:20,text:'Vlevo:\nVpravo:\nNahoru:\nDolu:\nStřílení:\nZměna zbraně:',spacing:2}),
    new StaticText({x:155,y:21,text:names,font:175,spacing:2,leading:3}),
    new Button({x:100,y:140,text:'Ok',onClick:()=>win.onOk()}),
  ]});
  win.onOk=()=>true;win.onCancel=()=>false;
  return win;
}

// Screen 2 (window 230,50 - 760,560): one column per player (x0 = 34 + 130 i).
// A network game (network = {role:'host'|'guest', onSay}) shows the other computers' players in
// the next columns, the chat of 0x4102d0 at (240,244): 'Chat:', CChatList (250,270)-(510,410) and
// CChatEdit (250,418)-(510,450, font 175, 120 characters), and 'Čekám na zbytek hráčů...' (0xfc)
// until everybody is in. Only the host picks the level and the rules and starts the game.
export async function startGame2({total,humans,rules,levelKey,onBack,onStart,onRules,onSettings,onKeys,onPlayersChange=()=>{},onLevelChange=()=>{},onMessage=async()=>{},random=Math.random,network=null}) {
  const manifest=await loadSpriteManifest();
  const players=humans.map(h=>({...h}));
  const widgets=[];
  players.forEach((p,i)=>{
    const x0=34+130*i;
    const preview=new Bulanek({x:x0+10,y:68,resource:180+Math.floor(random()*4),colorIndex:p.colorIndex,manifest});
    widgets.push(new ColorSet({x:x0-3,y:10,selected:p.colorIndex,onChange:c=>{p.colorIndex=c;preview.colorIndex=c;onPlayersChange(players);}}),
      new Picture({x:x0,y:53,image:27,alpha:0x80/255}),preview,
      new TextEdit({x:x0-12,y:138,w:100,value:p.name,fallback:p.name,onChange:t=>{p.name=t;onPlayersChange(players);}}),
      new Button({x:x0-3,y:170,text:'Ovládání',onClick:()=>onKeys(p.keys)}));
  });
  const remote=[];
  if(network)for(let i=players.length;i<total;i++) {
    const x0=34+130*i,c={frame:new Picture({x:x0,y:53,image:27,alpha:0x80/255,visible:false}),
      preview:new Bulanek({x:x0+10,y:68,resource:180+Math.floor(random()*4),colorIndex:0,manifest,visible:false}),
      name:new StaticText({x:x0-12,y:142,w:100,h:20,flags:1,text:'',font:175})};
    remote.push(c);widgets.push(c.frame,c.preview,c.name);
  }
  const summaryText=()=>total===1?RULE_SUMMARY.time(150):RULE_SUMMARY[rules().type](rules().limits[rules().type])+(rules().weapons==='shotgun'?' Pouze brokovnice.':'');
  const summary=new StaticText({x:122,y:214,text:summaryText(),font:175});
  if(total>1&&network?.role!=='guest')widgets.push(new Button({x:31,y:208,text:'Typ hry',onClick:async()=>{await onRules();summary.text=summaryText();}}));
  else{const label='Typ hry:';widgets.push(new StaticText({x:20,y:210,text:label,spacing:2}));summary.x=20+measure(174,label,{spacing:2}).w+10;}
  const levels=new ListBox({x:30,y:270,w:200,h:170,items:LEVELS.map(l=>l[1]),selected:Math.max(0,LEVELS.findIndex(l=>l[0]===levelKey)),onChange:i=>onLevelChange(LEVELS[i][0])});
  widgets.push(summary,
    new Button({x:400,y:210,text:'Nastavení',onClick:()=>onSettings()}),
    new StaticText({x:20,y:244,text:'Levely:',spacing:2}),levels,
    new Button({x:40,y:466,text:'Start',onClick:async()=>{
      const used=duplicateName(players.map(p=>p.name));if(used!==null){await onMessage(nameUsedText(used));return;}
      onStart({players,levelKey:LEVELS[levels.selected][0]});}}),
    new Button({x:140,y:466,text:'Zrušit',onClick:()=>onBack()}));
  const startButton=widgets.find(w=>w instanceof Button&&w.text==='Start');
  let waiting=null,chat=null;
  if(network) {
    levels.disabled=network.role==='guest';
    waiting=new StaticText({x:240,y:470,text:'Čekám na zbytek hráčů...',font:175});
    chat=new ChatList({x:250,y:270,w:260,h:140});
    const edit=new TextEdit({x:250,y:418,w:260,digits:120,value:''});
    edit.commit=()=>{};
    edit.key=(e=>{const base=TextEdit.prototype.key.bind(edit);return ev=>{if(ev.code==='Enter'||ev.code==='NumpadEnter'){const t=edit.text.trim();edit.text='';if(t)network.onSay(t);return true;}return base(ev);};})();
    widgets.push(new StaticText({x:240,y:244,text:'Chat:',spacing:2}),chat,edit,waiting);
    if(network.role==='guest')startButton.visible=false;else startButton.disabled=true;
  }
  const win=new Window({x:230,y:50,w:530,h:510,widgets});
  win.onCancel=()=>onBack();
  // Network lobby update: the other computers' players, the chat lines, whether all are in.
  win.updateLobby=(others,lines,full)=>{
    remote.forEach((c,i)=>{const p=others[i];for(const w of [c.frame,c.preview,c.name])w.visible=!!p;if(p){c.preview.colorIndex=p.colorIndex;c.name.text=p.name;}});
    if(chat)chat.lines=lines;if(waiting)waiting.visible=!full;
    if(network?.role==='host')startButton.disabled=!full;
  };
  win.setFocus(widgets.find(w=>w instanceof TextEdit)??levels);
  return win;
}
export {defaultHumans};
