// CGunMouse (ctor 0x426060, draw 0x424610): the pointer of the original screens. Crosshair
// bitmap 173 centred on the mouse, red lines at 50% to the screen edges, and a trail of dots
// that follows 300 ms behind (a queue of 30 positions, one per 10 ms, 0x424370/0x4243b0) at an
// offset of (2,3). The dots are animations 267/266/265 (table 0x4af900) with opacity 100 from
// chunk 13; each end picks one at random (0x423bd0). Mouse only: touch has no pointer to show.
import {createDisplay} from '../display.js';

const W=800,H=600,CLIPS=[267,266,265],OPACITY=100/255,LINE=0.5;
const image=src=>{const im=new Image();im.src=src;return im;};
const ready=im=>im.complete&&im.naturalWidth>0;

export function createGunMouse(frame,manifestReady,active) {
  if(!matchMedia('(hover:hover) and (pointer:fine)').matches)return;
  const canvas=document.createElement('canvas');canvas.id='gun-mouse';canvas.width=W;canvas.height=H;
  frame.append(canvas);
  const display=createDisplay(canvas),ctx=display.ctx,cross=image('assets/original/ui/173.png'),sheets=CLIPS.map(n=>image(`assets/original/sprites/${n}-sheet.png`));
  let clips=null,mouse=null,queue=[],trail=null,last=0,clip=0,clipStart=0,raf=0;
  manifestReady.then(m=>{clips=CLIPS.map(n=>m.resources[n]);});
  const reset=now=>{queue=[];trail=null;last=now;clip=0;clipStart=now;};
  function fit(){const s=Math.min(frame.clientWidth/W,frame.clientHeight/H);if(s>0){canvas.style.width=`${W*s}px`;canvas.style.height=`${H*s}px`;}}
  function follow(now) {
    if(now-last>1000)last=now-10;
    while(last+10<=now){last+=10;queue.push(mouse);if(queue.length===30)trail=queue.shift();}
  }
  function drawTrail(now) {
    const c=clips?.[clip],im=sheets[clip];if(!c||!trail||!ready(im))return;
    const span=c.duration_ticks*(c.frames-1)/c.frames;
    while(now-clipStart>=span){clipStart+=span;clip=Math.floor(Math.random()*3);return;}
    const f=Math.floor((now-clipStart)*c.frames/c.duration_ticks);
    ctx.globalAlpha=OPACITY;
    ctx.drawImage(im,f*c.width,0,c.width,c.height,trail[0]+2-(c.width>>1),trail[1]+3-(c.height>>1),c.width,c.height);
    ctx.globalAlpha=1;
  }
  function render(now) {
    raf=0;const on=mouse&&active();
    frame.classList.toggle('gun-cursor',!!on);canvas.hidden=!on;
    if(!on){if(mouse===null)return;reset(now);raf=requestAnimationFrame(render);return;}
    follow(now);
    display.begin();ctx.clearRect(0,0,W,H);drawTrail(now);
    const [x,y]=mouse,w=cross.naturalWidth||75,h=cross.naturalHeight||75,l=x-(w>>1),t=y-(h>>1);
    ctx.globalAlpha=LINE;ctx.fillStyle='#f00';
    ctx.fillRect(0,y,Math.max(0,l),1);ctx.fillRect(l+w,y,Math.max(0,W-l-w),1);
    ctx.fillRect(x,0,1,Math.max(0,t));ctx.fillRect(x,t+h,1,Math.max(0,H-t-h));
    ctx.globalAlpha=1;if(ready(cross))ctx.drawImage(cross,l,t);
    raf=requestAnimationFrame(render);
  }
  frame.addEventListener('pointermove',e=>{
    if(e.pointerType!=='mouse')return;
    const r=canvas.getBoundingClientRect();if(!r.width)fit();
    const b=canvas.hidden?frame.getBoundingClientRect():r,s=Math.min(b.width/W,b.height/H),left=b.left+(b.width-W*s)/2,top=b.top+(b.height-H*s)/2;
    mouse=[Math.round((e.clientX-left)/s),Math.round((e.clientY-top)/s)];
    if(!raf)raf=requestAnimationFrame(render);
  },{capture:true});
  frame.addEventListener('pointerleave',()=>{mouse=null;frame.classList.remove('gun-cursor');canvas.hidden=true;});
  new ResizeObserver(fit).observe(frame);fit();canvas.hidden=true;
}
