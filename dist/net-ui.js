// Network play screens: the list of games and the room. One responsive page, designed for a phone
// first: thumbs, a short code to read out, a link to send. The desktop gets the same screens
// inside the game frame. Nothing here talks to the network; app.js feeds the state in.
const NAME_MAX=16;
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
const button=(cls,text,onClick)=>{const b=el('button',cls,text);b.type='button';b.onclick=onClick;return b;};

export function inviteLink(code){const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('hra',code);return url.href;}

export function createNetUI({root,phone,colors,levels,sprite,keyHint,ruleRanges}) {
  const screen=el('section','net-screen');screen.id='net-screen';screen.hidden=true;screen.tabIndex=-1;screen.setAttribute('aria-label','Hra po síti');
  root.append(screen);
  let view=null,back=null,lobbyEls=null,lastSeats='',lastLevels='',lastChat=-1;
  screen.addEventListener('keydown',e=>{if(e.code==='Escape'&&!(e.target instanceof HTMLInputElement)){e.stopPropagation();back?.();}e.stopPropagation();});
  // The virtual keyboard shrinks the visual viewport; the footer and the chat stay above it.
  const fitKeyboard=()=>{if(phone&&globalThis.visualViewport)screen.style.height=`${visualViewport.height}px`;};
  globalThis.visualViewport?.addEventListener('resize',fitKeyboard);

  function bulanek(colorIndex,seat) {
    const box=el('div','net-portrait'),s=sprite(colorIndex,seat);
    if(s){const b=el('i','net-bulanek');b.style.cssText=`width:${s.w}px;height:${s.h}px;background-image:url(${s.url});--sheet:-${s.w*s.frames}px;animation-duration:${s.ms}ms;animation-timing-function:steps(${s.frames})`;box.append(b);}
    return box;
  }
  function swatches(selected,taken,onPick) {
    const row=el('div','net-swatches');row.setAttribute('role','radiogroup');row.setAttribute('aria-label','Barva');
    colors.forEach((c,i)=>{const b=button('net-swatch','',()=>onPick(i));b.style.background=c;b.disabled=taken.has(i);b.setAttribute('aria-label',`Barva ${i+1}`);b.setAttribute('aria-pressed',String(i===selected));row.append(b);});
    return row;
  }
  function nameInput(value,onChange) {
    const input=el('input','net-name');Object.assign(input,{value,maxLength:NAME_MAX,autocomplete:'off',enterKeyHint:'done',spellcheck:false});input.setAttribute('aria-label','Jméno');
    input.onchange=()=>{const t=input.value.trim();if(t)onChange(t);else input.value=value;};
    input.onkeydown=e=>{if(e.code==='Enter')input.blur();};
    return input;
  }

  // ---- list of games ---------------------------------------------------------------------
  let hub=null;
  function showHub(state) {
    view='hub';hub=state;back=state.onBack;lobbyEls=null;lastSeats=lastLevels='';lastChat=-1;
    const h=state.humans[0],top=el('header','net-top');
    top.append(button('net-back','‹ Zpět',state.onBack),el('h1','','Hra po síti'));
    const me=el('div','net-me'),holder=el('div','net-me-portrait');
    const paintMe=()=>{holder.replaceChildren(bulanek(h.colorIndex,0));pick.replaceWith(pick=swatches(h.colorIndex,new Set(),i=>{h.colorIndex=i;state.onHumans();paintMe();}));};
    let pick=el('div');const fields=el('div','net-me-fields');
    fields.append(nameInput(h.name,t=>{h.name=t;state.onHumans();}),pick);me.append(holder,fields);paintMe();
    const create=button('net-primary','Založit hru',()=>{create.disabled=true;state.onCreate();});create.disabled=true;
    const form=el('form','net-code');const code=el('input','net-code-input');
    Object.assign(code,{maxLength:4,placeholder:'Kód',autocomplete:'off',autocapitalize:'characters',spellcheck:false,enterKeyHint:'go'});code.setAttribute('aria-label','Kód hry');
    code.oninput=()=>{code.value=code.value.toUpperCase();go.disabled=code.value.trim().length<4;};
    const go=el('button','net-secondary','Připojit se');go.type='submit';go.disabled=true;form.append(code,go);
    form.onsubmit=e=>{e.preventDefault();code.blur();state.onJoin(code.value);};
    const actions=el('div','net-actions');actions.append(create,form);
    const note=el('p','net-notice');note.hidden=!state.notice;note.textContent=state.notice??'';note.setAttribute('role','alert');
    const games=el('div','net-games');games.append(el('p','net-empty','Připojuji se k serveru…'));
    const body=el('div','net-scroll net-hub');body.append(me,note,actions,el('h2','','Čekající hry'),games);
    hub.els={note,games,create,go};
    screen.replaceChildren(top,body);open();
  }
  function setGames(list) {
    if(view!=='hub')return;const {games}=hub.els;
    if(!list.length){games.replaceChildren(el('p','net-empty','Zatím tu žádná hra nečeká. Založte ji a pošlete kamarádům odkaz.'));return;}
    games.replaceChildren(...list.map(g=>{
      const row=el('div','net-game'),text=el('div'),full=g.players>=g.total;
      text.append(el('b','',g.name),el('small','',[g.level,g.playing?'právě se hraje':g.rule].filter(Boolean).join('. ')));
      row.append(text,el('span','net-count',`${g.players}/${g.total}`),full?el('span','net-full','Plno'):button('net-secondary','Připojit se',()=>hub.onJoin(g.id)));
      return row;
    }));
  }
  function setOnline(){if(view==='hub')hub.els.create.disabled=false;}
  function setOffline() {
    if(view!=='hub')return;
    hub.els.games.replaceChildren(el('p','net-empty','Herní server neodpovídá. Na ukázce bez serveru hra po síti nejde, jinde zkontrolujte připojení.'),button('net-secondary','Zkusit znovu',hub.onRetry));
  }
  function notice(text) {
    if(view==='hub'){hub.els.note.textContent=text;hub.els.note.hidden=false;hub.els.create.disabled=false;}
    else if(lobbyEls){lobbyEls.note.textContent=text;lobbyEls.note.hidden=false;setTimeout(()=>{if(lobbyEls)lobbyEls.note.hidden=true;},4000);}
  }

  // ---- room ------------------------------------------------------------------------------
  async function share(link,b) {
    const done=text=>{b.textContent=text;setTimeout(()=>{b.textContent='Pozvat kamarády';},2000);};
    if(phone&&navigator.share){try{await navigator.share({title:'Bulánci',text:'Pojď si zahrát Bulánky',url:link});}catch{}return;}
    try{await navigator.clipboard.writeText(link);done('Odkaz zkopírován');}catch{prompt('Zkopírujte odkaz:',link);}
  }
  function buildLobby(s) {
    back=()=>s.onLeave();
    const top=el('header','net-top net-room-top'),leave=button('net-back',s.role==='host'?'‹ Ukončit':'‹ Odejít',()=>back());
    const codeBox=el('div','net-room-code');codeBox.append(el('span','','Kód hry'),el('strong','',s.code));
    const invite=button('net-secondary net-invite','Pozvat kamarády',()=>share(lobbyEls.link,invite));
    top.append(leave,codeBox,invite);
    const seats=el('div','net-seats'),note=el('p','net-notice');note.hidden=true;note.setAttribute('role','alert');
    const setup=el('section','net-setup'),levelBox=el('div','net-levels'),rules=el('div','net-rules');
    setup.append(el('h2','','Level'),levelBox,el('h2','','Pravidla'),rules);
    const chat=el('section','net-chat'),lines=el('div','net-lines');lines.setAttribute('aria-live','polite');
    const form=el('form','net-say'),say=el('input');Object.assign(say,{maxLength:120,placeholder:'Napište zprávu',autocomplete:'off',enterKeyHint:'send'});say.setAttribute('aria-label','Zpráva');
    form.append(say);form.onsubmit=e=>{e.preventDefault();const t=say.value.trim();say.value='';if(t)lobbyEls.onSay(t);};
    chat.append(el('h2','','Chat'),lines,form);
    const body=el('div','net-scroll net-room');body.append(seats,note,setup,chat);
    const status=el('p','net-status'),start=button('net-primary','Spustit hru',()=>lobbyEls.onStart()),foot=el('footer','net-foot');foot.append(status,start);
    screen.replaceChildren(top,body,foot);
    lobbyEls={seats,note,levelBox,rules,lines,status,start,foot};
    open();
  }
  function renderSeats(s) {
    const mine=s.players.filter(p=>p.peer===s.peer),sig=JSON.stringify([s.players,s.humans.map(h=>h.name),s.maxPlayers]);
    if(sig===lastSeats||lobbyEls.seats.contains(document.activeElement)&&document.activeElement.tagName==='INPUT')return;lastSeats=sig;
    const nodes=[];
    for(let i=0;i<s.maxPlayers;i++) {
      const p=s.players[i],seat=el('div','net-seat');
      if(!p){seat.classList.add('free');seat.append(el('div','net-portrait'),el('span','net-seat-name','Volné místo'));
        // Two people at one keyboard: desktop only, a phone has one pair of thumbs.
        if(!phone&&s.humans.length<3&&s.players.length<s.maxPlayers&&i===s.players.length)seat.append(button('net-link','Přidat hráče na této klávesnici',()=>lobbyEls.onLocalPlayers(s.humans.length+1)));
        nodes.push(seat);continue;}
      const k=mine.indexOf(p),own=k>=0;
      seat.classList.toggle('own',own);seat.append(bulanek(p.colorIndex,i));
      if(own) {
        const taken=new Set(s.players.filter(o=>o!==p).map(o=>o.colorIndex));
        seat.append(nameInput(p.name,t=>lobbyEls.onHuman(k,{name:t})),swatches(p.colorIndex,taken,c=>lobbyEls.onHuman(k,{colorIndex:c})));
        if(s.info.rules?.play==='teams')seat.append(button('net-secondary',`Tým ${(p.team??0)+1}`,()=>lobbyEls.onHuman(k,{team:(p.team??0)?0:1})));
        if(!phone)seat.append(el('small','net-keys',keyHint(s.humans[k]?.keys)));
        if(k>0&&k===mine.length-1)seat.append(button('net-link','Odebrat',()=>lobbyEls.onLocalPlayers(s.humans.length-1)));
      } else {
        seat.append(el('span','net-seat-name',p.name),el('small','net-keys',s.info.rules?.play==='teams'?`Tým ${(p.team??0)+1}`:p.peer===0?'hostitel':'připojen'));
        if(s.role==='host')seat.append(button('net-link','Odebrat',()=>lobbyEls.onKick(p.peer)));
      }
      nodes.push(seat);
    }
    lobbyEls.seats.replaceChildren(...nodes);
  }
  function renderSetup(s) {
    const host=s.role==='host',sig=JSON.stringify([host,s.info.level,s.info.summary,s.info.rules]);if(sig===lastLevels)return;
    if(lobbyEls.rules.contains(document.activeElement)&&document.activeElement.tagName==='INPUT')return;lastLevels=sig;
    const all=levels();
    lobbyEls.levelBox.classList.toggle('guest',!host);
    lobbyEls.levelBox.replaceChildren(...all.filter(l=>host||l.key===s.info.level).map(l=>{
      const b=button('net-level','',()=>{if(host)lobbyEls.onLevel(l.key);});b.disabled=!host;b.setAttribute('aria-pressed',String(l.key===s.info.level));
      const im=el('img');im.src=l.src;im.alt='';b.append(im,el('span','',l.name));return b;}));
    if(!host){lobbyEls.rules.replaceChildren(el('p','net-summary',s.info.summary));return;}
    const {type,limit,weapons,play,bots,foes,fight}=s.info.rules,select=(label,value,options,onChange)=>{const w=el('label','net-field');w.append(el('span','',label));const e=el('select');for(const [v,t] of options){const o=el('option','',t);o.value=v;e.append(o);}e.value=value;e.onchange=()=>onChange(e.value);w.append(e);return w;};
    const unit={time:'Vteřin',hits:'Zásahů k výhře',lives:'Životů'}[type],[min,max]=ruleRanges[type];
    const number=el('label','net-field');number.append(el('span','',unit));const n=el('input');Object.assign(n,{type:'number',inputMode:'numeric',min,max,value:limit});n.onchange=()=>lobbyEls.onRules({limit:+n.value});number.append(n);
    lobbyEls.rules.replaceChildren(
      select('Hra',play,[['ffa','každý sám'],['teams','týmy'],['coop','kooperace']],v=>lobbyEls.onRules({play:v})),
      select('Hraje se',type,[['time','na čas'],['hits','na zásahy'],['lives','na životy']],v=>lobbyEls.onRules({type:v})),number,
      select('Zbraně',weapons,[['classic','všechny'],['shotgun','pouze brokovnice']],v=>lobbyEls.onRules({weapons:v})),
      select('Boti',String(bots),[0,1,2,3,4,5,6].map(n=>[String(n),n?String(n):'žádní']),v=>lobbyEls.onRules({bots:+v})),
      select('Boti se',foes,[['original','jen stojí'],['walk','procházejí'],['hunt','loví']],v=>lobbyEls.onRules({foes:v})),
      select('Po sobě',fight?'1':'0',[['1','střílí'],['0','nestřílí']],v=>lobbyEls.onRules({fight:v==='1'})));
  }
  function renderChat(s) {
    if(s.chat.length===lastChat)return;lastChat=s.chat.length;
    lobbyEls.lines.replaceChildren(...(s.chat.length?s.chat.slice(-60).map(t=>el('p','',t)):[el('p','net-empty','Tady si můžete napsat, než se začne.')]));
    lobbyEls.lines.scrollTop=lobbyEls.lines.scrollHeight;
  }
  function showLobby(s) {
    if(view!=='lobby'){view='lobby';hub=null;buildLobby(s);}else open();
    Object.assign(lobbyEls,{link:s.link,onHuman:s.onHuman,onLocalPlayers:s.onLocalPlayers,onLevel:s.onLevel,onRules:s.onRules,onSay:s.onSay,onKick:s.onKick,onStart:s.onStart});
    renderSeats(s);renderSetup(s);renderChat(s);
    const host=s.role==='host',enough=s.players.length>=2||s.alone;
    lobbyEls.start.hidden=!host;lobbyEls.start.disabled=!enough;
    lobbyEls.status.textContent=s.info.playing?'Právě se hraje kolo. Do dalšího se přidáte sami.':host?(enough?`Hráči: ${s.players.length} ze ${s.maxPlayers}. Spusťte hru, až budou všichni tady.`:'Zatím tu jste sami. Přidejte boty nebo pošlete kamarádům kód.'):'Hru spustí hostitel. Zatím si nastavte jméno a barvu.';
  }
  function open(){screen.hidden=false;fitKeyboard();if(!screen.contains(document.activeElement))screen.focus({preventScroll:true});}
  function hide(){screen.hidden=true;}
  return {showHub,setGames,setOnline,setOffline,notice,showLobby,hide};
}
