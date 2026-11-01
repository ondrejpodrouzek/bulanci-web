// Relays the freeware archive from bulanci.cz to a player who agreed to it on import.html. That
// site sends no CORS header, so a browser cannot fetch it itself. Nothing is stored here and only
// this one address can be requested, so the route is not an open proxy. import.html checks
// SHA-256 of what arrives. BULANCI_DOWNLOAD=0 turns the route off.
import {Readable} from 'node:stream';

export const GAME_URL='https://www.bulanci.cz/wp-content/uploads/2021/04/bulanci_hra.zip';
const MAX_BYTES=32*1024*1024,MAX_ACTIVE=3,MAX_PER_HOUR=120,HOUR=3600000,TIMEOUT=120000;
let active=0,hourStart=0,hourCount=0;

export async function gameDownload(req,res,fetcher=fetch,now=Date.now()) {
  if(process.env.BULANCI_DOWNLOAD==='0'){res.writeHead(404).end();return;}
  if(req.method==='HEAD'){res.writeHead(204,{'Cache-Control':'no-store'}).end();return;}
  if(req.method!=='GET'){res.writeHead(405).end();return;}
  if(now-hourStart>HOUR){hourStart=now;hourCount=0;}
  if(active>=MAX_ACTIVE||hourCount>=MAX_PER_HOUR){res.writeHead(503,{'Retry-After':'60'}).end();return;}
  active++;hourCount++;
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),TIMEOUT);
  res.on('close',()=>abort.abort());
  try{
    const upstream=await fetcher(GAME_URL,{redirect:'error',signal:abort.signal});
    const size=Number(upstream.headers.get('content-length'));
    if(!upstream.ok||!upstream.body||!(size>0)||size>MAX_BYTES){res.writeHead(502).end();abort.abort();return;}
    res.writeHead(200,{'Content-Type':'application/zip','Content-Length':size,'Cache-Control':'no-store'});
    await new Promise((resolve,reject)=>{
      const body=Readable.fromWeb(upstream.body);
      body.on('error',reject);res.on('close',resolve);
      body.pipe(res);
    });
  }catch{
    if(!res.headersSent)res.writeHead(502).end();else res.destroy();
  }finally{
    clearTimeout(timer);active--;
  }
}
