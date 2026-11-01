// CPanel (0x4280f0): the bar at the bottom of the game, one panel per human player at X from
// table 0x4af924. All positions are relative to bar 117 at y = 495.
//   name         CStaticText font 175, style 5, (X+4,9)-(X+92,22)
//   frame        bitmap 128 at (X+5,40)
//   portrait     CBulPicture (X+6,41): bitmap 29 through the player's palette
//   ammo strip   CShotCounter (X+6,84), background 166
//   weapon icon  column 4 of table 0x482820 at (X+59,57)
//   score        CNumCounter (X+59,41): three rolling digits
//   time         font 174, style 5, rectangle (358,45)-(444,95), palette 0x4b39ec
export const PANEL_X=[12,149,556,693],BAR_Y=495;
export const WEAPON_ICON=[172,169,170,171,168,167];
// Column 5 of the same table: the mark of one round; 0 means the plain bar 165 (0x426ff4).
export const WEAPON_PIP=[108,160,163,0,162,161];
export const WEAPON_CAPACITY=[5,4,4,1,4,2]; // 0x481a60
const STRIP=166,RELOAD_BAR=124,NO_PIPS=165,SHOTGUN_MARK=169,FRAME=128,DIGITS=118,DIGIT_FRAME=33;
const DIGIT_W=9,DIGIT_H=13,DIGIT_STRIP=130,DIGIT_GAP=2,ROLL_MS=100;

// 0x426f0f: the rounds spread evenly over the strip, half a gap from its left edge.
export function pipPositions(stripW,pipW,count) {
  const gap=(stripW-pipW*count)/count,first=Math.trunc(gap*.5+.5);
  return Array.from({length:count},(_,i)=>first+Math.trunc(i*gap+.5)+pipW*i);
}
// 0x427100: values wrap at 1000, the sign shows as a red tint, one digit is DIGIT_H rows.
export function digitRows(value) {
  const v=Math.abs(value)%1000;
  return [Math.floor(v/100),Math.floor(v/10)%10,v%10].map(d=>d*DIGIT_H);
}
// 0x427020: one row per tick on each digit, forwards when the size grew, backwards otherwise.
export function rollDigit(row,target,up) {
  if(row===target)return row;
  const next=up?row+1:row-1;
  return next>=DIGIT_STRIP?0:next<0?DIGIT_STRIP-1:next;
}

export function createHud({image,drawText}) {
  const state=new Map();let current=null;
  const put=(ctx,n,x,y)=>{const im=image(`assets/original/ui/${n}.png`);if(im.complete&&im.naturalWidth)ctx.drawImage(im,x,y);return im;};
  function counter(p,now) {
    let s=state.get(p.id);
    if(!s){s={value:p.score,rows:digitRows(p.score),up:true,at:now};state.set(p.id,s);}
    if(s.value!==p.score){s.up=Math.abs(p.score)>Math.abs(s.value);s.value=p.score;}
    const target=digitRows(p.score);
    for(;s.at+ROLL_MS<=now;s.at+=ROLL_MS){if(now-s.at>2000){s.rows=target;s.at=now;break;}s.rows=s.rows.map((r,i)=>rollDigit(r,target[i],s.up));}
    return s;
  }
  function score(ctx,p,x,y,now) {
    const s=counter(p,now),strip=image(`assets/original/ui/${DIGITS}.png`);
    s.rows.forEach((row,i)=>{
      const dx=x+i*(DIGIT_W+DIGIT_GAP);
      if(strip.complete&&strip.naturalWidth){
        const part=Math.min(DIGIT_H,DIGIT_STRIP-row);
        ctx.drawImage(strip,0,row,DIGIT_W,part,dx,y,DIGIT_W,part);
        if(part<DIGIT_H)ctx.drawImage(strip,0,0,DIGIT_W,DIGIT_H-part,dx,y+part,DIGIT_W,DIGIT_H-part);
      }
      if(p.score<0){ctx.save();ctx.globalCompositeOperation='lighter';ctx.fillStyle='rgb(175,0,0)';ctx.fillRect(dx,y,DIGIT_W,DIGIT_H);ctx.restore();}
      put(ctx,DIGIT_FRAME,dx,y);
    });
  }
  function ammo(ctx,p,x,y,reloadTime) {
    const strip=put(ctx,STRIP,x,y),w=p.weapon;
    if(w===0&&p.ammo[0]<=0) { // 0x427ce2: an empty pistol shows the reload bar
      const bar=image(`assets/original/ui/${RELOAD_BAR}.png`);
      if(bar.complete&&bar.naturalWidth){const ticks=Math.floor(Math.max(0,1-(p.reloading??0)/reloadTime)*16),width=Math.floor(ticks*bar.naturalWidth/15);if(width>0)ctx.drawImage(bar,0,0,width,bar.naturalHeight,x+1,y+1,width,bar.naturalHeight);}
      return;
    }
    if(!WEAPON_PIP[w]){if(p.ammo[w]>0)put(ctx,NO_PIPS,x,y);return;}
    const pip=image(`assets/original/ui/${WEAPON_PIP[w]}.png`);
    if(!pip.complete||!pip.naturalWidth||!strip.naturalWidth)return;
    pipPositions(strip.naturalWidth,pip.naturalWidth,WEAPON_CAPACITY[w]).slice(0,p.ammo[w]).forEach(dx=>ctx.drawImage(pip,x+dx,y+1));
  }
  function panel(ctx,game,p,i,now) {
    const X=PANEL_X[i];
    drawText(ctx,175,p.name,{x:X+4,y:BAR_Y+9,w:88,h:13},{flags:5,spacing:1,alpha:0x90/255});
    put(ctx,FRAME,X+5,BAR_Y+40);
    const face=image(`assets/original/ui/29-c${p.colorIndex??0}.png`);
    if(face.complete&&face.naturalWidth)ctx.drawImage(face,X+6,BAR_Y+41);
    if(p.shotgunToken)put(ctx,SHOTGUN_MARK,X+35,BAR_Y+60);
    ammo(ctx,p,X+6,BAR_Y+84,game.reloadTime?.()??.5);
    put(ctx,WEAPON_ICON[p.weapon],X+59,BAR_Y+57);
    score(ctx,p,X+59,BAR_Y+41,now);
  }
  return {
    draw(ctx,game,seconds,now) {
      if(game!==current){current=game;state.clear();}
      if(Number.isFinite(seconds))drawText(ctx,174,String(seconds),{x:358,y:BAR_Y+45,w:86,h:50},{flags:5,spacing:1,color:'#909090'});
      if(game)game.players.filter(p=>!p.bot).forEach((p,i)=>{if(i<PANEL_X.length)panel(ctx,game,p,i,now);});
    },
  };
}
