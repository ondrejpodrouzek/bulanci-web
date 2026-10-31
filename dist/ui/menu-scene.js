// Living parts of the original main menu CMenu (ctor 0x4265e0) that sit on the 315 picture:
// bitmap 313 at (610, 0) by night, the poem scroller CPoemScroller, "Verze: 1.80" and four
// film scratches CRuch. See analysis/ui-re.md, "Hlavní menu".
import {createDisplay} from '../display.js';
import {loadFont,measure,drawText} from './font.js';
import {StaticText} from './widgets.js';
import {isMenuNight} from '../game-audio.js';

const rand=n=>Math.floor(Math.random()*n); // rand()*n>>15
// CPoemScroller: rectangle (10,384)-(215,550), font 175 colour #b0b0b0, letter spacing 1 and
// line spacing 1 (+0x94..); timer 120 ms from 3 s after creation (0x4264aa), one pixel a tick.
export const POEM={x:10,y:384,w:205,h:166,font:175,color:'#b0b0b0',spacing:1,leading:1,period:120,delay:3000,fade:40};
// 0x425df0 builds two 40-row masks, opacity 6, 12 .. 240 for the top edge and 250 .. 16 for the
// bottom edge (0x4240f0); rows between are drawn as they are.
export function poemRowAlpha(row,h=POEM.h,fade=POEM.fade) {
  if(row<fade)return (6+6*row)/256;
  if(row>=h-fade)return (250-6*(row-(h-fade)))/256;
  return 1;
}
// CRuch (0x423c20): a 1 px line #3f3f3f over the whole height. Hidden, it shows after
// rand(0..4000) ms for 100 ms, then hides and jumps to a random x (0x423de0). The menu turns
// them on when its music has faded in from 70 to 100 % by 1 % a 120 ms tick (0x424080).
export const SCRATCH={count:4,color:'#3f3f3f',shown:100,maxWait:4000,startAfter:30*120};

export function attachMenuScene(stage,menu) {
  const night=document.createElement('img');night.className='menu-night';night.alt='';night.src='assets/original/menu-night.jpg';night.hidden=true;
  const canvas=document.createElement('canvas');canvas.className='menu-scene';canvas.width=800;canvas.height=600;
  stage.prepend(canvas);stage.prepend(night);
  const display=createDisplay(canvas),ctx=display.ctx;
  const version=new StaticText({x:230,y:575,text:'Verze: 1.80',font:176,spacing:1});
  let poems=[],text=null,pos=POEM.h,nextTick=0,active=false,activeSince=0,raf=0;
  const scratches=Array.from({length:SCRATCH.count},()=>({x:rand(800),visible:false,next:Infinity}));

  // 0x425df0: pick a random poem and start it just under the window.
  function pick() {
    const poem=poems[rand(poems.length)];if(!poem)return;
    const opt={spacing:POEM.spacing,leading:POEM.leading},m=measure(POEM.font,poem.text,opt);
    const c=document.createElement('canvas');c.width=Math.max(1,m.w);c.height=Math.max(1,m.h);
    drawText(c.getContext('2d'),POEM.font,poem.text,{x:0,y:0,w:m.w,h:m.h},{...opt,color:POEM.color});
    text={canvas:c,w:m.w,h:m.h,resource:poem.resource};pos=POEM.h;
  }
  function drawPoem() {
    if(!text)return;
    const x=POEM.x+Math.trunc((POEM.w-text.w)/2);
    const from=Math.max(0,pos),to=Math.min(POEM.h,pos+text.h);
    const prev=ctx.globalAlpha;
    for(let row=from;row<to;) {
      const a=poemRowAlpha(row);
      // Rows of full opacity go in one piece.
      let end=row+1;if(a===1)while(end<to&&poemRowAlpha(end)===1)end++;
      ctx.globalAlpha=a;
      ctx.drawImage(text.canvas,0,row-pos,text.w,end-row,x,POEM.y+row,text.w,end-row);
      row=end;
    }
    ctx.globalAlpha=prev;
  }
  function render() {
    display.begin();ctx.clearRect(0,0,800,600);
    drawPoem();version.draw(ctx,{x:0,y:0});
    ctx.fillStyle=SCRATCH.color;for(const s of scratches)if(s.visible)ctx.fillRect(s.x,0,1,600);
  }
  function update(now) {
    let changed=false;
    while(text&&now>=nextTick){nextTick+=POEM.period;pos--;if(pos===-text.h)pick();changed=true;}
    if(now-activeSince>=SCRATCH.startAfter)for(const s of scratches) {
      if(s.next===Infinity)s.next=now+rand(SCRATCH.maxWait+1);
      while(now>=s.next) {
        if(s.visible){s.visible=false;s.x=rand(800);s.next+=rand(SCRATCH.maxWait+1);}
        else{s.visible=true;s.next+=SCRATCH.shown;}
        changed=true;
      }
    }
    return changed;
  }
  function frame(now){raf=0;if(!active)return;if(update(now))render();raf=requestAnimationFrame(frame);}
  // 0xf1 / 0xf0 (0x422670): the menu comes back / the game takes over.
  function setActive(on) {
    if(on===active)return;active=on;
    for(const s of scratches){s.visible=false;s.next=Infinity;}
    if(on) {
      const now=performance.now();activeSince=now;
      nextTick=Math.max(nextTick,now); // the scroller waits while the menu is away
      // 0x425400: the night look is chosen from the local hour when the menu appears.
      night.hidden=!isMenuNight(globalThis.bulanciAudio?.settings?.menuTheme);
      render();raf||=requestAnimationFrame(frame);
    } else if(raf){cancelAnimationFrame(raf);raf=0;}
  }
  const created=performance.now();nextTick=created+POEM.delay;
  Promise.all([loadFont(175),loadFont(176),fetch('assets/original/poems.json').then(r=>r.json())]).then(([, ,list])=>{
    poems=list;pick();if(active)render();
  }).catch(()=>{});
  const sync=()=>setActive(!menu.hidden);
  new MutationObserver(sync).observe(menu,{attributes:true,attributeFilter:['hidden']});
  addEventListener('bulanci:display',()=>active&&render());
  new ResizeObserver(()=>active&&render()).observe(canvas);
  sync();
  return {get poem(){return text?{resource:text.resource,pos,w:text.w,h:text.h}:null;},scratches,night,canvas};
}
