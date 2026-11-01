// Original start screens: CStartGame1 (0x40c650) and CStartGame2 (0x4104f0), and the
// "Ovládání" dialog (0x40f7d0). Coordinates and texts from the EXE (analysis/ui-re.md).
import {StaticText,Radio,Button,TextEdit,ColorSet,Picture,ListBox,Bulanek,Window,loadSpriteManifest} from './widgets.js';
import {measure} from './font.js';
import {RULE_SUMMARY} from './game-type-dialog.js';
import {duplicateName,nameUsedText} from './msg-dialog.js';
import {KEYSETS,keyName,defaultHumans} from '../players.js';

// Level list order: the original list as seen on a period screenshot (Na dobrou noc, Malárie,
// Noční směna, Vybíjená), then the two later levels.
export const LEVELS=[['bedtime','Na dobrou noc'],['malaria','Malárie'],['factory','Noční směna'],['disco','Vybíjená'],['eightbit','V zajetí 8-bitu'],['exitus','Exitus']];

// Screen 1 (window 250,60 - 760,560). The original chose Vytvořit / Připojit se, players in total,
// players on this computer and the protocol here, which made a network game a side effect of
// two numbers. The web asks one question first: here, or over the network (net-ui.js).
export function startGame1({total=2,network=false,onNext}) {
  const placeRadio=new Radio({x:30,y:45,w:200,items:['Na tomto počítači','Po síti'],selected:network?1:0});
  const totalRadio=new Radio({x:30,y:130,w:200,items:['1 hráč (trénink)','2 hráči','3 hráči'],selected:Math.min(3,total)-1});
  const totalLabel=new StaticText({x:20,y:105,text:'Počet hráčů:',spacing:2});
  const hint=new StaticText({x:20,y:110,text:'Založíte hru a pošlete kamarádům odkaz,\nnebo se přidáte ke hře, která už čeká.',font:175,leading:4});
  const sync=()=>{const net=placeRadio.selected===1;totalRadio.visible=totalLabel.visible=!net;hint.visible=net;};
  placeRadio.onChange=sync;sync();
  const win=new Window({x:250,y:60,w:510,h:500,widgets:[
    new StaticText({x:20,y:20,text:'Kde budete hrát:',spacing:2}),placeRadio,
    totalLabel,totalRadio,hint,
    new Button({x:20,y:456,text:'Dále',onClick:()=>onNext({total:totalRadio.selected+1,network:placeRadio.selected===1})}),
  ]});
  win.setFocus(placeRadio);
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
export async function startGame2({total,humans,rules,levelKey,onBack,onStart,onRules,onSettings,onKeys,onPlayersChange=()=>{},onLevelChange=()=>{},onMessage=async()=>{},random=Math.random}) {
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
  const summaryText=()=>total===1?RULE_SUMMARY.time(150):RULE_SUMMARY[rules().type](rules().limits[rules().type])+(rules().weapons==='shotgun'?' Pouze brokovnice.':'');
  const summary=new StaticText({x:122,y:214,text:summaryText(),font:175});
  if(total>1)widgets.push(new Button({x:31,y:208,text:'Typ hry',onClick:async()=>{await onRules();summary.text=summaryText();}}));
  else{const label='Typ hry:';widgets.push(new StaticText({x:20,y:210,text:label,spacing:2}));summary.x=20+measure(174,label,{spacing:2}).w+10;}
  const levels=new ListBox({x:30,y:270,w:200,h:170,items:LEVELS.map(l=>l[1]),selected:Math.max(0,LEVELS.findIndex(l=>l[0]===levelKey)),onChange:i=>onLevelChange(LEVELS[i][0])});
  widgets.push(summary,
    new Button({x:400,y:210,text:'Nastavení',onClick:()=>onSettings()}),
    new StaticText({x:20,y:244,text:'Levely:',spacing:2}),levels,
    new Button({x:40,y:466,text:'Start',onClick:async()=>{
      const used=duplicateName(players.map(p=>p.name));if(used!==null){await onMessage(nameUsedText(used));return;}
      onStart({players,levelKey:LEVELS[levels.selected][0]});}}),
    new Button({x:140,y:466,text:'Zrušit',onClick:()=>onBack()}));
  const win=new Window({x:230,y:50,w:530,h:510,widgets});
  win.onCancel=()=>onBack();
  win.setFocus(widgets.find(w=>w instanceof TextEdit)??levels);
  return win;
}
export {defaultHumans};
