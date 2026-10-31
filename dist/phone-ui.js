// Phone interface (iPhone Safari / Brave and other touch browsers): the original 800x600 dialogs are
// too small for thumbs, so phones get their own menu, pause and result sheets. The game itself
// and the desktop screens are untouched. On a phone only the training fits one screen; network
// play and Historie still open the original dialogs, enlarged by the touch hit margin.
const PLAYER_KEY='bulanci.phone.player.v1';
const load=()=>{try{return JSON.parse(localStorage.getItem(PLAYER_KEY))||{};}catch{return {};}};
const save=v=>{try{localStorage.setItem(PLAYER_KEY,JSON.stringify(v));}catch{}};
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
const button=(cls,text,onClick)=>{const b=el('button',cls,text);b.type='button';b.onclick=onClick;return b;};
const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const iosBrowser=()=>/iPhone|iPad|iPod/.test(navigator.userAgent);

export function createPhoneMenu({root,colors,thumb,onPlay,onNetwork,onHistory,onBack}) {
  const player={name:'Bulík',colorIndex:0,...load()};
  let level='malaria',original=false,visible=true;
  const menu=el('section','phone-menu');menu.id='phone-menu';
  const head=el('header','phone-title');head.append(el('h1','','BULÁNCI'));
  const levels=el('div','phone-levels');levels.setAttribute('role','listbox');levels.setAttribute('aria-label','Level');
  const name=el('input','phone-name');Object.assign(name,{value:player.name,maxLength:16,autocomplete:'off',enterKeyHint:'done'});name.setAttribute('aria-label','Jméno hráče');
  const swatches=el('div','phone-colors');
  const play=button('phone-play','Načítám…',()=>{player.name=name.value.trim()||'Bulík';save(player);onPlay({level,human:{name:player.name,colorIndex:player.colorIndex,keys:0}});});play.disabled=true;
  const tools=el('nav','phone-tools');
  tools.append(button('', 'Hra po síti',()=>{setOriginal(true);onNetwork();}),button('','Historie',()=>{setOriginal(true);onHistory();}),button('','Zvuk',()=>sound()));
  const tip=el('p','phone-tip','Celá obrazovka: Sdílet → Přidat na plochu');tip.hidden=!iosBrowser()||standalone();
  const side=el('div','phone-side');const who=el('div','phone-who');who.append(name,swatches);side.append(who,play,tools,tip);
  menu.append(head,levels,side);
  const back=button('phone-back','‹ Zpět',()=>{setOriginal(false);onBack();});back.hidden=true;
  const sheet=el('section','phone-sheet');sheet.hidden=true;
  root.append(menu,back,sheet);
  const paint=()=>{for(const b of swatches.children)b.setAttribute('aria-pressed',String(+b.dataset.color===player.colorIndex));for(const b of levels.children)b.setAttribute('aria-selected',String(b.dataset.level===level));};
  colors.forEach((c,i)=>{const b=button('phone-swatch','',()=>{player.colorIndex=i;paint();});b.dataset.color=i;b.style.background=c;b.setAttribute('aria-label',`Barva ${i+1}`);swatches.append(b);});
  function refresh(){menu.hidden=!visible||original;back.hidden=!visible||!original;}
  function setOriginal(on){original=on;refresh();}
  function setVisible(on){visible=on;if(!on)original=false;refresh();}
  function setMaps(entries){
    levels.replaceChildren(...entries.map(({key,name:title,map})=>{const b=button('phone-level','',()=>{level=key;paint();});b.dataset.level=key;b.setAttribute('role','option');const im=el('img');im.src=thumb(map);im.alt='';im.loading='lazy';b.append(im,el('span','',title));return b;}));
    paint();play.disabled=false;play.textContent='Hrát trénink';
  }
  // One sheet at a time; resolves with the id of the action that closed it.
  function open(title,build) {
    return new Promise(resolve=>{
      const box=el('div','phone-sheet-box');box.append(el('h2','',title));
      build(box,value=>{sheet.hidden=true;sheet.replaceChildren();resolve(value);});
      sheet.replaceChildren(box);sheet.hidden=false;
    });
  }
  function soundRows(box) {
    const audio=globalThis.bulanciAudio;if(!audio)return;
    const on=el('label','phone-row');const check=el('input');check.type='checkbox';check.checked=!!audio.settings.enabled;
    check.onchange=()=>{audio.configure({enabled:check.checked});audio.unlock?.();};on.append(el('span','','Zvuk'),check);box.append(on);
    for(const [key,label] of [['music','Hudba'],['effects','Efekty']]){
      const row=el('label','phone-row'),range=el('input');Object.assign(range,{type:'range',min:0,max:1,step:.05,value:audio.settings[key]});
      range.oninput=()=>audio.configure({[key]:+range.value});row.append(el('span','',label),range);box.append(row);
    }
  }
  const sound=()=>open('Zvuk',(box,close)=>{soundRows(box);box.append(button('phone-primary','Hotovo',()=>close()));});
  const pause=({network=false}={})=>open(network?'Síťová hra':'Pozastaveno',(box,close)=>{
    box.append(button('phone-primary','Pokračovat',()=>close('resume')));soundRows(box);
    box.append(button('phone-danger',network?'Odejít ze hry':'Konec hry',()=>close('end')));
  });
  // Result table of the round: the same order as the original Statistika, highest score first.
  const score=game=>open('Statistika',(box,close)=>{
    const list=el('ol','phone-score');
    for(const p of [...game.players].sort((a,b)=>b.score-a.score)){const row=el('li');const dot=el('i');dot.style.background=p.color;row.append(dot,el('span','',p.name),el('b','',String(p.score)));list.append(row);}
    box.append(list,button('phone-primary','Zpět do menu',()=>close()));
  });
  const notice=text=>open(text,(box,close)=>box.append(button('phone-primary','Ok',()=>close())));
  refresh();
  return {setMaps,setVisible,pause,score,notice,home:()=>setOriginal(false)};
}
