// CGameCounter (constructor 0x410e20, handler 0x40b140): the screen between the menu and a round.
// Full-screen window with the level's picture (script native 0x35, game view +0x360), four lamps
// (bitmap 34) at x = 517 + 70 i, y = 537, and CLoadingLevel on top while the level loads. Once it is
// loaded, timer 2 ticks every 1000 ms (0x414c17) and +0x1e8 counts from 0 (0x41631f): ticks 0-2 light
// a lamp with bitmap 35 and sample 18, tick 3 the last lamp with bitmap 36 and sample 17, tick 4
// closes the window and the round starts. In a network game only the host's timer runs (0x413f4f);
// every tick travels as message 7 (0x412da0). Before it the host waits for all players (0x4137b0).
import {Window,bitmap} from './widgets.js';

export const COUNTER_TICK=1000,COUNTER_STEPS=5;
export const LAMP_X=[517,587,657,727],LAMP_Y=537,LAMP_OFF=34,LAMP_ON=35,LAMP_LAST=36;
// background_res of each level script, by level resource.
const PICTURES={319:'menu-level-311.jpg',320:'menu-level-312.jpg',321:'88.png',322:'104.png',323:'105.png',324:'53.png'};
export const levelPicture=map=>{if(map?.picture)return map.picture;const name=PICTURES[map?.source_resource];return name?`assets/original/${name}`:null;};
export const counterSample=step=>step<3?18:step===3?17:null;

export function counterScreen(picture) {
  const lamps=[LAMP_OFF,LAMP_OFF,LAMP_OFF,LAMP_OFF];
  const win=new Window({x:0,y:0,w:800,h:600});
  win.draw=ctx=>{
    ctx.fillStyle='#000';ctx.fillRect(0,0,800,600);
    if(picture?.complete&&picture.naturalWidth)ctx.drawImage(picture,0,0);
    lamps.forEach((id,i)=>{const im=bitmap(id);if(im.complete&&im.naturalWidth)ctx.drawImage(im,LAMP_X[i],LAMP_Y);});
  };
  win.lamps=lamps;
  win.light=step=>{if(step<3)lamps[step]=LAMP_ON;else if(step===3)lamps[3]=LAMP_LAST;};
  win.key=()=>true; // the original window takes no input
  win.onOk=()=>true;
  return win;
}
