// CAdvertising (constructor 0x40e5f0, shown from message 0xf7, 0x4025f4): the first screen after the
// program starts. A CBlackView filled with +0x68 = white, picture 314 centred (0x40fe30), timer 4000 ms
// (0x40aca0); a key or a mouse button closes it sooner (0x40b4d0, 0x40acc0 -> 0x8003).
import {Window} from './widgets.js';

export const TITLE_MS=4000;
export function titleScreen(picture) {
  const win=new Window({x:0,y:0,w:800,h:600});
  win.draw=ctx=>{
    ctx.fillStyle='#fff';ctx.fillRect(0,0,800,600);
    if(picture.complete&&picture.naturalWidth)ctx.drawImage(picture,(800-picture.naturalWidth)>>1,(600-picture.naturalHeight)>>1);
  };
  win.key=()=>{win.onOk();return true;};
  win.pointerDown=()=>win.onOk();
  win.pointerUp=()=>{};
  win.onOk=()=>true;
  return win;
}
