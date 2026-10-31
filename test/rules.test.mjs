import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../dist/engine.js';
import {resolveRules,ranking,RULE_DEFAULTS} from '../dist/rules.js';
const blank={name:'Test',layers:[],obstacles:[]};
const local=(gameType,limit)=>{const g=new Game({mapData:blank,mode:'local',gameType,limit,random:()=>.5});g.pickups=[];return g;};
const run=(g,s)=>{for(let i=0;i<Math.round(s*60);i++)g.update(1/60);};

test('defaults, ranges and the forced training rules come from the EXE (0x40a290, CGameTypeDlg, 0x4136df)',()=>{
 assert.deepEqual(RULE_DEFAULTS,{hits:30,time:180,lives:30});
 assert.deepEqual(resolveRules({mode:'training',gameType:'hits',limit:7}),{type:'time',limit:150});
 assert.deepEqual(resolveRules({mode:'local',gameType:'hits',limit:2}),{type:'hits',limit:5},'min 5');
 assert.deepEqual(resolveRules({mode:'local',gameType:'time',limit:99999}),{type:'time',limit:9999});
 assert.equal(new Game({mapData:blank,mode:'training',random:()=>.5}).time,150);
});

test('"na čas" scores kills minus deaths (0x412680)',()=>{
 const g=local('time',180),[a,b]=g.players;
 g.kill(b,a.id);assert.equal(a.score,1);assert.equal(b.score,-1);
});

test('"na zásahy" has no clock and ends when a player reaches the limit',()=>{
 const g=local('hits',5),[a,b]=g.players;let ended=0;g.onEvent=e=>{if(e.type==='end')ended++;};
 assert.equal(g.time,Infinity);
 for(let i=0;i<4;i++){g.kill(b,a.id);b.dead=0;}
 assert.equal(g.over,false);assert.equal(a.score,4);
 g.kill(b,a.id);assert.equal(g.over,true);assert.equal(ended,1);assert.equal(a.score,5);
});

test('"na životy" counts lives down, an eliminated player stays out, last one standing ends it',()=>{
 const g=local('lives',5),[a,b]=g.players;
 assert.equal(a.score,5);
 for(let i=0;i<4;i++){g.kill(b,a.id);run(g,2.3);}
 assert.equal(b.score,1);assert.equal(b.dead,0,'still respawns');assert.equal(g.over,false);
 g.kill(b,a.id);assert.equal(b.score,0);assert.equal(g.over,true,'one human left');
 assert.deepEqual(ranking(g).map(p=>p.id),[0,1]);
});

test('an eliminated player does not respawn (0x417abd)',()=>{
 const g=new Game({mapData:blank,mode:'local',gameType:'lives',limit:5,random:()=>.5});g.pickups=[];
 // three-way check is not possible with two humans; simulate the respawn path directly
 const b=g.players[1];b.deaths=5;b.dead=.01;g.over=false;g.update(1/60);
 assert.equal(b.active,false);assert.equal(b.dead,Infinity);
});
