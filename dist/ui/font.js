// Original bitmap fonts (t54 174/175/176) and the text routine 0x4375e0.
// Glyph record: [x in strip, width, first row, row after last]; see analysis/ui-re.md.
const fonts=new Map();
export function loadFont(id) {
  if(fonts.has(id))return fonts.get(id).ready;
  const font={id,meta:null,image:new Image()};
  font.ready=Promise.all([
    fetch(`assets/original/fonts/${id}.json`).then(r=>r.json()).then(m=>{font.meta=m;}),
    new Promise((ok,fail)=>{font.image.onload=ok;font.image.onerror=fail;font.image.src=`assets/original/fonts/${id}.png`;}),
  ]).then(()=>font);
  fonts.set(id,font);return font.ready;
}
export const font=id=>{const f=fonts.get(id);return f?.meta?f:null;};
const TAB='\t',CENTRE='\u0001',RIGHT='\u0002';
const glyph=(f,ch)=>f.meta.glyphs[ch]??f.meta.glyphs['?'];
// 0x437330: a glyph of width 0 (the space) advances by a quarter of the font's first header
// value (+0x560); the line height is the second header value (+0x564).
const advance=(f,g)=>g?(g[1]||Math.trunc(f.meta.line/4)):0;
const lineHeight=f=>f.meta.cell;
// Advance = glyph advance + style spacing (style[1]); TAB = four spaces (0x43772f).
function step(f,ch,spacing){return ch===TAB?4*(advance(f,glyph(f,' '))+spacing):advance(f,glyph(f,ch))+spacing;}
function lineWidth(f,line,spacing) {
  let w=0;for(const ch of line)if(ch!==CENTRE&&ch!==RIGHT)w+=step(f,ch,spacing);
  return line.length?w-spacing:0;
}
// Style flags (0x43777e..): bits 0-1 horizontal (0 left, 1 centre, 2 right), bits 2-3 vertical
// (0 top, 4 centre, 8 bottom). A line starting with code 1 / 2 is centred / right-aligned.
export function measure(fontId,text,{spacing=1,leading=0}={}) {
  const f=font(fontId);if(!f)return {w:0,h:0};
  const lines=String(text).split('\n');
  return {w:Math.max(0,...lines.map(l=>lineWidth(f,l,spacing))),h:lines.length*(lineHeight(f)+leading)-leading};
}
// A text palette (0x403040 copies it to the text's +0x84) recolours the font: the statistics
// draw glyph 0x1f in a player's colour. Strips are tinted once per colour.
function strip(f,color) {
  if(!color)return f.image;
  const cache=f.tinted??=new Map();let c=cache.get(color);
  if(!c){c=document.createElement('canvas');c.width=f.image.width;c.height=f.image.height;const x=c.getContext('2d');x.drawImage(f.image,0,0);x.globalCompositeOperation='source-in';x.fillStyle=color;x.fillRect(0,0,c.width,c.height);cache.set(color,c);}
  return c;
}
export function drawText(ctx,fontId,text,rect,{flags=0,spacing=1,leading=0,alpha=1,color=null}={}) {
  const f=font(fontId);if(!f||!f.image?.naturalWidth)return;const image=strip(f,color); // text can be asked for before the strip has loaded
  const lines=String(text).split('\n'),lineH=lineHeight(f)+leading,total=lines.length*lineH-leading;
  const v=flags&0xc;let y=v===4?rect.y+Math.trunc((rect.h-total)/2):v===8?rect.y+rect.h-total:rect.y;
  const prev=ctx.globalAlpha;ctx.globalAlpha=prev*alpha;
  for(const raw of lines) {
    let h=flags&3,line=raw;
    if(line[0]===CENTRE){h=1;line=line.slice(1);}else if(line[0]===RIGHT){h=2;line=line.slice(1);}
    const w=lineWidth(f,line,spacing);
    let x=h===1?rect.x+Math.trunc((rect.w-w)/2):h===2?rect.x+rect.w-w:rect.x;
    for(const ch of line) {
      if(ch!==TAB){const g=glyph(f,ch);if(g&&g[1]&&g[3]>g[2])ctx.drawImage(image,g[0],g[2],g[1],g[3]-g[2],x,y+g[2],g[1],g[3]-g[2]);}
      x+=step(f,ch,spacing);
    }
    y+=lineH;
  }
  ctx.globalAlpha=prev;
}
