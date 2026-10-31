import {Game,WEAPONS,DIRECTIONS,shotPellets} from './engine.js';
import {bodyResource,deathResource,actorLayout,weaponFrame,deathPose} from './actor-frames.js';
import {objectFrame} from './mines.js';
import {sceneAnimFrame,sceneAnimOffset} from './scene-anims.js';
import {WEAPON_DATA,SHOT_DATA} from './original-data.js';
import {createTouchControls} from './touch-controls.js';
import {createDisplay} from './display.js';
import {KEYSETS,defaultHumans} from './players.js';
import {RULE_DEFAULTS} from './rules.js';
import {createDialogLayer} from './ui/layer.js';
import {createGunMouse} from './ui/gun-mouse.js';
import {gameTypeDialog,RULE_SUMMARY} from './ui/game-type-dialog.js';
import {startGame1,startGame2,keysDialog} from './ui/start-game.js';
import {msgDialog,nameUsedText} from './ui/msg-dialog.js';
import {setupDialog} from './ui/setup-dialog.js';
import {pauseDialog} from './ui/pause-dialog.js';
import {scoreScreen} from './ui/score-screen.js';
import {loadingDialog} from './ui/loading-dialog.js';
import {exitScreen} from './ui/exit-screen.js';
import {historyDialog} from './ui/history-dialog.js';
import {tcpipDialog,sessionList} from './ui/net-dialogs.js';
import {connectNet,hostLobby,guestLobby,hostGame,guestGame,netURL} from './net.js';
import {attachRemoteGame,remoteEvents} from './audio-bridge.js';
import {createPhoneMenu} from './phone-ui.js';
import {PLAYER_COLORS,colorCss} from './players.js';
import {loadSpriteManifest} from './ui/widgets.js';
const $=s=>document.querySelector(s),canvas=$('#game'),display=createDisplay(canvas,{phoneScale:1}),ctx=display.ctx,dialogs=createDialogLayer($('#game-frame'));
createGunMouse($('#game-frame'),loadSpriteManifest(),()=>!$('#menu').hidden||!$('#dialog-layer').hidden);
let maps={},manifest={resources:{}},game=null,paused=false,menu=true,mapKey='malaria',last=0,acc=0,muted=true,loading=true,toastUntil=0;
const keys=[],images=new Map(),bitmaps=new Map(),sounds=['0-0.wav','0-1.wav','0-0.wav'].map(file=>new Audio('assets/original/audio/'+file));
const touch=createTouchControls({frame:$('#game-frame'),onWeapon:()=>{if(netPlay?.role==='guest')netPlay.guest.weapon(0);else game?.switchWeapon(0);},onMenu:()=>netPlay?phoneLeave():pauseGame()});
// Phones get their own menu and sheets (phone-ui.js); the game stays the same.
const phoneMenu=touch.isMobile()?createPhoneMenu({root:document.body,colors:PLAYER_COLORS.map((_,i)=>colorCss(i)),thumb:map=>layerSrc(map.layers[0]),
  onPlay:({level,human})=>{$('#map-select').value=level;$('#map-select').dispatchEvent(new Event('change'));$('#mode').value='training';$('#mode').dispatchEvent(new Event('change'));customHumans=[human];start().finally(()=>{customHumans=null;});},
  onNetwork:()=>showScreen1(),onHistory:()=>showHistory(),onBack:()=>document.dispatchEvent(new CustomEvent('bulanci:menu-view',{detail:'start'}))}):null;
if(phoneMenu)new MutationObserver(()=>phoneMenu.setVisible(!$('#menu').hidden)).observe($('#menu'),{attributes:true,attributeFilter:['hidden']});
// Colour sheets of a round stay decoded as bitmaps on phones: iOS drops decoded images and
// redecoding one in the middle of the game makes the sprite vanish for a moment.
const sheetReady=im=>!!im&&(im instanceof ImageBitmap||(im.complete&&im.naturalWidth));
function sheet(src,fallback){const im=bitmaps.get(src)??image(src);return sheetReady(im)||!fallback?im:bitmaps.get(fallback)??image(fallback);}
function image(src){if(!images.has(src)){const im=new Image();im.src=src;images.set(src,im);}return images.get(src);}
function drawImage(src,x,y,w,h){const im=image(src);if(im.complete&&im.naturalWidth){if(w!==undefined)ctx.drawImage(im,x,y,w,h);else ctx.drawImage(im,x,y);}}
function message(text){$('#message').textContent=text;$('#message').style.opacity=1;toastUntil=performance.now()+2500;}
function load(){return Promise.all([fetch('assets/original/maps.json').then(r=>{if(!r.ok)throw Error('Chybí data map');return r.json();}),fetch('assets/original/sprites/manifest.json').then(r=>r.json())]).then(([m,s])=>{maps=m;manifest=s;for(const map of Object.values(maps))for(const l of map.layers)image(l.resource===310?'assets/disco.jpg':`assets/original/${l.resource}.png`);for(const row of SHOT_DATA)for(const shot of row)image(`assets/original/${shot.resource}.png`);for(const n of manifest.undead_variant?.resources??[])image(`assets/original/sprites/${n}-undead-sheet.png`);for(const [n,r] of Object.entries(manifest.resources))if(r.width*r.height*r.frames<=1<<20)image(`assets/original/sprites/${n}-sheet.png`);image('assets/original/117.png');loading=false;phoneMenu?.setMaps([...$('#map-select').options].filter(o=>maps[o.value]).map(o=>({key:o.value,name:o.textContent,map:maps[o.value]})));$('#start-text').disabled=false;$('#start-text').textContent='START HRY';}).catch(e=>{loading=false;message('Nepodařilo se načíst data: '+e.message);console.error(e);});}
function clear(){keys.length=0;touch.reset();}
function showMenu(){if(!game||game.over||dialogs.modalOpen)return;menu=true;paused=true;clear();$('#menu').hidden=false;$('#resume').hidden=false;showStartScreen();}
// Original pause (0x41c290): the game stands still under the Hra je pozastavena dialog.
async function pauseGame(){if(!game||game.over||menu||paused||netPlay)return;paused=true;clear();document.dispatchEvent(new CustomEvent('bulanci:pause',{detail:true}));const r=await (phoneMenu?phoneMenu.pause():dialogs.open(pauseDialog({onSetup:openSetup})));paused=false;acc=0;document.dispatchEvent(new CustomEvent('bulanci:pause',{detail:false}));if(r==='end')game.finish();else canvas.focus();}
function resume(){if(!game||game.over)return;menu=false;paused=false;clear();$('#menu').hidden=true;$('#result').hidden=true;acc=0;canvas.focus();}
function onEvent(e){if(e.type==='powerup'&&e.player.id===0&&!e.player.bot)message(['Neviditelnost na 20 s','Štít na 20 s','Neomezené náboje na 20 s','Čas +15 s'][e.powerup.kind]);if(e.type==='shot'&&!muted){const sound=sounds[e.weapon??e.player.weapon];if(sound){const copy=sound.cloneNode();copy.volume=.35;copy.play().catch(()=>{});}}if(e.type==='pickup'&&e.player.id===0)message(WEAPONS[e.item.type].name+' — sebráno');if(e.type==='kill'&&e.victim.id===0)message('Zásah. Za chvíli jsi zpátky.');if(netPlay?.host)netPlay.host.event(e);if(e.type==='end'){netPlay?.host?.end();if(netPlay?.host)closeNet();showScore(game);}}
// After the round (0x41d5f0) the game view waits for the end sound 17 (0.72 s), then CScore runs
// (0x401c66) with sample 4/29 in the music group; closing it returns to the start screen.
async function showScore(ended){
  menu=false;await new Promise(r=>setTimeout(r,720));if(game!==ended)return;
  document.dispatchEvent(new CustomEvent('bulanci:score',{detail:true}));
  globalThis.bulanciAudio?.playSample(4,29,{category:'music',whilePaused:true});
  if(phoneMenu)await phoneMenu.score(ended);else await dialogs.open(scoreScreen({game:ended,level:mapKey,manifest:await loadSpriteManifest()}));
  document.dispatchEvent(new CustomEvent('bulanci:score',{detail:false}));
  if(game!==ended)return;
  $('#result').hidden=true;$('#menu').hidden=false;$('#resume').hidden=true;menu=true;paused=true;showStartScreen();
}
let customHumans=null;
async function start(){try{if(loading)await ready;dialogs.hide();if(!maps[$('#map-select').value])throw Error('Data mapy nejsou dostupná');mapKey=$('#map-select').value;const next=new Game({mapData:maps[mapKey],mode:$('#mode').value==='training'?'training':'local',humans:customHumans??defaultHumans($('#mode').value==='training'?1:$('#mode').value==='local3'?3:2),gameType:rulesState.type,limit:rulesState.limits[rulesState.type],weapons:rulesState.weapons,onEvent});await loadLevel(maps[mapKey],next.players);game=next;if(netPlay?.role==='host')netPlay.begin(game);if(location.search.includes('debug'))globalThis.bulanciGame=game;paused=false;menu=false;clear();acc=0;$('#menu').hidden=true;$('#result').hidden=true;$('#resume').hidden=false;canvas.focus();touch.setActive(true);message(touch.isMobile()?'Palec vlevo: pohyb · vpravo: střelba':(game.humans.length>1?'S F E D / J L I K / Num 4 6 8 5: pohyb · A / M / Num 0: střelba · Q / N / Num 1: zbraň':'Šipky: pohyb · mezerník: střelba · C: zbraň'));}catch(e){console.error(e);message('Spuštění se nezdařilo: '+e.message);}}
function direction(codes){for(let i=keys.length-1;i>=0;i--){const d=codes.indexOf(keys[i]);if(d>=0)return d;}return undefined;}
// Each human reads the original key set of its profile (players.js); touch drives player 1.
function input(){const t=touch.read();return (game?.players??[]).map((p,slot)=>{if(p.bot)return {};if(netPlay?.owners&&netPlay.owners[slot]!==0)return netPlay.host.input(slot);const k=KEYSETS[p.keys??0];const i={direction:direction(k.slice(0,4)),fire:keys.includes(k[4])};if(p.id===0){i.direction=t.direction??i.direction;i.fire=i.fire||t.fire;}return i;});}
const localHumans=()=>netPlay?.role==='guest'?netPlay.humans:(game?.players??[]).filter((p,i)=>!p.bot&&(!netPlay?.owners||netPlay.owners[i]===0));
const activeKeyCodes=()=>new Set(localHumans().flatMap(p=>KEYSETS[p.keys??0]));
// Original frames, no substitute vector characters. Direction-specific resource
// mapping and runtime palette are still being recovered; this is disclosed in status.
const variantList=color=>color==='undead'?manifest.undead_variant?.resources:/^c[0-7]$/.test(color)?manifest.original_color_variant_resources:manifest.player_color_variant_resources;
function sprite(n,x,y,elapsed=0,playing=true,color=null,explicitFrame=null){const info=manifest.resources[n];if(!info)return;const im=spriteSheet(n,color);if(!sheetReady(im))return;const duration=info.duration_ticks/1000||1,frame=explicitFrame??(playing?Math.floor(elapsed/duration*info.frames)%info.frames:0);ctx.drawImage(im,frame*info.width,0,info.width,info.height,Math.round(x),Math.round(y),info.width,info.height);}
// Current animation frame index for a resource (same selection as sprite()).
function frameIndex(n,elapsed=0,playing=true){const info=manifest.resources[n];if(!info)return 0;const duration=info.duration_ticks/1000||1;return playing?Math.floor(elapsed/duration*info.frames)%info.frames:0;}
// While a colour sheet is not there yet the plain sheet stands in, so nothing ever disappears.
function spriteSheet(n,color){const base=`assets/original/sprites/${n}-sheet.png`;return color&&variantList(color)?.includes(n)?sheet(`assets/original/sprites/${n}-${color}-sheet.png`,base):sheet(base);}
// Draw rows [row0,row1) of weapon frame f. The original renderer 0x417640 splits
// the weapon source rectangle so part draws behind the body and part in front.
function weaponSlice(n,f,x,y,row0,row1,color){const info=manifest.resources[n];if(!info)return;const im=spriteSheet(n,color);if(!sheetReady(im))return;const r0=Math.max(0,row0),r1=Math.min(info.height,row1),h=r1-r0;if(h<=0)return;ctx.drawImage(im,f*info.width,r0,info.width,h,Math.round(x),Math.round(y)+r0,info.width,h);}
function player(p){
 if(p.active===false)return;
 const color=p.undead?'undead':`c${p.colorIndex??0}`;
 if(p.dead>0){const n=deathResource(p),pose=deathPose(p);sprite(n,pose.x,pose.y,0,false,color,pose.frame);if(p.undead&&p.deathElapsed<.855){const ghost=deathPose(p,218);sprite(218,ghost.x,ghost.y,0,false,color,ghost.frame);}return;}
 const resource=bodyResource(p),info=manifest.resources[resource];if(!info)return;
 const bodyX=p.x-info.width/2,bodyY=p.y-info.height+12,bodyFrame=p.bodyFrame??frameIndex(resource,p.walk,p.moving);
 const drawBody=()=>sprite(resource,bodyX,bodyY,p.walk,p.moving,color,bodyFrame);
 const ids=WEAPON_DATA[p.weapon]?.resources;
 const wn=ids?ids[p.direction]:null,wd=wn!=null?manifest.resources[wn]:null;
 if(!wd){drawBody();}
 else{
  const wFrame=weaponFrame(p),layout=actorLayout(p);
  const wx=layout.weaponX,wy=layout.weaponY;
  if(p.direction===2){weaponSlice(wn,wFrame,wx,wy,0,wd.height,color);drawBody();}          // up: behind body
  else if(p.direction===3){drawBody();weaponSlice(wn,wFrame,wx,wy,0,wd.height,color);}       // down: in front
  else{const cut=Math.floor(wd.height/2)+(p.direction===0?-7:5);                              // left/right: split
   weaponSlice(wn,wFrame,wx,wy,0,cut,color);drawBody();weaponSlice(wn,wFrame,wx,wy,cut,wd.height,color);}
 }
 if(!p.npc&&(p.id===0||game.mode==='local')){ctx.fillStyle=p.id===0?'#fff':'#fa8888';ctx.font='10px Tahoma';ctx.textAlign='center';ctx.fillText(String(p.id+1),p.x,p.y-info.height+9);}
}

const layerSrc=l=>l.resource===310?'assets/disco.jpg':`assets/original/${l.resource}.png`;
const layerIsFg=(l,i)=>l.fg===undefined?i>0:!!l.fg;
// Player panel origins (0x4af924) and CSpells icons: bitmap 78 cut at the same x as drawn
// (0x4278c0 rect table 0x4b39b8: eye 25..36, shield 0..11, ammo 13..23), panel offset (6,41).
const HUD_X=[12,149,556,693],SPELL_RECTS=[[25,11],[0,11],[13,10]];
// Scene CAnimation: loops follow the clock, one-shot (Malárie, crane) frames come from scene-anims.js.
const drawAnim=(o,i)=>{const [dx,dy]=sceneAnimOffset(game,i);if(manifest.resources[o.resource])sprite(o.resource,o.x+dx,o.y+dy,game?.elapsed??0,true,null,sceneAnimFrame(game,o,i));};
function render(){display.begin();ctx.fillStyle='#000';ctx.fillRect(0,0,800,600);const map=game?.map??maps[mapKey];if(map){map.layers.forEach((l,i)=>{if(!layerIsFg(l,i))drawImage(layerSrc(l),l.x,l.y);});(map.animations??[]).forEach((o,i)=>{if(!o.layer)drawAnim(o,i);});
 if(game){
  for(const item of game.pickups)sprite(item.resource,item.x,item.y,game.elapsed-(item.shownAt??0),true);
  // Solo power-up item (animations 293/294/221/220) at its original top-left placement.
  if(game.powerups?.item){const it=game.powerups.item;sprite(it.resource,it.x,it.y,game.elapsed-it.shownAt,true);}
  const drawCreature=c=>c.hidden||sprite(c.res,c.x+(c.offsetX??0),c.y+(c.offsetY??0),0,false,null,c.frame??0);
  for(const c of game.creatures)if(c.layer===0)drawCreature(c);
  const actors=[...game.players,...game.npcs].filter(p=>p.active!==false).map(p=>({z:p.y+12,draw:()=>{
   // 0x417640: an invisible actor is skipped for everyone else; the solo human sees a faint additive copy (0x303030).
   const hidden=p.dead<=0&&p.effects?.invisible>0;if(hidden&&(p.bot||p.npc||p.id!==0))return;
   ctx.save();if(hidden){ctx.globalCompositeOperation='lighter';ctx.globalAlpha=0x30/255;}if(p.undead&&p.dead<=0)ctx.filter=`brightness(${p.fade??1})`;player(p);ctx.restore();}}));
  for(const mn of game.mines)actors.push({z:mn.y+4,draw:()=>sprite(177,mn.x,mn.y,0,false,null,objectFrame(mn,game.elapsed))});
  for(const c of game.creatures)if(c.layer===1)actors.push({z:c.y+(c.offsetY??0)+c.h+(c.z??0),draw:()=>drawCreature(c)});
  if([320,321,323,324].includes(map.source_resource))for(const l of map.layers)if(l.fg&&!l.overlay){const im=image(layerSrc(l));actors.push({z:l.y+(im.naturalHeight||0)+(l.z??0),draw:()=>drawImage(layerSrc(l),l.x,l.y)});}
  // Shots are scene objects too: CShot depth 15 (0x41ef02); horizontal shotgun shots lose 5 per
  // 40px step (0x419b40). They pass behind scenery such as the mushroom cap instead of over it.
  for(const b of game.bullets){const steps=b.mask!==undefined&&b.direction<2?(b.height-b.bitmapHeight)/10:0;
   actors.push({z:b.y+(b.height??2)+15-5*steps,draw:()=>{if(b.mask!==undefined)for(const q of shotPellets(b))drawImage(`assets/original/${b.resource}.png`,Math.round(q.x),Math.round(q.y));else if(b.resource)drawImage(`assets/original/${b.resource}.png`,Math.round(b.x),Math.round(b.y));else{ctx.fillStyle='#fff2bd';ctx.fillRect(Math.round(b.x),Math.round(b.y),2,2);}}});}
  for(const object of actors.sort((a,b)=>a.z-b.z))object.draw();
  for(const e of game.explosions)sprite(178,e.x,e.y,0,false,null,objectFrame(e,game.elapsed));
  // CTeleportPoint: animation 304 centred on the actor's collision rectangle (0x41c9a0).
  for(const t of game.teleports??[]){const d=manifest.resources[t.resource];if(d)sprite(t.resource,t.x-d.width/2,t.y-d.height/2,game.elapsed-t.at,true);}
  for(const c of game.creatures)if(c.layer===2)drawCreature(c);
 }
 // Foreground is composited at original serialized scene positions.
 // Layer-2 scene animations interleave with the top bitmaps in script insertion order.
 const top=[];map.layers.forEach((l,i)=>{if(layerIsFg(l,i)&&(![320,321,323,324].includes(map.source_resource)||!game||l.overlay))top.push({at:parseInt(l.source_offset??'0',16),draw:()=>drawImage(layerSrc(l),l.x,l.y)});});
 (map.animations??[]).forEach((o,i)=>{if(o.layer)top.push({at:parseInt(o.source_offset??'0',16),draw:()=>drawAnim(o,i)});});
 for(const t of top.sort((a,b)=>a.at-b.at))t.draw();
 }if(phoneMenu)return; // phones show the whole field and their own HUD (touch-controls.js)
 drawImage('assets/original/117.png',0,495,800,105);
 const shownTime=game?game.time:($('#mode').value==='training'?150:rulesState.type==='time'?rulesState.limits.time:Infinity),time=Math.ceil(shownTime);if(Number.isFinite(time)){ctx.fillStyle='#222';ctx.font='bold 12px Tahoma';ctx.textAlign='center';ctx.fillText(`${Math.floor(time/60)}:${String(time%60).padStart(2,'0')}`,400,551);}
 if(game)for(const p of game.players){const x=HUD_X[p.id];for(const [bit,name] of ['invisible','shield','ammo'].entries())if(p.effects?.[name]>0){const [l,w]=SPELL_RECTS[bit],im=image('assets/original/78.png');if(im.complete&&im.naturalWidth)ctx.drawImage(im,l,0,w,14,x+6+l,536,w,14);}ctx.textAlign='left';ctx.fillStyle='#eee';ctx.font='10px Tahoma';ctx.fillText(p.name,x+4,512);ctx.font='bold 17px Tahoma';ctx.fillText(String(p.score).padStart(2,'0'),x+7,539);ctx.font='9px Tahoma';ctx.fillStyle='#ccc';ctx.fillText(WEAPONS[p.weapon].name,x+4,557);ctx.fillStyle='#e13e36';for(let i=0;i<p.ammo[p.weapon];i++)ctx.fillRect(x+5+i*7,567,4,10);if(p.reloading>0){ctx.fillStyle='#ccc';ctx.fillText('Nabíjení...',x+4,590);}}
 if(location.search.includes('debug')&&map){ctx.save();ctx.lineWidth=1;ctx.strokeStyle='rgba(255,40,40,.85)';for(const o of map.obstacles)ctx.strokeRect(o.x+.5,o.y+.5,o.w,o.h);if(game){ctx.strokeStyle='rgba(0,230,255,.95)';for(const p of game.players){if(p.dead>0)continue;const r={x:p.x-55/2+2,y:p.y-62+12+25,w:51,h:37};ctx.strokeRect(r.x+.5,r.y+.5,r.w,r.h);ctx.fillStyle='#ff0';ctx.fillRect(p.x-1,p.y-1,2,2);}}ctx.restore();}
}
function phoneHud(){const me=netPlay?.role==='guest'?Math.max(0,game.humans.findIndex(h=>h.peer===netPlay.net.peer)):0,p=game.players[me];if(!p)return;const left=Math.ceil(game.time);touch.updateHud({players:game.players,me,time:Number.isFinite(left)?`${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`:'∞',weapon:WEAPONS[p.weapon]?.name??'',ammo:p.reloading>0?'…':String(p.ammo[p.weapon]??0)});}
function frame(now){touch.setActive(!!game&&!menu&&!paused&&!game.over);if(phoneMenu&&game&&!menu&&!game.over)phoneHud();const dt=Math.min(.1,(now-last)/1000||0);last=now;if(game?.mirror){if(!menu&&!game.over)netPlay?.guest?.sendInput(guestInput());}else if(game&&!menu&&!paused&&!game.over){acc+=dt;while(acc>=1/60){game.update(1/60,input());netPlay?.host?.afterUpdate();acc-=1/60;}}render();if(toastUntil&&now>toastUntil){$('#message').style.opacity=0;toastUntil=0;}requestAnimationFrame(frame);}
$('#start').onclick=start;$('#start-text').onclick=start;$('#again').onclick=start;$('#resume').onclick=resume;$('#back').onclick=()=>{$('#result').hidden=true;$('#menu').hidden=false;menu=true;paused=true;showStartScreen();};$('#menu-button').onclick=()=>menu?resume():showMenu();
$('#map-select').onchange=()=>{mapKey=$('#map-select').value;const first=maps[mapKey]?.layers[0];$('#map-thumb').src=first?.resource===310?'assets/disco.jpg':`assets/original/${first?.resource??103}.png`;$('#map-thumb').alt=maps[mapKey]?.name??'';};
if(location.search.includes('debug')){globalThis.bulanciDisplay=display;globalThis.bulanciDialogs=dialogs;}
const pixelsLabel=()=>{$('#pixels').textContent=display.pixels==='sharp'?'Obraz: ostré pixely':'Obraz: vyhlazený';$('#pixels').setAttribute('aria-pressed',String(display.pixels==='sharp'));};
$('#pixels').onclick=()=>{display.setPixels(display.pixels==='sharp'?'smooth':'sharp');pixelsLabel();};pixelsLabel();
// Game type, limits and weapon mode (CGameTypeDlg), kept like the original keeps its settings.
const RULES_KEY='bulanci.rules.v1';
const rulesState=(()=>{const base={type:'time',limits:{...RULE_DEFAULTS},weapons:'classic'};try{const v=JSON.parse(localStorage.getItem(RULES_KEY));if(v&&v.limits)return {...base,...v,limits:{...base.limits,...v.limits}};}catch{}return base;})();
function syncRules(){const training=$('#mode').value==='training';
 $('#rules-summary').textContent=training?RULE_SUMMARY.time(150):RULE_SUMMARY[rulesState.type](rulesState.limits[rulesState.type])+(rulesState.weapons==='shotgun'?' Pouze brokovnice.':'');
 $('#game-type-button').disabled=training;$('#rule-note').hidden=!training;}
$('#mode').addEventListener('change',syncRules);
$('#game-type-button').onclick=async()=>{const r=await dialogs.open(gameTypeDialog(rulesState));if(r){Object.assign(rulesState,r);try{localStorage.setItem(RULES_KEY,JSON.stringify(rulesState));}catch{}syncRules();}$('#game-type-button').focus({preventScroll:true});};
syncRules();
// Original start screens (CStartGame1 / CStartGame2) on the menu picture. The hidden web form
// keeps the chosen level and mode so that "Nová hra" and automated checks use the same path.
const PLAYERS_KEY='bulanci.players.v1';
const savedHumans=total=>{try{const v=JSON.parse(localStorage.getItem(PLAYERS_KEY))?.[total];if(Array.isArray(v)&&v.length===Math.min(3,total))return v;}catch{}return defaultHumans(total);};
const saveHumans=(total,list)=>{try{const all=JSON.parse(localStorage.getItem(PLAYERS_KEY))||{};all[total]=list;localStorage.setItem(PLAYERS_KEY,JSON.stringify(all));}catch{}};
let menuView='start',startTotal=(()=>{try{return Number(localStorage.getItem('bulanci.total'))||2;}catch{return 2;}})();
async function showScreen1(){closeNet();await dialogs.show(startGame1({total:startTotal,onNext:({total,local,join})=>{
  if(join)return joinGame(local);
  startTotal=total;try{localStorage.setItem('bulanci.total',String(total));}catch{}
  if(local<total)return hostGame_(total,local);showScreen2();}}));}

// ---- network game (net.js, net-server.mjs) ----------------------------------------------------
// netPlay: {role, net, lobby, humans (players on this computer), owners (host: peer per slot),
// host / guest (running game)}. Pause is not available in a network game.
let netPlay=null;
function closeNet(){if(!netPlay)return;const n=netPlay;netPlay=null;n.lobby?.close();n.host?.close();n.guest?.close();n.net.close();}
// Phone: the pause button of a network game offers leaving; the game goes on meanwhile.
function dropGame(){game=null;touch.setActive(false);$('#menu').hidden=false;$('#resume').hidden=true;$('#result').hidden=true;menu=true;paused=true;}
async function phoneLeave(){if(game?.over)return;const r=await phoneMenu?.pause({network:true});if(r!=='end'||!netPlay)return;closeNet();dropGame();showStartScreen();}
// The connection or the other side is gone: a running round cannot go on, back to the start.
async function netFailed(text){if(!netPlay)return;closeNet();if(game&&!game.over)dropGame();if(phoneMenu){await phoneMenu.notice(text.replaceAll('\u0001',''));phoneMenu.home();}else await dialogs.open(msgDialog(text));showScreen1();}
function lobbyView(list,chat,total){const mine=netPlay?.net.peer;netPlay?.win?.updateLobby(list.filter(p=>p.peer!==mine),chat,list.length===total);}
async function hostGame_(total,local){
  const net=connectNet();try{await net.ready;}catch(e){return netFailed(e.message);}
  const humans=savedHumans(local).map(h=>({...h}));
  netPlay={role:'host',net,humans};
  net.on('disconnect',()=>{if(netPlay?.net===net)netFailed('Spojení se serverem bylo přerušeno.');});
  const made=Promise.race([net.once('hosted'),net.once('error'),net.once('disconnect')]);net.send({t:'host',name:humans[0].name,total});
  const answer=await made;if(answer.t==='error')return netFailed('\u0001'+answer.text);if(answer.t!=='hosted')return;
  netPlay.lobby=hostLobby(net,{total,locals:humans,onChange:(list,chat)=>lobbyView(list,chat,total)});
  netPlay.win=await startGame2({total,humans,rules:()=>rulesState,levelKey:$('#map-select').value,network:{role:'host',onSay:t=>netPlay?.lobby.say(t)},
    onBack:()=>showScreen1(),
    onRules:async()=>{const r=await dialogs.open(gameTypeDialog(rulesState));if(r){Object.assign(rulesState,r);try{localStorage.setItem(RULES_KEY,JSON.stringify(rulesState));}catch{}syncRules();}},
    onSettings:()=>openSetup(),onKeys:keys=>dialogs.open(keysDialog(keys)),onMessage:text=>dialogs.open(msgDialog(text)),
    onPlayersChange:list=>{list.forEach((p,i)=>Object.assign(humans[i],p));saveHumans(local,list);netPlay?.lobby.publish();},
    onLevelChange:key=>{$('#map-select').value=key;$('#map-select').dispatchEvent(new Event('change'));},
    onStart:({players,levelKey})=>{
      const all=netPlay.lobby.players();if(all.length!==total)return;
      const used=new Set();for(const p of all){if(used.has(p.name))return dialogs.open(msgDialog(nameUsedText(p.name)));used.add(p.name);}
      players.forEach((p,i)=>Object.assign(humans[i],p));saveHumans(local,players);
      net.send({t:'start'});netPlay.owners=all.map(p=>p.peer);
      $('#map-select').value=levelKey;$('#map-select').dispatchEvent(new Event('change'));$('#mode').value='local';
      customHumans=all.map((p,i)=>p.peer===0?{...humans[i]}:{name:p.name,colorIndex:p.colorIndex,keys:null});
      start().finally(()=>{customHumans=null;});
    }});
  netPlay.begin=g=>{netPlay.host=hostGame(net,{game:g,owners:netPlay.owners,onEmpty:()=>{message('Někdo z hráčů opustil hru.');g.finish();}});
    net.post({kind:'start',level:mapKey,map:g.map,rules:g.rules,players:g.players.map((p,i)=>({id:p.id,name:p.name,colorIndex:p.colorIndex,peer:netPlay.owners[i]}))});};
  netPlay.lobby.publish();
  await dialogs.show(netPlay.win);
}
async function joinGame(local){
  const target=await dialogs.open(tcpipDialog(''));if(!target)return showScreen1();
  const address=target.address,secure=location.protocol==='https:',url=address?`${secure?'wss':'ws'}://${address.includes(':')||secure?address:address+':4173'}/net`:netURL();
  const net=connectNet(url);try{await net.ready;}catch(e){return netFailed(e.message);}
  netPlay={role:'guest',net,humans:savedHumans(local).map(h=>({...h}))};
  net.on('closed',()=>{if(netPlay?.net===net)netFailed('Někdo z hráčů opustil hru.');});
  net.on('disconnect',()=>{if(netPlay?.net===net)netFailed('Spojení se serverem bylo přerušeno.');});
  const session=await dialogs.open(sessionList({search:()=>net.list()}));if(!session)return showScreen1();
  const result=Promise.race([net.once('joined'),net.once('error'),net.once('disconnect')]);net.send({t:'join',id:session.id});
  const r=await result;if(r.t==='error')return netFailed('\u0001'+r.text);if(r.t!=='joined')return;
  const humans=netPlay.humans;let first=null;const ready=new Promise(ok=>{first=ok;});
  netPlay.lobby=guestLobby(net,{humans:()=>humans,onChange:(list,chat,total)=>{netPlay.total=total;first?.();lobbyView(list,chat,total);},
    onStart:m=>guestStart(m),onReject:text=>netFailed('\u0001Připojení ke hře bylo odmítnuto,\n\u0001protože je na tomto počítači příliš mnoho hráčů.')});
  await ready;if(netPlay?.net!==net)return;
  netPlay.win=await startGame2({total:netPlay.total,humans,rules:()=>rulesState,levelKey:$('#map-select').value,network:{role:'guest',onSay:t=>netPlay?.lobby.say(t)},
    onBack:()=>showScreen1(),onRules:async()=>{},onSettings:()=>openSetup(),onKeys:keys=>dialogs.open(keysDialog(keys)),onMessage:text=>dialogs.open(msgDialog(text)),
    onPlayersChange:list=>{list.forEach((p,i)=>Object.assign(humans[i],p));saveHumans(local,list);netPlay?.lobby.hello();},onStart:()=>{}});
  netPlay.lobby.hello();
  await dialogs.show(netPlay.win);
}
// Guest: load the host's level, then draw the snapshots; keys go to the host.
async function guestStart(m){
  if(!netPlay)return;dialogs.hide();mapKey=m.level;
  await loadLevel(m.map,m.players);if(!netPlay)return;
  netPlay.guest=guestGame(netPlay.net,{start:m,onSnapshot:(g,events)=>remoteEvents(g,events),onEnd:g=>{closeNet();showScore(g);},onLost:()=>netFailed('Hra se přerušila: hostitel neodpovídá.')});
  game=netPlay.guest.game;attachRemoteGame(game,m.level);
  paused=false;menu=false;clear();$('#menu').hidden=true;$('#result').hidden=true;$('#resume').hidden=false;canvas.focus();touch.setActive(true);
}
function guestInput(){const t=touch.read();return netPlay.humans.map((h,k)=>{const keyset=KEYSETS[h.keys??0];const i={direction:direction(keyset.slice(0,4)),fire:keys.includes(keyset[4])};if(k===0){i.direction=t.direction??i.direction;i.fire=i.fire||t.fire;}return i;});}
document.addEventListener('bulanci:quit',()=>closeNet());
async function showScreen2() {
  const total=startTotal;
  await dialogs.show(await startGame2({total,humans:savedHumans(total),rules:()=>rulesState,levelKey:$('#map-select').value,
    onBack:()=>showScreen1(),
    onRules:async()=>{const r=await dialogs.open(gameTypeDialog(rulesState));if(r){Object.assign(rulesState,r);try{localStorage.setItem(RULES_KEY,JSON.stringify(rulesState));}catch{}syncRules();}},
    onSettings:()=>openSetup(),
    onKeys:keys=>dialogs.open(keysDialog(keys)),
    onMessage:text=>dialogs.open(msgDialog(text)),
    onPlayersChange:list=>saveHumans(total,list),onLevelChange:key=>{$('#map-select').value=key;$('#map-select').dispatchEvent(new Event('change'));},
    onStart:({players,levelKey})=>{saveHumans(total,players);$('#map-select').value=levelKey;$('#map-select').dispatchEvent(new Event('change'));
      $('#mode').value=total===1?'training':total===3?'local3':'local';$('#mode').dispatchEvent(new Event('change'));customHumans=players;start().finally(()=>{customHumans=null;});}}));
}
// Original Nastavení (CSetupDlg): music / effects balance, heard while it moves.
async function openSetup() {
  const audio=globalThis.bulanciAudio;let preview=null;
  const r=await dialogs.open(setupDialog({balance:audio?.settings.balance??0,onChange:v=>audio?.configure({balance:v}),
    onPreview:()=>{preview={};audio?.playSample(4,30,{loop:true,handle:preview});},
    onPreviewEnd:()=>{if(preview){preview.released=true;preview.stop?.();preview=null;}}}));
  if(r)audio?.configure({balance:r.balance});
}
function showStartScreen(){if($('#menu').hidden)dialogs.hide();else if(menuView==='start')showScreen1();else if(menuView==='exit')showExit();else if(menuView==='history')showHistory();else dialogs.hide();}
// Original Konec (CExitDlg); Konec hry ends any round and goes back to the start view.
// CHistoryDlg: while a film runs the menu music stops and restarts after it (0xf0/0xf1 -> 0x424010).
let historyWin=null;
async function showHistory(){const win=await historyDialog({onFilm:playing=>globalThis.bulanciAudio?.setScene(playing?'film':'menu')});historyWin?.close();historyWin=win;await dialogs.show(win);}
document.addEventListener('bulanci:menu-view',e=>{if(e.detail!=='history'){historyWin?.close();historyWin=null;}});
async function showExit(){await dialogs.show(exitScreen({manifest:await loadSpriteManifest(),onQuit:()=>{document.dispatchEvent(new Event('bulanci:quit'));$('#start').click();}}));}
// CLoadingLevel while the level's pictures arrive (all were requested when the page loaded).
async function loadLevel(map,players=[]){
  await dialogs.ready;
  // The round's colour sheets load with the level: a sprite must not be missing when first used.
  const colors=[...new Set([...players.map(p=>p.colorIndex),...(map.npcs?[1,2,3]:[])])],sheetPath=(n,c)=>`assets/original/sprites/${n}-${c}-sheet.png`;
  const sheets=[...colors.flatMap(c=>manifest.original_color_variant_resources.map(n=>sheetPath(n,'c'+c))),...(map.source_resource===324?manifest.undead_variant.resources.map(n=>sheetPath(n,'undead')):[])];
  const ims=[...new Set([...map.layers.map(layerSrc),...sheets,...(map.animations??[]).filter(o=>manifest.resources[o.resource]).map(o=>`assets/original/sprites/${o.resource}-sheet.png`)])].map(image),win=loadingDialog();
  const update=()=>win.progress(ims.filter(im=>im.complete).length,ims.length);update();
  const shown=dialogs.open(win),frame=()=>new Promise(r=>requestAnimationFrame(r));await frame();
  await Promise.all(ims.map(im=>im.complete?null:new Promise(r=>{im.addEventListener('load',r,{once:true});im.addEventListener('error',r,{once:true});}).then(update)));
  update();if(phoneMenu)await pinSheets(sheets);await frame();win.onOk();await shown;
}
async function pinSheets(list){const keep=new Set(list);for(const [src,b] of bitmaps)if(!keep.has(src)){b.close();bitmaps.delete(src);}await Promise.all(list.filter(s=>!bitmaps.has(s)).map(async s=>{try{bitmaps.set(s,await createImageBitmap(image(s)));}catch{}}));}
document.addEventListener('bulanci:menu-view',e=>{menuView=e.detail;showStartScreen();});
// The web volume popup lies under the layer, so the start screen steps aside while it is open.
new MutationObserver(()=>{const popup=$('.menu-sound-popup');dialogs.suspend(!!popup&&!popup.hidden);}).observe($('#menu'),{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
$('#sound').onclick=()=>{muted=!muted;$('#sound').textContent=muted?'Zvuk vypnutý':'Zvuk zapnutý';};$('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('#game-frame').requestFullscreen();}catch{message('Celá obrazovka není dostupná.');}};
$('#history').onclick=()=>$('#about').showModal();$('#close-about').onclick=()=>$('#about').close();
window.addEventListener('keydown',e=>{if($('#about').open)return;if(/^(SELECT|INPUT|BUTTON)$/.test(document.activeElement.tagName)&&menu)return;if(e.code==='Escape'){e.preventDefault();if(menu)resume();else pauseGame();return;}if(menu||game?.over)return;if(!activeKeyCodes().has(e.code))return;e.preventDefault();if(!keys.includes(e.code))keys.push(e.code);if(!e.repeat)localHumans().forEach((p,k)=>{if(KEYSETS[p.keys??0][5]!==e.code)return;if(netPlay?.role==='guest')netPlay.guest.weapon(k);else game.switchWeapon(p.id);});});window.addEventListener('keyup',e=>{const i=keys.indexOf(e.code);if(i>=0)keys.splice(i,1);});window.addEventListener('blur',()=>{clear();pauseGame();});document.addEventListener('visibilitychange',()=>{if(document.hidden){clear();pauseGame();}});
$('#start-text').disabled=true;$('#start-text').textContent='NAČÍTÁM DATA…';const ready=load();requestAnimationFrame(frame);
ready.then(()=>showStartScreen());
