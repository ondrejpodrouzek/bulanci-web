// Statistics after a round: CScore (constructor 0x411010), a full-screen window 800x600 shown
// modally by 0x401c66 when the game view ends; Esc or Enter closes it (0x40abe0 -> 0x8003).
// Background 164; the players stand on podiums by place, each with Zabil / Mrtev and how many
// times they killed whom. Alone (training) the screen adds the level's record table.
// Every text here is drawn at full opacity (+0x94 = 1), table rows only when highlighted.
import {StaticText,Picture,Bulanek,Window} from './widgets.js';
import {finalScore} from '../rules.js';

const X=[0x88,0x117,0x1a7,0x237];              // slot x (0x4ae788)
const Y=[0xf0,0x10e,0x12c,0x14a];              // bulánek y by place (0x4ae798)
const PODIUM=[[150],[151,152],[153,154,155],[156,157,158,159]]; // [slot][place] (0x4ae708)
const BULANEK=[180,184,188,192];               // four directions each, by place (0x4ae748)
const COLUMNS=[[3,49],[57,150],[158,217],[222,281],[286,345]]; // record table (0x4aeab0) + 330
const HEADERS=['Pořadí','Jméno','Zabil','Mrtev','Rozdíl']; // texts 0x64, 0x66..0x69 (Level unused)
// Records of an empty level (0x409620): names 0x4ae6b8, kills 0x480504, deaths 0x4804ec.
const DEFAULT_RECORDS=[['Žezlík',30],['Kapslík',25],['Čmelík',20],['Uhlík',15],['Terčík',10],['Cvalík',5]].map(([name,kills])=>({name,kills,deaths:10}));
const RECORDS_KEY='bulanci.records';

// CRT qsort (0x4483b0) sorts up to 8 items with shortsort (0x448320): take the first maximum,
// swap it to the end, shrink. Not stable; ties land exactly as in the original.
export function shortsort(list,compare) {
  const a=[...list];
  for(let hi=a.length-1;hi>0;hi--){let max=0;for(let p=1;p<=hi;p++)if(compare(a[p],a[max])>0)max=p;[a[max],a[hi]]=[a[hi],a[max]];}
  return a;
}
const diff=r=>r.kills-r.deaths;
// Insert a training result (0x414280 -> 0x409b10): append, sort by kills - deaths (0x408fd0),
// keep six. Returns the stored entry, or null when it fell off the table.
export function addRecord(records,entry) {
  const sorted=shortsort([...records,entry],(a,b)=>diff(b)-diff(a)).slice(0,6);
  return {records:sorted,entry:sorted.includes(entry)?entry:null};
}
function loadRecords(level) {
  try{const all=JSON.parse(localStorage.getItem(RECORDS_KEY)??'{}');if(Array.isArray(all[level]))return all[level];}catch{}
  return DEFAULT_RECORDS.map(r=>({...r}));
}
function saveRecords(level,records) {
  try{const all=JSON.parse(localStorage.getItem(RECORDS_KEY)??'{}');all[level]=records;localStorage.setItem(RECORDS_KEY,JSON.stringify(all));}catch{}
}
const text=(props)=>new StaticText({font:175,spacing:1,flags:5,bright:true,...props});

// `game`: the finished round; `level`: key of its record table.
export function scoreScreen({game,level,manifest,random=Math.random}) {
  const humans=game.players.filter(p=>!p.bot&&!p.npc);
  const order=shortsort(humans,(a,b)=>finalScore(game.rules,b)-finalScore(game.rules,a)); // 0x40abd0
  let record=null,records=null;
  if(humans.length===1){
    const p=humans[0];({records,entry:record}=addRecord(loadRecords(level),{name:p.name,kills:p.kills??0,deaths:p.deaths??0}));
    saveRecords(level,records);
  }
  const widgets=[new Picture({image:164,x:0,y:0})];
  let place=0;
  order.forEach((p,i)=>{
    const x=X[i];
    widgets.push(new Picture({image:PODIUM[i][place],x,y:229}));
    // Alone and off the record table, the bulánek is the saddest one (0x4112d9).
    const look=humans.length===1&&!record?3:place;
    widgets.push(new Bulanek({x:x+0x21,y:Y[place],resource:BULANEK[look]+Math.trunc(random()*4),colorIndex:p.colorIndex,manifest}));
    widgets.push(text({x,y:Y[place]-0x1c,w:118,h:0x12,text:p.name}));
    widgets.push(text({x,y:0x1e5,w:118,h:0xf,text:`Mrtev: ${p.deaths??0}x`}));
    widgets.push(text({x,y:0x1d7,w:118,h:0xf,text:`Zabil: ${p.kills??0}x`}));
    // Whom they killed: glyph 0x1f in the victim's colour (grey 0x5f5f5f as 0x2f2f2f), count.
    let y=0x1c4;
    for(let j=0;j<4;j++){
      const n=p.victims?.[j]??0;if(n<=0)continue;
      const victim=game.players.find(q=>q.id===j);
      const color=victim?.colorIndex===7?'#2f2f2f':victim?.color??'#fff';
      widgets.push(text({x:x-15,y,w:118,h:0x12,text:'\u001f',color}));
      widgets.push(text({x:x+5,y,w:118,h:0x12,text:String(n)}));
      y-=14;
    }
    if(i+1<order.length&&finalScore(game.rules,order[i+1])<finalScore(game.rules,p))place++;
  });
  if(records){
    widgets.push(new Picture({image:149,x:330,y:190,alpha:0x80/255}));
    const cell=(c,y,t,{bright=true,centred=true}={})=>text({x:COLUMNS[c][0]+330,y,w:COLUMNS[c][1]-COLUMNS[c][0],h:23,text:t,bright,flags:centred?5:4});
    HEADERS.forEach((h,c)=>widgets.push(cell(c,0xbf,h)));
    // Rank grows when kills - deaths changes; the first row equal to the result lights up (0x409080).
    let rank=1,lit=!record;
    records.forEach((r,k)=>{
      const y=0xbf+26*(k+1),bright=!lit&&r.name===record.name&&r.kills===record.kills&&r.deaths===record.deaths;
      if(bright)lit=true;
      [String(rank),r.name,String(r.kills),String(r.deaths),String(diff(r))].forEach((t,c)=>widgets.push(cell(c,y,t,{bright,centred:c!==1})));
      if(k+1<records.length&&diff(records[k+1])!==diff(r))rank++;
    });
  }
  widgets.push(new Bulanek({x:0x78,y:0x32,resource:303,colorIndex:null,once:true,manifest}));
  const win=new Window({w:800,h:600,x:0,y:0,widgets});
  win.key=e=>{if(e.code==='Escape'||e.code==='Enter'||e.code==='NumpadEnter'){win.onOk();return true;}return false;};
  win.onOk=()=>true;
  win.pointerDown=()=>win.onOk(); // web: a click or tap also closes it (phones have no Enter)
  win.pointerUp=()=>{};
  return win;
}
