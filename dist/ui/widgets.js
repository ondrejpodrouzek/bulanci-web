// Original dialog widgets, drawn as the EXE draws them (analysis/ui-re.md, "Kreslení prvků").
// Coordinates are window-relative pixels of the 800x600 scene.
import {drawText,measure} from './font.js';

const images=new Map();
export function bitmap(id){let im=images.get(id);if(!im){im=new Image();im.src=`assets/original/ui/${id}.png`;images.set(id,im);}return im;}
export const preloadBitmaps=ids=>Promise.all(ids.map(id=>{const im=bitmap(id);return im.complete?null:new Promise(r=>{im.onload=im.onerror=r;});}));
const ready=im=>im.complete&&im.naturalWidth>0;
// Samples of the global bank: CButton 0 (field +0x94, 0x4030e0), CRadio 14 (0x402fb0), CIcon 20 (0x403ea0).
export let uiSound=()=>{};
export const setUiSound=play=>{uiSound=play;};

// 0x402f40: drawing opacity by widget state - disabled 0x30, focused 0x90, otherwise 0x85.
export const stateAlpha=w=>(w.disabled?0x30:w.focused?0x90:0x85)/255;
const hex=c=>`#${c.toString(16).padStart(6,'0')}`;
// 0x436530: one-pixel rectangle outline; 0x4365f0: filled rectangle.
function outline(ctx,r,color){ctx.fillStyle=hex(color);ctx.fillRect(r.x,r.y,r.w,1);ctx.fillRect(r.x,r.y+r.h-1,r.w,1);ctx.fillRect(r.x,r.y+1,1,r.h-2);ctx.fillRect(r.x+r.w-1,r.y+1,1,r.h-2);}
const inset=(r,n)=>({x:r.x+n,y:r.y+n,w:r.w-2*n,h:r.h-2*n});
// 0x404e80: #b7b7b7, #575757, #b7b7b7 outlines inwards, then the fill (-1 = none).
export function sunkenFrame(ctx,r,alpha,fill=0) {
  const prev=ctx.globalAlpha;ctx.globalAlpha=prev*alpha;
  outline(ctx,r,0xb7b7b7);outline(ctx,inset(r,1),0x575757);outline(ctx,inset(r,2),0xb7b7b7);
  if(fill>=0){ctx.fillStyle=hex(fill);const f=inset(r,3);ctx.fillRect(f.x,f.y,f.w,f.h);}
  ctx.globalAlpha=prev;
}

class Widget {
  constructor(props){Object.assign(this,{x:0,y:0,w:0,h:0,visible:true,disabled:false,focused:false,hover:false,focusable:false},props);}
  contains(px,py){return this.visible&&px>=this.x&&py>=this.y&&px<this.x+this.w&&py<this.y+this.h;}
  draw(){} pointerDown(){} pointerUp(){} key(){return false;}
}

// CStaticText 0x406a50: text, letter spacing, font; rectangle fitted to the text (style 0x10).
// Draw 0x4054d0: opacity 0x909090, 0x303030 when inactive, full when +0x94 is set (bright).
export class StaticText extends Widget {
  constructor(p){super({font:174,spacing:1,flags:0,bright:false,color:null,...p});}
  draw(ctx,o){if(!this.visible)return;const opt={spacing:this.spacing,leading:this.leading??0},m=measure(this.font,this.text,opt);drawText(ctx,this.font,this.text,{x:o.x+this.x,y:o.y+this.y,w:this.w||m.w,h:this.h||m.h},{flags:this.flags,alpha:this.bright?1:(this.disabled?0x30:0x90)/255,color:this.color,...opt});}
}

// CButton 0x4087f0 / draw 0x4056b0: bitmaps 31 / 30 (focus) / 32 (pressed), text style 5.
export class Button extends Widget {
  constructor(p){super({font:174,spacing:1,focusable:true,w:82,h:25,images:[31,30,32],...p});}
  draw(ctx,o) {
    if(!this.visible)return;
    const alpha=stateAlpha(this),state=this.pressed?2:(this.hover||this.focused)?1:0,im=bitmap(this.images[state]);
    const prev=ctx.globalAlpha;ctx.globalAlpha=prev*alpha;if(ready(im))ctx.drawImage(im,o.x+this.x,o.y+this.y);ctx.globalAlpha=prev;
    const d=this.pressed?1:0;
    drawText(ctx,this.font,this.text,{x:o.x+this.x+d,y:o.y+this.y+d,w:this.w,h:this.h},{flags:5,spacing:this.spacing,alpha});
  }
  pointerDown(){if(!this.disabled){this.pressed=true;uiSound(0);}}
  pointerUp(inside){const was=this.pressed;this.pressed=false;if(was&&inside&&!this.disabled)this.onClick?.();}
  key(e){if(e.code==='Enter'||e.code==='Space'||e.code==='NumpadEnter'){uiSound(0);this.onClick?.();return true;}return false;}
}

// CRadio 0x408540 / draw 0x403ac0: bitmaps 121 / 119 (focus) / 122 (selected) / 120
// (selected + focus) / 123 (disabled item), step = height + 2, text 11 px right of the box.
export class Radio extends Widget {
  constructor(p){super({font:175,spacing:1,focusable:true,selected:0,disabledItems:[],...p});const n=this.items.length;this.w=this.w||180;this.h=n*17-2;}
  draw(ctx,o) {
    if(!this.visible)return;
    const alpha=stateAlpha(this);
    this.items.forEach((text,i)=>{
      const off=this.disabledItems.includes(i),idx=off?4:(i===this.selected?2:0)+(this.focused&&i===this.cursor?1:0);
      const im=bitmap([121,119,122,120,123][idx]),y=o.y+this.y+i*17;
      const a=off?0x30/255:alpha,prev=ctx.globalAlpha;ctx.globalAlpha=prev*a;
      if(ready(im))ctx.drawImage(im,o.x+this.x,y);ctx.globalAlpha=prev;
      drawText(ctx,this.font,text,{x:o.x+this.x+15+11,y,w:this.w-26,h:15},{flags:4,spacing:this.spacing,alpha:a});
    });
  }
  pick(i){if(i>=0&&i<this.items.length&&!this.disabledItems.includes(i)){this.selected=i;this.cursor=i;this.onChange?.(i);}}
  pointerDown(px,py){const i=Math.floor((py-this.y)/17);if(i>=0&&i<this.items.length&&!this.disabledItems.includes(i))uiSound(14);this.pick(i);}
  key(e){
    this.cursor??=this.selected;
    if(e.code==='ArrowDown'||e.code==='ArrowRight'){this.pick(Math.min(this.items.length-1,this.cursor+1));return true;}
    if(e.code==='ArrowUp'||e.code==='ArrowLeft'){this.pick(Math.max(0,this.cursor-1));return true;}
    return false;
  }
}

// CEdit 0x407760 (height forced to 23, text inset 5, font 175) and CNumEdit 0x407d50
// (digits, minimum, maximum). The value is clamped when the field loses focus.
export class NumEdit extends Widget {
  constructor(p){super({font:175,focusable:true,numeric:true,...p});this.h=23;this.text=String(this.value??this.min);}
  get value(){return Number(this.text)||0;} set value(v){this.text=String(v);}
  commit(){const v=Math.round(Number(this.text));this.value=Math.min(this.max,Math.max(this.min,Number.isFinite(v)?v:this.min));this.onChange?.(this.value);}
  draw(ctx,o,now) {
    if(!this.visible)return;
    const r={x:o.x+this.x,y:o.y+this.y,w:this.w,h:this.h},alpha=stateAlpha(this);
    sunkenFrame(ctx,r,alpha,0);
    const caret=this.focused&&Math.floor(now/1000)%2===0?'_':'';
    drawText(ctx,this.font,this.text+caret,{x:r.x+5,y:r.y,w:r.w-10,h:r.h},{flags:4,alpha});
  }
  key(e){
    if(/^(Digit|Numpad)[0-9]$/.test(e.code)){if(this.text.length<this.digits)this.text=(this.text==='0'?'':this.text)+e.code.slice(-1);return true;}
    if(e.code==='Backspace'){this.text=this.text.slice(0,-1);return true;}
    if(e.code==='ArrowUp'){this.value=Math.min(this.max,this.value+1);return true;}
    if(e.code==='ArrowDown'){this.value=Math.max(this.min,this.value-1);return true;}
    return false;
  }
  blur(){this.commit();}
}

// CWindow: draws nothing itself (dialogs lie directly on the menu picture); it holds the
// widgets, the focus order and the Ok (0x8002) / Cancel (0x8003) commands.
const touchSlop=globalThis.matchMedia?.('(pointer: coarse)').matches?24:0;
export class Window {
  constructor({w,h,x,y,widgets=[]}){Object.assign(this,{w,h,x:x??Math.trunc((800-w)/2),y:y??Math.trunc((600-h)/2),widgets});this.focus=this.widgets.find(w=>w.focusable&&w.visible)??null;if(this.focus)this.focus.focused=true;}
  focusables(){return this.widgets.filter(w=>w.focusable&&w.visible&&!w.disabled);}
  setFocus(w){if(this.focus===w)return;if(this.focus){this.focus.focused=false;this.focus.blur?.();}this.focus=w;if(w)w.focused=true;}
  draw(ctx,now){for(const w of this.widgets)w.draw(ctx,this,now);}
  // Touch: a finger that lands just beside a control still takes it (touchSlop in logical px).
  hit(px,py){const lx=px-this.x,ly=py-this.y,exact=[...this.widgets].reverse().find(w=>w.contains(lx,ly));if(exact||!touchSlop)return exact??null;
    let best=null,dist=touchSlop;for(const w of this.widgets){if(!w.visible||w.disabled||!(w.onClick||w.focusable))continue;const d=Math.hypot(Math.max(w.x-lx,0,lx-w.x-w.w),Math.max(w.y-ly,0,ly-w.y-w.h));if(d<dist){dist=d;best=w;}}return best;}
  pointerMove(px,py){const h=this.hit(px,py);for(const w of this.widgets)w.hover=w===h;(this.pressedWidget??h)?.pointerMove?.(px-this.x,py-this.y);}
  pointerDown(px,py){const w=this.hit(px,py);this.pressedWidget=w;if(!w)return;if(w.focusable&&!w.disabled)this.setFocus(w);w.pointerDown(px-this.x,py-this.y);}
  pointerUp(px,py){const w=this.pressedWidget;this.pressedWidget=null;if(w)w.pointerUp(w===this.hit(px,py));}
  key(e) {
    if(e.code==='Tab'){const list=this.focusables(),i=list.indexOf(this.focus);this.setFocus(list[(i+(e.shiftKey?-1:1)+list.length)%list.length]);return true;}
    if(this.focus?.key(e))return true;
    if(e.code==='Escape'&&this.onCancel){this.onCancel();return true;}
    if((e.code==='Enter'||e.code==='NumpadEnter')&&this.onOk){this.focus?.blur?.();this.onOk();return true;}
    return false;
  }
}

// CEdit for a name (0x410884: max 40 characters, font 175, height 23).
export class TextEdit extends NumEdit {
  constructor(p){super({digits:40,min:0,max:0,...p});this.numeric=false;this.textInput=true;this.text=p.value??'';}
  get value(){return this.text;} set value(v){this.text=String(v);}
  commit(){this.text=this.text.trim()||this.fallback||'';this.onChange?.(this.text);}
  key(e){
    if(e.code==='Backspace'){this.text=this.text.slice(0,-1);return true;}
    if(e.key&&e.key.length===1&&!e.ctrlKey&&!e.metaKey){if(this.text.length<this.digits)this.text+=e.key;return true;}
    return false;
  }
}

// A bitmap drawn with a fixed opacity (0x4191a0; the preview frame 27 uses 0x80).
export class Picture extends Widget {
  constructor(p){super({alpha:1,...p});}
  draw(ctx,o){if(!this.visible)return;const im=bitmap(this.image);if(!ready(im))return;const prev=ctx.globalAlpha;ctx.globalAlpha=prev*this.alpha;ctx.drawImage(im,o.x+this.x,o.y+this.y);ctx.globalAlpha=prev;}
}

// CColorSet (0x40ffd0 / draw 0x40aed0): bitmap 19 (4x2 colours) one pixel inside, the chosen
// cell outlined #eeeeee; cell pitch (w-11)/4+3 by (h-5)/2+3, outline 20x15.
export class ColorSet extends Widget {
  constructor(p){super({focusable:true,selected:0,w:83,h:31,...p});}
  cell(i){const cw=Math.trunc((this.w-11)/4)+3,ch=Math.trunc((this.h-5)/2)+3;return {x:this.x+cw*(i%4),y:this.y+ch*(i>>2),w:20,h:15};}
  draw(ctx,o) {
    if(!this.visible)return;
    const alpha=stateAlpha(this),im=bitmap(19),prev=ctx.globalAlpha;
    ctx.globalAlpha=prev*alpha;if(ready(im))ctx.drawImage(im,o.x+this.x+1,o.y+this.y+1);ctx.globalAlpha=prev;
    if(this.selected!=null&&this.selected>=0){const c=this.cell(this.selected);sunkenOutline(ctx,{x:o.x+c.x,y:o.y+c.y,w:c.w,h:c.h},alpha);}
  }
  pick(i){if(i>=0&&i<8){this.selected=i;this.onChange?.(i);}}
  pointerDown(px,py){const cw=Math.trunc((this.w-11)/4)+3,ch=Math.trunc((this.h-5)/2)+3;this.pick(Math.min(3,Math.floor((px-this.x)/cw))+4*Math.min(1,Math.floor((py-this.y)/ch)));}
  key(e){const s=this.selected??0,m={ArrowLeft:-1,ArrowRight:1,ArrowUp:-4,ArrowDown:4}[e.code];if(m===undefined)return false;const n=s+m;if(n>=0&&n<8)this.pick(n);return true;}
}
function sunkenOutline(ctx,r,alpha){const prev=ctx.globalAlpha;ctx.globalAlpha=prev*alpha;ctx.fillStyle='#eeeeee';ctx.fillRect(r.x,r.y,r.w,1);ctx.fillRect(r.x,r.y+r.h-1,r.w,1);ctx.fillRect(r.x,r.y+1,1,r.h-2);ctx.fillRect(r.x+r.w-1,r.y+1,1,r.h-2);ctx.globalAlpha=prev;}

// CListBox / CLevelList (0x4057c0, 0x406d00, item 0x40d490): frame without fill, items in
// font 175 with the 1-based number, unselected items at opacity 0x85, the chosen one full.
// CListBox with the vertical CScrollBar (table 0x4ae5a0: up 142/138/146, thumb 132/130/134, down
// 139/135/143) once the items no longer fit. The bar's exact placement is not verified.
const BAR_W=13,ARROW_H=12;
export class ListBox extends Widget {
  constructor(p){super({focusable:true,font:175,itemHeight:15,selected:0,top:0,...p});}
  get rows(){return Math.max(1,Math.floor((this.h-7)/this.itemHeight));}
  get scrolls(){return this.items.length>this.rows;}
  get maxTop(){return Math.max(0,this.items.length-this.rows);}
  scrollTo(top){this.top=Math.max(0,Math.min(this.maxTop,top));}
  reveal(i){if(i<this.top)this.scrollTo(i);else if(i>=this.top+this.rows)this.scrollTo(i-this.rows+1);}
  thumbY(track){return this.maxTop?Math.round(this.top*track/this.maxTop):0;}
  draw(ctx,o) {
    if(!this.visible)return;
    const r={x:o.x+this.x,y:o.y+this.y,w:this.w,h:this.h},width=this.scrolls?r.w-BAR_W-2:r.w;sunkenFrame(ctx,r,stateAlpha(this),-1);
    this.scrollTo(this.top);
    this.items.slice(this.top,this.top+this.rows).forEach((text,k)=>{
      const i=k+this.top,y=r.y+4+k*this.itemHeight,alpha=i===this.selected?1:0x85/255;
      drawText(ctx,this.font,String(i+1),{x:r.x+6,y,w:16,h:this.itemHeight},{flags:4,alpha});
      drawText(ctx,this.font,text,{x:r.x+27,y,w:width-32,h:this.itemHeight},{flags:4,alpha});
    });
    if(!this.scrolls)return;
    const x=r.x+r.w-BAR_W-1,put=(id,y)=>{const im=bitmap(id);if(ready(im))ctx.drawImage(im,x,y);};
    put(142,r.y+1);put(139,r.y+r.h-ARROW_H-1);
    put(132,r.y+1+ARROW_H+this.thumbY(r.h-2*ARROW_H-8));
  }
  pick(i){if(i>=0&&i<this.items.length){this.selected=i;this.reveal(i);this.onChange?.(i);}}
  pointerDown(px,py) {
    const y=py-this.y;
    if(this.scrolls&&px-this.x>=this.w-BAR_W-1){
      if(y<=ARROW_H)this.scrollTo(this.top-1);
      else if(y>=this.h-ARROW_H-1)this.scrollTo(this.top+1);
      else this.scrollTo(y<ARROW_H+this.thumbY(this.h-2*ARROW_H-8)?this.top-this.rows:this.top+this.rows);
      return;
    }
    this.pick(this.top+Math.floor((y-4)/this.itemHeight));
  }
  key(e){if(e.code==='ArrowDown'){this.pick(Math.min(this.items.length-1,this.selected+1));return true;}if(e.code==='ArrowUp'){this.pick(Math.max(0,this.selected-1));return true;}return false;}
}

// The start-screen bulánek: one of the idle animations 180..183 in the player's colour.
let spriteManifest=null;
export const loadSpriteManifest=()=>spriteManifest??=fetch('assets/original/sprites/manifest.json').then(r=>r.json());
export class Bulanek extends Widget {
  // colorIndex null: the sheet as stored. once: play to the last frame and stay (0x4391e0 flag 1
  // without the loop bit 2).
  constructor(p){super({colorIndex:0,resource:180,once:false,...p});}
  draw(ctx,o,now) {
    if(!this.visible||!this.manifest)return;
    const info=this.manifest.resources[this.resource];if(!info)return;
    const im=bitmap(this.colorIndex==null?`../sprites/${this.resource}-sheet`:`../sprites/${this.resource}-c${this.colorIndex}-sheet`);if(!ready(im))return;
    const step=info.duration_ticks/info.frames;
    const frame=this.once?Math.min(info.frames-1,Math.floor((now-(this.started??=now))/step)):Math.floor((now%info.duration_ticks)/step)%info.frames;
    ctx.drawImage(im,frame*info.width,0,info.width,info.height,o.x+this.x,o.y+this.y,info.width,info.height);
  }
}

// CProgressBar (0x40b560, draw 0x40b1f0): black 1 px outline (0x436530), inside filled #a0a0a0
// from the left by value / max (0x4365f0).
export class ProgressBar extends Widget {
  constructor(p){super({value:0,max:1,...p});}
  draw(ctx,o){
    if(!this.visible)return;const x=o.x+this.x,y=o.y+this.y;
    ctx.strokeStyle='#000';ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,this.w-1,this.h-1);
    if(!this.max)return;const w=Math.trunc((this.w-2)*Math.min(this.value,this.max)/this.max);
    ctx.fillStyle='#a0a0a0';ctx.fillRect(x+1,y+1,w,this.h-2);
  }
}

// CScrollBar (0x408370 / draw 0x403530), horizontal: left arrow, thumb and right arrow, three
// bitmaps each (normal / hover / pressed); the height is the arrow's. Two track lines in the
// state colour 0x402f40, (arrowH-9)/2 and 6 px below. Parts: 1 left arrow (step 1, repeat
// 300 ms), 2 / 4 track (page 20), 3 thumb drag (0x404fe0), 5 right arrow. CVolume (0x40e1b0)
// uses its own bitmaps 114 / 113 / 115, 131 / 129 / 133, 126 / 125 / 127.
export class ScrollBar extends Widget {
  constructor(p){super({focusable:true,min:0,max:100,value:0,step:1,page:20,images:[[140,136,144],[131,129,133],[141,137,145]],arrow:[12,13],thumb:[6,11],...p});this.h=this.arrow[1];this.part=0;this.hoverPart=0;}
  get track(){return this.w-2*this.arrow[0]-this.thumb[0];}
  thumbX(){const r=this.max-this.min;return this.arrow[0]+(r?Math.trunc((this.value-this.min)*this.track/r):0);}
  partAt(px){const x=px-this.x,t=this.thumbX();return x<this.arrow[0]?1:x>=this.w-this.arrow[0]?5:x<t?2:x<t+this.thumb[0]?3:4;}
  set(v){v=Math.max(this.min,Math.min(this.max,Math.round(v)));if(v!==this.value){this.value=v;this.onChange?.(v);}}
  draw(ctx,o) {
    if(!this.visible)return;
    const alpha=stateAlpha(this),x=o.x+this.x,y=o.y+this.y,[aw,ah]=this.arrow;
    const state=k=>this.part===k?2:this.hover&&this.hoverPart===k?1:0;
    const prev=ctx.globalAlpha;ctx.globalAlpha=prev*alpha;
    const put=(id,px,py)=>{const im=bitmap(id);if(ready(im))ctx.drawImage(im,px,py);};
    put(this.images[0][state(1)],x,y);put(this.images[2][state(5)],x+this.w-aw,y);
    const g=Math.round(alpha*255),line=`rgb(${g},${g},${g})`,ly=y+((ah-9)>>1);ctx.globalAlpha=prev;
    ctx.fillStyle=line;ctx.fillRect(x+aw,ly,this.w-2*aw,1);ctx.fillRect(x+aw,ly+6,this.w-2*aw,1);
    ctx.globalAlpha=prev*alpha;put(this.images[1][state(3)],x+this.thumbX(),ly-1);ctx.globalAlpha=prev;
  }
  pointerMove(px){this.hoverPart=this.partAt(px);if(this.part===3)this.drag(px);}
  drag(px){const r=this.max-this.min,t=this.track;this.set(this.min+Math.trunc((px-this.x-this.arrow[0]+1-((t/r|0)>>1)-(this.thumb[0]>>1))*r/t));}
  pointerDown(px){
    const k=this.partAt(px);if(this.disabled)return;
    if(k===2||k===4){this.set(this.value+(k===2?-this.page:this.page));return;}
    this.part=k;this.onPress?.();
    if(k===3)return;
    const d=k===1?-this.step:this.step;this.set(this.value+d);
    this.timer=setInterval(()=>this.set(this.value+d),300);
  }
  pointerUp(){clearInterval(this.timer);if(this.part)this.onRelease?.();this.part=0;}
  key(e){const m={ArrowLeft:-this.step,ArrowRight:this.step,PageUp:-this.page,PageDown:this.page}[e.code];if(m===undefined)return false;this.set(this.value+m);return true;}
}
