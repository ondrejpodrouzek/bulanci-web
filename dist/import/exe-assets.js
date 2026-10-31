// Builds the game's assets from the player's own bulanci.exe, inside the browser. The file is
// never sent anywhere. Format notes: docs/reverse-engineering.md; tools/import_assets.py is
// the same import for development.
//
// buildAssets yields {path,data,type}; path is relative to the page, data a Uint8Array or Blob.
const BLOCK=0x8000;
const BITMAPS=new Set([19,20,21,23,24,25,26,30,31,32,...range(34,55),...range(67,74),...range(75,113),116,117,147,148,...range(150,165),172,12288,12290,12292,12294]);
const JPEGS={310:'disco.jpg',314:'title.jpg',315:'menu.jpg',313:'original/menu-night.jpg',316:'original/menu-start.jpg',317:'original/menu-history.jpg',318:'original/menu-exit.jpg'};
const UNASSIGNED=new Set([0x81,0x83,0x88,0x90,0x98]); // no such characters in CP1250
const FILMS=[12289,12291,12293,12295],FILM_COLUMNS=10;
export class NotBulanci extends Error {}

function range(a,b){return Array.from({length:b-a},(_,i)=>a+i);}
const view=b=>new DataView(b.buffer,b.byteOffset,b.byteLength);

function inflateTables(){
  const build=lengths=>{const count=new Uint16Array(16),symbol=new Uint16Array(lengths.length),offs=new Uint16Array(16);
    for(const l of lengths)count[l]++;count[0]=0;for(let i=1;i<15;i++)offs[i+1]=offs[i]+count[i];
    lengths.forEach((l,s)=>{if(l)symbol[offs[l]++]=s;});return {count,symbol};};
  const fixed=new Uint8Array(288).map((_,i)=>i<144?8:i<256?9:i<280?7:8);
  return {build,fixedLit:build(fixed),fixedDist:build(new Uint8Array(30).fill(5))};
}
const T=inflateTables();
const LBASE=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258],LEXT=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
const DBASE=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577],DEXT=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
const ORDER=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];

// One zlib stream at src[start]: returns the bytes and where the stream ended, or throws.
// DecompressionStream cannot tell where a stream ends, and the blocks have no length table.
function inflateBlock(src,start,limit) {
  if((src[start]&15)!==8||((src[start]<<8)|src[start+1])%31)throw Error('not zlib');
  const out=new Uint8Array(limit);let pos=start+2,n=0,bitbuf=0,bitcnt=0;
  const bits=need=>{let v=bitbuf;while(bitcnt<need){if(pos>=src.length)throw Error('eof');v|=src[pos++]<<bitcnt;bitcnt+=8;}bitbuf=v>>>need;bitcnt-=need;return v&((1<<need)-1);};
  const decode=h=>{let code=0,first=0,index=0;for(let len=1;len<=15;len++){code|=bits(1);const c=h.count[len];if(code-c<first)return h.symbol[index+(code-first)];index+=c;first+=c;first<<=1;code<<=1;}throw Error('bad code');};
  for(let last=0;!last;){
    last=bits(1);const kind=bits(2);
    if(kind===0){bitbuf=bitcnt=0;const len=src[pos]|src[pos+1]<<8;pos+=4;if(n+len>limit)throw Error('overflow');out.set(src.subarray(pos,pos+len),n);n+=len;pos+=len;continue;}
    if(kind===3)throw Error('bad block');
    let lit=T.fixedLit,dist=T.fixedDist;
    if(kind===2){
      const nlen=bits(5)+257,ndist=bits(5)+1,ncode=bits(4)+4,l=new Uint8Array(320),c=new Uint8Array(19);
      for(let i=0;i<ncode;i++)c[ORDER[i]]=bits(3);
      const cl=T.build(c);
      for(let i=0;i<nlen+ndist;){const s=decode(cl);if(s<16)l[i++]=s;else{let prev=0,rep;if(s===16){if(!i)throw Error('bad repeat');prev=l[i-1];rep=3+bits(2);}else rep=s===17?3+bits(3):11+bits(7);if(i+rep>nlen+ndist)throw Error('bad repeat');while(rep--)l[i++]=prev;}}
      lit=T.build(l.subarray(0,nlen));dist=T.build(l.subarray(nlen,nlen+ndist));
    }
    for(;;){
      const s=decode(lit);
      if(s<256){if(n>=limit)throw Error('overflow');out[n++]=s;}
      else if(s===256)break;
      else{const i=s-257;if(i>=29)throw Error('bad length');const len=LBASE[i]+bits(LEXT[i]),d=decode(dist);if(d>=30)throw Error('bad distance');const back=DBASE[d]+bits(DEXT[d]);if(back>n||n+len>limit)throw Error('bad copy');for(let k=0;k<len;k++,n++)out[n]=out[n-back];}
    }
  }
  pos-=bitcnt>>3;
  let a=1,b=0;for(let i=0;i<n;i++){a=(a+out[i])%65521;b=(b+a)%65521;}
  const sum=((src[pos]<<24)|(src[pos+1]<<16)|(src[pos+2]<<8)|src[pos+3])>>>0;
  if(sum!==((b<<16)|a)>>>0)throw Error('bad checksum');
  return {data:out.subarray(0,n),end:pos+4};
}

function sections(exe){const v=view(exe),pe=v.getUint32(0x3c,true),count=v.getUint16(pe+6,true),table=pe+24+v.getUint16(pe+20,true);
  return range(0,count).map(i=>{const at=table+i*40+8;return {virtualSize:v.getUint32(at,true),va:v.getUint32(at+4,true),size:v.getUint32(at+8,true),raw:v.getUint32(at+12,true)};});}

export function unpackArchive(exe) {
  if(exe.length<0x1000||exe[0]!==0x4d||exe[1]!==0x5a)throw new NotBulanci('Tohle není spustitelný soubor Windows.');
  let pos=Math.max(...sections(exe).map(s=>s.raw+s.size));
  if(String.fromCharCode(...exe.subarray(pos,pos+4))!=='GZIP')throw new NotBulanci('V souboru není datový archiv Bulánků.');
  pos+=12;
  const blocks=[];let total=0;
  while(pos<exe.length){
    let part;
    try{const r=inflateBlock(exe,pos,BLOCK);if(r.data.length!==BLOCK&&exe.length-pos>BLOCK+2048)throw Error('short block');part=r.data;pos=r.end;}
    catch{part=exe.subarray(pos,pos+BLOCK);pos+=part.length;}
    blocks.push(part);total+=part.length;
  }
  const a=new Uint8Array(total);let at=0;for(const b of blocks){a.set(b,at);at+=b.length;}
  const v=view(a),count=v.getUint32(0,true),base=8+count*24,res=new Map();
  for(let i=0;i<count;i++){const r=8+i*24,id=v.getUint32(r+4,true)-65536,kind=v.getUint32(r+8,true),offset=v.getUint32(r+12,true),size=v.getUint32(r+20,true);
    res.set(id,{kind,data:a.subarray(base+offset,base+offset+size+4)});}
  return res;
}

// The closing note of the Konec screen, a UTF-16 literal in .rdata.
function exitText(exe){const mark=new Uint8Array([...'Cílem projektu'].flatMap(c=>[c.charCodeAt(0),0]));
  outer:for(let i=0;i<exe.length-mark.length;i+=2){for(let k=0;k<mark.length;k++)if(exe[i+k]!==mark[k])continue outer;
    let e=i;while(exe[e]||exe[e+1])e+=2;return new TextDecoder('utf-16le').decode(exe.subarray(i-8,e));}
  throw new NotBulanci('V souboru chybí texty hry.');}

function basePalette(exe){const rva=0xaeb20,s=sections(exe).find(s=>s.va<=rva&&rva<s.va+Math.max(s.virtualSize,s.size));const at=s.raw+rva-s.va,p=new Uint8Array(768);
  for(let i=0;i<256;i++){p[i*3]=exe[at+i*4+2];p[i*3+1]=exe[at+i*4+1];p[i*3+2]=exe[at+i*4];}return p;}
function playerPalette(base,rgb){const p=base.slice(),set=(i,f)=>{for(let c=0;c<3;c++)p[i*3+c]=f(rgb[c]);};
  set(127,c=>c);for(let k=15,i=112;k>0;k--,i++)set(i,c=>c+Math.floor((255-c)*k/15));for(let k=1,i=128;k<=24;k++,i++)set(i,c=>c-Math.floor(c*k/24));return p;}

function decodeFull(d,size){const out=new Uint8Array(size),v=view(d);let i=0,o=0;
  while(i<d.length){let n=v.getInt8(i++);if(n>=0){if(n===0){n=v.getUint16(i,true);i+=2;}out.fill(d[i++],o,o+n+1);o+=n+1;}else{out.set(d.subarray(i,i-n),o);o-=n;i-=n;}}
  return out;}
function decodeDelta(d,previous){const out=previous.slice(),v=view(d);let i=0,dest=0;
  while(i<d.length){let skip=d[i++];if(skip===255){skip=v.getUint16(i,true);i+=2;}dest+=skip;let n=v.getInt8(i++);if(n===0)continue;if(n===-128){n=v.getInt16(i,true);i+=2;}
    if(n>=0){out.fill(d[i++],dest,dest+n+1);dest+=n+1;}else{out.set(d.subarray(i,i-n),dest);i-=n;dest-=n;}}
  return out;}
function decodePalette(d,palette){const p=palette.slice();let i=0,dest=0;
  while(i<d.length){dest+=d[i];const n=d[i+1]+1;i+=2;for(let k=0;k<n;k++,i+=3,dest++){p[dest*3]=d[i+2];p[dest*3+1]=d[i+1];p[dest*3+2]=d[i];}}
  return p;}

function decodeAnimation(data,base){
  const v=view(data),key=v.getUint32(16,true),w=v.getUint32(20,true),h=v.getUint32(24,true),count=v.getUint32(36,true);
  let pixels=new Uint8Array(w*h).fill(key<256?key:0),palette=base,alpha=null,pos=40;const frames=[];
  for(let f=0;f<count;f++){
    const length=v.getUint32(pos,true);let at=pos+5;
    for(let c=data[pos+4];c>0;c--){const size=v.getUint32(at,true),kind=data[at+4],p=data.subarray(at+5,at+size);
      if(kind===0)pixels=decodeFull(p,w*h);else if(kind===4)pixels=decodeDelta(p,pixels);else if(kind===9)palette=decodePalette(p,palette);else if(kind===14)alpha=decodeFull(p,w*h);else if(kind===15)alpha=decodeDelta(p,alpha);
      at+=size;}
    frames.push({pixels,palette,alpha});pos+=length;
  }
  return {w,h,key,frames};
}
function atlas({w,h,key,frames},palette) {
  const width=w*frames.length,rgba=new Uint8Array(width*h*4);
  frames.forEach(({pixels,palette:own,alpha},f)=>{const pal=palette??own;
    for(let y=0,i=0;y<h;y++){let o=(y*width+f*w)*4;for(let x=0;x<w;x++,i++,o+=4){const p=pixels[i];rgba[o]=pal[p*3];rgba[o+1]=pal[p*3+1];rgba[o+2]=pal[p*3+2];rgba[o+3]=p===key?0:alpha?alpha[i]:255;}}});
  return {width,height:h,rgba};
}
function decodeBitmap(d){
  const v=view(d),w=v.getUint32(4,true),h=v.getUint32(8,true),mode=v.getUint32(12,true),stride=v.getUint32(16,true),key=v.getUint32(20,true),rgba=new Uint8Array(w*h*4);
  if(mode===5){for(let y=0,o=0;y<h;y++)for(let x=0;x<w;x++,o+=4){const at=30+y*stride+x*3,b=d[at],g=d[at+1],r=d[at+2];rgba[o]=r;rgba[o+1]=g;rgba[o+2]=b;rgba[o+3]=((r<<16)|(g<<8)|b)===key?0:255;}return {width:w,height:h,rgba,mode};}
  const count=v.getUint32(25,true),off=30+count*4,bpp={3:8,2:4,1:2,0:1}[mode],per=8/bpp,mask=(1<<bpp)-1,alpha=d.length-off-stride*h?off+stride*h:0;
  for(let y=0,o=0;y<h;y++)for(let x=0;x<w;x++,o+=4){const b=d[off+y*stride+Math.floor(x/per)],p=(b>>(8-bpp*(x%per+1)))&mask,c=30+p*4;
    if(p<count){rgba[o]=d[c+2];rgba[o+1]=d[c+1];rgba[o+2]=d[c];}else{rgba[o]=255;rgba[o+2]=255;}
    rgba[o+3]=p===key?0:alpha?d[alpha+y*w+x]:255;}
  return {width:w,height:h,rgba,mode};
}

const CRC=new Int32Array(256).map((_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n;});
function chunk(type,data){const out=new Uint8Array(12+data.length),v=view(out);v.setUint32(0,data.length);for(let i=0;i<4;i++)out[4+i]=type.charCodeAt(i);out.set(data,8);
  let c=-1;for(let i=4;i<8+data.length;i++)c=CRC[(c^out[i])&255]^(c>>>8);v.setUint32(8+data.length,~c>>>0);return out;}
async function png({width,height,rgba}){
  const stride=width*4,raw=new Uint8Array((stride+1)*height);
  for(let y=0;y<height;y++)raw.set(rgba.subarray(y*stride,(y+1)*stride),y*(stride+1)+1);
  const head=new Uint8Array(13),v=view(head);v.setUint32(0,width);v.setUint32(4,height);head[8]=8;head[9]=6;
  const packed=new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
  return new Blob([new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',packed),chunk('IEND',new Uint8Array())],{type:'image/png'});
}
function wav(pcm,channels,bits,rate){const h=new Uint8Array(44),v=view(h),text=(at,s)=>{for(let i=0;i<4;i++)h[at+i]=s.charCodeAt(i);},block=channels*bits/8;
  text(0,'RIFF');v.setUint32(4,36+pcm.length,true);text(8,'WAVE');text(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,channels,true);v.setUint32(24,rate,true);v.setUint32(28,rate*block,true);v.setUint16(32,block,true);v.setUint16(34,bits,true);text(36,'data');v.setUint32(40,pcm.length,true);
  return new Blob([h,pcm],{type:'audio/wav'});}
const json=value=>({data:new Blob([JSON.stringify(value)],{type:'application/json'})});

function font(n,d){
  const v=view(d),w=v.getUint32(4,true),h=v.getUint32(8,true),mode=v.getUint32(12,true),stride=v.getUint32(16,true),count=v.getUint32(25,true),off=30+count*4,bpp={0:1,1:2}[mode],per=8/bpp,end=off+stride*h,rgba=new Uint8Array(w*h*4);
  for(let y=0,o=0;y<h;y++)for(let x=0;x<w;x++,o+=4){const p=(d[off+y*stride+Math.floor(x/per)]>>(8-bpp*(x%per+1)))&((1<<bpp)-1),c=30+p*4;rgba[o]=d[c+2];rgba[o+1]=d[c+1];rgba[o+2]=d[c];rgba[o+3]=p?255:0;}
  const decoder=new TextDecoder('windows-1250'),glyphs={};
  for(let code=0;code<256;code++){const at=end+8+code*5,gw=d[at+2],ch=decoder.decode(new Uint8Array([code]));if(!UNASSIGNED.has(code)&&(gw||code===0x20))glyphs[ch]=[v.getUint16(at,true),gw,d[at+3],d[at+4]];}
  return {image:{width:w,height:h,rgba},meta:{resource:n,width:w,height:h,line:v.getUint32(end,true),cell:v.getUint32(end+4,true),glyphs}};
}

// Historie pages: the page VM of docs/analysis, expression opcodes used by these pages only.
function decodePage(raw){
  const v=view(raw),size=v.getUint32(4,true),code=raw.subarray(16,16+size);let p=v.getUint32(16+size,true)+1;
  const c=view(code),u32=()=>{const x=c.getUint32(p,true);p+=4;return x;};
  const expr=()=>{const op=code[p++],n={};const e=expr;
    if(op===0x2d){n.name='label';n.args=[e(),e(),e(),e()];n.font=u32()-65536;}
    else if(op===0x2e){n.name='textbox';n.args=[e(),e(),e(),e(),e(),e()];n.font=u32()-65536;n.args.push(e());}
    else if(op===0x2f){n.name='bitmap';n.args=[e(),e()];n.resource=u32()-65536;}
    else if(op===0x30){n.name='colors';n.args=[e()];for(let k=code[p++];k>0;k--)n.args.push(e());}
    else if(op===0x31){n.name='pair';n.args=[e(),e()];}
    else if(op===0x32){n.name='set_byte';n.args=[e(),e()];}
    else if(op===0x33){n.name='insert';n.args=[e()];}
    else if(op===0x34){n.name='object';n.args=[e(),e()];n.resource=u32()-65536;n.args.push(e(),e());}
    else if(op===0){n.name='const';n.value=u32();}
    else if(op===27){n.name='string';const s=p;while(code[p]||code[p+1])p+=2;n.value=new TextDecoder('utf-16le').decode(code.subarray(s,p));p+=2;}
    else if(op===0x11){n.name='return';n.args=[e()];}
    else throw new NotBulanci('Neznámý zápis stránek Historie.');
    return n;};
  const value=n=>n.name==='const'?(n.value>=2**31?n.value-2**32:n.value):n.name==='string'?n.value:(()=>{throw Error(n.name);})();
  const element=n=>{const out={};for(;;){
      if(n.name==='insert')n=n.args[0];
      else if(n.name==='colors'){out.colors=n.args.slice(1).map(value);n=n.args[0];}
      else if(n.name==='set_byte'){out.byte=value(n.args[1]);n=n.args[0];}
      else if(n.name==='pair'){out.pair=value(n.args[1]);n=n.args[0];}
      else break;}
    out.kind=n.name;out.args=(n.args??[]).map(value);if('font'in n)out.font=n.font;if('resource'in n)out.resource=n.resource;return out;};
  const items=[];while(p<code.length){const n=expr();if(n.name==='return')break;items.push(element(n));}
  return items;
}

// canvas: {decode(jpegBytes)->ImageBitmap, surface(w,h)->OffscreenCanvas}
export async function* buildAssets(exe,manifest,canvas,progress=()=>{}) {
  const res=unpackArchive(exe),base=basePalette(exe);
  for(const n of [28,52,48,67])if(![...res.values()].some(r=>r.kind===n))throw new NotBulanci('V archivu chybí data hry.');
  const ofKind=k=>[...res].filter(([,r])=>r.kind===k).sort((a,b)=>a[0]-b[0]);
  const bitmaps=ofKind(28),animations=ofKind(52),total=bitmaps.length+animations.length+40;let done=0;const step=()=>progress(++done/total);

  for(const [n,{data}] of bitmaps){const blob=await png(decodeBitmap(data));yield {path:`original/ui/${n}.png`,data:blob};if(BITMAPS.has(n))yield {path:`original/${n}.png`,data:blob};step();}
  for(const [n,name] of Object.entries(JPEGS))yield {path:name,data:new Blob([res.get(+n).data.subarray(4)],{type:'image/jpeg'})};

  const title=await canvas.decode(res.get(314).data.subarray(4)),side=Math.min(title.width,title.height);
  for(const size of [180,512]){const c=canvas.surface(size,size),x=c.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(title,(title.width-side)/2|0,(title.height-side)/2|0,side,side,0,0,size,size);yield {path:`icon-${size}.png`,data:await c.convertToBlob({type:'image/png'})};}
  title.close();

  const wanted=new Map(),add=(n,name,rgb)=>{if(!wanted.has(n))wanted.set(n,[]);wanted.get(n).push([name,rgb]);};
  for(const n of manifest.player_color_variant_resources)for(const [name,rgb] of Object.entries(manifest.player_color_variants))add(n,name,rgb);
  for(const n of manifest.original_color_variant_resources)manifest.original_player_colors.forEach((rgb,i)=>add(n,'c'+i,rgb));
  for(const n of manifest.undead_variant.resources)add(n,'undead',manifest.undead_variant.rgb);
  for(const [n,{data}] of animations){
    const a=decodeAnimation(data,base);
    yield {path:`original/sprites/${n}-sheet.png`,data:await png(atlas(a))};
    yield {path:`original/sprites/${n}.png`,data:await png(atlas({...a,frames:a.frames.slice(0,1)}))};
    for(const [name,rgb] of wanted.get(n)??[])yield {path:`original/sprites/${n}-${name}-sheet.png`,data:await png(atlas(a,playerPalette(base,rgb)))};
    step();
  }
  yield {path:'original/sprites/base-palette.json',...json(Array.from({length:256},(_,i)=>[base[i*3],base[i*3+1],base[i*3+2]]))};

  for(const n of [174,175,176]){const f=font(n,res.get(n).data);yield {path:`original/fonts/${n}.png`,data:await png(f.image)};yield {path:`original/fonts/${n}.json`,...json(f.meta)};}
  const samples={};
  for(const [n,{data}] of ofKind(67)){const v=view(data),source=v.getUint16(4,true),count=v.getUint32(12,true),src=res.get(source).data,s=view(src),channels=s.getUint16(8,true),bits=s.getUint16(10,true),rate=s.getUint32(12,true),pcm=src.subarray(16);let pos=0;
    for(let i=0;i<count;i++){const length=v.getUint32(16+i*4,true),name=`${n}-${i}.wav`;yield {path:`original/audio/${name}`,data:wav(pcm.subarray(pos,pos+length),channels,bits,rate)};samples[name]={bank:n,source,sample:i,byte_offset:pos,bytes:length,seconds:length/(channels*bits/8*rate)};pos+=length;}}
  yield {path:'original/audio/manifest.json',...json(samples)};
  for(const [n,{data}] of ofKind(48))yield {path:`original/music/${n}.mp3`,data:new Blob([data.subarray(20)],{type:'audio/mpeg'})};
  const text=new TextDecoder('utf-16le');
  yield {path:'original/poems.json.part',...json(ofKind(2043).map(([resource,{data}])=>({resource,text:text.decode(data.subarray(8))})))};
  yield {path:'original/exit-text.json',...json({text:exitText(exe)})};
  yield {path:'original/history/pages.json',...json([307,308,309].map(resource=>({resource,items:decodePage(res.get(resource).data)})))};
  for(const film of FILMS){
    const d=res.get(film).data,v=view(d),w=v.getUint32(8,true),h=v.getUint32(12,true),count=v.getUint32(24,true),channels=v.getUint16(32,true),bits=v.getUint16(34,true),rate=v.getUint32(36,true);
    const c=canvas.surface(FILM_COLUMNS*w,Math.ceil(count/FILM_COLUMNS)*h),x=c.getContext('2d'),pcm=[];let pos=40,i=0;
    while(pos<d.length){const n=v.getUint32(pos,true),part=d.subarray(pos+4,pos+4+n);pos+=4+n;
      if(part[0]===0xff&&part[1]===0xd8){const f=await canvas.decode(part);x.drawImage(f,(i%FILM_COLUMNS)*w,Math.floor(i/FILM_COLUMNS)*h);f.close();i++;}else pcm.push(part);}
    const joined=new Uint8Array(await new Blob(pcm).arrayBuffer());
    yield {path:`original/history/${film}-frames.jpg`,data:await c.convertToBlob({type:'image/jpeg',quality:.9})};
    yield {path:`original/history/${film}.wav`,data:wav(joined,channels,bits,rate)};step();
  }
  progress(1);
}
