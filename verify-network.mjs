// Two browsers play one network game over the local relay (net-server.mjs): the host creates
// it for 2 players with 1 on its computer, the guest joins through the original TCP/IP and
// session dialogs, both chat, the host starts, the guest's keys move player 2 on the host and
// the guest draws the host's snapshots.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
const errors=[];
async function open(name,players){const page=await browser.newPage({viewport:{width:1100,height:900}});if(players)await page.addInitScript(v=>localStorage.setItem('bulanci.players.v1',v),JSON.stringify(players));page.on('pageerror',e=>errors.push(name+': '+e.message));await page.goto(''+(process.env.BASE||'http://127.0.0.1:4173')+'/?debug');await page.waitForFunction(()=>!document.querySelector('#start-text').disabled);await page.waitForTimeout(500);return page;}
async function at(page,x,y){const b=await page.locator('#dialog-layer').boundingBox(),k=b.width/800;await page.mouse.click(b.x+x*k,b.y+y*k);await page.waitForTimeout(250);}
async function type(page,text){await page.keyboard.type(text);}
// Different names: Start hry 2 refuses two players of the same name across computers (0x40f610).
const host=await open('host'),guest=await open('guest',{1:[{name:'Uzlík',colorIndex:2,keys:0}]});
// Start hry 1 (window 250,60): 2 players in total, 1 on this computer -> network host.
await at(host,250+30+30,60+130+17+8);await at(host,250+30+30,60+248+8);await at(host,250+20+41,60+456+12);
await host.waitForTimeout(500);
// Guest: Připojit se, Dále, session list, Připojit.
await at(guest,250+30+30,60+45+17+8);await at(guest,250+20+41,60+456+12);
await guest.waitForTimeout(1500);
await at(guest,232+20+40,178+50+4+7);await at(guest,232+83+41,178+200+12);
await guest.waitForTimeout(1000);
// Chat from the guest (edit at 250,418 of the window 230,50).
await at(guest,230+250+50,50+418+10);await type(guest,'ahoj');await guest.keyboard.press('Enter');await host.waitForTimeout(500);
// Host starts (Start at 40,466).
await at(host,230+40+41,50+466+12);
await host.waitForFunction(()=>window.bulanciGame&&!window.bulanciGame.over,null,{timeout:10000});
await guest.waitForTimeout(2500);
const before=await host.evaluate(()=>window.bulanciGame.players.map(p=>[p.x,p.y,p.name]));
const mirrorBefore=await guest.evaluate(()=>document.querySelector('#menu').hidden);
await guest.keyboard.down('ArrowRight');await guest.waitForTimeout(900);await guest.keyboard.up('ArrowRight');
await host.keyboard.down('ArrowLeft');await host.waitForTimeout(900);await host.keyboard.up('ArrowLeft');
await host.waitForTimeout(300);
const after=await host.evaluate(()=>window.bulanciGame.players.map(p=>[p.x,p.y]));

assert.deepEqual(before.map(p=>p[2]),['Bulík','Uzlík']);assert.ok(mirrorBefore,'guest left the menu');
assert.ok(after[1][0]!==before[1][0],'guest keys moved player 2 on the host');
assert.ok(after[0][0]!==before[0][0],'host keys moved player 1');
assert.deepEqual(errors,[]);
// The guest leaves in mid-game: the host's round ends cleanly and the session is gone from the list.
await guest.close();await host.waitForFunction(()=>window.bulanciGame?.over,null,{timeout:5000});await host.waitForFunction(()=>window.bulanciDialogs?.top?.w===800,null,{timeout:5000});
const third=await open('third');const left=await third.evaluate(()=>new Promise(r=>{const ws=new WebSocket(`ws://${location.host}/net`);ws.onopen=()=>ws.send('{"t":"list"}');ws.onmessage=e=>r(JSON.parse(e.data).list);}));assert.deepEqual(left,[],'no session left behind');assert.deepEqual(errors,[]);
console.log(JSON.stringify({players:before.map(p=>p[2]),hostMoved:true,guestMoved:true,guestLeft:true,errors}));
await browser.close();
