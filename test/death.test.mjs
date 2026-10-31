import test from 'node:test';
import assert from 'node:assert/strict';
import {deathChoice,deathSeconds} from '../dist/actor-frames.js';

test('a shot lays the character down, by shot direction and facing (0x4aefb8)',()=>{
  assert.deepEqual(deathChoice(3,3,false,false),{resource:295,direction:3});
  assert.deepEqual(deathChoice(3,2,false,false),{resource:296,direction:3});
  assert.deepEqual(deathChoice(0,0,false,false),{resource:297,direction:0});
  assert.deepEqual(deathChoice(1,1,false,false),{resource:300,direction:1});
  assert.deepEqual(deathChoice(2,3,false,false),{resource:301,direction:2});
});
test('a facing with no table entry falls to the nearest row',()=>{
  assert.deepEqual(deathChoice(3,0,false,false),{resource:299,direction:1});
  assert.deepEqual(deathChoice(2,1,false,false),{resource:300,direction:1});
  assert.deepEqual(deathChoice(0,3,false,false),{resource:301,direction:2});
  assert.deepEqual(deathChoice(1,2,false,false),{resource:302,direction:2});
});
test('a close blast tears apart, undead always',()=>{
  assert.equal(deathChoice(3,1,true,false).resource,208);
  assert.equal(deathChoice(3,3,false,true).resource,205);
});
test('the body lasts until the ring frame',()=>{
  assert.ok(Math.abs(deathSeconds(295)-2805*32/33/1000)<1e-9);
  assert.ok(Math.abs(deathSeconds(204)-2201*30/31/1000)<1e-9);
});
