// Pause dialog (constructor 0x411df0): window 306x90 on the screen centre, built once with the
// game view (0x420423) and shown modally by 0x41c290 while the game's timers, animations and
// sounds stand still. Esc in the game (0x41687a) pauses the local player (0x4124a0); the first
// pause opens the dialog (0xed). Pozastav and Pokračuj share one place, message 0xe9 shows the
// one that fits the player's state and moves focus to it (0x40b2f0). Esc in the dialog
// (0x40ac20) and Pokračuj resume; the last resume closes it (0x80ca). Nastavení opens CSetupDlg
// (0x40ac50), Konec hry ends the round (0x8003 -> 0x80cd, 0x41d5f0: end sound 17, then out).
// In a local game the dialog only exists while paused, so Pozastav is never shown here; it
// matters in network games, where the dialog is also taller by 200 px for the chat (0x4102d0).
import {StaticText,Button,Window} from './widgets.js';

export function pauseDialog({onSetup=()=>{},paused=true}={}) {
  const y=90-40;
  const pause=new Button({x:15,y,text:'Pozastav',visible:!paused,onClick:()=>win.onPause?.()});
  const resume=new Button({x:15,y,text:'Pokračuj',visible:paused,onClick:()=>win.onOk()});
  const win=new Window({w:306,h:90,widgets:[
    new StaticText({x:0,y:12,w:306,h:23,text:'Hra je pozastavena',font:174,spacing:2,flags:5}),
    pause,resume,
    new Button({x:112,y,text:'Nastavení',onClick:()=>onSetup()}),
    new Button({x:209,y,text:'Konec hry',onClick:()=>{win.result='end';win.onOk();}}),
  ]});
  win.setFocus(paused?resume:pause);
  win.onOk=()=>win.result??'resume';
  win.onCancel=()=>'resume';
  return win;
}
