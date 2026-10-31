import test from 'node:test';
import assert from 'node:assert/strict';
import {GameAudio, MENU_MUSIC, menuMusicGain, balanceGain} from '../dist/game-audio.js';

test('menu music volume maps to DirectSound like 0x43a060', () => {
  assert.ok(Math.abs(menuMusicGain(70) - 10**(-3000/2000)) < 1e-12); // -30 dB
  assert.equal(menuMusicGain(100), 1);
  for (const balance of [0, 10, 50]) assert.ok(Math.abs(menuMusicGain(100, balance) - balanceGain(balance).music) < 1e-12);
  assert.ok(Math.abs(menuMusicGain(70, 50) - 10**(((10000-2500)*.7-10000)/2000)) < 1e-12);
});

test('menu music fades 70 -> 100 in audible 120 ms ticks and restarts at 70 after a game', () => {
  const track = {paused:false, volume:1, play(){}, pause(){}};
  const audio = new GameAudio({catalogURL:'data:application/json,{}', storage:null, mediaFactory:() => track});
  audio.settings.music = 1;
  audio.musicID = 329; audio.tracks.set(329, track);
  assert.equal(audio.menuVolume, MENU_MUSIC.start);
  for (let i = 0; i < 29; i++) audio.tickMenuFade();
  assert.equal(audio.menuVolume, 99);
  audio.tickMenuFade(); audio.tickMenuFade();
  assert.equal(audio.menuVolume, 100);
  assert.equal(audio.menuFadeTimer, null);
  track.paused = true;
  audio.scene = 'level'; audio.setScene('menu');
  audio.setScene('level');
  assert.equal(audio.menuVolume, MENU_MUSIC.start);
  audio.scene = 'menu'; audio.tickMenuFade();
  assert.equal(audio.menuVolume, MENU_MUSIC.start, 'paused (autoplay-locked) track does not advance the fade');
  clearInterval(audio.menuFadeTimer);
});
