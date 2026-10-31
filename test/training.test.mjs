import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../dist/engine.js';
const maps=JSON.parse(readFileSync(new URL('../dist/assets/original/maps.json',import.meta.url)));
test('all five maps retain three training opponents, separate from scripted level NPCs',()=>{
 for(const mapData of Object.values(maps)){
  const g=new Game({mapData,mode:'training',random:()=>.5});
  assert.equal(g.players.length,4,mapData.name);assert.equal(g.players[0].bot,false);
  assert.equal(g.players.filter(p=>p.bot).length,3,mapData.name);
  for(const p of g.players)assert.equal(p.dead,0);
  if(mapData.source_resource===324)assert.equal(g.npcs.filter(p=>p.active).length,1,'original undead remains active');
 }
});
test('local keyboard mode has two human players without training bots',()=>{
 for(const mapData of Object.values(maps)){const g=new Game({mapData,mode:'local',random:()=>.5});assert.equal(g.players.length,2);assert.ok(g.players.every(p=>!p.bot));}
});
const blank={name:'Test',layers:[],obstacles:[]};
function training(random=()=>.5){const g=new Game({mapData:blank,mode:'training',random});g.pickups=[];g.players.slice(2).forEach(p=>{p.dead=100;p.x=-1000;});return g;}
const run=(g,seconds,input=[])=>{for(let i=0;i<Math.round(seconds*60);i++)g.update(1/60,input);};

test('a training opponent turns to a human entering its axis, shoots after rand(0..3)*500ms and respawns',()=>{
 const g=training(),p=g.players[0],bot=g.players[1];
 Object.assign(p,{x:350,y:250});Object.assign(bot,{x:150,y:250,direction:3,cooldown:0});
 g.update(1/60);assert.equal(bot.direction,1,'faces the sensor side at once');assert.ok(Math.abs(bot.fireAt-g.elapsed-1)<1e-9,'random .5 -> 2*500ms');
 run(g,.9);assert.equal(g.bullets.length,0,'no shot before the timer');
 run(g,.6);assert.ok(p.dead>0,'human hit');assert.equal(bot.score,1);
 bot.dead=.05;bot.x=-1000;run(g,4/60);
 assert.equal(bot.dead,0);assert.ok(bot.x>=0,'opponent respawns');assert.equal(bot.bot,true);
});

test('training opponents never walk and ignore humans outside their four axes',()=>{
 const g=training(),p=g.players[0],bot=g.players[1];
 Object.assign(p,{x:400,y:400});Object.assign(bot,{x:150,y:150,direction:3,cooldown:0});
 const x=bot.x,y=bot.y;run(g,5);
 assert.equal(bot.x,x);assert.equal(bot.y,y);assert.equal(g.bullets.length,0);assert.equal(bot.direction,3);
});

test('a human standing in the axis draws one shot; leaving and re-entering arms another',()=>{
 const g=training(()=>0),p=g.players[0],bot=g.players[1];
 Object.assign(bot,{x:150,y:250,direction:1,cooldown:0});Object.assign(p,{x:450,y:250});
 const spawnAt=g.spawnPoint.bind(g);g.spawnPoint=a=>a===bot?{x:a.x,y:a.y}:spawnAt(a); // keep the post-shot teleport (40%) in place for this test
 let shots=0;g.onEvent=e=>{if(e.type==='shot'&&e.player===bot)shots++;};
 g.update(1/60);assert.equal(shots,1,'zero delay fires at once');
 p.dead=0;run(g,3);assert.equal(shots,1,'no repeat while the sensor stays taken');
 Object.assign(p,{x:450,y:420,dead:0});run(g,.1);Object.assign(p,{x:450,y:250,dead:0});bot.cooldown=0;g.update(1/60);
 assert.equal(shots,2,'re-entry fires again');
});

test('leaving the axis before the timer cancels the shot (0x421133)',()=>{
 const g=training(()=>.99),p=g.players[0],bot=g.players[1];
 Object.assign(bot,{x:150,y:250,direction:1,cooldown:0});Object.assign(p,{x:450,y:250});
 g.update(1/60);assert.ok(Math.abs(bot.fireAt-g.elapsed-1.5)<1e-9,'max delay 1500ms');
 run(g,.5);Object.assign(p,{y:420});run(g,2);assert.equal(g.bullets.length,0);
});

test('entering from behind cover occupies the sensor without a shot (0x421079)',()=>{
 const g=new Game({mapData:{...blank,obstacles:[{x:260,y:150,w:20,h:200}]},mode:'training',random:()=>0});g.pickups=[];g.players.slice(2).forEach(p=>{p.dead=100;p.x=-1000;});
 const p=g.players[0],bot=g.players[1];
 Object.assign(bot,{x:150,y:250,direction:3,cooldown:0});Object.assign(p,{x:450,y:250});
 run(g,1);assert.equal(g.bullets.length,0);assert.equal(bot.direction,3,'does not turn to a hidden human');
 g.map.obstacles=[];run(g,1);assert.equal(g.bullets.length,0,'no new entry, no shot');
});

test('computers spend no ammunition and respawn with the shotgun 10 times in 101 (0x417500, 0x41f805)',()=>{
 const g=training(()=>0),bot=g.players[1];Object.assign(bot,{cooldown:0,weapon:0});
 for(let i=0;i<8;i++){bot.cooldown=0;g.shoot(bot);}
 assert.equal(bot.ammo[0],5);assert.equal(bot.reloading,0);
 const respawnWeapon=r=>{const h=training(()=>r),b=h.players[1];b.dead=.01;run(h,2/60);return b.weapon;};
 assert.equal(respawnWeapon(9.99/101),1);assert.equal(respawnWeapon(10/101),0);
});

test('Exitus undead ignore training bots and fire one-shot timer1, re-armed by the 2s poll',()=>{
 const exitus=Object.values(maps).find(m=>m.source_resource===324);
 const g=new Game({mapData:exitus,mode:'training',random:()=>.5});g.pickups=[];g.map.obstacles=[];
 const n=g.npcs[0],p=g.players[0],bot=g.players[1];g.players.slice(2).forEach(q=>{q.dead=100;q.x=-1000;});
 // A bot alone in the undead's axis is not a sensor target.
 Object.assign(p,{x:700,y:60});Object.assign(bot,{x:600,y:300});Object.assign(n,{x:150,y:300,dead:0,direction:3,cooldown:0,fade:1,fadeMs:undefined});
 n.wanderAt=1e9;n.sightPollAt=g.elapsed+2;g.update(1/60);assert.equal(n.fireAt,null,'bot ignored');
 // A human in the axis draws a shot 500ms later, then nothing until the next 2s poll.
 bot.x=-1000;bot.dead=100;Object.assign(p,{x:600,y:300});
 let bursts=0;g.onEvent=e=>{if(e.type==='shot'&&e.player===n&&e.round===0)bursts++;};
 n.sightPollAt=g.elapsed+2;
 for(let i=0;i<90;i++){p.dead=0;g.update(1/60);}
 assert.equal(bursts,1,'one burst after entry');
 for(let i=0;i<40;i++){p.dead=0;g.update(1/60);}
 assert.equal(bursts,1,'still one before the poll fires');
 for(let i=0;i<45;i++){p.dead=0;g.update(1/60);}
 assert.equal(bursts,2,'poll re-arms the one-shot timer');
});

test('computers teleport every (rand(0..10)+5) s while idle, with effect, sound and a 426ms turn lock (0x417260, 0x41db00)',async()=>{
 const {TELEPORT_MS}=await import('../dist/training.js');
 const g=training(()=>.5),p=g.players[0],bot=g.players[1];p.x=-1000;
 assert.equal(bot.teleportPeriod,10,'floor(.5*11)+5');
 let events=0;g.onEvent=e=>{if(e.type==='teleport'&&e.player===bot)events++;};
 const at=bot.teleportAt;run(g,at-g.elapsed-.05);assert.equal(events,0);
 run(g,.1);assert.equal(events,1);assert.equal(g.teleports.length,2,'old and new place');
 assert.ok(bot.teleportingUntil-g.elapsed<=TELEPORT_MS/1000&&TELEPORT_MS===426);
 // a human entering the axis during the lock gets no shot armed
 Object.assign(p,{x:bot.x+300,y:bot.y,dead:0});g.update(1/60);assert.equal(bot.fireAt,null);
 run(g,.5);assert.equal(g.teleports.length,0,'effects finished');assert.equal(bot.teleportingUntil,null);
});

test('after its weapon animation a computer teleports 40 times in 100 (0x421579)',()=>{
 const shootAndEnd=r=>{const g=training(()=>r),p=g.players[0],bot=g.players[1];p.x=-1000;bot.teleportAt=1e9;
  let tp=0;g.onEvent=e=>{if(e.type==='teleport')tp++;};bot.cooldown=0;g.shoot(bot);run(g,1);return tp;};
 assert.equal(shootAndEnd(.39),1);assert.equal(shootAndEnd(.4),0);
});

test('a dying computer does not teleport',()=>{
 const g=training(()=>0),bot=g.players[1];g.players[0].x=-1000;bot.teleportAt=1e9;bot.cooldown=0;g.shoot(bot);
 let tp=0;g.onEvent=e=>{if(e.type==='teleport')tp++;};g.kill(bot,0);assert.equal(tp,0);
});
