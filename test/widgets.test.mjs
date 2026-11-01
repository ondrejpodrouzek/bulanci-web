import test from 'node:test';
import assert from 'node:assert/strict';
import {Button,ListBox,Radio,setUiSound} from '../dist/ui/widgets.js';

test('interface widgets play their samples',()=>{
  const played=[];setUiSound(s=>played.push(s));
  const b=new Button({x:0,y:0,text:'x',onClick(){}});b.pointerDown();
  b.disabled=true;b.pointerDown();
  const r=new Radio({x:0,y:0,items:['a','b'],disabledItems:[1]});r.pointerDown(1,1);r.pointerDown(1,20);
  assert.deepEqual(played,[0,14]);setUiSound(()=>{});
});
test('a list that does not fit scrolls and keeps the selection in view',()=>{
  const l=new ListBox({x:0,y:0,w:200,h:130,items:Array.from({length:20},(_,i)=>String(i))});
  assert.equal(l.rows,8);assert.equal(l.scrolls,true);
  l.pointerDown(195,125);assert.equal(l.top,1);
  l.pointerDown(195,2);assert.equal(l.top,0);
  l.pick(15);assert.equal(l.top,8);
  l.pointerDown(50,6);assert.equal(l.selected,8);
  l.scrollTo(99);assert.equal(l.top,12);
});
test('a list that fits has no bar',()=>{
  const l=new ListBox({x:0,y:0,w:200,h:170,items:['a','b']});
  assert.equal(l.scrolls,false);l.pointerDown(195,20);assert.equal(l.selected,1);
});
