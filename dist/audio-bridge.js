// Audio integration kept separate so concurrent engine/rendering work stays safe.
import {Game} from './engine.js';
import {GameAudio} from './game-audio.js';

const marker=Symbol.for('bulanci.originalAudioBridge');
export const gameAudio=globalThis.bulanciAudio ?? new GameAudio();
globalThis.bulanciAudio=gameAudio;
let activeGame=null,pausedDialog=false,scoreOpen=false;
const menu=document.querySelector('#menu'), result=document.querySelector('#result');
const mapSelect=document.querySelector('#map-select');

function scene() {
  if (scoreOpen) return 'score';
  if (!activeGame || activeGame.over || (result && !result.hidden)) return 'menu';
  return (menu && !menu.hidden) || pausedDialog ? 'pause' : 'level';
}
function syncScene() { gameAudio.setScene(scene()); }

if (!Game.prototype[marker]) {
  Object.defineProperty(Game.prototype,marker,{value:true});
  const update=Game.prototype.update;
  Game.prototype.update=function(...args) {
    if (this!==activeGame) {
      activeGame=this;
      gameAudio.beginLevel(this.map,mapSelect?.value);
      Object.defineProperty(this,marker,{value:{states:new Map(),events:new Set()},configurable:true});
      gameAudio.ready.then(()=>{
        if (activeGame===this && !this.over && scene()==='level') gameAudio.voice('spawn',this.players?.[0]);
      });
    }
    const bridge=this[marker];
    bridge.events.clear();
    if (!this.onEvent?.[marker]) {
      const previous=this.onEvent;
      const wrapped=event=>{
        const canonical=event.type==='respawn'?'spawn':event.type;
        bridge.events.add(`${canonical}:${(event.player || event.victim)?.id ?? ''}`);
        gameAudio.handleEvent(event,this);
        return typeof previous==='function' ? previous.call(this,event) : undefined;
      };
      Object.defineProperty(wrapped,marker,{value:true});
      this.onEvent=wrapped;
    }
    const returned=update.apply(this,args);
    for (const player of this.players || []) {
      const before=bridge.states.get(player.id);
      if (before?.dead>0 && player.dead<=0 && !bridge.events.has(`spawn:${player.id}`)) gameAudio.handleEvent({type:'spawn',player},this);
      if (before?.reloading>0 && player.reloading<=0 && player.dead<=0 && !bridge.events.has(`reload:${player.id}`)) gameAudio.handleEvent({type:'reload',player},this);
      bridge.states.set(player.id,{dead:player.dead,reloading:player.reloading});
    }
    return returned;
  };
}

const observer=new MutationObserver(syncScene);
for (const element of [menu,result]) if (element) observer.observe(element,{attributes:true,attributeFilter:['hidden']});
document.addEventListener('bulanci:pause',e=>{pausedDialog=!!e.detail;syncScene();});
document.addEventListener('bulanci:score',e=>{scoreOpen=!!e.detail;syncScene();});
document.addEventListener('visibilitychange',()=>{gameAudio.setHidden(document.hidden);syncScene();});
document.addEventListener('bulanci:quit',()=>{
  if(activeGame)activeGame.over=true;
  activeGame=null;
  gameAudio.setScene('menu');
  if(result)result.hidden=true;
  if(menu)menu.hidden=false;
  const resume=document.querySelector('#resume');if(resume)resume.hidden=true;
  globalThis.bulanciFullscreen?.exit();
});
window.addEventListener('pagehide',()=>gameAudio.setHidden(true));
window.addEventListener('pageshow',()=>{gameAudio.setHidden(document.hidden);syncScene();});
function gesture() {
  if (!gameAudio.unlocked || gameAudio.context?.state==='suspended') gameAudio.unlock();
  else if (gameAudio.settings.enabled && gameAudio.tracks.get(gameAudio.musicID)?.paused) gameAudio.playCurrentMusic();
}
// iOS grants audio only in touchend/click, never in pointerdown or touchstart.
for (const name of ['pointerdown','touchend','click']) document.addEventListener(name,gesture,{capture:true});
document.addEventListener('keydown',gesture,{capture:true});

const button=document.querySelector('#sound');
function reflectSettings() {
  if (button) {
    button.textContent=gameAudio.settings.enabled?'Zvuk zapnutý':'Zvuk vypnutý';
    button.setAttribute('aria-pressed',String(gameAudio.settings.enabled));
    button.setAttribute('aria-label',gameAudio.settings.enabled?'Vypnout hudbu a zvuky':'Zapnout hudbu a zvuky');
  }
  for (const input of document.querySelectorAll('[data-audio-volume]')) {
    const volume=gameAudio.settings[input.dataset.audioVolume];
    input.value=String(Math.round(volume*100));
    input.nextElementSibling.textContent=`${Math.round(volume*100)} %`;
  }
}
if (button) button.addEventListener('click',event=>{
  // Suppress only the old provisional sound toggle. It otherwise enables a
  // duplicate 0-0.wav shot handler retained in app.js by the concurrent author.
  event.stopImmediatePropagation();
  gameAudio.configure({enabled:!gameAudio.settings.enabled});
  gameAudio.unlock();
},{capture:true});

const controls=document.createElement('details');
controls.className='original-audio-controls';
controls.innerHTML='<summary>Hlasitost</summary><div class="audio-volume-panel"><label>Hudba<input type="range" min="0" max="100" data-audio-volume="music" aria-label="Hlasitost hudby"><output></output></label><label>Zvuky<input type="range" min="0" max="100" data-audio-volume="effects" aria-label="Hlasitost zvuků"><output></output></label><label>Hlášky<input type="range" min="0" max="100" data-audio-volume="voices" aria-label="Hlasitost hlášek"><output></output></label></div>';
document.querySelector('.browser-bar > div')?.append(controls);
for (const input of controls.querySelectorAll('input')) input.addEventListener('input',()=>{
  gameAudio.configure({[input.dataset.audioVolume]:Number(input.value)/100});
  gameAudio.unlock();
});
gameAudio.addEventListener('settingschange',reflectSettings);
gameAudio.addEventListener('audioerror',event=>{
  if (button) button.title=`Audio: ${event.detail.message}`;
});
reflectSettings();


// Network guest: the mirror game never runs update(), so the host's events arrive with each
// snapshot; spawn and reload sounds are derived from the state like above.
const remoteStates=new Map();
export function attachRemoteGame(game,levelKey) {
  activeGame=game;remoteStates.clear();
  gameAudio.beginLevel(game.map,levelKey);syncScene();
}
export function remoteEvents(game,events) {
  if(game!==activeGame)return;
  const seen=new Set();
  for(const event of events){seen.add(`${event.type==='respawn'?'spawn':event.type}:${(event.player||event.victim)?.id??''}`);gameAudio.handleEvent(event,game);}
  for(const player of game.players||[]) {
    const before=remoteStates.get(player.id);
    if(before?.dead>0&&player.dead<=0&&!seen.has(`spawn:${player.id}`))gameAudio.handleEvent({type:'spawn',player},game);
    if(before?.reloading>0&&player.reloading<=0&&player.dead<=0&&!seen.has(`reload:${player.id}`))gameAudio.handleEvent({type:'reload',player},game);
    remoteStates.set(player.id,{dead:player.dead,reloading:player.reloading});
  }
}
