import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../dist/engine.js';
const make=mode=>new Game({mapData:{name:'x',layers:[],obstacles:[]},mode,random:()=>.5});

test('an empty pistol takes 16 ticks to reload (0x420b4b)',()=>{
  assert.ok(Math.abs(make('training').reloadTime()-2.4)<1e-9);
  assert.ok(Math.abs(make('local').reloadTime()-8)<1e-9);
});
