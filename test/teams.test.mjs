// Web additions for network play: teams, co-op, bots beside several humans, fighting bots.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../dist/engine.js';
import {hostile,allied,teamResult,assignTeams} from '../dist/rules.js';
import {sensorTargets} from '../dist/exitus.js';

const map={layers:[],obstacles:[],animations:[]};
const two=[{name:'A',colorIndex:0},{name:'B',colorIndex:1}];
const game=o=>new Game({mapData:map,mode:'local',humans:two.map(h=>({...h})),gameType:'hits',limit:3,...o});

test('without teams and without fighting bots the targets are the original ones: humans only',()=>{
  const g=new Game({mapData:map,mode:'training',humans:[two[0]]});
  assert.deepEqual(sensorTargets(g,g.players[1]).map(p=>p.id),[0]);
  assert.equal(g.rules.play,undefined,'training has no team rules');
});
test('fighting bots aim at each other, in training too',()=>{
  const g=new Game({mapData:map,mode:'training',humans:[two[0]],botsFight:true});
  assert.deepEqual(sensorTargets(g,g.players[1]).map(p=>p.id),[0,2,3]);
});
test('co-op: humans are one team, bots do not hit each other unless they fight',()=>{
  const g=game({play:'coop',botCount:2});
  assert.deepEqual(g.players.map(p=>p.team),[0,0,1,1]);
  assert.ok(allied(g.players[0],g.players[1]));assert.ok(!hostile(g,g.players[2],g.players[3]));assert.ok(hostile(g,g.players[2],g.players[0]));
  const f=game({play:'coop',botCount:2,botsFight:true});
  assert.ok(hostile(f,f.players[2],f.players[3]));assert.ok(!hostile(f,f.players[0],f.players[1]));
});
test('teams: the chosen team counts, bots fill the smaller team',()=>{
  const g=new Game({mapData:map,mode:'local',humans:[{...two[0],team:1},{...two[1],team:1}],play:'teams',botCount:2});
  assert.deepEqual(g.players.map(p=>p.team),[1,1,0,0]);
});
test('a team mate survives shots and blasts, an enemy does not, a suicide still counts',()=>{
  const g=game({play:'teams',botCount:0});
  g.players[0].team=0;g.players[1].team=0;
  g.kill(g.players[1],0);assert.equal(g.players[1].dead,0);
  g.kill(g.players[0],0);assert.ok(g.players[0].dead>0,'own explosion');
  const v=game({play:'teams',botCount:0});
  v.kill(v.players[1],0);assert.ok(v.players[1].dead>0);
});
test('a shot passes through a team mate',()=>{
  const g=game({play:'coop'}),[a,b]=g.players;a.x=100;a.y=100;b.x=300;b.y=100;
  assert.equal(g.shotHit(200,90,400,90,2,2,0),null);
  const v=game({}),[c,d]=v.players;c.x=100;c.y=100;d.x=300;d.y=100;
  assert.equal(v.shotHit(200,90,400,90,2,2,0)?.target,d);
});
test('on hits a team plays for the common total',()=>{
  const g=game({play:'teams'});
  g.players[0].team=0;g.players[1].team=1;g.humans.push();
  const bot=game({play:'coop',botCount:1}),[a,b,c]=bot.players;
  for(const who of [0,1,0,1]){bot.kill(c,who);c.dead=0;}assert.equal(bot.over,false);bot.kill(c,1);assert.equal(bot.over,true);
  assert.match(teamResult(bot),/zabili 5x/);
});
test('on lives a lone human against bots plays on until somebody runs out',()=>{
  const g=new Game({mapData:map,mode:'local',humans:[two[0]],gameType:'lives',limit:5,botCount:1,play:'ffa'}),[a,b]=g.players;
  for(let i=0;i<4;i++){g.kill(a,1);assert.equal(g.over,false,'a death does not end a one-human round');a.dead=0;}
  g.kill(a,1);assert.equal(g.over,true);
});
test('the teams line names the winner',()=>{
  const g=game({play:'teams'});g.players[0].team=0;g.players[1].team=1;g.players[1].kills=2;
  assert.match(teamResult(g),/Vyhrál tým 2/);
  assert.equal(teamResult(game({})),null);
});
test('assignTeams clears teams in a free-for-all',()=>{const p=[{id:0,team:1}];assignTeams(p,undefined,false);assert.equal(p[0].team,undefined);});
