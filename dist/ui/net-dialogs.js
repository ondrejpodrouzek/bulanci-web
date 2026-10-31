// Original network dialogs (analysis/ui-dialogs.txt). The web plays over the WebSocket relay of
// the server that serves the page, so the "computer" is that server's address.
import {StaticText,Button,TextEdit,ListBox,Window,sunkenFrame,stateAlpha} from './widgets.js';
import {drawText} from './font.js';

// CTcpIpConfig (0x40c060): window 312x160, text 0x7c (font 174, centred), CEdit (font 175),
// Ok (73,115) and Zrušit (163,115). An empty address searches; here it means this server.
export function tcpipDialog(address='') {
  const edit=new TextEdit({x:20,y:70,w:272,value:address,digits:80});
  const win=new Window({w:312,h:160,widgets:[
    new StaticText({x:20,y:20,w:272,h:40,flags:5,text:'\u0001Zadejte název nebo IP adresu počítače.\nNezadá-li se nic, bude se počítač hledat.'}),
    edit,
    new Button({x:73,y:115,text:'Ok',onClick:()=>win.onOk()}),
    new Button({x:163,y:115,text:'Zrušit',onClick:()=>win.onCancel()}),
  ]});
  win.setFocus(edit);
  win.onOk=()=>({address:edit.text.trim()});win.onCancel=()=>null;
  return win;
}

// CSessionList (0x40c2d0): window 335x244, status text 0x80 'Inicializuje se hledání...' then
// 'Hledám hry...', the list (20,50)-(315,180), Připojit (83,200) and Zrušit (173,200).
export function sessionList({search}) {
  const status=new StaticText({x:20,y:20,text:'Inicializuje se hledání...'});
  const list=new ListBox({x:20,y:50,w:295,h:130,items:[],selected:0});
  let sessions=[],stopped=false;
  const join=new Button({x:83,y:200,text:'Připojit',disabled:true,onClick:()=>{if(sessions.length)win.onOk();}});
  const win=new Window({w:335,h:244,widgets:[status,list,join,new Button({x:173,y:200,text:'Zrušit',onClick:()=>win.onCancel()})]});
  async function poll(){
    while(!stopped){
      try{sessions=await search();}catch{sessions=[];}
      if(stopped)break;
      status.text='Hledám hry...';list.items=sessions.map(s=>`${s.name} (${s.players}/${s.total})`);
      list.selected=Math.min(list.selected,Math.max(0,sessions.length-1));join.disabled=!sessions.length;
      await new Promise(r=>setTimeout(r,1000));
    }
  }
  poll();
  win.onOk=()=>{stopped=true;return sessions[list.selected]??null;};win.onCancel=()=>{stopped=true;return null;};
  win.setFocus(list);
  return win;
}

// CChatList (0x40d010): a list box of text lines, newest at the bottom.
export class ChatList {
  constructor(p){Object.assign(this,{lines:[],visible:true,disabled:false,focused:false,font:175,lineHeight:15},p);}
  contains(){return false;}
  draw(ctx,o){
    if(!this.visible)return;
    const r={x:o.x+this.x,y:o.y+this.y,w:this.w,h:this.h};sunkenFrame(ctx,r,stateAlpha(this),-1);
    const rows=Math.floor((this.h-8)/this.lineHeight),shown=this.lines.slice(-rows);
    shown.forEach((line,i)=>drawText(ctx,this.font,line,{x:r.x+6,y:r.y+4+i*this.lineHeight,w:r.w-12,h:this.lineHeight},{flags:4}));
  }
  pointerDown(){} pointerUp(){} key(){return false;}
}
