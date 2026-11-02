// Native-resolution output for FullHD/4K. The game keeps its original 800x600 logical frame
// (800x515 field + HUD); only the canvas backing store follows the on-screen size, so text,
// HUD and lines are drawn sharp and the original bitmaps are scaled once, at draw time.
export const LOGICAL_W=800,LOGICAL_H=600,MAX_SCALE=6; // 6 x 800 = 4800 px covers 4K at any DPR
const coarse=globalThis.matchMedia?.('(pointer: coarse)'),limit=max=>coarse?.matches?max:MAX_SCALE;
const KEY='bulanci.display.v1';
const load=()=>{try{return JSON.parse(localStorage.getItem(KEY))||{};}catch{return {};}};
const store=v=>{try{localStorage.setItem(KEY,JSON.stringify(v));}catch{}};

// phoneScale: backing scale on touch screens. The game draws no text there, so 1x (the art's own
// size, enlarged by the GPU) looks the same as 2x at a quarter of the fill work.
// Text and UI bitmaps are 1:1 pixels of the 800x600 scene. A plain bilinear stretch by 1.3 blurs each
// of them differently; here the finished 1x picture is enlarged as a whole, first by a whole factor
// with hard pixels and only the rest with smoothing ("sharp bilinear"): every pixel stays one even
// block, with a soft edge one screen pixel wide. A whole-number scale needs no smoothing at all.
const steps=new WeakMap();
export function presentSharp(ctx,source,x,y,w,h,{hard=false}={}) {
  const k=w/source.width,whole=Math.abs(k-Math.round(k))<1e-3;
  ctx.save();ctx.setTransform(1,0,0,1,0,0);
  if(hard||whole){ctx.imageSmoothingEnabled=false;ctx.drawImage(source,x,y,w,h);ctx.restore();return;}
  const n=Math.max(2,Math.ceil(k));let step=steps.get(source);
  if(!step)steps.set(source,step=document.createElement('canvas'));
  if(step.width!==source.width*n||step.height!==source.height*n){step.width=source.width*n;step.height=source.height*n;}
  const s=step.getContext('2d');s.clearRect(0,0,step.width,step.height);s.imageSmoothingEnabled=false;s.drawImage(source,0,0,step.width,step.height);
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='medium';ctx.drawImage(step,x,y,w,h);ctx.restore();
}
export function pictureBuffer(w=LOGICAL_W,h=LOGICAL_H) {
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;return {canvas,ctx:canvas.getContext('2d')};
}

export function createDisplay(canvas,{phoneScale=2}={}) {
  const ctx=canvas.getContext('2d');
  const settings={pixels:'smooth',...load()};
  let scale=1,dirty=true;
  function apply() {
    dirty=false;
    const r=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
    const next=Math.max(1,Math.min(limit(phoneScale),(r.width||LOGICAL_W)*dpr/LOGICAL_W));
    const w=Math.round(LOGICAL_W*next),h=Math.round(LOGICAL_H*next);
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    scale=w/LOGICAL_W;
  }
  // A resize only marks the canvas: resizing clears it, and doing that outside the frame shows
  // a blank picture (phones resize whenever the browser toolbar moves). Called at the start of
  // every frame; resizing a canvas resets its state.
  const resize=()=>{dirty=true;};
  function begin() {
    if(dirty)apply();
    ctx.setTransform(scale,0,0,scale,0,0);
    ctx.imageSmoothingEnabled=settings.pixels!=='sharp';
    ctx.imageSmoothingQuality=coarse?.matches?'medium':'high';
  }
  function setPixels(mode){settings.pixels=mode==='sharp'?'sharp':'smooth';store(settings);window.dispatchEvent(new Event('bulanci:display'));}
  new ResizeObserver(resize).observe(canvas);
  window.addEventListener('resize',resize);
  matchMedia('(resolution: 1dppx)').addEventListener?.('change',resize);
  apply();
  return {ctx,begin,resize,setPixels,get pixels(){return settings.pixels;},get scale(){return scale;},
    get backing(){return {width:canvas.width,height:canvas.height};}};
}
