const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));
const SETTINGS_KEY = 'bulanci.audio.v1';
// CMenu 0x425400: night when (hour - 6) > 15 unsigned, i.e. 22:00-5:59 local time (GetLocalTime);
// night plays music 330 and shows bitmap 313, day plays 329.
export const isMenuNight = (theme = 'auto', hour = new Date().getHours()) => theme === 'night' || (theme === 'auto' && (hour < 6 || hour > 21));
const DEFAULTS = { enabled: true, balance: 0, music: .48, effects: .85, voices: .9, menuTheme: 'auto' };
// Original music / effects balance (CSetupDlg, 0x4223e0): -50..50; above 0 music is attenuated
// by 50 hundredths of a dB per step, below 0 the effects group (DirectSound volume, 1/100 dB).
const balanceValue = value => Math.round(clamp(value, -50, 50));
export const balanceGain = value => ({music: value > 0 ? 10**(-value*50/2000) : 1, effects: value < 0 ? 10**(value*50/2000) : 1});
// CMenu music (0x4252a0, menu timer 0x424080): starts at volume 70, every 120 ms tick adds 1 up to 100.
// Message 0xf0 (game starts) fades back to 70 and pauses, 0xf1 (back in menu) fades up again.
// 0x43a060 hands DirectSound (base + 10000) * volume / 100 - 10000 hundredths of a dB, base being the
// balance attenuation, so 70 is -30 dB and the fade is linear in dB.
export const MENU_MUSIC = {start:70, full:100, tickMs:120};
export const menuMusicGain = (volume, balance = 0) => {
  const base = balance > 0 ? -balance*50 : 0;
  return 10**(((base+10000)*volume/100-10000)/2000);
};
const LEVEL_IDS = { disco:319, bedtime:320, factory:321, malaria:322, eightbit:323, '8bit':323, exitus:324 };

/** Original game audio. No dependency on rendering or gameplay implementation. */
export class GameAudio extends EventTarget {
  constructor({catalogURL = new URL('./assets/original/audio/catalog.json', import.meta.url), storage, contextFactory, mediaFactory} = {}) {
    super();
    try { this.storage = storage ?? globalThis.localStorage; } catch {}
    try { this.settings = {...DEFAULTS, ...JSON.parse(this.storage?.getItem(SETTINGS_KEY) || '{}')}; } catch { this.settings = {...DEFAULTS}; }
    this.settings.enabled = !!this.settings.enabled;
    for (const key of ['music','effects','voices']) this.settings[key] = clamp(this.settings[key]);
    this.settings.balance = balanceValue(this.settings.balance);
    this.contextFactory = contextFactory ?? (() => new (globalThis.AudioContext || globalThis.webkitAudioContext)());
    this.mediaFactory = mediaFactory ?? (() => new Audio());
    this.context = null;
    this.catalog = null;
    this.buffers = new Map();
    this.tracks = new Map();
    this.active = new Set();
    this.voiceKeys = new Map();
    this.scene = 'menu';
    this.levelID = null;
    this.levelKey = null;
    this.hidden = false;
    this.unlocked = false;
    this.generation = 0;
    this.musicID = null;
    this.menuVolume = MENU_MUSIC.start;
    this.menuFadeTimer = null;
    this.voiceCount = 0;
    this.lastEvent = new Map();
    this.stats = {effectsStarted:0, musicStarted:0, failures:[]};
    this.ready = fetch(catalogURL).then(response => {
      if (!response.ok) throw new Error(`Audio catalog HTTP ${response.status}`);
      return response.json();
    }).then(catalog => {
      this.catalog = catalog;
      this.applyScene();
      return catalog;
    }).catch(error => { this.report(error); return null; });
  }

  report(error) {
    const message = String(error?.message || error);
    if (!this.stats.failures.includes(message)) this.stats.failures.push(message);
    this.dispatchEvent(new CustomEvent('audioerror', {detail:{message}}));
  }

  async unlock() {
    this.unlocked = true;
    // play() must be attempted in the gesture turn, before waiting for fetch/decode or resume.
    this.playCurrentMusic();
    if (this.settings.enabled && !this.hidden) {
      try {
        this.ensureContext();
        await this.context.resume();
      } catch (error) { this.report(error); }
    }
    this.ready.then(() => {
      this.applyScene();
      if (this.settings.enabled && this.context) this.preloadEffects();
    });
  }

  ensureContext() {
    if (this.context) return;
    this.context = this.contextFactory();
    this.buses = {};
    for (const name of ['effects','voices','music']) {
      const gain = this.context.createGain();
      gain.connect(this.context.destination);
      this.buses[name] = gain;
    }
    this.applyVolumes();
  }

  configure(patch) {
    for (const key of ['music','effects','voices']) if (key in patch) this.settings[key] = clamp(patch[key]);
    if ('enabled' in patch) this.settings.enabled = !!patch.enabled;
    if ('balance' in patch) this.settings.balance = balanceValue(patch.balance);
    if (['auto','day','night'].includes(patch.menuTheme)) this.settings.menuTheme = patch.menuTheme;
    try { this.storage?.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch {}
    if (!this.settings.enabled) {
      this.stopEffects();
      for (const track of this.tracks.values()) track.pause();
    }
    this.applyVolumes();
    this.applyScene();
    this.dispatchEvent(new Event('settingschange'));
  }

  applyVolumes() {
    const audible = this.settings.enabled && !this.hidden;
    if (this.buses) for (const name of ['effects','voices','music']) {
      const balance = balanceGain(this.settings.balance)[name==='music'?'music':'effects'];
      this.buses[name].gain.setTargetAtTime(audible ? this.settings[name] * balance : 0, this.context.currentTime, .025);
    }
    const music = this.scene === 'menu' ? menuMusicGain(this.menuVolume, this.settings.balance) : balanceGain(this.settings.balance).music;
    const volume = audible ? this.settings.music * music * (this.voiceCount ? .72 : 1) : 0;
    for (const track of this.tracks.values()) track.volume = volume;
  }

  preloadEffects() {
    if (!this.catalog || !this.context) return;
    // Load the original shared bank; maps' additional banks stay lazy.
    for (const sample of Object.values(this.catalog.samples)) if (sample.bank === 4) {
      this.buffer(sample.bank, sample.sample).catch(error => this.report(error));
    }
  }

  buffer(bank, sample) {
    const key = `${bank}-${sample}.wav`;
    if (!this.catalog?.samples[key]) return Promise.reject(new Error(`Unknown original sample ${key}`));
    if (!this.buffers.has(key)) {
      const request = fetch(new URL(`./assets/original/audio/${key}`, import.meta.url)).then(async response => {
        if (!response.ok) throw new Error(`Sample ${key}: HTTP ${response.status}`);
        return this.context.decodeAudioData(await response.arrayBuffer());
      }).catch(error => { this.buffers.delete(key); throw error; });
      this.buffers.set(key, request);
    }
    return this.buffers.get(key);
  }

  stopEffects() {
    for (const entry of [...this.active]) entry.stop();
  }

  async playSample(bank, sample, {x=400, volume=1, category='effects', voiceKey, whilePaused=false, loop=false, handle} = {}) {
    if (!this.settings.enabled || !this.unlocked || this.hidden || (!whilePaused && this.scene === 'pause')) return false;
    const generation = this.generation, requested = performance.now();
    try {
      this.ensureContext();
      if (this.context.state !== 'running') return false;
      const decoded = await this.buffer(bank, sample);
      if (generation !== this.generation || !this.settings.enabled || this.hidden || performance.now()-requested > 700 || (!whilePaused && this.scene === 'pause')) return false;
      if (voiceKey) this.voiceKeys.get(voiceKey)?.stop();
      // Bound polyphony under held automatic fire and simultaneous players.
      if (this.active.size >= 32) [...this.active].find(entry => entry.category === 'effects')?.stop();
      const source = this.context.createBufferSource();
      source.buffer = decoded;
      source.loop = loop;
      const level = this.context.createGain();
      level.gain.value = clamp(volume);
      source.connect(level);
      const merger = this.context.createChannelMerger(2);
      const left = this.context.createGain(), right = this.context.createGain();
      // Original 0x422500 pans by +/-1500 hundredths of a decibel over 800px.
      const pan = Math.trunc(clamp(x,0,800)*3000/800)-1500;
      left.gain.value = pan > 0 ? 10**(-pan/2000) : 1;
      right.gain.value = pan < 0 ? 10**(pan/2000) : 1;
      level.connect(left); level.connect(right);
      left.connect(merger,0,0); right.connect(merger,0,1);
      merger.connect(this.buses[category] || this.buses.effects);
      return await new Promise(resolve => {
        let cancelled = false;
        const entry = {category, source, stop:() => { cancelled = true; try { source.stop(); } catch {} }};
        this.active.add(entry);
        if (handle) { handle.stop = entry.stop; if (handle.released) queueMicrotask(entry.stop); }
        if (voiceKey) this.voiceKeys.set(voiceKey, entry);
        if (category === 'voices') { this.voiceCount++; this.applyVolumes(); }
        source.onended = () => {
          this.active.delete(entry);
          if (voiceKey && this.voiceKeys.get(voiceKey) === entry) this.voiceKeys.delete(voiceKey);
          if (category === 'voices') { this.voiceCount=Math.max(0,this.voiceCount-1); this.applyVolumes(); }
          for (const node of [source,level,left,right,merger]) node.disconnect();
          resolve(!cancelled);
        };
        source.start();
        this.stats.effectsStarted++;
        this.dispatchEvent(new CustomEvent('effect',{detail:{bank,sample,category}}));
      });
    } catch (error) { this.report(error); return false; }
  }

  async effect(name, options={}) {
    await this.ready;
    const effect = this.catalog?.effects[name];
    if (!effect) return false;
    return this.playSample(effect.bank,effect.sample,options);
  }

  voice(kind, player, options={}) {
    const profile = Math.max(0,Math.min(3,Number(player?.voiceSet ?? player?.voiceProfile ?? player?.id ?? 0) | 0));
    const sample = this.catalog?.voices[kind]?.[profile];
    if (sample === undefined) return Promise.resolve(false);
    return this.playSample(4,sample,{category:'voices',x:player?.x ?? 400,voiceKey:`player-${player?.id ?? 0}`,...options});
  }

  beginLevel(map, key) {
    this.generation++;
    this.stopEffects();
    this.lastEvent.clear();
    this.levelID = Number(map?.source_resource ?? LEVEL_IDS[key]);
    this.levelKey = key;
    this.scene = 'level';
    const id = this.catalog?.levels[this.levelID]?.music;
    if (id && this.tracks.has(id)) this.tracks.get(id).currentTime=0;
    this.applyScene();
  }

  setScene(scene) {
    if (this.scene === scene) return;
    // The web pauses the menu track at once instead of the original 3.6 s fade down to 70 under the
    // loading screen; returning to the menu resumes it from 70 as 0xf1 does.
    if (this.scene === 'menu') this.menuVolume = MENU_MUSIC.start;
    this.scene = scene;
    if (scene !== 'level') this.stopEffects();
    if (scene === 'pause') {
      const track = this.tracks.get(this.catalog?.scenes.pause);
      if (track) track.currentTime=0;
    }
    this.applyScene();
  }

  setHidden(hidden) {
    this.hidden=!!hidden;
    if (hidden) this.stopEffects();
    this.applyVolumes();
    this.playCurrentMusic();
  }

  applyScene() {
    if (!this.catalog) return;
    const night = isMenuNight(this.settings.menuTheme);
    // The statistics screen has no music track; it plays sample 4/29 in the music group (0x411add).
    // A Historie film stops the menu music for its length (0x424010).
    const id = this.scene === 'score' || this.scene === 'film' ? null : this.scene === 'level' ? this.catalog.levels[this.levelID]?.music : this.scene === 'pause' ? this.catalog.scenes.pause : night ? this.catalog.scenes.menuNight : this.catalog.scenes.menuDay;
    if (id !== this.musicID) {
      for (const track of this.tracks.values()) track.pause();
      this.musicID=id;
    }
    if (id && !this.tracks.has(id)) {
      const track=this.mediaFactory();
      track.preload='auto'; track.loop=true;
      track.src=new URL(`./${this.catalog.music[id].url}`,import.meta.url).href;
      track.addEventListener('error',()=>this.report(new Error(`Cannot decode music resource ${id}`)));
      this.tracks.set(id,track);
    }
    this.applyVolumes();
    this.playCurrentMusic();
    this.updateMenuFade();
  }

  updateMenuFade() {
    const run = this.scene === 'menu' && this.menuVolume < MENU_MUSIC.full;
    if (run && !this.menuFadeTimer) this.menuFadeTimer = setInterval(() => this.tickMenuFade(), MENU_MUSIC.tickMs);
    else if (!run && this.menuFadeTimer) { clearInterval(this.menuFadeTimer); this.menuFadeTimer = null; }
  }

  tickMenuFade() {
    const track = this.tracks.get(this.musicID);
    // Count only audible ticks: until the first gesture the browser keeps the track paused.
    if (track && !track.paused && this.settings.enabled && !this.hidden) {
      this.menuVolume = Math.min(MENU_MUSIC.full, this.menuVolume+1);
      this.applyVolumes();
    }
    this.updateMenuFade();
  }

  playCurrentMusic() {
    const track=this.tracks.get(this.musicID);
    if (!track) return;
    if (!this.unlocked || !this.settings.enabled || this.hidden) { track.pause(); return; }
    if (!track.paused) return;
    Promise.resolve(track.play()).then(()=>{this.stats.musicStarted++;}).catch(error=>{
      // Browsers require a new gesture after interrupted autoplay; the next
      // pointer/key gesture retries. Surface actual codec/network failures.
      if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') this.report(error);
    });
  }

  handleEvent(event, game) {
    const player=event.type==='kill'?event.victim:event.player || event.victim, x=player?.x ?? event.x ?? 400;
    const canonical=event.type==='respawn'?'spawn':event.type==='reload-complete'?'reload':event.type;
    const key=`${canonical}:${player?.id ?? ''}`;
    const now=game?.elapsed ?? performance.now()/1000;
    if (event.type !== 'shot' && event.type !== 'sound' && now-(this.lastEvent.get(key) ?? -Infinity)<.075) return;
    this.lastEvent.set(key,now);
    switch(event.type) {
      case 'shot': {
        if(event.sound){this.ready.then(()=>this.playSample(event.sound.bank,event.sound.sample,{x}));break;}
        const name={0:'pistol',1:'shotgun',4:'smg',5:'rocket'}[event.weapon ?? event.player?.lastShotWeapon ?? event.player?.weapon ?? 0];
        if(name)this.effect(name,{x});break;
      }
      case 'kill': {
        // 0x41f900: a sound, then the victim's line, then message 0xdb gives the shooter a taunt
        // (0x420e2b, 0x420ee8). Flag 0x80 (undead, close blast) goes straight to the taunt.
        const victim=event.victim,killer=event.player,generation=this.generation;
        const taunt=()=>{if(killer&&killer!==victim&&generation===this.generation&&!game?.over&&killer.dead<=0&&killer.active!==false)this.voice('taunt',killer);};
        if(victim?.undead||event.blast){taunt();break;}
        this.voiceKeys.get(`player-${victim?.id}`)?.stop();
        this.effect(event.shotgun?'shotgunDeath':'death',{x:victim?.x ?? x}).then(played=>{
          if(!played||generation!==this.generation||game?.over||(victim&&victim.dead<=0))return;
          if(victim?.npc){taunt();return;}
          this.voice('afterDeath',victim).then(taunt);
        }); break;
      }
      case 'spawn': case 'respawn': this.voice('spawn',player); break;
      case 'pickup': this.effect('pickup',{x}); break;
      case 'reload': case 'reload-complete': this.effect('reload',{x}); break;
      case 'taunt': this.voice('taunt',player); break;
      case 'voice': this.voice(event.kind || 'taunt',player); break;
      case 'teleport': this.effect('teleport',{x}); break;
      case 'explosion': this.effect('explosion',{x}); break;
      case 'sound': this.ready.then(()=>this.playSample(event.bank ?? this.catalog?.levels[this.levelID]?.ambientBank ?? 4,event.sample,{x,volume:event.volume ?? 1})); break;
      case 'end': this.setScene('score'); this.effect('roundEnd',{x:400,whilePaused:true}); break;
    }
  }

  diagnostics() {
    return {scene:this.scene,enabled:this.settings.enabled,unlocked:this.unlocked,levelID:this.levelID,
      musicID:this.musicID,musicPlaying:!!this.tracks.get(this.musicID)&&!this.tracks.get(this.musicID).paused,
      activeEffects:this.active.size,decodedSamples:this.buffers.size,...this.stats};
  }
}
