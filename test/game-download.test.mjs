import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {gameDownload,GAME_URL} from '../game-download.mjs';

function response() {
  const r=new EventEmitter();
  Object.assign(r,{status:0,headers:null,headersSent:false,chunks:[],writeHead(s,h){r.status=s;r.headers=h;r.headersSent=true;return r;},end(c){if(c)r.chunks.push(c);r.emit('close');},write(c){r.chunks.push(c);return true;},destroy(){r.emit('close');},once:r.once.bind(r),removeListener:r.removeListener.bind(r),writable:true});
  return r;
}
const upstream=(body,size,ok=true)=>async url=>{assert.equal(url,GAME_URL);return {ok,body:new Blob([body]).stream(),headers:new Headers({'content-length':String(size)})};};

test('availability is answered without touching bulanci.cz',async()=>{
  const r=response();await gameDownload({method:'HEAD'},r,()=>assert.fail('no upstream call'));
  assert.equal(r.status,204);
});
test('only GET and HEAD are served',async()=>{
  const r=response();await gameDownload({method:'POST'},r,()=>assert.fail());
  assert.equal(r.status,405);
});
test('a failed or oversized answer is not relayed',async()=>{
  let r=response();await gameDownload({method:'GET'},r,upstream('x',1,false),1);assert.equal(r.status,502);
  r=response();await gameDownload({method:'GET'},r,upstream('x',64*1024*1024),2);assert.equal(r.status,502);
});
test('a good answer is relayed and never cached',async()=>{
  const r=response();await gameDownload({method:'GET'},r,upstream('abc',3),3);
  assert.equal(r.status,200);assert.equal(r.headers['Cache-Control'],'no-store');
});
test('the switch turns the route off',async()=>{
  process.env.BULANCI_DOWNLOAD='0';
  const r=response();await gameDownload({method:'HEAD'},r);
  delete process.env.BULANCI_DOWNLOAD;assert.equal(r.status,404);
});
