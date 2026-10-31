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
