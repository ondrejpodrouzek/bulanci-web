// Phone controls drawn as a transparent overlay above the game screen.
// Left half: floating joystick (appears under the thumb, snaps to the 4 original directions).
// Right half: hold anywhere to fire; separate weapon and pause buttons.
const DIRECTION_NAMES=['left','right','up','down'];

export function createTouchControls({frame,onWeapon,onMenu}) {
  const panel=document.createElement('section');panel.id='touch-controls';panel.className='touch-controls';
  panel.setAttribute('aria-label','Dotykové ovládání hry');panel.hidden=true;
  panel.innerHTML=`<div class="touch-stick-zone" data-touch-zone="move" aria-label="Pohyb – joystick">
    <div class="touch-stick" aria-hidden="true"><i class="touch-stick-arrow" data-arrow="2"></i><i class="touch-stick-arrow" data-arrow="0"></i><i class="touch-stick-arrow" data-arrow="1"></i><i class="touch-stick-arrow" data-arrow="3"></i><span class="touch-stick-knob"></span></div>
  </div><div class="touch-fire-zone" data-touch-zone="fire">
    <span class="touch-fire" role="button" aria-pressed="false" aria-label="Střílet (podrž kdekoli vpravo)"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"/><path d="M12 2v6m0 8v6M2 12h6m8 0h6"/></svg></span>
  </div>
  <button type="button" class="touch-weapon" data-touch-action="weapon" aria-label="Změnit zbraň"><span></span><b></b></button>
  <button type="button" class="touch-pause" data-touch-action="menu" aria-label="Pozastavit hru a otevřít menu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6v12M15 6v12"/></svg></button>
  <div class="phone-hud" aria-hidden="true"><div class="phone-hud-side"></div><div class="phone-time"></div><div class="phone-hud-side"></div></div>
  <p class="phone-rotate">Na šířku je hra větší</p>`;
  frame.after(panel);
  const zone=panel.querySelector('.touch-stick-zone'),stick=panel.querySelector('.touch-stick'),knob=panel.querySelector('.touch-stick-knob');
  const fireButton=panel.querySelector('.touch-fire'),pointers=new Map();let sequence=0,active=false;
  const coarse=matchMedia('(pointer: coarse)'),noHover=matchMedia('(hover: none)');
  const mobile=()=>coarse.matches||(noHover.matches&&navigator.maxTouchPoints>0);
  const radius=()=>stick.offsetWidth/2||60;
  function read(){
    const moves=[...pointers.values()].filter(p=>p.action==='move'&&p.direction!==undefined).sort((a,b)=>b.order-a.order);
    return {direction:moves[0]?.direction,fire:[...pointers.values()].some(p=>p.action==='fire')};
  }
  function placeStick(p){
    // The joystick follows the thumb's first contact; without one it rests in its CSS home position.
    if(p){const r=zone.getBoundingClientRect();stick.style.left=`${p.originX-r.left}px`;stick.style.top=`${p.originY-r.top}px`;stick.classList.add('engaged');}
    else{stick.style.left='';stick.style.top='';stick.classList.remove('engaged');knob.style.transform='';}
  }
  function reflect(){
    const state=read(),move=[...pointers.values()].filter(p=>p.action==='move').sort((a,b)=>b.order-a.order)[0];
    placeStick(move);
    if(move){const max=radius()*.62,len=Math.hypot(move.dx,move.dy)||1,k=Math.min(1,max/len);knob.style.transform=`translate(calc(-50% + ${move.dx*k}px),calc(-50% + ${move.dy*k}px))`;}
    stick.dataset.direction=state.direction===undefined?'none':DIRECTION_NAMES[state.direction];
    for(const a of stick.querySelectorAll('.touch-stick-arrow'))a.classList.toggle('lit',Number(a.dataset.arrow)===state.direction);
    fireButton.classList.toggle('pressed',state.fire);fireButton.setAttribute('aria-pressed',String(state.fire));
  }
  function remove(id){pointers.delete(id);reflect();}
  function reset(){const held=[...pointers.entries()];pointers.clear();for(const [id,p] of held)if(p.capture.hasPointerCapture?.(id))p.capture.releasePointerCapture(id);reflect();}
  function layout(){
    document.documentElement.classList.toggle('touch-device',mobile());
    panel.hidden=!active||!mobile();if(panel.hidden)reset();
    window.dispatchEvent(new Event('bulanci:touch-layout'));
  }
  // On a diagonal the current axis wins until the other one is clearly longer: otherwise the
  // thumb's tremble flips the direction, and the sprite and weapon with it, every few frames.
  function stickDirection(p){
    const dead=radius()*.28,ax=Math.abs(p.dx),ay=Math.abs(p.dy);
    if(Math.hypot(p.dx,p.dy)<dead)return undefined;
    const horizontal=p.direction===undefined?ax>ay:p.direction<2?ax*1.35>=ay:ax>ay*1.35;
    return horizontal?p.dx<0?0:1:p.dy<0?2:3;
  }
  function down(event){
    if(panel.hidden||!active||(event.pointerType==='mouse'&&event.button!==0))return;
    const button=event.target.closest('button[data-touch-action]'),area=event.target.closest('[data-touch-zone]');
    if(!button&&!area)return;
    event.preventDefault();
    const capture=button||area,action=button?button.dataset.touchAction:area.dataset.touchZone;
    try{capture.setPointerCapture?.(event.pointerId);}catch{} // the finger may already be gone
    const p={action,capture,order:++sequence,originX:event.clientX,originY:event.clientY,dx:0,dy:0,direction:undefined};
    if(action==='move'){
      // Starting too close to the screen edge would leave no room to push the knob outward.
      const r=zone.getBoundingClientRect(),pad=radius()*.75;
      p.originX=Math.min(Math.max(event.clientX,r.left+pad),r.right-pad);p.originY=Math.min(Math.max(event.clientY,r.top+pad),r.bottom-pad);
      p.dx=event.clientX-p.originX;p.dy=event.clientY-p.originY;p.direction=stickDirection(p);
    }
    pointers.set(event.pointerId,p);
    if(button)button.classList.add('pressed');
    reflect();
    if(action==='weapon')onWeapon();else if(action==='menu')onMenu();
  }
  function moved(event){
    const p=pointers.get(event.pointerId);if(!p)return;event.preventDefault();
    if(p.action!=='move')return;
    p.dx=event.clientX-p.originX;p.dy=event.clientY-p.originY;
    // Dragging far past the rim drags the base along, so reversing direction stays a short thumb move.
    const max=radius()*1.15,len=Math.hypot(p.dx,p.dy);
    if(len>max){const k=(len-max)/len;p.originX+=p.dx*k;p.originY+=p.dy*k;p.dx-=p.dx*k;p.dy-=p.dy*k;}
    p.direction=stickDirection(p);reflect();
  }
  function up(event){const p=pointers.get(event.pointerId);if(p&&p.capture.matches?.('button'))p.capture.classList.remove('pressed');remove(event.pointerId);}
  panel.addEventListener('pointerdown',down);
  panel.addEventListener('pointermove',moved);
  for(const name of ['pointerup','pointercancel','lostpointercapture'])panel.addEventListener(name,up);
  panel.addEventListener('contextmenu',event=>event.preventDefault());
  // Keyboard/assistive activation of the buttons (pointer taps are handled in pointerdown).
  panel.addEventListener('click',event=>{event.preventDefault();if(event.detail!==0||panel.hidden)return;const action=event.target.closest('[data-touch-action]')?.dataset.touchAction;if(action==='weapon')onWeapon();else if(action==='menu')onMenu();});
  // iOS Safari still pinch-zooms / double-tap-zooms on some elements despite touch-action.
  for(const name of ['touchstart','touchmove','gesturestart'])panel.addEventListener(name,event=>{if(!panel.hidden)event.preventDefault();},{passive:false});
  window.addEventListener('blur',reset);window.addEventListener('orientationchange',reset);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
  coarse.addEventListener('change',layout);noHover.addEventListener('change',layout);layout();
  // Phone HUD: rebuilt only when something shown changes.
  const sides=panel.querySelectorAll('.phone-hud-side'),clock=panel.querySelector('.phone-time'),weaponLabel=panel.querySelector('.touch-weapon span'),weaponAmmo=panel.querySelector('.touch-weapon b');
  const chip=(p,me)=>{const c=document.createElement('div');c.className=me?'phone-chip me':'phone-chip';const dot=document.createElement('i');dot.style.background=p.color;const name=document.createElement('span');name.textContent=p.name;const score=document.createElement('b');score.textContent=p.score;c.append(dot,name,score);return c;};
  let hudKey='';
  function updateHud({players,me,time,weapon,ammo}){
    if(clock.textContent!==time)clock.textContent=time;if(weaponLabel.textContent!==weapon)weaponLabel.textContent=weapon;if(weaponAmmo.textContent!==ammo)weaponAmmo.textContent=ammo;
    const key=JSON.stringify([me,players.map(p=>[p.name,p.score,p.color])]);if(key===hudKey)return;hudKey=key;
    const half=Math.ceil(players.length/2);sides[0].replaceChildren(...players.slice(0,half).map((p,i)=>chip(p,i===me)));sides[1].replaceChildren(...players.slice(half).map((p,i)=>chip(p,i+half===me)));
  }
  return {read,reset,updateHud,isMobile:mobile,setActive(value){if(active===value)return;active=value;layout();}};
}
