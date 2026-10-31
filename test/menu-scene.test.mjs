import test from 'node:test';
import assert from 'node:assert/strict';
import {poemRowAlpha,POEM,SCRATCH} from '../dist/ui/menu-scene.js';
import {isMenuNight} from '../dist/game-audio.js';

test('menu is in its night look from 22:00 to 5:59 (0x425400)', () => {
  const night=[...Array(24).keys()].filter(h=>isMenuNight('auto',h));
  assert.deepEqual(night,[0,1,2,3,4,5,22,23]);
  assert.equal(isMenuNight('night',12),true);
  assert.equal(isMenuNight('day',23),false);
});

test('poem window fades over 40 rows at both edges (0x425df0 masks)', () => {
  assert.deepEqual([POEM.x,POEM.y,POEM.x+POEM.w,POEM.y+POEM.h],[10,384,215,550]);
  assert.equal(poemRowAlpha(0),6/256);
  assert.equal(poemRowAlpha(39),240/256);
  assert.equal(poemRowAlpha(40),1);
  assert.equal(poemRowAlpha(POEM.h-41),1);
  assert.equal(poemRowAlpha(POEM.h-40),250/256);
  assert.equal(poemRowAlpha(POEM.h-1),16/256);
});

test('scratches start once the menu music has faded in (30 ticks of 120 ms)', () => {
  assert.equal(SCRATCH.startAfter,3600);
  assert.equal(SCRATCH.shown,100);
});
