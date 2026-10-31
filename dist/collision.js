/** Geometry shared by actors and projectiles. All coordinates are game pixels. */
export const WORLD_WIDTH = 800, WORLD_HEIGHT = 515;
export const BODY_WIDTH = 55, BODY_HEIGHT = 62;
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export function playerRect(x, y) {
  // Original body-local bounds [2,25,53,62], translated from the sprite origin.
  return {x:x-BODY_WIDTH/2+2, y:y-BODY_HEIGHT+12+25, w:BODY_WIDTH-4, h:BODY_HEIGHT-25};
}
export function rectsOverlap(a,b) {
  return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
}
export function pointInRect(x,y,r) { return x>=r.x && x<r.x+r.w && y>=r.y && y<r.y+r.h; }
export function circleRect(x,y,r,o) {
  return (x-clamp(x,o.x,o.x+o.w))**2+(y-clamp(y,o.y,o.y+o.h))**2<r*r;
}
export const blocksActors = o => o.active !== false && o.solidForPlayers !== false;
export const blocksShots = o => o.active !== false && o.solidForProjectiles !== false;

/** First segment contact with a rectangle, including subpixel-thin obstacles. */
export function segmentRectTime(ax,ay,bx,by,rectangle,padding=0) {
  let enter=0,leave=1;
  const dx=bx-ax,dy=by-ay;
  for(const [origin,delta,min,max] of [
    [ax,dx,rectangle.x-padding,rectangle.x+rectangle.w+padding],
    [ay,dy,rectangle.y-padding,rectangle.y+rectangle.h+padding]
  ]) {
    if(Math.abs(delta)<1e-12) { if(origin<=min || origin>=max)return null;continue; }
    let t0=(min-origin)/delta,t1=(max-origin)/delta;
    if(t0>t1)[t0,t1]=[t1,t0];
    enter=Math.max(enter,t0);leave=Math.min(leave,t1);
    if(enter>=leave)return null;
  }
  // Native rectangle intersections are strict: edge-only or corner-only
  // contact is not a hit, including a step ending exactly at the edge.
  return enter>=0 && enter<1 && leave>0 ? enter : null;
}

/** Move a body exactly to contact rather than rejecting its whole last step. */
export function clipActorAxis(rectangle,delta,axis,obstacles) {
  let allowed=delta;
  if(!delta)return 0;
  const primary=axis==='x'?'x':'y',size=axis==='x'?'w':'h';
  const cross=axis==='x'?'y':'x',crossSize=axis==='x'?'h':'w';
  const edge=rectangle[primary],far=edge+rectangle[size];
  const worldSize=axis==='x'?WORLD_WIDTH:WORLD_HEIGHT;
  allowed=delta>0?Math.min(allowed,worldSize-far):Math.max(allowed,-edge);
  for(const o of obstacles) {
    if(rectangle[cross]>=o[cross]+o[crossSize] || rectangle[cross]+rectangle[crossSize]<=o[cross])continue;
    if(delta>0 && far<=o[primary]+1e-9)allowed=Math.min(allowed,Math.max(0,o[primary]-far));
    else if(delta<0 && edge>=o[primary]+o[size]-1e-9)allowed=Math.max(allowed,Math.min(0,o[primary]+o[size]-edge));
    else if(rectsOverlap(rectangle,o)) {
      // A loaded/teleported overlapping body may retreat out of the overlap.
      const center=edge+rectangle[size]/2,otherCenter=o[primary]+o[size]/2;
      if((delta>0 && center<otherCenter)||(delta<0 && center>otherCenter))allowed=0;
    }
  }
  return allowed;
}

export function canPlaceActor(x,y,obstacles,actors=[],ignore=null) {
  const r=playerRect(x,y);
  if(r.x<0||r.y<0||r.x+r.w>WORLD_WIDTH||r.y+r.h>WORLD_HEIGHT)return false;
  if(obstacles.some(o=>blocksActors(o)&&rectsOverlap(r,o)))return false;
  return !actors.some(a=>a!==ignore && a.spawned!==false && a.x!==undefined && rectsOverlap(r,playerRect(a.x,a.y)));
}
