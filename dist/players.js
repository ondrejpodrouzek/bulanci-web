// Player profiles of the original (defaults 0x40a290, tables 0x4ae5ec / 0x4ae604 / 0x4ae60c /
// 0x4ae614) and the eight player colours (0x4aef24, the swatches of bitmap 19).
export const PLAYER_COLORS=[[8,141,0],[207,87,87],[156,113,87],[215,51,8],[179,169,0],[187,100,187],[123,123,192],[95,95,95]];
export const colorCss=i=>`rgb(${PLAYER_COLORS[i]??PLAYER_COLORS[0]})`;
// Four key sets, DirectInput scan codes in the order left, right, up, down, fire, weapon.
export const KEYSETS=[
  ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','KeyC'],          // 203 205 200 208 57 46
  ['KeyS','KeyF','KeyE','KeyD','KeyA','KeyQ'],                              // 31 33 18 32 30 16
  ['KeyJ','KeyL','KeyI','KeyK','KeyM','KeyN'],                              // 36 38 23 37 50 49
  ['Numpad4','Numpad6','Numpad8','Numpad5','Numpad0','Numpad1'],            // 75 77 72 76 82 79
];
// Texts of the original key names (table 0x104..0x12c) for the "Ovládání" dialog.
export const KEY_NAMES={ArrowLeft:'šipka vlevo',ArrowRight:'šipka vpravo',ArrowUp:'šipka nahoru',ArrowDown:'šipka dolů',Space:'mezerník',
  Numpad1:'Num 1',Numpad0:'Num 0',Numpad4:'Num 4',Numpad5:'Num 5',Numpad6:'Num 6',Numpad8:'Num 8'};
export const keyName=code=>KEY_NAMES[code]??code.replace(/^Key/,'');
// Profiles by the number of players on this computer: name, colour, key set.
export const PROFILES={
  1:[{name:'Bulík',colorIndex:0,keys:0}],
  2:[{name:'Bulík',colorIndex:0,keys:1},{name:'Uzlík',colorIndex:2,keys:3}],
  3:[{name:'Bulík',colorIndex:0,keys:1},{name:'Uzlík',colorIndex:2,keys:2},{name:'Mazlík',colorIndex:4,keys:3}],
};
export const defaultHumans=count=>PROFILES[Math.min(3,Math.max(1,count))].map(p=>({...p}));
