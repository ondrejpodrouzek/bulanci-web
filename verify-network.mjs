// Real browsers over the local relay (net-server.mjs): a computer hosts, a phone joins through the
// invitation link, a third joins by code while the round runs. Everybody starts with the default
// name and colour. Two rounds in a row keep the room together; leaving is announced.
// SHOTS=<dir> also saves the screens.
import {chromium,devices} from '@playwright/test';
import assert from 'node:assert/strict';
const BASE=process.env.BASE||'http://127.0.0.1:4173',SHOTS=process.env.SHOTS;
const browser=await chromium.launch({headless:true}),errors=[];
async function open(name,context={viewport:{width:1100,height:900}},query='?debug'){
  const page=await (await browser.newContext(context)).newPage();
  page.on('pageerror',e=>errors.push(`${name}: ${e.message}`));
  await page.goto(`${BASE}/${query}`);await page.waitForFunction(()=>!document.querySelector('#start-text').disabled);return page;
}
const shot=(page,name)=>SHOTS?page.screenshot({path:`${SHOTS}/${name}.png`}):null;
const seats=page=>page.locator('.net-seat:not(.free)').evaluateAll(list=>list.map(s=>s.querySelector('input')?.value??s.querySelector('.net-seat-name').textContent));
const names=page=>page.evaluate(()=>window.bulanciNet.state().players.map(p=>p.name));
// The computer's screens are the original widgets on the canvas: found by their text, clicked in place.
const press=async(page,text,nth=0)=>{const r=await page.evaluate(([text,nth])=>{const w=window.bulanciDialogs.top,all=w.widgets.filter(x=>x.text===text&&x.onClick&&x.visible),b=all[nth];return b&&{x:w.x+b.x+b.w/2,y:w.y+b.y+b.h/2,disabled:b.disabled};},[text,nth]);assert.ok(r,'button '+text);const box=await page.locator('#dialog-layer').boundingBox(),k=box.width/800;await page.mouse.click(box.x+r.x*k,box.y+r.y*k);await page.waitForTimeout(200);return r;};
const disabled=(page,text)=>page.evaluate(t=>window.bulanciDialogs.top.widgets.find(x=>x.text===t)?.disabled,text);
const phone={...devices['iPhone 14 Pro'],viewport:{width:844,height:390}};delete phone.defaultBrowserType;

// Computer: Start hry 1 asks where to play, Po síti opens the list of games.
const host=await open('host');await host.waitForTimeout(600);
const at=async(page,x,y)=>{const b=await page.locator('#dialog-layer').boundingBox(),k=b.width/800;await page.mouse.click(b.x+x*k,b.y+y*k);await page.waitForTimeout(250);};
await shot(host,'1-start');
await at(host,250+30+30,60+45+17+8);await shot(host,'2-start-net');await at(host,250+20+41,60+456+12);
await host.waitForFunction(()=>window.bulanciDialogs.top?.widgets.some(w=>w.text==='Založit'&&!w.disabled));await shot(host,'2b-hub');await press(host,'Založit');
await host.waitForFunction(()=>window.bulanciNet.state()?.code);
const code=await host.evaluate(()=>window.bulanciNet.state().code);assert.match(code,/^[A-Z2-9]{4}$/);
await host.waitForFunction(()=>window.bulanciDialogs.top?.widgets.some(w=>w.text==='Spustit'));
assert.ok(await disabled(host,'Spustit'),'nobody to play with yet');await shot(host,'3-room-alone');
// Rules and level chosen before anybody comes must reach the guests.
await host.evaluate(()=>{window.bulanciNet.level('factory');window.bulanciNet.rules({type:'time',limit:20});});await host.waitForTimeout(200);

// Phone: the link leads straight into the room, nothing to fill in.
const guest=await open('phone',phone,`?debug&hra=${code}`);
await guest.waitForSelector('.net-seat.own');await guest.waitForFunction(()=>document.querySelectorAll('.net-seat:not(.free)').length===2);
assert.deepEqual(await names(host),['Bulík','Bulík 2'],'the same default name is sorted out');
assert.deepEqual(await seats(guest),['Bulík','Bulík 2']);
assert.equal(await guest.locator('.net-level').count(),1,'the guest sees the chosen level only');
assert.match(await guest.locator('.net-level').textContent(),/Noční směna/);assert.match(await guest.locator('.net-summary').textContent(),/20 vteřin/);
assert.equal(await guest.getByRole('button',{name:'Spustit hru'}).isVisible(),false);
await shot(host,'4-room-host');await shot(guest,'5-room-phone');
// The list on another computer shows the game.
const third=await open('third');await third.waitForTimeout(600);await at(third,250+30+30,60+45+17+8);await at(third,250+20+41,60+456+12);
await third.waitForFunction(()=>window.bulanciDialogs.top?.widgets.some(w=>w.items?.[0]?.includes('2/4')));assert.match(await third.evaluate(()=>window.bulanciDialogs.top.widgets.find(w=>w.items).items[0]),/Noční směna.*2\/4/);await shot(third,'6-list');
// Chat, and a rename that the other side sees.
await guest.locator('.net-say input').fill('ahoj');await guest.locator('.net-say input').press('Enter');
await host.waitForFunction(()=>window.bulanciNet.state().chat.some(t=>t.includes('Bulík 2: ahoj')));await host.waitForTimeout(150);await shot(host,'4b-chat');
await guest.locator('.net-seat.own .net-name').fill('Uzlík');await guest.locator('.net-seat.own .net-name').blur();
await host.waitForFunction(()=>window.bulanciNet.state().players.some(p=>p.name==='Uzlík'));await host.waitForTimeout(150);

// Round 1.
const started=Date.now();await press(host,'Spustit');
// CGameCounter on both sides: the same picture, the same lamps, nobody plays during it.
await host.waitForTimeout(2600);await shot(host,'4c-counter-host');await shot(guest,'4d-counter-phone');
const lamps=async page=>page.evaluate(()=>window.bulanciDialogs.top?.lamps?.join());
assert.match(await host.evaluate(()=>String(window.bulanciDialogs.top?.lamps)),/35/,'the host counts');assert.match(await lamps(guest),/35/,'the guest sees the lamps too');
await host.waitForFunction(()=>window.bulanciGame&&!window.bulanciGame.over,null,{timeout:12000});assert.ok(Date.now()-started>=4500,'the round waits for the lamps');
await guest.waitForFunction(()=>document.querySelector('#net-screen').hidden&&document.querySelector('#menu').hidden&&!window.bulanciDialogs.top,null,{timeout:10000});
await host.waitForTimeout(1500);
// A latecomer joins by code and waits; the running game is marked in the list.
await third.waitForFunction(()=>window.bulanciDialogs.top.widgets.find(w=>w.items)?.items[0]?.includes('právě se hraje'));
await third.evaluate(c=>{window.bulanciDialogs.top.widgets.find(w=>w.digits===4).text=c;},code);await press(third,'Připojit',0);
await third.waitForFunction(()=>window.bulanciNet.state()?.info?.playing);await third.waitForTimeout(300);await shot(third,'7-waiting');
// Esc does not stop the round for anybody.
await host.keyboard.press('Escape');await host.waitForTimeout(300);await shot(host,'8-esc');
const t0=await host.evaluate(()=>window.bulanciGame.time);await host.waitForTimeout(500);assert.ok(await host.evaluate(()=>window.bulanciGame.time)<t0,'the game goes on');
await host.keyboard.press('Escape');
// Time runs out: results, then the same room for everybody.
await host.waitForFunction(()=>window.bulanciGame.over,null,{timeout:30000});
await guest.waitForSelector('.phone-score',{timeout:8000});await shot(guest,'9-score-phone');
await host.waitForFunction(()=>window.bulanciDialogs?.top?.w===800,null,{timeout:5000});
await host.mouse.click(550,450);await host.keyboard.press('Enter');
await host.waitForFunction(()=>window.bulanciDialogs.top?.widgets.some(w=>w.text==='Spustit')&&window.bulanciNet.state().players.length===3,null,{timeout:5000});await host.waitForTimeout(200);
assert.equal(await disabled(host,'Spustit'),false);

// Round 2 starts while the phone still looks at its results; it follows.
await press(host,'Spustit');
await guest.waitForFunction(()=>document.querySelector('.phone-sheet').hidden&&document.querySelector('#menu').hidden,null,{timeout:10000});
await third.waitForFunction(()=>document.querySelector('#menu').hidden,null,{timeout:10000});
await host.waitForFunction(()=>window.bulanciGame&&!window.bulanciGame.over&&window.bulanciGame.players.length===3,null,{timeout:12000});await third.waitForFunction(()=>!window.bulanciDialogs.top,null,{timeout:5000});
await guest.waitForTimeout(1200);
const before=await host.evaluate(()=>window.bulanciGame.players.map(p=>[p.x,p.y,p.name]));
const key=before[2][0]<400?'ArrowRight':'ArrowLeft';await third.keyboard.down(key);await third.waitForTimeout(700);await third.keyboard.up(key);
const after=await host.evaluate(()=>window.bulanciGame.players.map(p=>[p.x,p.y]));
assert.deepEqual(before.map(p=>p[2]),['Bulík','Uzlík','Bulík 2']);assert.notEqual(after[2][0],before[2][0],'the latecomer plays');
// One leaves: gone from the field, the others play on, the host hears about it.
await third.close();await host.waitForFunction(()=>window.bulanciGame.players[2].active===false,null,{timeout:5000});
assert.equal(await host.evaluate(()=>window.bulanciGame.over),false);
assert.match(await host.locator('#message').textContent(),/Odchází/);
// The host ends the room: the guest is told why and lands on the list.
await host.keyboard.press('Escape');await host.waitForTimeout(300);
await at(host,247+209+41,255+50+12);
await host.waitForFunction(()=>window.bulanciGame.over,null,{timeout:3000});
await guest.waitForSelector('.phone-score',{timeout:8000});
await host.waitForFunction(()=>window.bulanciDialogs?.top?.w===800,null,{timeout:5000});await host.keyboard.press('Enter');
await host.waitForFunction(()=>window.bulanciDialogs.top?.widgets.some(w=>w.text==='Ukončit'));await host.waitForTimeout(200);await press(host,'Ukončit');
await guest.waitForFunction(()=>document.querySelector('.net-notice')?.textContent.includes('Hostitel hru ukončil'),null,{timeout:5000});
await shot(guest,'10-host-left');
const left=await guest.evaluate(()=>new Promise(r=>{const ws=new WebSocket(`ws://${location.host}/net`);ws.onopen=()=>ws.send('{"t":"list"}');ws.onmessage=e=>r(JSON.parse(e.data).list);}));assert.deepEqual(left,[],'no game left behind');
assert.deepEqual(errors,[]);
console.log(JSON.stringify({code,players:before.map(p=>p[2]),rounds:2,errors}));
await browser.close();
