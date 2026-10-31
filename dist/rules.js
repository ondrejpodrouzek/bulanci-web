// Original game types, recovered from the supplied EXE (evidence in reconstruction.md, "Typy hry").
// Session settings live at rules+0x19c (type) and +0x19e+type*4 (limit); per-player records
// (stride 0x23 from +0xe2) hold kills (+0xe6), deaths (+0xfa) and elimination order (+0xfe).
export const GAME_TYPES=['hits','time','lives']; // index = original type byte (0x87 / 0x19c)
// Defaults when no settings are stored (0x40a290); dialog ranges from CGameTypeDlg (0x40dc82..).
export const RULE_DEFAULTS={hits:30,time:180,lives:30};
export const RULE_RANGES={hits:[5,999],time:[10,9999],lives:[5,999]};
// One human player (config+0xd8 == 1) forces "na čas" for 150 s (0x4136df).
export const TRAINING_RULES={type:'time',limit:150};

const human=p=>!p.bot&&!p.npc;
export function resolveRules({mode,gameType='time',limit}={}) {
  if(mode==='training')return {...TRAINING_RULES};
  const type=GAME_TYPES.includes(gameType)?gameType:'time',[lo,hi]=RULE_RANGES[type];
  const value=Number.isFinite(Number(limit))?Math.round(Number(limit)):RULE_DEFAULTS[type];
  return {type,limit:Math.min(hi,Math.max(lo,value))};
}
// HUD value per player (0x412680): hits -> kills, time -> kills - deaths, lives -> lives left.
export function scoreOf(rules,p) {
  if(rules.type==='hits')return p.kills??0;
  if(rules.type==='time')return (p.kills??0)-(p.deaths??0);
  return rules.limit-(p.deaths??0);
}
export const eliminated=(rules,p)=>rules.type==='lives'&&(p.deaths??0)>=rules.limit; // 0x4125b0
export function refreshScores(game){for(const p of game.players)p.score=scoreOf(game.rules,p);}

// A kill credited to `owner` (0x420dd6 -> 0x4180e0): on "na zásahy" the round ends when the
// leading human reaches the limit.
export function afterKill(game,owner) {
  refreshScores(game);
  if(game.rules.type!=='hits'||!owner||!human(owner))return;
  const humans=game.players.filter(human),best=Math.max(...humans.map(p=>p.kills??0));
  if(owner.kills===best&&owner.kills>=game.rules.limit)game.finish();
}
// A death (0x41f350 -> 0x4128a0): on "na životy" the victim may be out (no respawn, 0x417abd);
// the round ends once at most one human is left.
export function afterDeath(game,victim) {
  refreshScores(game);
  if(game.rules.type!=='lives')return;
  if(eliminated(game.rules,victim)&&victim.outOrder==null)victim.outOrder=game.outCount=(game.outCount??0)+1;
  const humans=game.players.filter(human);
  if(humans.filter(p=>eliminated(game.rules,p)).length+1>=humans.length)game.finish();
}
// Final score (0x4126e0): the HUD value; on "na životy" a player with no lives left gets
// elimination order (+0xfe) - 4, so who went out later ranks higher.
export function finalScore(rules,p) {
  const s=scoreOf(rules,p);
  return rules.type==='lives'&&s<=0?(p.outOrder??0)-4:s;
}
export function ranking(game) {
  return [...game.players].sort((a,b)=>finalScore(game.rules,b)-finalScore(game.rules,a));
}
