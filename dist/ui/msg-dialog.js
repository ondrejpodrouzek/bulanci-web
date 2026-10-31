// CMsgDialog (constructor 0x40be80, shown modally by 0x40f2c0): the text (font 174, spacing 2)
// at (30, 10), the window 60 px wider and higher than the text, centred on the screen, and one
// button centred under the text at y = text height + 20. Button kind 0 is "Ok" (0x8002), kind 1
// "Zrušit" (0x8003), from the tables 0x4ae6f0 / 0x4ae6f8.
import {StaticText,Button,Window} from './widgets.js';
import {measure} from './font.js';

const BUTTONS=[['Ok','onOk'],['Zrušit','onCancel']];
export function msgDialog(text,kind=0) {
  const m=measure(174,text,{spacing:2}),w=m.w+60,h=m.h+60;
  const [label,command]=BUTTONS[kind&1],button=new Button({y:m.h+20,text:label,onClick:()=>win[command]()});
  button.x=Math.trunc((w-button.w)/2);
  const win=new Window({w,h,widgets:[new StaticText({x:30,y:10,text,font:174,spacing:2}),button]});
  win.onOk=()=>true;win.onCancel=()=>false;
  return win;
}

// CStartGame2 command 0x8002 (0x40f610): every player on this computer is compared with all
// players (exact, case-sensitive 0x42d3f0); the first clash stops the start with
// 'Jméno "%s" je již použito.' (text 0xdc).
export function duplicateName(names,first=0,local=names.length) {
  for(let i=first;i<first+local;i++)for(let j=names.length-1;j>=0;j--)if(j!==i&&names[j]===names[i])return names[i];
  return null;
}
export const nameUsedText=name=>`Jméno "${name}" je již použito.`;
