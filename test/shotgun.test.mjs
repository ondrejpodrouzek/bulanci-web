import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,shotPellets} from '../dist/engine.js';
const empty={name:'Test',layers:[],obstacles:[]};
function game(map=empty){let seed=42;const g=new Game({mapData:map,mode:'local',random:()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}});g.pickups=[];return g;}
function step(g,n,input=[]){for(let i=0;i<n;i++)g.update(1/60,input);}
const shotgun=(g,direction=1)=>{Object.assign(g.players[0],{x:100,y:250,direction,cooldown:0,weapon:1,ammo:[0,4,0,0,0,0],dead:0});g.players[1].x=-999;g.shoot(g.players[0]);return g.bullets.at(-1);};

test('shotgun fires one CShot kind1 carrying five coincident pellets (0x41fdf0, mask 0x1f)',()=>{
 const g=game(),b=shotgun(g);
 assert.equal(g.bullets.length,1);assert.equal(g.players[0].ammo[1],3);
 assert.equal(b.shotKind,1);assert.equal(b.mask,0x1f);
 const pellets=shotPellets(b);assert.equal(pellets.length,5);
 assert.ok(pellets.every(q=>q.x===b.x&&q.y===b.y),'no spread before the first 40px step');
});

test('each 40px step widens the shot by 5px per side and spreads pellets evenly (0x419b40, 0x417b30)',()=>{
 const g=game(),b=shotgun(g,1),x0=b.x,y0=b.y,h=b.bitmapHeight;
 g.advanceBullet(b,b.x+40,b.y,g.elapsed);g.advanceBullet(b,b.x+40,b.y,g.elapsed);
 assert.equal(b.x,x0+80);assert.equal(b.y,y0-10);assert.equal(b.height,h+20);assert.equal(b.width,b.bitmapWidth);
 // Pellet i: top + trunc((rect - bitmap) * i / 4) -> 0, 5, 10, 15, 20 after two steps.
 assert.deepEqual(shotPellets(b).map(q=>q.y-b.y),[0,5,10,15,20]);
});

test('vertical shots widen horizontally',()=>{
 const g=game(),b=shotgun(g,3),x0=b.x;
 g.advanceBullet(b,b.x,b.y+40,g.elapsed);
 assert.equal(b.x,x0-5);assert.equal(b.width,b.bitmapWidth+10);assert.equal(b.height,b.bitmapHeight);
 assert.deepEqual(shotPellets(b).map(q=>q.x-b.x),[0,2,5,7,10]);
});

test('a pellet hit clears only that pellet; the rest fly on (0x41e016)',()=>{
 // A thin wall that only the centre of the spread reaches.
 const g=game(),b=shotgun(g,1);
 const centre=b.y+b.bitmapHeight/2;
 g.map.obstacles.push({x:b.x+300,y:centre-1,w:4,h:2});
 step(g,30);
 assert.notEqual(b.mask,0x1f,'some pellet was stopped');assert.notEqual(b.mask,0,'outer pellets survive');
 assert.equal(b.mask&0b10001,0b10001,'outermost pellets pass beside the wall');
});

test('the spread can hit an off-axis player that a pistol shot would miss',()=>{
 const run=weapon=>{const g=game(),p=g.players[0],q=g.players[1];
  Object.assign(p,{x:100,y:250,direction:1,cooldown:0,weapon,ammo:[5,4,0,0,0,0],dead:0});
  g.shoot(p);const b=g.bullets.at(-1);
  // Target's hit rect (y-25..y+12) starts 20px below the unspread shot: outside the pistol line,
  // inside the shotgun spread after four 40px steps.
  Object.assign(q,{x:b.x+420,y:b.y+b.height+20+25,dead:0});
  step(g,40);return q.deaths;};
 assert.equal(run(0),0,'pistol misses');
 assert.equal(run(1),1,'shotgun outer pellet hits');
});

test('a shot ends once any edge of its rectangle leaves the field, with no lifetime (0x41de60)',()=>{
 const g=game();g.players.forEach(p=>p.x=-1000);
 const b=g.newBullet(700,250,1,0,0,g.elapsed,0);
 g.advanceBullet(b,750,250,g.elapsed);assert.equal(b.x,750,'still inside');
 assert.equal(g.advanceBullet(b,790,250,g.elapsed),false,'right edge 799 is inside');
 assert.equal(g.advanceBullet(b,791,250,g.elapsed),true,'right edge 800 is outside');
 const up=g.newBullet(300,2,2,0,0,g.elapsed,0);assert.equal(g.advanceBullet(up,300,-1,g.elapsed),true);
});

test('shotgun pellets that leave the field drop out one by one',()=>{
 const g=game(),b=shotgun(g,1);b.y=3;b.x=100;
 g.advanceBullet(b,b.x+40,b.y,g.elapsed);
 assert.equal(b.mask&1,0,'upper pellet left the top edge');assert.notEqual(b.mask,0,'the rest fly on');
});
