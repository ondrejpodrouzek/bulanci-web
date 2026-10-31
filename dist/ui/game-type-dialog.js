// CGameTypeDlg (constructor 0x40d930): window 320x218, coordinates and texts from the EXE.
// The three limit labels and fields share one position; only the selected type's pair shows.
import {StaticText,Radio,NumEdit,Button,Window} from './widgets.js';
import {GAME_TYPES,RULE_RANGES} from '../rules.js';

const LIMIT_TEXT=['Počet zásahů k výhře:','Délka hry ve vteřinách:','Počet životů:']; // table 0xf4, 0xf8, 0x178
const DIGITS=[3,4,3];
// Summary line of the start screen (table 0xdc, 0xe0, 0x17c area: indices 55, 56, 95).
export const RULE_SUMMARY={hits:n=>`Kdo ${n}-krát zasáhne soupeře, vyhrál.`,time:n=>`Hra končí po ${n} vteřinách.`,lives:n=>`Kdo bude ${n}-krát zabit, skončil.`};

export function gameTypeDialog({type,limits,weapons}) {
  const typeIndex=GAME_TYPES.indexOf(type);
  const fields=GAME_TYPES.map((t,i)=>{
    const [min,max]=RULE_RANGES[t];
    return {label:new StaticText({x:20,y:118,text:LIMIT_TEXT[i],font:174,spacing:1}),
      edit:new NumEdit({x:230,y:115,w:58,digits:DIGITS[i],min,max,value:limits[t]})};
  });
  const show=i=>fields.forEach((f,k)=>{f.label.visible=f.edit.visible=k===i;});
  const types=new Radio({x:40,y:45,w:110,items:['na zásahy','na čas','na životy'],selected:typeIndex,onChange:show});
  const mode=new Radio({x:175,y:45,w:140,items:['pouze brokovnice','všechny zbraně'],selected:weapons==='shotgun'?0:1});
  const win=new Window({w:320,h:218,widgets:[
    new StaticText({x:20,y:20,text:'Typ hry:',font:174,spacing:2}),types,
    new StaticText({x:155,y:20,text:'Mód zbraní:',font:174,spacing:2}),mode,
    ...fields.flatMap(f=>[f.label,f.edit]),
    new Button({x:55,y:168,text:'Ok',onClick:()=>win.onOk()}),
    new Button({x:180,y:168,text:'Zrušit',onClick:()=>win.onCancel()}),
  ]});
  show(typeIndex);
  win.onOk=()=>{fields.forEach(f=>f.edit.commit());return {type:GAME_TYPES[types.selected],weapons:mode.selected===0?'shotgun':'classic',
    limits:Object.fromEntries(GAME_TYPES.map((t,i)=>[t,fields[i].edit.value]))};};
  win.onCancel=()=>null;
  return win;
}
