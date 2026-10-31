import test from 'node:test';
import assert from 'node:assert/strict';
import {shortsort,addRecord} from '../dist/ui/score-screen.js';
import {finalScore} from '../dist/rules.js';

test('shortsort (0x448320) takes the first maximum to the end, like the CRT qsort', () => {
  const items=[{k:'a',v:1},{k:'b',v:3},{k:'c',v:1},{k:'d',v:3}];
  // ascending by v: ties keep the order shortsort gives, not a stable sort's
  assert.deepEqual(shortsort(items,(a,b)=>a.v-b.v).map(i=>i.k),['c','a','d','b']);
  assert.deepEqual(shortsort(items,(a,b)=>b.v-a.v).map(i=>i.k),['b','d','c','a']);
});

test('training records keep six by kills - deaths (0x409b10)', () => {
  const base=[['Žezlík',30],['Kapslík',25],['Čmelík',20],['Uhlík',15],['Terčík',10],['Cvalík',5]].map(([name,kills])=>({name,kills,deaths:10}));
  const good=addRecord(base,{name:'Bulík',kills:22,deaths:4});
  assert.equal(good.records.length,6);assert.ok(good.entry);assert.equal(good.records[1].name,'Bulík');
  assert.ok(!good.records.some(r=>r.name==='Cvalík'));
  const bad=addRecord(base,{name:'Bulík',kills:3,deaths:9});
  assert.equal(bad.entry,null);assert.deepEqual(bad.records.map(r=>r.name),base.map(r=>r.name));
});

test('final score on lives (0x4126e0): out players rank by elimination order - 4', () => {
  const rules={type:'lives',limit:5};
  assert.equal(finalScore(rules,{deaths:2}),3);
  assert.equal(finalScore(rules,{deaths:5,outOrder:2}),-2);
  assert.equal(finalScore({type:'time',limit:60},{kills:4,deaths:6}),-2);
});
