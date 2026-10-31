const frame=document.querySelector('#game-frame'),button=document.querySelector('#fullscreen');
if(frame && !frame.closest('.game-screen-shell')) {
  const shell=document.createElement('div');shell.className='game-screen-shell';shell.id='game-screen-shell';
  frame.before(shell);shell.append(frame);
  const touch=document.querySelector('#touch-controls');if(touch)shell.append(touch);
  const tools=document.createElement('div');tools.className='game-fullscreen-tools';
  tools.innerHTML='<button type="button" data-fullscreen-sound aria-label="Vypnout nebo zapnout zvuk">Zvuk</button><button type="button" data-fullscreen-pixels aria-label="Přepnout ostré nebo vyhlazené pixely">Obraz</button><button type="button" data-fullscreen-exit aria-label="Opustit celou obrazovku">↙ Zpět</button>';
  shell.append(tools);
  let fallback=false,hideTimer=null,previousOverflow='';
  const active=()=>document.fullscreenElement===shell||document.webkitFullscreenElement===shell||fallback;
  function dimensions(){
    if(!active())return;
    // Touch controls are an overlay, so the game always gets the whole screen.
    const availableWidth=shell.clientWidth,availableHeight=shell.clientHeight;
    const width=Math.floor(Math.max(0,Math.min(availableWidth,availableHeight*4/3)));
    shell.style.setProperty('--fullscreen-game-width',`${width}px`);
    shell.style.setProperty('--fullscreen-game-height',`${width*3/4}px`);
  }
  function reveal(){
    shell.classList.add('fullscreen-controls-visible');clearTimeout(hideTimer);
    hideTimer=setTimeout(()=>shell.classList.remove('fullscreen-controls-visible'),2200);
  }
  function reflect(){
    const enabled=active();
    if(button){button.textContent=enabled?'Opustit celou obrazovku':'Celá obrazovka';button.setAttribute('aria-pressed',String(enabled));}
    dimensions();if(enabled)reveal();
    // Keep keyboard play usable after the browser moves focus to the fullscreen element.
    if(document.activeElement===document.body||document.activeElement===shell||document.activeElement===button)frame.querySelector('canvas')?.focus({preventScroll:true});
  }
  async function leave(){
    if(fallback){fallback=false;shell.classList.remove('game-page-fullscreen');document.body.style.overflow=previousOverflow;reflect();return;}
    if(document.fullscreenElement)await document.exitFullscreen();
    else if(document.webkitFullscreenElement)document.webkitExitFullscreen();
  }
  async function toggle(){
    if(active()){await leave();return;}
    try{
      if(shell.requestFullscreen)await shell.requestFullscreen({navigationUI:'hide'});
      else if(shell.webkitRequestFullscreen)shell.webkitRequestFullscreen();
      else throw new Error('Fullscreen API unavailable');
    }catch(error){
      // Safari/embedded contexts may deny native fullscreen. The same 4:3 layout
      // can still fill the browser viewport and can be left with Escape.
      previousOverflow=document.body.style.overflow;fallback=true;
      document.body.style.overflow='hidden';shell.classList.add('game-page-fullscreen');
      if(button)button.title='Hra vyplňuje okno prohlížeče. F11 může skrýt také lišty prohlížeče.';
    }
    reflect();
  }
  if(button)button.addEventListener('click',event=>{event.stopImmediatePropagation();toggle();},{capture:true});
  tools.querySelector('[data-fullscreen-exit]').onclick=leave;
  tools.querySelector('[data-fullscreen-sound]').onclick=()=>document.querySelector('#sound')?.click();
  tools.querySelector('[data-fullscreen-pixels]').onclick=()=>document.querySelector('#pixels')?.click();
  document.addEventListener('fullscreenchange',reflect);document.addEventListener('webkitfullscreenchange',reflect);
  window.addEventListener('resize',dimensions);new ResizeObserver(dimensions).observe(shell);
  window.addEventListener('bulanci:touch-layout',dimensions);
  new MutationObserver(dimensions).observe(document.querySelector('#menu'),{attributes:true,attributeFilter:['hidden']});
  shell.addEventListener('pointermove',reveal,{passive:true});shell.addEventListener('pointerdown',reveal,{passive:true});
  document.addEventListener('keydown',event=>{
    if(event.altKey&&event.code==='Enter'){event.preventDefault();event.stopImmediatePropagation();toggle();}
    else if(fallback&&event.code==='Escape'){event.preventDefault();event.stopImmediatePropagation();leave();}
    if(active())reveal();
  },{capture:true});
  globalThis.bulanciFullscreen={toggle,exit:leave,isActive:active,resize:dimensions};
  reflect();
}
