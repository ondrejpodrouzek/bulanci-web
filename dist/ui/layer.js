// Overlay that shows original screens and dialogs above the game frame, at native resolution.
// A stack: a persistent screen (e.g. Start hry) at the bottom, modal dialogs above it. Only
// the top window takes input; pointer events outside every window pass through to the page.
import {createDisplay} from '../display.js';
import {loadFont} from './font.js';
import {preloadBitmaps,loadSpriteManifest} from './widgets.js';

export function createDialogLayer(frame) {
  const canvas=document.createElement('canvas');canvas.id='dialog-layer';canvas.width=800;canvas.height=600;
  canvas.hidden=true;frame.append(canvas);
  // A real input carries typing on phones (virtual keyboard) and for assistive technology.
  const input=document.createElement('input');input.className='dialog-input';input.autocomplete='off';input.hidden=true;frame.append(input);
  const display=createDisplay(canvas),ctx=display.ctx;
  const stack=[];let raf=0,suspended=false;
  const ready=Promise.all([loadFont(174),loadFont(175),loadFont(176),loadSpriteManifest(),preloadBitmaps([132,139,142,19,27,30,31,32,113,114,115,119,120,121,122,123,125,126,127,129,131,133])]);
  // While suspended (a web panel such as the volume popup covers the screen) the layer is hidden
  // and takes no input.
  const top=()=>suspended?null:stack.at(-1)?.win??null;
  const point=e=>{const r=canvas.getBoundingClientRect();return [(e.clientX-r.left)*800/r.width,(e.clientY-r.top)*600/r.height];};
  const inside=(w,x,y)=>x>=w.x&&y>=w.y&&x<w.x+w.w&&y<w.y+w.h;
  const modal=()=>stack.length&&stack.at(-1).modal;
  function syncInput() {
    const win=top(),w=win?.focus;
    if(!w||!(w.numeric||w.textInput)){input.hidden=true;return;}
    const r=canvas.getBoundingClientRect(),s=r.width/800;
    input.inputMode=w.numeric?'numeric':'text';input.maxLength=w.digits??40;
    Object.assign(input.style,{left:`${(win.x+w.x)*s}px`,top:`${(win.y+w.y)*s}px`,width:`${w.w*s}px`,height:`${w.h*s}px`});
    if(input.hidden||input.dataset.for!==String(w.uid??=Math.random())){input.hidden=false;input.dataset.for=String(w.uid);input.value=w.text;}
    if(document.activeElement!==input)input.focus({preventScroll:true});
  }
  // Windows have no background of their own, so a dialog replaces the screen it was opened
  // from instead of being drawn over it.
  function render(now){display.begin();ctx.clearRect(0,0,800,600);const shown=modal()?[stack.at(-1)]:stack;for(const s of shown)s.win.draw(ctx,now);raf=stack.length?requestAnimationFrame(render):0;}
  const kick=()=>{if(!raf&&stack.length)raf=requestAnimationFrame(render);};
  // A screen has no background: a click on its empty area falls through to the page below
  // (the web sound and fullscreen links lie inside the Start hry window).
  function routed(e){const win=top();if(!win)return null;const [x,y]=point(e);return (modal()||(inside(win,x,y)&&win.hit(x,y)))?{win,x,y}:null;}
  frame.addEventListener('pointermove',e=>{const win=top();if(!win)return;const [x,y]=point(e);win.pointerMove(x,y);},{capture:true});
  frame.addEventListener('pointerdown',e=>{
    const r=routed(e);if(!r)return;
    e.preventDefault();e.stopPropagation();
    r.win.pointerMove(r.x,r.y);r.win.pointerDown(r.x,r.y);syncInput();
    try{frame.setPointerCapture(e.pointerId);}catch{} // a dragged slider keeps the pointer
  },{capture:true});
  frame.addEventListener('pointercancel',e=>{const win=top();if(win?.pressedWidget)win.pointerUp(-1,-1);},{capture:true});
  frame.addEventListener('pointerup',e=>{const win=top();if(!win||!win.pressedWidget)return;const [x,y]=point(e);win.pointerUp(x,y);e.stopPropagation();},{capture:true});
  frame.addEventListener('click',e=>{if(routed(e))e.stopPropagation();},{capture:true});
  input.addEventListener('input',()=>{const w=top()?.focus;if(!w)return;w.text=w.numeric?input.value.replace(/\D/g,'').slice(0,w.digits):input.value.slice(0,w.digits);if(w.numeric&&input.value!==w.text)input.value=w.text;});
  input.addEventListener('blur',()=>{if(!top()?.focus?.textInput&&!top()?.focus?.numeric)input.hidden=true;});
  function onKey(e) {
    const win=top();if(!win||canvas.hidden)return;
    if(document.activeElement===input&&(e.key?.length===1||e.code==='Backspace'))return; // the input types
    if(win.key(e)){e.preventDefault();e.stopImmediatePropagation();syncInput();}
  }
  window.addEventListener('keydown',onKey,{capture:true});
  // The layer is the 4:3 frame contained in #game-frame, like the game picture under it; CSS alone
  // cannot size a canvas to fit both ways without its backing store feeding back.
  function fit(){const w=frame.clientWidth,h=frame.clientHeight;if(!w||!h)return;const s=Math.min(w/800,h/600);canvas.style.width=`${800*s}px`;canvas.style.height=`${600*s}px`;}
  new ResizeObserver(()=>{fit();if(top())syncInput();}).observe(frame);fit();
  window.addEventListener('resize',()=>top()&&syncInput());
  function refresh(){canvas.hidden=!stack.length||suspended;frame.classList.toggle('dialog-open',stack.some(s=>s.modal));frame.classList.toggle('screen-open',stack.length>0);if(!stack.length||suspended)input.hidden=true;else syncInput();kick();}
  function suspend(on){suspended=!!on;refresh();}
  function remove(win){const i=stack.findIndex(s=>s.win===win);if(i>=0){stack[i].win.focus?.blur?.();stack.splice(i,1);}refresh();}
  // Persistent screen: replaces the bottom of the stack, closes nothing above it.
  async function show(win){await ready;const i=stack.findIndex(s=>!s.modal);if(i>=0)stack.splice(i,1,{win,modal:false});else stack.unshift({win,modal:false});display.resize();refresh();return win;}
  function hide(){for(let i=stack.length-1;i>=0;i--)if(!stack[i].modal){stack[i].win.focus?.blur?.();stack.splice(i,1);}refresh();}
  // Modal dialog: resolves with what its Ok / Cancel handlers return.
  async function open(win) {
    await ready;
    return new Promise(resolve=>{
      const ok=win.onOk,cancel=win.onCancel;
      win.onOk=()=>{const r=ok?ok():true;remove(win);resolve(r);};
      win.onCancel=()=>{const r=cancel?cancel():false;remove(win);resolve(r??false);};
      stack.push({win,modal:true});display.resize();refresh();
    });
  }
  return {show,hide,open,suspend,ready,get top(){return top();},get modalOpen(){return !!modal();}};
}
