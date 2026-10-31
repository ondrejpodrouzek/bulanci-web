import test from 'node:test';
import assert from 'node:assert/strict';
import {pipPositions,digitRows,rollDigit,WEAPON_ICON,WEAPON_PIP} from '../dist/hud.js';

test('rounds spread evenly over the strip (0x426f0f)',()=>{
  const x=pipPositions(84,6,5);
  assert.equal(x.length,5);
  assert.equal(x[0],5);
  assert.ok(x.every((v,i)=>!i||v-x[i-1]>=16));
  assert.ok(x[4]+6<=84);
});
test('digits are rows of the 130 px strip and the score wraps at 1000',()=>{
  assert.deepEqual(digitRows(127),[13,26,91]);
  assert.deepEqual(digitRows(-5),[0,0,65]);
  assert.deepEqual(digitRows(1002),[0,0,26]);
});
test('a digit rolls one row per tick and wraps round the strip',()=>{
  assert.equal(rollDigit(13,26,true),14);
  assert.equal(rollDigit(129,0,true),0);
  assert.equal(rollDigit(0,117,false),129);
  assert.equal(rollDigit(26,26,true),26);
});
test('weapon tables follow the six rows of 0x482820',()=>{
  assert.equal(WEAPON_ICON.length,6);
  assert.equal(WEAPON_PIP[3],0);
});
