// Original CMenu constructor 0x4265xx: 800x600; buttons (35,37/121/205),
// labels (100,55/139/223), assets212/213,147/148,67/68,75/76.
import {attachMenuScene} from './ui/menu-scene.js';
const menu=document.querySelector('#menu'),frame=document.querySelector('#game-frame');
if (menu && frame && !document.querySelector('.original-menu-stage')) {
  const stage=document.createElement('div');stage.className='original-menu-stage';
  while(menu.firstChild)stage.append(menu.firstChild);
  menu.append(stage);
  const nav=stage.querySelector('nav'), options=stage.querySelector('.menu-options');
  const illustration=document.createElement('img');illustration.className='menu-illustration';illustration.alt='';illustration.src='assets/original/menu-start.jpg';stage.prepend(illustration);
  globalThis.bulanciMenuScene=attachMenuScene(stage,menu);
  // Historie is the original CHistoryDlg drawn by the dialog layer (ui/history-dialog.js).
  const exit=document.createElement('section');exit.className='menu-exit-panel';exit.hidden=true;stage.append(exit); // the original CExitDlg is drawn by the dialog layer (ui/exit-screen.js)
  const start=stage.querySelector('#start'),historyButton=stage.querySelector('#history');
  const exitButton=document.createElement('button');exitButton.id='original-exit';exitButton.className='picture-button';exitButton.type='button';exitButton.setAttribute('aria-label','Konec');nav.insertBefore(exitButton,stage.querySelector('#resume'));
  for(const [button,normal,active,label] of [[start,147,148,'Start'],[historyButton,67,68,'Historie'],[exitButton,75,76,'Konec']]) {
    button.type='button';button.innerHTML=`<span class="menu-orb" aria-hidden="true"></span><img class="menu-word" src="assets/original/${normal}.png" alt="${label}"><img class="menu-word menu-word-active" src="assets/original/${active}.png" alt="" aria-hidden="true">`;
  }
  // CMenu orb buttons (0x424bc0): an animation with clips 212 and 213 (8 frames, 568 ms), shown
  // on clip 212 frame 0. Pointer over a button that is not selected (0x423f20) plays 212 once
  // with global sample 0 and leaves it lit; pointer out (0x423ef0) plays 213 once. Either only
  // starts while the orb is idle. Selecting (0x424d30) plays 212 unless it is already lit, and the
  // previously selected orb plays 213 (message 0xc8, 0x424dc0). The words switch only with the
  // selection: the command handlers hide the normal word and show the active one (0x423a00).
  const ORB_FRAMES=8,ORB_MS=568;
  const orbs=new Map([[start,'start'],[historyButton,'history'],[exitButton,'exit']].map(([button,name])=>[button,{name,el:button.querySelector('.menu-orb'),clip:0,frame:0,fresh:true,playing:false,selected:false,raf:0}]));
  function drawOrb(o){o.el.style.backgroundImage=`url(assets/original/sprites/${o.clip?213:212}-sheet.png)`;o.el.style.backgroundPosition=`${-64*o.frame}px 0`;}
  function playOrb(o,clip,sound) {
    o.clip=clip;o.frame=0;o.fresh=false;o.playing=true;drawOrb(o);cancelAnimationFrame(o.raf);
    if(sound)globalThis.bulanciAudio?.playSample(4,0,{whilePaused:true,x:400});
    const t0=performance.now();
    const tick=now=>{const f=Math.floor((now-t0)*ORB_FRAMES/ORB_MS);o.frame=Math.min(ORB_FRAMES-1,f);drawOrb(o);if(f<ORB_FRAMES)o.raf=requestAnimationFrame(tick);else o.playing=false;};
    o.raf=requestAnimationFrame(tick);
  }
  function selectOrb(view) {
    for(const o of orbs.values()) {
      if(o.name===view){if(o.selected)continue;if(o.clip===1||o.fresh)playOrb(o,0,true);o.selected=true;}
      else if(o.selected){o.selected=false;if(!o.playing)playOrb(o,1,false);}
    }
  }
  for(const [button,o] of orbs) {
    drawOrb(o);
    button.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch'&&!o.selected&&!o.playing)playOrb(o,0,true);});
    button.addEventListener('pointerleave',e=>{if(e.pointerType!=='touch'&&!o.selected&&!o.playing)playOrb(o,1,false);});
  }
  // Keys S, H and K select Start, Historie and Konec (0x424fa0); X (quit the program) has no web counterpart.
  document.addEventListener('keydown',e=>{
    if(menu.hidden||e.ctrlKey||e.altKey||e.metaKey||e.target.closest?.('input,select,textarea'))return;
    const button={KeyS:start,KeyH:historyButton,KeyK:exitButton}[e.code];if(button){e.preventDefault();button.click();}
  });
  function show(view) {
    selectOrb(view);
    options.hidden=view!=='start';exit.hidden=view!=='exit';
    for(const [button,name] of [[start,'start'],[historyButton,'history'],[exitButton,'exit']]) {
      if(name===view)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
    }
    illustration.src=`assets/original/menu-${view}.jpg`;
    document.dispatchEvent(new CustomEvent('bulanci:menu-view',{detail:view}));
    const sounds={start:27,history:24,exit:25};
    globalThis.bulanciAudio?.playSample(4,sounds[view],{whilePaused:true,x:400});
  }
  start.addEventListener('click',event=>{event.stopImmediatePropagation();show('start');},{capture:true});
  historyButton.addEventListener('click',event=>{event.stopImmediatePropagation();show('history');},{capture:true});
  exitButton.addEventListener('click',()=>show('exit'));
  if(options.querySelector('h1'))options.querySelector('h1').textContent='Nastavení hry';
  const soundPanel=document.createElement('div');soundPanel.className='menu-sound-popup';soundPanel.hidden=true;
  soundPanel.innerHTML='<b>Hudba a zvuky</b><button type="button" class="close-menu-sound" aria-label="Zavřít hlasitost">×</button><div class="audio-volume-panel"><label>Hudba<input type="range" min="0" max="100" data-audio-volume="music" aria-label="Hlasitost hudby v menu"><output></output></label><label>Zvuky<input type="range" min="0" max="100" data-audio-volume="effects" aria-label="Hlasitost efektů v menu"><output></output></label><label>Hlášky<input type="range" min="0" max="100" data-audio-volume="voices" aria-label="Hlasitost hlášek v menu"><output></output></label></div>';
  stage.append(soundPanel);soundPanel.querySelector('.close-menu-sound').onclick=()=>soundPanel.hidden=true;
  for(const input of soundPanel.querySelectorAll('input'))input.addEventListener('input',()=>{
    globalThis.bulanciAudio?.configure({[input.dataset.audioVolume]:Number(input.value)/100});globalThis.bulanciAudio?.unlock();
  });
  const audio=document.createElement('button');audio.type='button';audio.className='menu-audio-shortcut';audio.textContent='Hudba a zvuky';audio.onclick=()=>{
    soundPanel.hidden=!soundPanel.hidden;
    globalThis.bulanciAudio?.dispatchEvent(new Event('settingschange'));
  };stage.append(audio);
  document.addEventListener('keydown',event=>{if(event.code==='Escape'&&!soundPanel.hidden){event.stopImmediatePropagation();event.preventDefault();soundPanel.hidden=true;}},{capture:true});
  const fullscreen=document.createElement('button');fullscreen.type='button';fullscreen.className='menu-fullscreen-shortcut';fullscreen.textContent='Celá obrazovka';fullscreen.onclick=()=>document.querySelector('#fullscreen')?.click();stage.append(fullscreen);
  // Contain-fit and centre like the dialog layer (ui/layer.js), so the picture and the dialogs drawn
  // over it stay aligned on any screen shape.
  const resize=()=>{const w=frame.clientWidth,h=frame.clientHeight,k=Math.min(w/800,h/600);stage.style.transform=`translate(${(w-800*k)/2}px,${(h-600*k)/2}px) scale(${k})`;};
  new ResizeObserver(resize).observe(frame);resize();
  start.setAttribute('aria-current','page');selectOrb('start'); // CMenu ctor selects its initial button (0x426c95)
}
