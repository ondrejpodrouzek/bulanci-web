import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {attachNetServer} from './net-server.mjs';
const root=resolve(import.meta.dirname,'dist');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.md':'text/plain; charset=utf-8','.webmanifest':'application/manifest+json','.json':'application/json; charset=utf-8','.wav':'audio/wav','.mp3':'audio/mpeg','.ogg':'audio/ogg'};
// Local only by default (AGENTS.md). BULANCI_HOST=0.0.0.0 opens it to the LAN for network games.
const host=process.env.BULANCI_HOST||'127.0.0.1',port=Number(process.env.PORT)||4173;
if(!existsSync(resolve(root,'assets/original/poems.json')))console.warn('Chybí data hry: spusťte python tools/import_assets.py <cesta k bulanci.exe>');
const server=http.createServer(async(req,res)=>{try{const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403).end();return;}const file=path===root?resolve(root,'index.html'):path;const data=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404).end('Nenalezeno');}});
attachNetServer(server);
server.listen(port,host,()=>console.log(`Bulánci: http://${host}:${port}`));
