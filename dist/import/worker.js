// Runs the import off the main thread and stores the assets in the browser's Cache Storage,
// where sw.js serves them. poems.json is written last: it marks a finished import.
import {buildAssets,NotBulanci} from './exe-assets.js';
import {CACHE,DONE_MARK} from './store.js';

const assets=new URL('../assets/',import.meta.url);
const canvas={decode:bytes=>createImageBitmap(new Blob([bytes],{type:'image/jpeg'})),surface:(w,h)=>new OffscreenCanvas(w,h)};

onmessage=async({data:file})=>{
  try{
    const exe=new Uint8Array(await file.arrayBuffer()),manifest=await fetch(new URL('original/sprites/manifest.json',assets)).then(r=>r.json());
    await caches.delete(CACHE);
    const cache=await caches.open(CACHE);let marker=null;
    for await(const {path,data} of buildAssets(exe,manifest,canvas,value=>postMessage({progress:value}))){
      const response=new Response(data,{headers:{'Content-Type':data.type||'application/octet-stream'}});
      if(path===DONE_MARK+'.part')marker=response;
      else await cache.put(new URL(path,assets),response);
    }
    await cache.put(new URL(DONE_MARK,assets),marker);
    postMessage({done:true});
  }catch(e){
    await caches.delete(CACHE).catch(()=>{});
    postMessage({error:e instanceof NotBulanci?e.message:'Import se nepovedl. Je to bulanci.exe verze 1.80?',detail:String(e?.stack??e)});
  }
};
