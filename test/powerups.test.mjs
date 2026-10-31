import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../dist/engine.js';
import {POWERUPS,POWERUP_WAIT,POWERUP_SHOWN,POWERUP_EFFECT} from '../dist/powerups.js';
const blank={name:'Test',layers:[],obstacles:[]};
function solo(random=()=>.5){const g=new Game({mapData:blank,mode:'training',random});g.pickups=[];g.players.slice(1).forEach(p=>{p.dead=1e9;p.x=-1000;});return g;}
const run=(g,seconds)=>{for(let i=0;i<Math.round(seconds*60);i++)g.update(1/60);};
const give=(g,actor,kind)=>{const d=POWERUPS[kind];g.powerups.item={x:actor.x-d.width/2,y:actor.y-10,w:d.width,h:d.height,kind,resource:d.resource,shownAt:g.elapsed};g.update(1/60);};

test('power-ups exist only with one human player (0x42031b)',()=>{
 assert.ok(solo().powerups);
 assert.equal(new Game({mapData:blank,mode:'local',random:()=>.5}).powerups,null);
});

test('one random power-up appears after 25 s, stays 10 s, then the cycle restarts (0x417c80, 0x41b500, 0x419e40)',()=>{
 const g=solo(()=>.5),p=g.players[0];p.x=-1000;
 run(g,POWERUP_WAIT-.1);assert.equal(g.powerups.item,null);
 run(g,.2);const it=g.powerups.item;assert.ok(it,'shown');assert.equal(it.kind,Math.floor(.5*256)>>6,'rand*256>>15>>6');
 assert.equal(it.resource,POWERUPS[it.kind].resource);
 run(g,POWERUP_SHOWN-.2);assert.ok(g.powerups.item);run(g,.3);assert.equal(g.powerups.item,null,'hidden after 10 s');
 run(g,POWERUP_WAIT-.3);assert.equal(g.powerups.item,null);run(g,.3);assert.ok(g.powerups.item,'next one after another 25 s');
});

test('the four kinds are picked with equal probability',()=>{
 const kinds=[0,.25,.5,.75,.999].map(r=>{const g=solo(()=>r);g.players[0].x=-1000;run(g,POWERUP_WAIT+.1);return g.powerups.item?.kind;});
 assert.deepEqual(kinds,[0,1,2,3,3]);
});

test('shield blocks death for 20 s',()=>{
 const g=solo(),p=g.players[0];Object.assign(p,{x:300,y:250});give(g,p,1);
 assert.equal(g.powerups.item,null,'item taken');assert.ok(Math.abs(g.powerups.at-(g.elapsed+POWERUP_WAIT))<1e-9,'countdown restarts on pickup');
 g.kill(p,1);assert.equal(p.dead,0,'shielded');
 run(g,POWERUP_EFFECT);g.kill(p,1);assert.ok(p.dead>0,'shield expired');
});

test('ammo power-up stops ammunition use; pistol never reloads while it lasts',()=>{
 const g=solo(),p=g.players[0];Object.assign(p,{x:300,y:250});give(g,p,2);
 for(let i=0;i<8;i++){p.cooldown=0;g.shoot(p);}
 assert.equal(p.ammo[0],5);assert.equal(p.reloading,0);
 run(g,POWERUP_EFFECT);p.cooldown=0;g.shoot(p);assert.equal(p.ammo[0],4);
});

test('hourglass gives the human +15 s and a computer -15 s (0x414572)',()=>{
 const g=solo(),p=g.players[0],bot=g.players[1];Object.assign(p,{x:300,y:250});
 const t=g.time;give(g,p,3);assert.ok(Math.abs(g.time-(t+15-1/60))<1e-6);
 Object.assign(bot,{x:500,y:250,dead:0});p.x=-1000;const t2=g.time;give(g,bot,3);assert.ok(Math.abs(g.time-(t2-15-1/60))<1e-6);
});

test('invisible humans are not seen by training bot sensors (0x417dfd)',()=>{
 const g=solo(()=>0),p=g.players[0],bot=g.players[1];
 Object.assign(bot,{x:150,y:250,dead:0,direction:3,cooldown:0});Object.assign(p,{x:-1000});g.update(1/60);
 p.effects={invisible:POWERUP_EFFECT};Object.assign(p,{x:450,y:250});run(g,1);
 assert.equal(g.bullets.length,0);assert.equal(bot.direction,3);
 p.effects.invisible=0;g.update(1/60);assert.equal(bot.direction,1,'visible again: sensor entry');
});
