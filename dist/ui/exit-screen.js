// CExitDlg (constructor 0x411b50): the menu's Konec (0x425970, command 0xcb) shows illustration
// 317 and this window at (221,24)-(762,569) on the menu picture, with sample 25. Animations
// 305 and 306 loop (0x419940 flag 3). Konec hry (0x8004) quits the program; the web returns
// to the start screen instead.
import {StaticText,Button,Bulanek,Window} from './widgets.js';

// The text comes with the player's own game data (import/exe-assets.js).
let text='';
fetch('assets/original/exit-text.json').then(r=>r.json()).then(j=>{text=j.text;}).catch(()=>{}); // text 0x138

export function exitScreen({manifest,onQuit}) {
  return new Window({x:0xdd,y:0x18,w:0x2fa-0xdd,h:0x239-0x18,widgets:[
    new Bulanek({x:0xc2,y:0x16,resource:305,colorIndex:null,manifest}),
    new Bulanek({x:0x139,y:0x11a,resource:306,colorIndex:null,manifest}),
    new StaticText({x:0x28,y:0x48,text,font:175,spacing:2}),
    new Button({x:0x31,y:0x1ec,text:'Konec hry',onClick:()=>onQuit()}),
  ]});
}
