// Serves the assets a player imported from their own bulanci.exe (import.html). The game keeps
// using its normal assets/ paths; whatever is not imported comes from the server.
const CACHE='bulanci-exe-assets-v1';

addEventListener('install',()=>skipWaiting());
addEventListener('activate',event=>event.waitUntil(clients.claim()));

async function serve(request) {
  const url=new URL(request.url);url.search='';
  const cached=await (await caches.open(CACHE)).match(url.href);
  if(!cached)return fetch(request);
  // Safari asks for media in ranges and refuses a plain 200.
  const range=/^bytes=(\d+)-(\d*)$/.exec(request.headers.get('range')??'');
  if(!range)return cached;
  const blob=await cached.blob(),start=+range[1],end=Math.min(range[2]?+range[2]:blob.size-1,blob.size-1);
  return new Response(blob.slice(start,end+1),{status:206,headers:{'Content-Type':cached.headers.get('Content-Type'),'Content-Range':`bytes ${start}-${end}/${blob.size}`,'Content-Length':String(end-start+1),'Accept-Ranges':'bytes'}});
}

addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method==='GET'&&url.origin===location.origin&&url.pathname.includes('/assets/'))event.respondWith(serve(event.request));
});
