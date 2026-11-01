// CHistoryDlg (constructor 0x4231d0): the menu's Historie shows illustration 317 and this window
// at (231,36)-(762,569). Its pages are the class-0x802 resources 307..309, small scripts for a
// page VM (opcodes 0x2d..0x34, table 0x4af7ac) run with arg 1 when a page opens (0x422f70);
// analysis/decode_history_pages.py turns them into assets/original/history/pages.json.
// CIcon 0xe5..0xe8 at (39|56|72|91, 480) go to the first / previous / next / last page
// (0x423130); first and previous are disabled on page 1, next and last on the last page.
// CIcon draw 0x403e40: image 0 normally (alpha 0x80 when disabled), 1 under the pointer,
// 2 while pressed.
import {StaticText,Window,bitmap,uiSound} from './widgets.js';

const ICONS=[[0xe5,0x27,[56,55,57]],[0xe6,0x38,[59,58,60]],[0xe7,0x48,[62,61,63]],[0xe8,0x5b,[65,64,66]]];
const ready=im=>im.complete&&im.naturalWidth>0;
const hex=c=>`#${c.toString(16).padStart(6,'0')}`;

class Icon {
  constructor(p){Object.assign(this,{w:15,h:21,visible:true,disabled:false,hover:false,pressed:false},p);}
  contains(px,py){return this.visible&&!this.disabled&&px>=this.x&&py>=this.y&&px<this.x+this.w&&py<this.y+this.h;}
  draw(ctx,o){
    const im=bitmap(this.images[this.disabled?0:this.pressed?2:this.hover?1:0]);if(!ready(im))return;
    const prev=ctx.globalAlpha;if(this.disabled)ctx.globalAlpha=prev*0x80/255;ctx.drawImage(im,o.x+this.x,o.y+this.y);ctx.globalAlpha=prev;
  }
  pointerDown(){this.pressed=true;}
  pointerUp(inside){this.pressed=false;if(inside){if(!this.disabled)uiSound(20);this.onClick();}}
}

// Page object 0x34 (0x4236a0): a photograph (bitmap resource) that plays a t76 film in place.
// The preview resource (even id) does not exist, so the photo stands in for it (0x4237b0).
// A click starts the film (0x422d50) or stops a running one (0x422630); the end (event 1,
// 0x422860) restores the photo. Start / end tell the menu to stop and restart its music
// (messages 0xf0 / 0xf1 -> 0x424010).
class Film {
  constructor(p){Object.assign(this,{w:166,h:153,visible:true,startedAt:null,audio:null},p);}
  contains(px,py){return px>=this.x&&py>=this.y&&px<this.x+this.w&&py<this.y+this.h;}
  frame(now){const f=this.film;return Math.min(f.frames-1,Math.floor((this.audio&&!this.audio.paused?this.audio.currentTime*1000:now-this.startedAt)*f.frames/f.durationMs));}
  draw(ctx,o,now){
    if(this.startedAt!==null){
      const f=this.film,k=this.frame(now),sheet=this.sheet;
      if(now-this.startedAt>=f.durationMs){this.stop();}
      else if(ready(sheet)){ctx.drawImage(sheet,(k%f.columns)*f.width,Math.floor(k/f.columns)*f.height,f.width,f.height,o.x+this.x,o.y+this.y,f.width,f.height);return;}
    }
    const im=bitmap(this.image);if(ready(im))ctx.drawImage(im,o.x+this.x,o.y+this.y);
  }
  pointerDown(){}
  pointerUp(inside){if(!inside)return;if(this.startedAt!==null)this.stop();else this.start();}
  start(){
    this.sheet??=Object.assign(new Image(),{src:`assets/original/history/${this.film.id}-frames.jpg`});
    this.startedAt=performance.now();this.onPlay?.(true,this);
    const audio=globalThis.bulanciAudio,settings=audio?.settings;
    if(!settings||settings.enabled!==false){
      this.audio=new Audio(`assets/original/history/${this.film.id}.wav`);this.audio.volume=settings?.effects??1;
      this.audio.play().then(()=>{this.startedAt=performance.now()-this.audio.currentTime*1000;}).catch(()=>{});
    }
  }
  stop(){if(this.startedAt===null)return;this.startedAt=null;this.audio?.pause();this.audio=null;this.onPlay?.(false,this);}
}

let data=null;
export const loadHistory=()=>data??=Promise.all([
  fetch('assets/original/history/pages.json').then(r=>r.json()),
  fetch('assets/original/history/films.json').then(r=>r.json()),
]).then(([pages,films])=>({pages,films:new Map(films.map(f=>[f.id,f]))}));

// Labels (0x2d -> CStaticText 0x406a50): x, y, text, letter spacing, font. A palette from
// opcode 0x30 recolours the font (entry 1 is the ink); otherwise the font keeps its colours.
function pageWidgets({pages,films},index,onPlay) {
  const out=[];
  for(const item of pages[index].items) {
    if(item.kind==='label'){const [x,y,text,spacing]=item.args;out.push(new StaticText({x,y,text,spacing,font:item.font,color:item.colors?hex(item.colors[1]):null}));}
    else if(item.kind==='object'){const [x,y,,film]=item.args;out.push(new Film({x,y,image:item.resource,film:films.get(film-65536),onPlay}));}
  }
  return out;
}

export async function historyDialog({onFilm}={}) {
  const history=await loadHistory();let page=-1;
  const win=new Window({x:0xe7,y:0x24,w:0x2fa-0xe7,h:0x239-0x24,widgets:[]});
  const films=()=>win.widgets.filter(w=>w instanceof Film);
  const icons=ICONS.map(([command,x,images])=>new Icon({x,y:0x1e0,images,command,onClick:()=>go(command)}));
  function show(next) {
    next=Math.max(0,Math.min(history.pages.length-1,next));if(next===page)return;
    for(const f of films())f.stop();page=next;
    win.widgets=[...pageWidgets(history,page,(playing,film)=>{if(playing)for(const f of films())if(f!==film)f.stop();onFilm?.(films().some(f=>f.startedAt!==null));}),...icons];
    icons[0].disabled=icons[1].disabled=page<=0;icons[2].disabled=icons[3].disabled=page+1>=history.pages.length;
  }
  function go(command){show({0xe5:0,0xe6:page-1,0xe7:page+1,0xe8:history.pages.length-1}[command]);}
  win.close=()=>{for(const f of films())f.stop();};
  win.key=e=>{
    if(e.code==='ArrowLeft'||e.code==='PageUp'){go(0xe6);return true;}
    if(e.code==='ArrowRight'||e.code==='PageDown'){go(0xe7);return true;}
    if(e.code==='Home'){go(0xe5);return true;}if(e.code==='End'){go(0xe8);return true;}
    return false;
  };
  show(0);
  return win;
}
